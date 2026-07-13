require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const compression = require('compression');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const winston = require('winston');

const { scrapeDomain } = require('./lib/scraper');
const { analyzeFootprint } = require('./lib/analyzer');
const { analyzeWorkforce } = require('./lib/workforce');
const { scourBusiness } = require('./lib/scourer');
const { getGA4Metrics } = require('./lib/ga');
const { scoutLocalProspects } = require('./lib/scouting');
const { generateAgentReply } = require('./lib/conversational_agent');
const { isSupabaseConfigured, insertRow } = require('./lib/supabase');

// Structured application logger (JSON in production, colorized in dev)
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.NODE_ENV === 'production'
    ? winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json())
    : winston.format.combine(winston.format.colorize(), winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.printf(({ timestamp, level, message, stack }) => `${timestamp} ${level} ${message}${stack ? '\n' + stack : ''}`)),
  transports: [new winston.transports.Console()]
});

// Boot validation — fail immediately if required env vars are missing
const REQUIRED_ENV = ['FIRECRAWL_API_KEY', 'GA4_PROPERTY_ID', 'GA4_MEASUREMENT_ID'];
const missingEnv = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length) {
  logger.error(`[BOOT] Missing required environment variables: ${missingEnv.join(', ')}`);
  logger.error('[BOOT] Server cannot start safely. Check your environment configuration.');
  process.exit(1);
}

// Sibling-folder path resolution — overridable so the container/cloud host can
// relocate the workspace without breaking relative `../` assumptions.
const REPO_ROOT = process.env.CONVERGENCE_ROOT
  ? path.resolve(process.env.CONVERGENCE_ROOT)
  : path.resolve(__dirname, '..');
const SOCIAL_AGENT_DIR = process.env.SOCIAL_AGENT_DIR
  ? path.resolve(process.env.SOCIAL_AGENT_DIR)
  : path.join(REPO_ROOT, 'aiwx-social-media-agent');
const ADMIN_DIST_DIR = process.env.ADMIN_DIST_DIR
  ? path.resolve(process.env.ADMIN_DIST_DIR)
  : path.join(REPO_ROOT, 'aiwx-admin-agent', 'dist');

for (const [label, dir] of [['SOCIAL_AGENT_DIR', SOCIAL_AGENT_DIR]]) {
  if (!fs.existsSync(dir)) {
    logger.warn(`[BOOT] ${label} does not exist at ${dir} — social publishing features will be unavailable.`);
  }
}

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3003;

// Behind a cloud load balancer / reverse proxy, trust the first hop so
// req.ip and the rate limiter see the real client address.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Body parser
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '2mb' }));

// HTTP security headers
app.use(helmet({ contentSecurityPolicy: false }));

// Structured HTTP request logging routed through Winston
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  stream: { write: (msg) => logger.info(msg.trim()) }
}));

// Response compression
app.use(compression());

// Strict Cache-Control and custom CORS headers middleware
const ALLOWED_ORIGINS = [
  'http://localhost:3003',
  'http://localhost:3000',
  'https://aiworxmiths.com',
  'https://www.aiworxmiths.com',
  // Extend at deploy time without a code change: comma-separated origins
  ...(process.env.CORS_ALLOWED_ORIGINS ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean) : [])
];

// Origin must match the allowlist exactly, or be a localhost/Lovable-hosted
// origin verified by hostname (not substring — blocks evil-lovable.attacker.com).
function isOriginAllowed(origin) {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  let host;
  try {
    host = new URL(origin).hostname;
  } catch (e) {
    return false;
  }
  if (host === 'localhost' || host === '127.0.0.1') return true;
  return /(^|\.)(lovable\.app|lovableproject\.com|lovable\.dev)$/.test(host);
}

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  const origin = req.headers.origin;
  if (origin && origin !== 'null' && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization,Accept,Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Rate limiting — global API ceiling plus tighter limits on expensive endpoints
const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_GLOBAL_PER_MIN, 10) || 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please slow down.' }
});

const auditLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please wait 60 seconds.' }
});

const scoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Scouting rate limit reached. Please wait.' }
});

const publishLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Publishing rate limit reached. Please wait before posting again.' }
});

app.use('/api/', globalApiLimiter);
app.use('/api/audit', auditLimiter);
app.use('/api/scout-prospects', scoutLimiter);
app.use('/api/publish-post', publishLimiter);
app.use('/api/outreach-send', publishLimiter);
app.use('/api/run-prospecting', publishLimiter);

// Configure Swagger JSDoc and Swagger UI spec
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AIWX SMB Auditor API',
      version: '1.1.0',
      description: 'Production-ready REST API for the SMB External Audit Engine & Workforce Planner',
      contact: {
        name: 'AiWorXmiths Support',
        url: 'https://aiworxmiths.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3003',
        description: 'Development Server'
      }
    ]
  },
  apis: ['./server.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));


// Serve static assets from public/ folder with HTML cache-busting headers
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));
// Mount the social media logs directory to serve execution screenshots
app.use('/logs', express.static(path.join(SOCIAL_AGENT_DIR, 'logs'), { dotfiles: 'deny' }));

// Serve the admin agent's production Vite build (if present) under /admin
if (fs.existsSync(ADMIN_DIST_DIR)) {
  app.use('/admin', express.static(ADMIN_DIST_DIR, { dotfiles: 'deny' }));
  logger.info(`[BOOT] Admin dashboard mounted at /admin from ${ADMIN_DIST_DIR}`);
} else {
  logger.warn(`[BOOT] Admin Vite build not found at ${ADMIN_DIST_DIR} — /admin not mounted. Run "npm run build" in aiwx-admin-agent.`);
}

// Serve visual assets from the social agent directory. SECURITY: the agent
// folder also holds session cookies, API credentials, and schedule state under
// config/ — those must never be reachable over HTTP, so only whitelisted asset
// extensions are served and sensitive paths are hard-blocked.
const SOCIAL_ASSET_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.html', '.css', '.ttf', '.woff', '.woff2', '.mp4', '.pdf']);
const SOCIAL_BLOCKED_PATH = /^\/(config|chrome_junction|temp_profile|__pycache__)(\/|$)|\.env|cookie|credential|\.pem|\.key$/i;

app.use('/', (req, res, next) => {
  const decodedPath = decodeURIComponent(req.path);
  if (decodedPath.startsWith('/api/') || decodedPath === '/health') {
    return next();
  }
  if (SOCIAL_BLOCKED_PATH.test(decodedPath)) {
    return res.status(404).json({ success: false, error: 'Not found.' });
  }
  if (!SOCIAL_ASSET_EXTENSIONS.has(path.extname(decodedPath).toLowerCase())) {
    return next();
  }
  return express.static(SOCIAL_AGENT_DIR, {
    dotfiles: 'deny',
    setHeaders: (res2, filePath) => {
      if (filePath.endsWith('.html')) {
        res2.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res2.setHeader('Pragma', 'no-cache');
        res2.setHeader('Expires', '0');
      }
    }
  })(req, res, next);
});

/**
 * Endpoint to fetch pre-configured sample domains for instant, gorgeous testing
 */
app.get('/api/sample-domains', (req, res) => {
  res.json({
    success: true,
    samples: [
      { domain: 'vintage-brew.com', label: 'Vintage Brew Co. (E-Commerce & Retail)', vertical: 'E-Commerce & Retail' },
      { domain: 'apex-consulting.org', label: 'Apex Global (Technology & SaaS)', vertical: 'Technology & SaaS' },
      { domain: 'smiles-dental.net', label: 'Smiles Clinic (Healthcare & Wellness)', vertical: 'Healthcare & Wellness' },
      { domain: 'vance-partners.com', label: 'Vance Advisory (Professional Services)', vertical: 'Professional Services' }
    ]
  });
});

/**
 * Endpoint to fetch social media posts library
 */
app.get('/api/posts-library', (req, res) => {
  try {
    const libraryPath = path.join(__dirname, 'public', 'posts_data.json');
    if (fs.existsSync(libraryPath)) {
      const data = fs.readFileSync(libraryPath, 'utf8');
      return res.json({ success: true, posts: JSON.parse(data) });
    }
    return res.status(404).json({ error: 'Posts library not found.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint to fetch GA4 Measurement configuration
 */
app.get('/api/analytics-config', (req, res) => {
  if (!process.env.GA4_MEASUREMENT_ID) {
    return res.status(503).json({ success: false, error: 'GA4_MEASUREMENT_ID is not configured on this server.' });
  }
  res.json({
    success: true,
    measurementId: process.env.GA4_MEASUREMENT_ID
  });
});

const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

function withTimeout(promise, ms = 30000) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`External request timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

/**
 * Primary Audit Endpoint
 */
app.post('/api/audit', async (req, res) => {
  const { domain, apiKey } = req.body;

  if (!domain || !DOMAIN_REGEX.test(domain.trim())) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a valid target domain name (e.g. example.com).'
    });
  }

  try {
    console.log(`[Server] Audit request received for domain: ${domain}`);
    
    // 1. Scrape domain (live Firecrawl only, simulation disabled)
    const activeApiKey = apiKey || process.env.FIRECRAWL_API_KEY || null;
    if (!activeApiKey || activeApiKey.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Firecrawl API key is required. Simulation mode is disabled on this server.'
      });
    }
    
    const scrapedData = await withTimeout(scrapeDomain(domain, activeApiKey), 30000);
    
    // 2. Scour the web for regulatory filings and financial data
    const teamNames = (scrapedData.rawTeamData || []).map(m => m.name);
    const scourerData = await scourBusiness(
      scrapedData.domain, 
      scrapedData.businessName, 
      scrapedData.vertical, 
      activeApiKey,
      teamNames
    );

    // 3. Perform SWOT and Technical Infrastructure Analysis
    const analyzerData = analyzeFootprint(scrapedData);
    
    // 4. Formulate Workforce AI-HITL Upskilling blueprint
    const workforceData = analyzeWorkforce(scrapedData);

    // 5. Synthesize unified corporate audit package
    const auditPackage = {
      success: true,
      timestamp: new Date().toISOString(),
      domain: scrapedData.domain,
      businessName: scrapedData.businessName,
      vertical: scrapedData.vertical,
      isSimulated: !activeApiKey,
      scrapedData: {
        technologies: scrapedData.technologies,
        subdomains: scrapedData.subdomains,
        metaData: scrapedData.metaData,
        scrapedPages: scrapedData.scrapedPages,
        firewallAudit: scrapedData.firewallAudit
      },
      scourerData,
      analyzerData,
      workforceData
    };

    // Save completed audit package permanently to disk
    try {
      const fs = require('fs');
      const path = require('path');
      const cacheDir = path.join(__dirname, 'audits_cache');
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      const safeFilename = scrapedData.domain.replace(/[^a-zA-Z0-9.-]/g, '_') + '.json';
      fs.writeFileSync(path.join(cacheDir, safeFilename), JSON.stringify(auditPackage, null, 2), 'utf-8');
      console.log(`[Server] Audit query permanently saved to cache disk: ${safeFilename}`);
    } catch (fsErr) {
      console.error(`[Server] Failed to write audit package cache file:`, fsErr);
    }

    res.json(auditPackage);

  } catch (error) {
    console.error(`[Server] Audit process failed for domain ${domain}:`, error);
    res.status(500).json({
      success: false,
      error: `Audit failed: ${error.message || 'Internal process error.'}`
    });
  }
});

/**
 * Headless Browser Direct Publish Endpoint
 */
const { exec, execFile } = require('child_process');
app.post('/api/publish-post', (req, res) => {
  const { platform, text, image, dryRun } = req.body;

  if (!platform || !text) {
    return res.status(400).json({
      success: false,
      error: 'Platform and text content are required.'
    });
  }

  console.log(`[Server] Social media publish request: platform=${platform}, dryRun=${dryRun || false}`);

  // Resolve agent directory and run script using execFile to handle multiline text and quotes safely
  const agentDir = SOCIAL_AGENT_DIR;

  let scriptToRun = 'publish_api.js';
  if (platform.toLowerCase() === 'linkedin') {
    scriptToRun = 'publish_headless.js';
  }
  
  const args = [scriptToRun, '--platform', platform, '--text', text];
  if (image) {
    args.push('--image', image);
  }
  if (dryRun) {
    args.push('--dry-run');
  }

  execFile('node', args, { cwd: agentDir }, (error, stdout, stderr) => {
    console.log(`[Server] publish_api stdout:\n${stdout}`);
    if (stderr) console.error(`[Server] publish_api stderr:\n${stderr}`);

    // Parse JSON response from stdout if present
    let result = { success: false, log: stdout };
    const lines = stdout.split('\n');
    for (let line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.hasOwnProperty('success')) {
            result = { ...parsed, log: stdout };
            break;
          }
        } catch (e) {
          // ignore parsing error
        }
      }
    }

    if (error || !result.success) {
      return res.status(500).json({
        success: false,
        error: error ? error.message : (result.error || 'Direct posting execution failed.'),
        log: stdout,
        stderr: stderr
      });
    }

    res.json(result);
  });
});

/**
 * Campaign Scheduler endpoints and background checker
 */
const SCHEDULE_FILE = path.join(SOCIAL_AGENT_DIR, 'config', 'campaign_schedule.json');
const AGENT_DIR = SOCIAL_AGENT_DIR;

function parseScheduledTime(dateStr, timeStr) {
  try {
    let timeOnly = timeStr.replace(' EST', '').replace(' EDT', '').trim();
    let [time, modifier] = timeOnly.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') {
      hours = '00';
    }
    if (modifier === 'PM') {
      hours = parseInt(hours, 10) + 12;
    }
    const formattedTime = `${String(hours).padStart(2, '0')}:${minutes}:00`;
    return new Date(`${dateStr}T${formattedTime}`);
  } catch (e) {
    return new Date(0);
  }
}

function sendNotification(title, message) {
  // Desktop toast notifications only exist on the Windows dev host; in a Linux
  // container we log the event instead so cloud log drains still capture it.
  if (process.platform !== 'win32') {
    logger.info(`[Notification] ${title}: ${message}`);
    return;
  }
  // Use execFile to avoid command line argument parsing issue with quotes and spaces on Windows
  execFile('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', 'send_notification.ps1', title, message], { cwd: AGENT_DIR }, (err) => {
    if (err) logger.error(`[Server] Failed to trigger notification: ${err.message}`);
  });
}

// Background scheduler check loop running every 60 seconds.
// Crash-safe: any error inside a tick is caught and counted; after repeated
// consecutive failures the loop backs off (skips ticks) instead of hammering a
// broken filesystem/DB, then automatically recovers on the next success.
let schedulerConsecutiveFailures = 0;
let schedulerSkipUntil = 0;

function schedulerTick() {
  if (Date.now() < schedulerSkipUntil) return;
  try {
    runSchedulerScan();
    schedulerConsecutiveFailures = 0;
  } catch (e) {
    schedulerConsecutiveFailures++;
    const backoffMs = Math.min(60000 * Math.pow(2, schedulerConsecutiveFailures - 1), 15 * 60 * 1000);
    schedulerSkipUntil = Date.now() + backoffMs;
    logger.error(`[Scheduler] Tick failed (${schedulerConsecutiveFailures} consecutive): ${e.message}. Backing off ${Math.round(backoffMs / 1000)}s.`);
  }
}

function runSchedulerScan() {
  if (!fs.existsSync(SCHEDULE_FILE)) return;

  let data;
  try {
    data = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
  } catch (e) {
    console.error('[Server] Failed to parse schedule file in loop:', e);
    return;
  }

  if (!data.schedulerActive) return;
  console.log(`[Scheduler] Scanning campaign queue of ${data.posts ? data.posts.length : 0} posts...`);

  const now = new Date();
  let updated = false;

  for (let post of data.posts) {
    if (post.status !== 'APPROVED') continue;
    if (post.platform.toLowerCase() === 'linkedin') continue;

    const scheduledTime = parseScheduledTime(post.date, post.time);
    
    if (scheduledTime <= now) {
      console.log(`[Scheduler] Post ${post.id} is due. Starting direct publish...`);
      post.status = 'PUBLISHING';
      updated = true;

      // Save immediately to prevent duplicate runs
      fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(data, null, 2));

      sendNotification('AiWorXmiths Campaign Scheduler', `Posting Post ${post.id.replace('post_', '')} to ${post.platform}...`);

      const args = ['publish_api.js', '--platform', post.platform.toLowerCase(), '--text', post.text];
      if (post.image) {
        args.push('--image', post.image);
      }
      
      execFile('node', args, { cwd: AGENT_DIR }, (err, stdout, stderr) => {
        console.log(`[Scheduler] publish_api output for ${post.id}:\n${stdout}`);
        
        let freshData;
        try {
          freshData = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
        } catch (e) {
          freshData = data;
        }

        const freshPost = freshData.posts.find(p => p.id === post.id);
        if (!freshPost) return;

        let result = { success: false };
        const lines = stdout.split('\n');
        for (let line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
              const parsed = JSON.parse(trimmed);
              if (parsed.hasOwnProperty('success')) {
                result = parsed;
                break;
              }
            } catch (e) {}
          }
        }

        if (err || !result.success) {
          console.error(`[Scheduler] Post ${freshPost.id} failed:`, err || (result.error || 'Browser execution failed.'));
          freshPost.status = 'FAILED';
          freshPost.error = err ? err.message : (result.error || 'Browser execution failed.');
          freshPost.logs = stdout + '\n' + stderr;
          if (result.screenshot) freshPost.screenshot = result.screenshot;

          sendNotification('AiWorXmiths Campaign Scheduler', `❌ Failed to publish Post ${freshPost.id.replace('post_', '')} to ${freshPost.platform}!`);
        } else {
          console.log(`[Scheduler] Post ${freshPost.id} published successfully!`);
          freshPost.status = 'PUBLISHED';
          freshPost.logs = stdout;
          if (result.screenshot) freshPost.screenshot = result.screenshot;

          sendNotification('AiWorXmiths Campaign Scheduler', `✓ Post ${freshPost.id.replace('post_', '')} published successfully to ${freshPost.platform}!`);
        }

        fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(freshData, null, 2));
      });
    }
  }

  if (updated) {
    fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(data, null, 2));
  }
}

setInterval(schedulerTick, 60000);

// Persisted Activity Alerts Database Helpers
const ALERTS_FILE = path.join(SOCIAL_AGENT_DIR, 'config', 'activity_alerts.json');

function loadAlerts() {
  if (!fs.existsSync(ALERTS_FILE)) {
    const initialAlerts = [
      {
        id: "alert_01",
        platform: "linkedin",
        userName: "Sarah Jenkins",
        userHandle: "Sarah Jenkins (Operations Director, Apex Legal)",
        avatar: "african_american_female_lawyer.png",
        postId: "post_01",
        postTitle: "The Silent Cost of Disconnected Operations",
        commentText: "This upskilling approach is exactly what we need. How do we get started with the Operational Capacity Audit?",
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
        status: "UNRESOLVED",
        aiDraft: "Hello Sarah! Thanks for reaching out. We would love to map your workflows. You can schedule a Free Scoping Diagnostics call directly at https://aiworxmiths.com/services. We focus on upskilling your existing staff into Growth Coordinators to manage these systems.",
        replyText: null,
        repliedAt: null
      },
      {
        id: "alert_02",
        platform: "instagram",
        userName: "Dr. Keith Miller",
        userHandle: "@miller_dental_nyc",
        avatar: "african_american_male_advisor.png",
        postId: "post_03",
        postTitle: "Stop Copy-Pasting: Connecting Your Billing and CRM",
        commentText: "Does your CRM to QuickBooks ledger sync support HIPAA compliance for patient intake?",
        timestamp: new Date(Date.now() - 1800000).toISOString(), // 30 mins ago
        status: "UNRESOLVED",
        aiDraft: "Hi Dr. Miller! Yes, absolutely. Our containerized integrations run inside your private VPC (AWS/GCP) using Row-Level Security (RLS) and Key Management Service (KMS) encryption to ensure complete HIPAA compliance. Your data never leaves your secure cloud.",
        replyText: null,
        repliedAt: null
      },
      {
        id: "alert_03",
        platform: "threads",
        userName: "Marcus Vance",
        userHandle: "@marcus_vance",
        avatar: "diverse_male_entrepreneur_1779798785119.png",
        postId: "post_02",
        postTitle: "Sustainable AI Scale: Countering Hype",
        commentText: "I like the idea of flat-fee hosting instead of per-seat licensing. It’s hard to predict SaaS bills as we grow.",
        timestamp: new Date(Date.now() - 900000).toISOString(), // 15 mins ago
        status: "UNRESOLVED",
        aiDraft: "Thanks Marcus! That’s the exact margin drain we resolve. By deploying the Operations Administrator container natively in your own cloud, we eliminate per-seat SaaS taxes, capping hosting at flat, predictable rates (~$35/month).",
        replyText: null,
        repliedAt: null
      }
    ];
    // Ensure config directory exists
    const configDir = path.dirname(ALERTS_FILE);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(ALERTS_FILE, JSON.stringify(initialAlerts, null, 2));
    return initialAlerts;
  }
  try {
    return JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveAlerts(alerts) {
  if (alerts.length > 100) {
    const overflow = alerts.splice(100);
    try {
      const logsDir = path.resolve(__dirname, 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      const date = new Date().toISOString().split('T')[0];
      const archivePath = path.join(logsDir, `alerts-${date}.json`);
      fs.appendFileSync(archivePath, JSON.stringify(overflow, null, 2) + '\n', 'utf8');
      console.log(`[Alerts] Archived ${overflow.length} overflow alert(s) to: ${archivePath}`);
    } catch (archiveErr) {
      console.error('[Alerts] Failed to archive overflow alerts:', archiveErr);
    }
  }
  fs.writeFileSync(ALERTS_FILE, JSON.stringify(alerts, null, 2));
}

// Real daily prospecting agent scheduler (runs between 12:00 PM and 12:30 PM EST)
let lastProspectRunDate = null;
let prospectingSchedulerEnabled = false; // Paused per user request

setInterval(() => {
  if (!prospectingSchedulerEnabled) return;
  const now = new Date();
  
  // Convert current time to Eastern Time (EST/EDT)
  const estString = now.toLocaleString("en-US", { timeZone: "America/New_York" });
  const estDate = new Date(estString);
  const estHour = estDate.getHours();
  const estMinute = estDate.getMinutes();
  const todayDateStr = estDate.toISOString().split('T')[0];

  // Check if we are inside the 12:00 PM - 12:30 PM EST window
  const isTimeWindow = (estHour === 12 && estMinute >= 0 && estMinute <= 30);

  if (isTimeWindow && lastProspectRunDate !== todayDateStr) {
    console.log(`[Prospecting Scheduler] Starting daily outbound prospecting run at ${estHour}:${estMinute} EST...`);
    
    // Rotate target verticals daily
    const verticals = ['Healthcare', 'Law', 'SaaS', 'Retail', 'Contractors', 'Dentists'];
    const dayOfYear = Math.floor((estDate - new Date(estDate.getFullYear(), 0, 0)) / 86400000);
    const targetVertical = verticals[dayOfYear % verticals.length];
    
    console.log(`[Prospecting Scheduler] Selected Vertical: ${targetVertical}`);

    execFile('node', ['prospecting_agent.js', '--platform', 'linkedin', '--vertical', targetVertical], { cwd: SOCIAL_AGENT_DIR }, (error, stdout, stderr) => {
      if (error) {
        logger.error(`[-] Prospecting run failed: ${error.message}`);
        return;
      }
      logger.info(`[+] Prospecting run completed successfully:\n${stdout}`);
      lastProspectRunDate = todayDateStr; // Set lock for today
    });
  }
}, 5 * 60 * 1000); // Check every 5 minutes

// API Endpoint to manually trigger the prospecting agent
app.post('/api/run-prospecting', (req, res) => {
  const { platform, vertical, dryRun } = req.body;
  const targetPlatform = platform || 'linkedin';
  const targetVertical = vertical || 'Healthcare';
  const isDryRun = dryRun !== false; // Default to dry-run safety
  
  console.log(`[API Prospecting] Manual trigger received. Platform: ${targetPlatform}, Vertical: ${targetVertical}, Dry-Run: ${isDryRun}`);

  // execFile with an args array — request values are never interpolated into a shell string
  const prospectArgs = ['prospecting_agent.js', '--platform', String(targetPlatform), '--vertical', String(targetVertical)];
  if (isDryRun) prospectArgs.push('--dry-run');

  execFile('node', prospectArgs, { cwd: SOCIAL_AGENT_DIR }, (error, stdout, stderr) => {
    if (error) {
      logger.error(`[-] Manual prospecting failed: ${error.message}`);
      return res.status(500).json({ success: false, error: error.message });
    }
    logger.info(`[+] Manual prospecting completed successfully:\n${stdout}`);
    res.json({ success: true, output: stdout });
  });
});

// API Endpoints for Activity Alerts
app.get('/api/activity-alerts', (req, res) => {
  try {
    const alerts = loadAlerts();
    res.json({ success: true, alerts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Failed to load alerts.' });
  }
});

app.post('/api/activity-alerts/resolve', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, error: 'Alert ID is required.' });

  try {
    const alerts = loadAlerts();
    const alert = alerts.find(a => a.id === id);
    if (alert) {
      alert.status = 'RESOLVED';
      saveAlerts(alerts);
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Alert not found.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update alert status.' });
  }
});

app.post('/api/generate-reply', (req, res) => {
  const { commentId } = req.body;
  if (!commentId) return res.status(400).json({ success: false, error: 'Comment ID is required.' });

  try {
    const alerts = loadAlerts();
    const alert = alerts.find(a => a.id === commentId);
    if (alert) {
      res.json({ success: true, replyDraft: alert.aiDraft });
    } else {
      res.status(404).json({ success: false, error: 'Comment alert not found.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to generate reply.' });
  }
});

app.post('/api/post-reply', (req, res) => {
  const { commentId, replyText } = req.body;
  if (!commentId || !replyText) {
    return res.status(400).json({ success: false, error: 'Comment ID and reply copy are required.' });
  }

  try {
    const alerts = loadAlerts();
    const alert = alerts.find(a => a.id === commentId);
    if (alert) {
      alert.status = 'REPLIED';
      alert.replyText = replyText;
      alert.repliedAt = new Date().toISOString();
      saveAlerts(alerts);
      
      console.log(`[Server] Response mock-posted back to ${alert.platform}: "${replyText}"`);
      sendNotification('AiWorXmiths Campaign Manager', `✓ Successfully posted response to ${alert.userName} on ${alert.platform}!`);

      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Comment alert not found.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to post reply on server.' });
  }
});

// Endpoint for simulated analytics time-series charts
app.get('/api/simulated-analytics', (req, res) => {
  const dates = [];
  const clicksData = { linkedin: [], threads: [], instagram: [], facebook: [] };
  const conversionData = [];
  
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    dates.push(dateStr);
    
    // Generate random but growing clicks over the last week
    const base = 22 + (6 - i) * 11;
    clicksData.linkedin.push(base + Math.floor(Math.random() * 8));
    clicksData.threads.push(Math.floor(base * 0.7) + Math.floor(Math.random() * 6));
    clicksData.instagram.push(Math.floor(base * 0.5) + Math.floor(Math.random() * 5));
    clicksData.facebook.push(Math.floor(base * 0.3) + Math.floor(Math.random() * 4));
    
    conversionData.push(Math.floor(base * 0.12) + (Math.random() > 0.6 ? 1 : 0));
  }
  
  res.json({
    success: true,
    labels: dates,
    clicks: clicksData,
    conversions: conversionData
  });
});


// Endpoint to schedule the entire campaign
app.post('/api/schedule-campaign', (req, res) => {
  const { posts } = req.body;
  if (!posts || !Array.isArray(posts)) {
    return res.status(400).json({ success: false, error: 'Valid posts array is required.' });
  }

  // Preserve existing schedulerActive state if present
  let active = false;
  if (fs.existsSync(SCHEDULE_FILE)) {
    try {
      const existing = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
      active = existing.schedulerActive || false;
    } catch (e) {}
  }

  const scheduleData = {
    schedulerActive: active,
    posts: posts.map(p => {
      let status = p.status || 'APPROVED';
      if (status === 'PENDING') {
        status = 'APPROVED';
      }
      return {
        ...p,
        status
      };
    })
  };

  try {
    fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(scheduleData, null, 2));
    res.json({ success: true, schedulerActive: active });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to write schedule file.' });
  }
});

// Endpoint to get the scheduler status and queue
app.get('/api/scheduler-status', (req, res) => {
  if (!fs.existsSync(SCHEDULE_FILE)) {
    return res.json({ success: true, schedulerActive: false, posts: [] });
  }

  try {
    const data = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
    res.json({ success: true, schedulerActive: data.schedulerActive || false, posts: data.posts || [] });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to read schedule file.' });
  }
});

// Endpoint to toggle scheduler state
app.post('/api/toggle-scheduler', (req, res) => {
  const { active } = req.body;
  if (active === undefined) {
    return res.status(400).json({ success: false, error: 'Active toggle state is required.' });
  }

  if (!fs.existsSync(SCHEDULE_FILE)) {
    return res.status(400).json({ success: false, error: 'Campaign schedule has not been set yet. Please schedule posts first.' });
  }

  try {
    const data = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
    data.schedulerActive = active;
    fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(data, null, 2));
    
    sendNotification('AiWorXmiths Campaign Scheduler', `Campaign Auto-Scheduler has been turned ${active ? 'ON' : 'OFF'}.`);
    
    res.json({ success: true, schedulerActive: active });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to update schedule status.' });
  }
});

// Endpoint to update a single post status in the schedule
app.post('/api/update-post-status', (req, res) => {
  const { id, status } = req.body;
  if (!id || !status) {
    return res.status(400).json({ success: false, error: 'Post ID and status are required.' });
  }

  if (!fs.existsSync(SCHEDULE_FILE)) {
    return res.status(400).json({ success: false, error: 'Campaign schedule has not been set yet.' });
  }

  try {
    const data = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
    let updated = false;

    if (data.posts && Array.isArray(data.posts)) {
      data.posts.forEach(post => {
        const baseId = post.id.split('_').slice(0, 2).join('_');
        if (baseId === id || post.id === id) {
          post.status = status;
          updated = true;
        }
      });
    }

    if (updated) {
      fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(data, null, 2));
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Post not found in schedule.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update post status on server.' });
  }
});

// Endpoint to update a single post text and/or image in the schedule (real-time sync)
app.post('/api/update-post', (req, res) => {
  const { id, text, image } = req.body;
  if (!id || text === undefined) {
    return res.status(400).json({ success: false, error: 'Post ID and text content are required.' });
  }

  if (!fs.existsSync(SCHEDULE_FILE)) {
    return res.status(400).json({ success: false, error: 'Campaign schedule has not been set yet.' });
  }

  try {
    const data = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
    let updated = false;

    if (data.posts && Array.isArray(data.posts)) {
      data.posts.forEach(post => {
        const baseId = post.id.split('_').slice(0, 2).join('_');
        if (baseId === id || post.id === id) {
          post.text = text;
          if (image !== undefined) post.image = image;
          updated = true;
        }
      });
    }

    if (updated) {
      fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(data, null, 2), 'utf8');
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Post not found in schedule.' });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Endpoint to retrieve and parse the local markdown posts library
app.get('/api/posts-library', (req, res) => {
  const libraryPath = path.join(SOCIAL_AGENT_DIR, 'social_media_posts_library.md');
  if (!fs.existsSync(libraryPath)) {
    return res.status(404).json({ success: false, error: 'Markdown posts library not found.' });
  }

  try {
    const content = fs.readFileSync(libraryPath, 'utf8');
    const activeContent = content.split(/## 📦 Archived Product/)[0];
    const postBlocks = activeContent.split(/### Post (\d+):/);
    
    if (postBlocks.length < 2) {
      return res.json({ success: true, posts: [] });
    }

    const parsedPosts = [];
    const monthMap = { "Jan": "January", "Feb": "February", "Mar": "March", "Apr": "April", "May": "May", "Jun": "June", "Jul": "July", "Aug": "August", "Sep": "September", "Oct": "October", "Nov": "November", "Dec": "December" };
    const monthNumMap = { "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04", "May": "05", "Jun": "06", "Jul": "07", "Aug": "08", "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12" };

    for (let i = 1; i < postBlocks.length; i += 2) {
      const postNum = parseInt(postBlocks[i], 10);
      const body = postBlocks[i+1];
      
      const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) continue;
      
      const titleLine = lines[0];
      const titleParts = titleLine.split(" - ");
      const datePart = titleParts[0].trim();
      const timePart = titleParts[1] ? titleParts[1].trim() : "10:00 AM EST";
      const titlePart = titleParts[2] ? titleParts[2].trim() : "Untitled Post";
      
      const dateWords = datePart.split(/\s+/);
      const monthAbbrev = dateWords[1];
      const dayVal = parseInt(dateWords[2], 10);
      const monthName = monthMap[monthAbbrev] || "June";
      const monthNum = monthNumMap[monthAbbrev] || "06";
      const yyyymmdd = `2026-${monthNum}-${String(dayVal).padStart(2, '0')}`;
      
      let campaign = "consultancy_sprints";
      let campaignMatch = body.match(/\*\s+\*\*Campaign:\*\*\s+`(.*?)`|\*\s+\*\*Campaign:\*\*\s+(.*)/);
      if (campaignMatch) campaign = (campaignMatch[1] || campaignMatch[2]).trim();
      
      let type = "AI Strategy & Consulting";
      let typeMatch = body.match(/\*\s+\*\*Content Type \/ Pillar:\*\*\s+(.*)/);
      if (typeMatch) {
        type = typeMatch[1].trim().replace(/`/g, '');
      } else {
        let labelMatch = body.match(/\*\s+\*\*Campaign Label:\*\*\s+`(.*?)`|\*\s+\*\*Campaign Label:\*\*\s+(.*)/);
        if (labelMatch) type = (labelMatch[1] || labelMatch[2]).trim().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      }
      
      let image = "black_female_founder_consultant.png";
      let imgMatch = body.match(/\*\s+\*\*Visual Asset:\*\*\s+`(.*?)`|\*\s+\*\*Visual Asset:\*\*\s+(.*)/);
      if (imgMatch) image = (imgMatch[1] || imgMatch[2]).trim();
      
      const sections = body.split('#### 📝 ');
      const extractCopy = (platformHeader) => {
        const sec = sections.find(s => s.trim().startsWith(platformHeader));
        if (!sec) return "";
        const lines = sec.split('\n');
        return lines.slice(1)
          .map(l => l.trim())
          .filter(l => l.startsWith('>'))
          .map(l => l.replace(/^>\s?/, ''))
          .join('\n').trim();
      };
      
      const linkedin = extractCopy("LinkedIn Copy");
      const threads = extractCopy("Threads Copy");
      const instagram = extractCopy("Instagram Slides");
      const blog = extractCopy("Blog Post");
      
      const debugObj = {
        id: `post_${String(postNum).padStart(2, '0')}`,
        week: String(Math.floor((postNum - 1) / 3) + 1),
        date: yyyymmdd,
        dayNum: dayVal,
        month: monthName,
        campaign: campaign,
        type: type,
        title: titlePart,
        image: image,
        imgAlt: `${titlePart} visual representation.`,
        status: [2, 5, 8, 11, 14, 17].includes(postNum) ? "PENDING" : "APPROVED",
        linkedin: linkedin,
        threads: threads,
        instagram: instagram,
        blog: blog,
        comments: []
      };
      
      parsedPosts.push(debugObj);
    }
    
    res.json({ success: true, posts: parsedPosts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Failed to parse library.' });
  }
});

const LOCAL_ANALYTICS_FILE = path.resolve(__dirname, 'config/local_analytics.json');

function loadLocalAnalytics() {
  if (fs.existsSync(LOCAL_ANALYTICS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(LOCAL_ANALYTICS_FILE, 'utf8'));
    } catch (e) {
      return { pageviews: [], events: [] };
    }
  }
  return { pageviews: [], events: [] };
}

function saveLocalAnalytics(data) {
  const dir = path.dirname(LOCAL_ANALYTICS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LOCAL_ANALYTICS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Endpoint to track custom analytics events locally (clickthrough, landing pageviews)
app.post('/api/track-event', (req, res) => {
  const { type, campaign, source, medium, label, value } = req.body;
  
  try {
    const analyticsData = loadLocalAnalytics();
    const newEvent = {
      timestamp: new Date().toISOString(),
      type,
      campaign: campaign || '(not set)',
      source: source || '(not set)',
      medium: medium || '(not set)',
      label: label || '',
      value: Number(value) || 1
    };
    
    if (type === 'pageview') {
      analyticsData.pageviews.push(newEvent);
    } else {
      analyticsData.events.push(newEvent);
    }
    
    saveLocalAnalytics(analyticsData);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint to track custom analytics events in batch
app.post('/api/track-events-batch', (req, res) => {
  const { events } = req.body;
  if (!events || !Array.isArray(events)) {
    return res.status(400).json({ success: false, error: 'Events array is required.' });
  }

  try {
    const analyticsData = loadLocalAnalytics();
    events.forEach(e => {
      const newEvent = {
        timestamp: e.timestamp || new Date().toISOString(),
        type: e.type,
        campaign: e.campaign || '(not set)',
        source: e.source || '(not set)',
        medium: e.medium || '(not set)',
        label: e.label || '',
        value: Number(e.value) || 1
      };
      if (newEvent.type === 'pageview') {
        analyticsData.pageviews.push(newEvent);
      } else {
        analyticsData.events.push(newEvent);
      }
    });

    saveLocalAnalytics(analyticsData);
    res.json({ success: true, count: events.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint to fetch real Google Analytics 4 performance metrics merged with local logs
app.get('/api/analytics', async (req, res) => {
  try {
    // 1. Process local analytics logs
    const local = loadLocalAnalytics();
    
    // Group local views (clicks) and cta events (conversions) by campaign/source
    const campaignsMap = {};
    
    // Pageviews represent clicks on campaign links
    local.pageviews.forEach(pv => {
      const campKey = `${pv.campaign} (${pv.source})`;
      if (!campaignsMap[campKey]) {
        campaignsMap[campKey] = { campaign: campKey, clicks: 0, conversions: 0 };
      }
      campaignsMap[campKey].clicks++;
    });
    
    // Events of type cta_click represent conversions
    local.events.forEach(ev => {
      if (ev.type && ev.type.startsWith('cta_click')) {
        const campKey = `${ev.campaign} (${ev.source})`;
        if (!campaignsMap[campKey]) {
          campaignsMap[campKey] = { campaign: campKey, clicks: 0, conversions: 0 };
        }
        campaignsMap[campKey].conversions++;
      }
    });
    
    const localCampaignsList = Object.values(campaignsMap).map(c => {
      const ctrVal = c.clicks > 0 ? ((c.conversions / c.clicks) * 100).toFixed(1) + '%' : '0.0%';
      return {
        campaign: c.campaign,
        clicks: c.clicks,
        ctr: ctrVal,
        conversions: c.conversions
      };
    });

    let totalLocalClicks = local.pageviews.length;
    let totalLocalConversions = local.events.filter(e => e.type && e.type.startsWith('cta_click')).length;
    let totalLocalImpressions = totalLocalClicks * 15 + Math.floor(Math.random() * 5);
    let localCtr = totalLocalClicks > 0 ? ((totalLocalConversions / totalLocalClicks) * 100).toFixed(2) + '%' : '0.00%';
    
    let summary = {
      impressions: totalLocalImpressions,
      clicks: totalLocalClicks,
      ctr: localCtr,
      conversions: totalLocalConversions
    };
    
    let campaigns = localCampaignsList;
    let ga4Connected = false;

    // Calculate trend from local pageviews
    const trendMap = {};
    local.pageviews.forEach(pv => {
      const dateStr = pv.timestamp.split('T')[0];
      trendMap[dateStr] = (trendMap[dateStr] || 0) + 1;
    });

    const last5Days = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      last5Days.push({ date: dStr, clicks: trendMap[dStr] || 0 });
    }

    // Calculate breakdown from local pageviews
    const breakdownMap = { linkedin: 0, facebook: 0, instagram: 0, threads: 0 };
    local.pageviews.forEach(pv => {
      const src = (pv.source || '').toLowerCase();
      if (src.includes('linkedin')) breakdownMap.linkedin++;
      else if (src.includes('facebook')) breakdownMap.facebook++;
      else if (src.includes('instagram')) breakdownMap.instagram++;
      else if (src.includes('threads')) breakdownMap.threads++;
    });

    // 2. Try fetching real GA4 property metrics
    try {
      const ga4 = await getGA4Metrics();
      if (ga4 && ga4.success) {
        ga4Connected = true;
        summary.impressions += ga4.summary.impressions;
        summary.clicks += ga4.summary.clicks;
        summary.conversions += ga4.summary.conversions;
        summary.ctr = summary.clicks > 0 ? ((summary.conversions / summary.clicks) * 100).toFixed(2) + '%' : '0.00%';
        
        // Merge campaigns list
        const mergedMap = {};
        campaigns.forEach(c => {
          mergedMap[c.campaign] = c;
        });
        
        ga4.campaigns.forEach(c => {
          if (mergedMap[c.campaign]) {
            mergedMap[c.campaign].clicks += c.clicks;
            mergedMap[c.campaign].conversions += c.conversions;
            mergedMap[c.campaign].ctr = mergedMap[c.campaign].clicks > 0 
              ? ((mergedMap[c.campaign].conversions / mergedMap[c.campaign].clicks) * 100).toFixed(1) + '%'
              : '0.0%';
          } else {
            mergedMap[c.campaign] = c;
          }

          // Merge GA4 clicks into platform breakdown
          const lowerCamp = c.campaign.toLowerCase();
          if (lowerCamp.includes('linkedin')) breakdownMap.linkedin += c.clicks;
          else if (lowerCamp.includes('facebook')) breakdownMap.facebook += c.clicks;
          else if (lowerCamp.includes('instagram')) breakdownMap.instagram += c.clicks;
          else if (lowerCamp.includes('threads')) breakdownMap.threads += c.clicks;
        });
        
        campaigns = Object.values(mergedMap);
      }
    } catch (gaError) {
      console.log('[Server] GA4 property fetch bypassed (using local logs fallback):', gaError.message);
    }

    const breakdown = Object.keys(breakdownMap).map(k => ({ platform: k, clicks: breakdownMap[k] }));
    const trend = last5Days;

    res.json({
      success: true,
      ga4Connected,
      summary,
      campaigns,
      trend,
      breakdown
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint to dynamically generate monthly posts based on a user's prompt brief
app.post('/api/generate-monthly-posts', (req, res) => {
  const { month, brief } = req.body;
  if (!month || !brief) {
    return res.status(400).json({ success: false, error: 'Please provide both target month and campaign brief.' });
  }

  try {
    console.log(`[Server] Generating posts for ${month} based on brief: ${brief.substring(0, 80)}...`);
    
    // 1. Calculate Tue/Thu/Fri dates for the target month in 2026
    const monthsMap = {
      "August": { num: 7, days: 31 },
      "September": { num: 8, days: 30 },
      "October": { num: 9, days: 31 }
    };
    const mData = monthsMap[month] || { num: 7, days: 31 };
    
    const dates = [];
    let d = new Date(2026, mData.num, 1);
    while (dates.length < 6 && d.getMonth() === mData.num) {
      if (d.getDay() === 2 || d.getDay() === 4 || d.getDay() === 5) {
        dates.push(new Date(d));
      }
      d.setDate(d.getDate() + 1);
    }
    
    const formatDate = (dateObj) => {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${days[dateObj.getDay()]} ${months[dateObj.getMonth()]} ${dateObj.getDate()}`;
    };

    // Determine vertical from brief keywords
    let vertical = "small businesses";
    let clientTerm = "customers";
    let workflowIcon = "⚙️";
    if (/dent(al|ist)/i.test(brief)) {
      vertical = "dental practices";
      clientTerm = "patients";
      workflowIcon = "🦷";
    } else if (/law|legal|attorney/i.test(brief)) {
      vertical = "law firms";
      clientTerm = "clients";
      workflowIcon = "⚖️";
    } else if (/clinic|med(ical|ical)|doctor/i.test(brief)) {
      vertical = "medical practices";
      clientTerm = "patients";
      workflowIcon = "🩺";
    } else if (/real\s*estate/i.test(brief)) {
      vertical = "real estate offices";
      clientTerm = "buyers";
      workflowIcon = "🏠";
    } else if (/hvac|plumb/i.test(brief)) {
      vertical = "home service businesses";
      clientTerm = "homeowners";
      workflowIcon = "🔧";
    }
    
    // Determine core focus from brief
    let focus = "automated bridges";
    let taskName = "data syncing";
    if (/bill(ing)?|invoice|quickbooks/i.test(brief)) {
      focus = "automated billing ledgers";
      taskName = "invoice matching";
    } else if (/schedul(e|ing)|calendar|booking/i.test(brief)) {
      focus = "direct calendar scheduling";
      taskName = "appointment booking";
    } else if (/document|signature|intake/i.test(brief)) {
      focus = "secure intake document routing";
      taskName = "agreement signing";
    }

    const generatedPosts = [];
    const postTitles = [
      `The Invisible Tax: Manual ${taskName} in ${vertical}`,
      `Auditing Your Problem Zero: Surgical process scoping for ${vertical}`,
      `Sustainable Growth: Decoupling carbon footprints and headcount cuts`,
      `Stop routing data by hand: Secure ${focus} in action`,
      `Visualizing capacity: The 24-hour setup workflow`,
      `Solution-First Automation: Upskilling your front desk`
    ];

    const imageAssets = [
      "black_female_founder_consultant.png",
      "collaborative_scoping_1779798801153.png",
      "3_empowered_systems_consultant.png",
      "2_operations_director_smb.png",
      "diverse_male_entrepreneur_1779798785119.png",
      "hispanic_female_retail_owner.png"
    ];

    for (let i = 0; i < 6; i++) {
      const postNum = i + 1;
      const targetDate = dates[i];
      const dateStr = formatDate(targetDate);
      const dayVal = targetDate.getDate();
      const title = postTitles[i];
      const image = imageAssets[i];
      const isFriday = targetDate.getDay() === 5;
      
      const utmToken = `post_gen_${month.toLowerCase()}_0${postNum}`;
      
      const linkedin = `**Subject**: The manual ${taskName} bottleneck in your office.

If you run one of today's ${vertical}, your staff is likely losing 10+ hours a week copy-pasting client records or manually reconciling accounting files.

At AiWorXmiths, we design secure, Human-in-the-Loop systems to automate this overhead. We focus on B2B business expansion, upskilling your team to supervise these automation engines rather than cutting headcount.

🔗 **Book your Free Consultation: https://aiworxmiths.com/services?utm_source=linkedin&utm_medium=social&utm_campaign=consultancy_sprints&utm_content=${utmToken}**`;

      const threads = `How many hours does your team waste on manual ${taskName} every week? 

We help ${vertical} replace these manual bridges with secure, low-compute automations, upskilling your front desk to oversee them. Human-first, growth-first.

🔗 **Reclaim your capacity. Book a free scoping call at AiWorXmiths.com: https://aiworxmiths.com/services?utm_source=threads&utm_medium=social&utm_campaign=consultancy_sprints&utm_content=${utmToken}**`;

      const instagram = `*   **Slide 1**: Streamlining operations in ${vertical}. (Visual: Professional setup with modern tech).
*   **Slide 2**: Manual ${taskName} is a silent drain on team focus and client trust.
*   **Slide 3**: The Fix: Secure, containerized private-cloud connectors.
*   **Slide 4**: We prioritize upskilling your team over headcount reductions.
*   **Slide 5**: Get paid faster Book a Free Consultation: Link in Bio (AiWorXmiths.com)`;

      const blog = `# ${title}

Manual workflows slow down modern ${vertical}. In this article, we explain how deploying custom ${focus} natives protects client confidentiality, lowers energy footprints, and frees team capacity.

[Book a free diagnostics consultation](https://aiworxmiths.com/services?utm_source=blog&utm_medium=social&utm_campaign=consultancy_sprints&utm_content=${utmToken})`;

      generatedPosts.push({
        id: `post_gen_${month.toLowerCase()}_0${postNum}`,
        week: String(Math.floor(i / 3) + 1),
        date: dateStr,
        dayNum: dayVal,
        month: month,
        campaign: "consultancy_sprints",
        type: "AI Consulting Audit",
        title: title,
        image: image,
        imgAlt: `${title} visual representation.`,
        status: isFriday ? "PENDING" : "APPROVED",
        linkedin: linkedin,
        threads: threads,
        instagram: instagram,
        blog: blog,
        comments: []
      });
    }

    res.json({ success: true, posts: generatedPosts });
  } catch (err) {
    console.error('[Server] Post generation error:', err);
    res.status(500).json({ success: false, error: err.message || 'Generation failed.' });
  }
});

// =================================================================
// PROSPECT SCOUTING & OUTREACH API ENDPOINTS
// =================================================================

app.post('/api/scout-prospects', async (req, res) => {
  const { niche, location, apiKey } = req.body;
  if (!niche || !location) {
    return res.status(400).json({ success: false, error: 'Niche and Location are required.' });
  }

  const activeApiKey = apiKey || process.env.FIRECRAWL_API_KEY;
  if (!activeApiKey) {
    return res.status(400).json({ success: false, error: 'Firecrawl API key is required.' });
  }

  try {
    console.log(`[Server] Scouting prospects for Niche: "${niche}" in "${location}"`);
    const prospects = await scoutLocalProspects(niche, location, activeApiKey);
    res.json({ success: true, prospects });
  } catch (err) {
    console.error('[Server] Scouting error:', err);
    res.status(500).json({ success: false, error: err.message || 'Scouting failed.' });
  }
});

const OUTREACH_REGISTRY = path.join(SOCIAL_AGENT_DIR, 'config', 'prospects_outreach.json');

function loadOutreachRegistry() {
  if (!fs.existsSync(OUTREACH_REGISTRY)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(OUTREACH_REGISTRY, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveOutreachRegistry(registry) {
  fs.writeFileSync(OUTREACH_REGISTRY, JSON.stringify(registry, null, 2));
}

app.post('/api/outreach-send', (req, res) => {
  const { domain, platform, text, image } = req.body;
  if (!domain || !platform || !text) {
    return res.status(400).json({ success: false, error: 'Domain, platform, and text are required.' });
  }

  console.log(`[Server] Triggering outreach for ${domain} on ${platform}...`);
  const agentDir = SOCIAL_AGENT_DIR;
  const args = ['publish_api.js', '--platform', platform.toLowerCase(), '--text', text];
  if (image) {
    args.push('--image', image);
  }

  const { execFile } = require('child_process');
  execFile('node', args, { cwd: agentDir }, (error, stdout, stderr) => {
    console.log(`[Server] outreach publish_api stdout:\n${stdout}`);
    if (stderr) console.error(`[Server] outreach publish_api stderr:\n${stderr}`);

    let result = { success: false, log: stdout };
    const lines = stdout.split('\n');
    for (let line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.hasOwnProperty('success')) {
            result = { ...parsed, log: stdout };
            break;
          }
        } catch (e) {}
      }
    }

    if (error && !result.success) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Outreach campaign execution failed.',
        log: stdout
      });
    }

    // Register this outreach in local database
    const registry = loadOutreachRegistry();
    const existingIdx = registry.findIndex(p => p.domain === domain);
    const newOutreach = {
      platform,
      text,
      timestamp: new Date().toISOString(),
      status: 'SENT'
    };

    if (existingIdx !== -1) {
      if (!registry[existingIdx].outreaches) registry[existingIdx].outreaches = [];
      registry[existingIdx].outreaches.push(newOutreach);
      registry[existingIdx].status = 'SENT';
      registry[existingIdx].lastUpdated = new Date().toISOString();
    } else {
      registry.push({
        domain,
        status: 'SENT',
        lastUpdated: new Date().toISOString(),
        outreaches: [newOutreach]
      });
    }
    saveOutreachRegistry(registry);

    res.json(result);
  });
});

// Supabase credentials are configured STRICTLY through environment variables
// (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). The previous behaviour — accepting
// a service-role key over HTTP and persisting it to a plaintext JSON file — was
// removed as a production security hazard.
app.get('/api/supabase-credentials', (req, res) => {
  res.json({
    success: true,
    configured: isSupabaseConfigured(),
    source: 'environment',
    // Never echo the URL or key back to the browser.
    hasKey: isSupabaseConfigured()
  });
});

app.post('/api/supabase-credentials', (req, res) => {
  res.status(410).json({
    success: false,
    error: 'Credential upload via API has been disabled. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as environment variables on the host/container instead.'
  });
});

app.post('/api/export-crm', async (req, res) => {
  const { prospect } = req.body;
  if (!prospect || !prospect.domain) {
    return res.status(400).json({ success: false, error: 'Prospect data is required.' });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.'
    });
  }

  try {
    console.log(`[Server] Syncing prospect ${prospect.domain} to Supabase Sales Command Center...`);

    // Pooled, retry-capable Supabase REST writes (lib/supabase.js)
    const postTable = (table, payload) => insertRow(table, payload);

    // 1. Insert into inbound_leads
    const leadPayload = {
      ghl_contact_id: `outreach_${prospect.domain.replace(/\./g, '_')}_${Date.now()}`,
      raw_payload: prospect,
      enrichment: {
        domain: prospect.domain,
        businessName: prospect.businessName,
        vertical: prospect.vertical,
        gaps: prospect.gaps,
        personnel: prospect.personnel,
        scoured: prospect.scoured,
        workforce: prospect.workforce
      },
      status: 'received'
    };

    console.log('[Server] Inserting inbound lead...');
    const leadResult = await postTable('inbound_leads', leadPayload);
    
    // 2. Insert corresponding discovery record
    const discoveryPayload = {
      consultant_id: '00000000-0000-0000-0000-000000000000', // System default/service placeholder
      consultant_profile_id: 'social_media_agent',
      status: 'qualified',
      data: {
        company: prospect.businessName,
        domain: prospect.domain,
        business_context: {
          lead_name: prospect.personnel?.[0]?.name || 'Owner',
          vertical: prospect.vertical
        },
        research: prospect
      },
      primary_bottleneck: prospect.gaps?.[0]?.title || 'Manual Administrative Process Drag',
      recommended_service: prospect.gaps?.[0]?.service || 'AiWorXmiths Custom Integrations'
    };

    console.log('[Server] Inserting discovery report...');
    await postTable('discoveries', discoveryPayload);

    res.json({ success: true, lead: leadResult });
  } catch (err) {
    console.error('[Server] Export to Supabase failed:', err);
    res.status(500).json({ success: false, error: err.message || 'Supabase write failed.' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'development',
    firecrawl: !!process.env.FIRECRAWL_API_KEY,
    ga4: !!process.env.GA4_PROPERTY_ID
  });
});

// Fallback all unspecified routes to index.html (SPA routing pattern)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize server listener
const server = app.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`🚀 SMB External Audit Engine active!`);
  console.log(`🌐 Server running at: http://localhost:${PORT}`);
  console.log(`🛡️ Mode: ${process.env.FIRECRAWL_API_KEY ? 'Live Firecrawl' : 'Smart Simulation (Default)'}`);
  console.log(`================================================================`);
});

// Graceful shutdown helper
function gracefulShutdown(signal) {
  console.log(`[Server] ${signal} received. Draining connections...`);
  server.close(() => {
    console.log('[Server] All connections closed. Exiting.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[Server] Forced shutdown after 10s.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Crash safety — catch uncaught exceptions and promise rejections
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err.message, err.stack);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Promise Rejection:', reason);
});

