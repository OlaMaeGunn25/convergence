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
const { getGA4Metrics } = require('./lib/ga');
const { generateAgentReply } = require('./lib/conversational_agent');
const { matchIntegrations } = require('./lib/integration_matcher');
const connectorCatalog = require('./lib/connectors/catalog');
const { ConnectionRegistry } = require('./lib/connection_registry');
const clioConnector = require('./lib/connectors/clio');
const { TaskModel: ConnTaskModel } = require('./lib/task_model');
const connectionRegistry = new ConnectionRegistry();
const connTaskModel = new ConnTaskModel();
const { isSupabaseConfigured, insertRow } = require('./lib/supabase');
const { searchScholar, isScholarConfigured } = require('./lib/scholar');
const { authenticate, isAuthConfigured } = require('./lib/auth');
const { auditOnFinish, recordAudit } = require('./lib/audit');
const { negotiate, isNegotiationLLMConfigured } = require('./lib/negotiation');
const { runAuditPipeline } = require('./lib/audit_runner');
const { CampaignStore } = require('./lib/stores/campaign_store');
const { AlertsStore } = require('./lib/stores/alerts_store');
const { AuditQueueStore } = require('./lib/stores/audit_queue_store');

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

// Optional-but-validated: Google Scholar (SerpApi) powers the Legal vertical.
// Not required to boot — absence falls back to the simulated dataset — but we
// surface a clear warning so operators know live case-law search is inactive.
if (isScholarConfigured()) {
  logger.info('[BOOT] Google Scholar (SerpApi) integration active for the Legal vertical.');
} else {
  logger.warn('[BOOT] SERPAPI_API_KEY / SCHOLAR_API_KEY not set — Legal-vertical Google Scholar search will use the simulated fallback dataset.');
}

// Governance posture: mutating endpoints are auth-gated once a key is set.
if (isAuthConfigured()) {
  logger.info('[BOOT] Gateway governance ACTIVE — mutating endpoints require an API key (audit trail enabled).');
} else {
  logger.warn('[BOOT] GATEWAY_API_KEY not set — mutating endpoints are UNAUTHENTICATED. Set it before production to enforce the governance layer.');
}

// Multi-agent negotiation: live Claude reasoning vs. simulated fallback.
if (isNegotiationLLMConfigured()) {
  logger.info('[BOOT] Multi-agent negotiation active (Anthropic API).');
} else {
  logger.warn('[BOOT] ANTHROPIC_API_KEY not set — multi-agent negotiation will use the simulated fallback.');
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
  : path.join(REPO_ROOT, 'aiwx-convergence-ai', 'dist');

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
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization,Accept,Origin,x-api-key');
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

const publishLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Publishing rate limit reached. Please wait before posting again.' }
});

const scholarLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_SCHOLAR_PER_MIN, 10) || 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Google Scholar search rate limit reached. Please wait.' }
});

// --- Governance: authentication + immutable audit trail ---
// Authentication is fail-closed once a key is configured. Two classes of route
// are gated:
//
//   PROTECTED_MUTATIONS — side-effectful endpoints. Viewer-role keys are
//     rejected on these by the role gate in lib/auth.js; high-value actions
//     also emit an audit_log entry below.
//   PROTECTED_READS — non-mutating GETs that either spend money on a metered
//     third-party API or return internal business data. These accept both
//     operator and viewer roles.
//
// Deliberately left PUBLIC: /api/track-event and /api/track-events-batch (the
// client-side tracking pixel fires from unauthenticated browsers) and /health
// (must stay reachable by load balancers and uptime probes).
const PROTECTED_MUTATIONS = [
  '/api/audit',
  '/api/publish-post',
  // Connection builder + status board (GET+POST both gated; establishing an
  // external integration is a governed, audited action).
  '/api/connections',
  '/api/schedule-campaign',
  '/api/toggle-scheduler',
  '/api/update-post',
  '/api/update-post-status',
  '/api/post-reply',
  '/api/generate-reply',
  '/api/activity-alerts/resolve',
  '/api/export-crm',
  '/api/generate-monthly-posts',
  '/api/negotiate',
  // Also serves GET (the HITL queue listing) — app.use() matches every method,
  // so this single entry gates both the POST and the read.
  '/api/audit-queue',
  // Tool registry: discovery (GET) + governed invoke (POST) — both auth-gated.
  '/api/tools'
];
const PROTECTED_READS = [
  // Each call bills a SerpApi credit — must not be open to anonymous callers.
  '/api/scholar/search',
  // Returns live campaign performance and local visitor telemetry.
  '/api/analytics',
  // Exposes the scheduled-post queue and its contents.
  '/api/scheduler-status',
  // Exposes the connector catalog + credential-configured flags.
  '/api/connectors'
];
app.use(PROTECTED_MUTATIONS, authenticate);
app.use(PROTECTED_READS, authenticate);
app.use('/api/audit', auditOnFinish('audit.run'));
app.use('/api/publish-post', auditOnFinish('post.publish'));
app.use('/api/export-crm', auditOnFinish('crm.export'));
app.use('/api/connections', auditOnFinish('connection.build'));

app.use('/api/', globalApiLimiter);
app.use('/api/audit', auditLimiter);
app.use('/api/scholar/search', scholarLimiter);

// ── Internal Tool Registry (Phase 2) ──────────────────────────────────────────
// One typed, governed surface over every capability — the same registry the MCP
// server draws from. GET lists tools; POST /:name validates input against the
// tool's Zod schema and enforces the approval policy (destructive tools need
// approved:true) centrally.
const toolRegistry = require('./lib/tool_registry');
app.get('/api/tools', (req, res) => {
  res.json({ success: true, tools: toolRegistry.list() });
});
app.post('/api/tools/:name', async (req, res) => {
  const { name } = req.params;
  if (!toolRegistry.has(name)) {
    return res.status(404).json({ success: false, error: `Unknown tool "${name}".` });
  }
  try {
    const input = (req.body && req.body.input) || {};
    const approved = req.body && req.body.approved === true;
    const result = await toolRegistry.invoke(name, input, { actor: req.actor, role: req.role, approved });
    if (result.ok === false && result.status === 'requires_approval') return res.status(202).json({ success: false, ...result });
    if (result.ok === false) return res.status(400).json({ success: false, ...result });
    return res.json({ success: true, tool: name, result: result.result });
  } catch (err) {
    console.error('[Tools] invocation failed:', err);
    return res.status(500).json({ success: false, error: err.message || 'Tool invocation failed.' });
  }
});
app.use('/api/publish-post', publishLimiter);

// ── Connections: connector catalog, connection builder + status board ─────────
// Discover the connector catalog CONVERGENCE-Ai can wire into the MCP layer.
app.get('/api/connectors', (req, res) => {
  const items = req.query.vertical ? connectorCatalog.byVertical(req.query.vertical) : connectorCatalog.list();
  res.json({ success: true, connectors: items.map(connectorCatalog.publicView) });
});
// Live connection status board (feeds the floating status component).
app.get('/api/connections', async (req, res) => {
  try {
    const systems = await connectionRegistry.statusBoard({ tenantId: req.query.tenantId || null });
    res.json({ success: true, systems, generatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Failed to load connections.' });
  }
});
// Build (establish) a connection — approval-gated; credentials never accepted here.
app.post('/api/connections', async (req, res) => {
  try {
    const { connectorId, tenantId, config, approved } = req.body || {};
    if (!connectorId || !connectorCatalog.has(connectorId)) {
      return res.status(400).json({ success: false, error: 'A valid connectorId is required.' });
    }
    if (approved !== true) {
      return res.status(202).json({ success: false, status: 'requires_approval', connectorId,
        message: 'Connecting an external system requires human approval. Re-POST with approved:true.' });
    }
    const result = await connectionRegistry.build(connectorId, { tenantId: tenantId || null, actor: req.actor || null, config: config || {} });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Failed to build connection.' });
  }
});
app.post('/api/connections/disconnect', async (req, res) => {
  try {
    const { connectorId, tenantId } = req.body || {};
    if (!connectorId || !connectorCatalog.has(connectorId)) {
      return res.status(400).json({ success: false, error: 'A valid connectorId is required.' });
    }
    const connection = await connectionRegistry.disconnect(connectorId, { tenantId: tenantId || null, actor: req.actor || null });
    res.json({ success: true, connection });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Failed to disconnect.' });
  }
});
// Clio webhook -> governed task (HMAC-verified when CLIO_WEBHOOK_SECRET is set).
app.post('/api/clio/webhook', async (req, res) => {
  try {
    const secret = process.env.CLIO_WEBHOOK_SECRET;
    if (secret) {
      const crypto = require('crypto');
      const sig = req.get('X-Hook-Signature') || req.get('X-Clio-Signature') || '';
      const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(req.body || {})).digest('hex');
      const a = Buffer.from(sig), b = Buffer.from(expected);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return res.status(401).json({ success: false, error: 'Invalid webhook signature.' });
      }
    }
    const descriptor = clioConnector.mapWebhookToTask(req.body || {});
    const task = await connTaskModel.create(descriptor);
    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Webhook processing failed.' });
  }
});

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

// Serve the Convergence-Ai's production Vite build (if present) under /admin
if (fs.existsSync(ADMIN_DIST_DIR)) {
  app.use('/admin', express.static(ADMIN_DIST_DIR, { dotfiles: 'deny' }));
  logger.info(`[BOOT] Admin dashboard mounted at /admin from ${ADMIN_DIST_DIR}`);
} else {
  logger.warn(`[BOOT] Admin Vite build not found at ${ADMIN_DIST_DIR} — /admin not mounted. Run "npm run build" in aiwx-convergence-ai.`);
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

/**
 * Google Scholar Search Endpoint (Legal Services vertical)
 * Powers case-law search, expert-witness publication vetting, and
 * scientific-precedent checks. Falls back to a simulated dataset when the
 * SerpApi key is not configured.
 *
 * @openapi
 * /api/scholar/search:
 *   get:
 *     summary: Search Google Scholar for case law and expert publications
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: num
 *         schema: { type: integer }
 *       - in: query
 *         name: engine
 *         schema: { type: string, enum: [google_scholar, google_scholar_author] }
 *     responses:
 *       200: { description: Structured scholar results }
 */
app.get('/api/scholar/search', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const engine = req.query.engine === 'google_scholar_author' ? 'google_scholar_author' : 'google_scholar';

  if (!q && engine !== 'google_scholar_author') {
    return res.status(400).json({ success: false, error: 'Query parameter "q" is required.' });
  }

  try {
    const data = await searchScholar(q, {
      engine,
      num: req.query.num,
      authorId: req.query.author_id,
      apiKey: req.query.apiKey
    });
    return res.json(data);
  } catch (err) {
    console.error('[Server] Scholar search failed:', err);
    return res.status(500).json({ success: false, error: err.message || 'Scholar search failed.' });
  }
});

const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

// Determine whether an audit target belongs to the Legal Services vertical, so
// the audit flow can attach Google Scholar case-law / expert-witness citations.
function isLegalVertical(explicitVertical, scrapedVertical, businessName) {
  const haystack = `${explicitVertical || ''} ${scrapedVertical || ''} ${businessName || ''}`.toLowerCase();
  return /\b(legal|law|attorney|counsel|litigation|esq)\b/.test(haystack);
}

/**
 * Multi-Agent Negotiation Endpoint
 * Runs a Proposer/Critic/Arbiter negotiation to a consensus recommendation,
 * escalating to the HITL queue when consensus fails or the vertical is high-risk.
 */
app.post('/api/negotiate', async (req, res) => {
  const { topic, context, vertical, options } = req.body || {};
  if (!topic || !String(topic).trim()) {
    return res.status(400).json({ success: false, error: 'A negotiation "topic" is required.' });
  }
  try {
    const result = await negotiate({ topic, context, vertical, options });
    return res.json(result);
  } catch (err) {
    console.error('[Server] Negotiation failed:', err);
    return res.status(500).json({ success: false, error: err.message || 'Negotiation failed.' });
  }
});

// ===================================================================
// AUTOMATED AUDIT SCHEDULER — enqueue domains for governed, hands-off
// audits run by a crash-safe background loop.
// ===================================================================
const AUDIT_QUEUE_FILE = path.join(REPO_ROOT, 'aiwx-smb-auditor', 'config', 'audit_queue.json');
const auditQueueStore = new AuditQueueStore(AUDIT_QUEUE_FILE);

// Enqueue one or more domains for automated auditing (and toggle the loop).
app.post('/api/audit-queue', async (req, res) => {
  const { domains, active, vertical } = req.body || {};
  const valid = Array.isArray(domains)
    ? domains.map(d => String(d || '').trim()).filter(d => DOMAIN_REGEX.test(d))
    : [];
  try {
    const result = await auditQueueStore.enqueue(valid, active, vertical);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error(`[AuditScheduler] Failed to update audit queue: ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to update the audit queue.' });
  }
});

// Inspect the automated audit queue.
app.get('/api/audit-queue', async (req, res) => {
  try {
    res.json({ success: true, ...(await auditQueueStore.getQueue()) });
  } catch (err) {
    logger.error(`[AuditScheduler] Failed to read audit queue: ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to read the audit queue.' });
  }
});

// Crash-safe background loop: processes one queued audit per tick with backoff.
// The claim is atomic (FOR UPDATE SKIP LOCKED on the Supabase backend), so
// several auditor instances can run this loop concurrently without two of them
// picking up the same job.
let auditLoopFailures = 0;
let auditLoopSkipUntil = 0;
let auditLoopBusy = false;

async function processAuditQueueTick() {
  if (Date.now() < auditLoopSkipUntil || auditLoopBusy) return;

  auditLoopBusy = true;
  let job;
  try {
    job = await auditQueueStore.claimNextJob();
    if (!job) return;

    const pkg = await runAuditPipeline(job.domain, { vertical: job.vertical });
    try {
      const cacheDir = path.join(__dirname, 'audits_cache');
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
      const safe = job.domain.replace(/[^a-zA-Z0-9.-]/g, '_') + '.json';
      fs.writeFileSync(path.join(cacheDir, safe), JSON.stringify(pkg, null, 2), 'utf-8');
    } catch (e) { /* cache write is best-effort */ }

    await auditQueueStore.completeJob(job.id, true);
    auditLoopFailures = 0;
    recordAudit({ actor: 'audit-scheduler', role: 'operator', action: 'audit.auto', resource: job.domain, outcome: 'success' });
    logger.info(`[AuditScheduler] Completed automated audit for ${job.domain}`);
  } catch (err) {
    auditLoopFailures++;
    const backoff = Math.min(60000 * Math.pow(2, auditLoopFailures - 1), 15 * 60 * 1000);
    auditLoopSkipUntil = Date.now() + backoff;
    if (job) {
      try {
        await auditQueueStore.completeJob(job.id, false, err.message);
      } catch (e) {
        logger.error(`[AuditScheduler] Could not record failure for ${job.id}: ${e.message}`);
      }
      recordAudit({ actor: 'audit-scheduler', role: 'operator', action: 'audit.auto', resource: job.domain, outcome: 'failure', metadata: { error: err.message } });
      logger.error(`[AuditScheduler] Automated audit for ${job.domain} failed: ${err.message}. Backing off ${Math.round(backoff / 1000)}s.`);
    } else {
      logger.error(`[AuditScheduler] Could not claim a job: ${err.message}. Backing off ${Math.round(backoff / 1000)}s.`);
    }
  } finally {
    auditLoopBusy = false;
  }
}

setInterval(() => { processAuditQueueTick().catch(e => logger.error(`[AuditScheduler] tick error: ${e.message}`)); }, 90 * 1000);

// Recover jobs whose worker died mid-run, so they don't sit in 'running' forever.
const STALE_JOB_MINUTES = parseInt(process.env.STALE_JOB_MINUTES, 10) || 30;
setInterval(() => {
  auditQueueStore.requeueStale(STALE_JOB_MINUTES)
    .then(rows => {
      if (rows.length) logger.warn(`[AuditScheduler] Requeued ${rows.length} stale audit job(s).`);
    })
    .catch(e => logger.error(`[AuditScheduler] Stale-job sweep failed: ${e.message}`));
}, 10 * 60 * 1000);

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
  const { domain, apiKey, vertical } = req.body;

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
    
    // 2. teamNames feeds the legal-vertical Scholar cross-reference below.
    //    (The public pre-sales scour was removed — that is an ASES sales
    //    function, not systems evaluation. See docs/AUDITOR_REFRAME.md.)
    const teamNames = (scrapedData.rawTeamData || []).map(m => m.name);

    // 3. Perform SWOT and Technical Infrastructure Analysis
    const analyzerData = analyzeFootprint(scrapedData);
    
    // 4. Formulate Workforce AI-HITL Upskilling blueprint
    const workforceData = analyzeWorkforce(scrapedData);

    // 4a. Integration-readiness: detected systems -> connectors -> MCP/API roadmap.
    const integrationReadiness = matchIntegrations({
      technologies: scrapedData.technologies,
      vertical: scrapedData.vertical,
      businessName: scrapedData.businessName,
      domain: scrapedData.domain
    });

    // 4b. Legal Services vertical: cross-reference personnel against Google
    // Scholar for case-law precedents and expert-witness publication vetting.
    let scholarData = null;
    if (isLegalVertical(vertical, scrapedData.vertical, scrapedData.businessName)) {
      try {
        const primaryName = teamNames[0];
        const scholarQuery = primaryName
          ? `"${scrapedData.businessName}" "${primaryName}" case law precedent`
          : `"${scrapedData.businessName}" legal precedent`;
        console.log(`[Server] Legal vertical detected — running Google Scholar cross-reference: ${scholarQuery}`);
        const scholarResult = await withTimeout(searchScholar(scholarQuery, { num: 8 }), 25000);
        const expertPublications = (scholarResult.results || []).filter(r => r.type === 'expert_publication' || r.type === 'scientific_precedent').length;
        scholarData = {
          ...scholarResult,
          crossReferencedNames: teamNames,
          expertPublicationCount: expertPublications,
          verifiedCaseCitations: (scholarResult.results || []).filter(r => r.type === 'case_law').length
        };
      } catch (scholarErr) {
        console.error('[Server] Scholar cross-reference failed (non-fatal):', scholarErr.message);
        scholarData = { success: false, error: scholarErr.message, results: [] };
      }
    }

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
      analyzerData,
      workforceData,
      integrationReadiness,
      // Present only for Legal Services audits
      ...(scholarData ? { scholarData } : {})
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
const campaignStore = new CampaignStore(SCHEDULE_FILE);

// LinkedIn posts are published by a separate flow, so the scheduler skips them.
const SCHEDULER_EXCLUDED_PLATFORMS = ['linkedin'];

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

async function schedulerTick() {
  if (Date.now() < schedulerSkipUntil) return;
  try {
    await runSchedulerScan();
    schedulerConsecutiveFailures = 0;
  } catch (e) {
    schedulerConsecutiveFailures++;
    const backoffMs = Math.min(60000 * Math.pow(2, schedulerConsecutiveFailures - 1), 15 * 60 * 1000);
    schedulerSkipUntil = Date.now() + backoffMs;
    logger.error(`[Scheduler] Tick failed (${schedulerConsecutiveFailures} consecutive): ${e.message}. Backing off ${Math.round(backoffMs / 1000)}s.`);
  }
}

/** Extract the publisher's `{"success": ...}` result line from its stdout. */
function parsePublisherResult(stdout) {
  for (const line of String(stdout || '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (Object.prototype.hasOwnProperty.call(parsed, 'success')) return parsed;
    } catch (e) { /* not the result line */ }
  }
  return { success: false };
}

/** Publish one already-claimed post and record its outcome. */
function publishClaimedPost(post) {
  return new Promise((resolve) => {
    sendNotification('AiWorXmiths Campaign Scheduler', `Posting Post ${post.id.replace('post_', '')} to ${post.platform}...`);

    const args = ['publish_api.js', '--platform', post.platform.toLowerCase(), '--text', post.text];
    if (post.image) args.push('--image', post.image);

    execFile('node', args, { cwd: AGENT_DIR }, async (err, stdout, stderr) => {
      console.log(`[Scheduler] publish_api output for ${post.id}:\n${stdout}`);
      const result = parsePublisherResult(stdout);
      const failed = Boolean(err) || !result.success;

      try {
        if (failed) {
          const message = err ? err.message : (result.error || 'Browser execution failed.');
          console.error(`[Scheduler] Post ${post.id} failed:`, message);
          await campaignStore.completePost(post.id, false, {
            error: message,
            logs: `${stdout || ''}\n${stderr || ''}`,
            screenshot: result.screenshot
          });
          sendNotification('AiWorXmiths Campaign Scheduler', `❌ Failed to publish Post ${post.id.replace('post_', '')} to ${post.platform}!`);
        } else {
          console.log(`[Scheduler] Post ${post.id} published successfully!`);
          await campaignStore.completePost(post.id, true, {
            logs: stdout,
            screenshot: result.screenshot
          });
          sendNotification('AiWorXmiths Campaign Scheduler', `✓ Post ${post.id.replace('post_', '')} published successfully to ${post.platform}!`);
        }
      } catch (storeErr) {
        // The post stays in PUBLISHING; the stale sweep below returns it to
        // APPROVED so it is retried rather than lost.
        logger.error(`[Scheduler] Could not record outcome for ${post.id}: ${storeErr.message}`);
      }
      resolve();
    });
  });
}

async function runSchedulerScan() {
  // One atomic claim replaces the old read → mark PUBLISHING → write sequence.
  // Any post returned here is exclusively owned by this process, so the
  // standalone scheduler_daemon.js cannot publish it as well.
  const claimed = await campaignStore.claimDuePosts(SCHEDULER_EXCLUDED_PLATFORMS);
  if (!claimed.length) return;

  console.log(`[Scheduler] Claimed ${claimed.length} due post(s) for publishing.`);
  for (const post of claimed) {
    publishClaimedPost(post);
  }
}

setInterval(() => { schedulerTick().catch(e => logger.error(`[Scheduler] tick error: ${e.message}`)); }, 60000);

// Return posts stranded in PUBLISHING by a crashed publisher back to APPROVED.
setInterval(() => {
  campaignStore.requeueStale(STALE_JOB_MINUTES)
    .then(rows => {
      if (rows.length) logger.warn(`[Scheduler] Requeued ${rows.length} stale campaign post(s).`);
    })
    .catch(e => logger.error(`[Scheduler] Stale-post sweep failed: ${e.message}`));
}, 10 * 60 * 1000);

// Persisted Activity Alerts — backed by Supabase `activity_alerts` in
// production, or config/activity_alerts.json (with the seed set) in local dev.
// Resolve/reply are single-row updates, so two operators acting at the same
// time can no longer overwrite each other's change.
const ALERTS_FILE = path.join(SOCIAL_AGENT_DIR, 'config', 'activity_alerts.json');
const alertsStore = new AlertsStore(ALERTS_FILE, path.resolve(__dirname, 'logs'));

// NOTE: The outbound prospecting scheduler and /api/run-prospecting endpoint were
// removed — automated outbound prospecting is an ASES sales-enablement function,
// not part of CONVERGENCE-Ai systems evaluation. See docs/AUDITOR_REFRAME.md.

// API Endpoints for Activity Alerts
app.get('/api/activity-alerts', async (req, res) => {
  try {
    const alerts = await alertsStore.listAlerts();
    res.json({ success: true, alerts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Failed to load alerts.' });
  }
});

app.post('/api/activity-alerts/resolve', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, error: 'Alert ID is required.' });

  try {
    const alert = await alertsStore.resolveAlert(id);
    if (!alert) return res.status(404).json({ success: false, error: 'Alert not found.' });
    res.json({ success: true });
  } catch (err) {
    logger.error(`[Alerts] Failed to resolve ${id}: ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to update alert status.' });
  }
});

app.post('/api/generate-reply', async (req, res) => {
  const { commentId } = req.body;
  if (!commentId) return res.status(400).json({ success: false, error: 'Comment ID is required.' });

  try {
    const alert = await alertsStore.getAlert(commentId);
    if (!alert) return res.status(404).json({ success: false, error: 'Comment alert not found.' });
    res.json({ success: true, replyDraft: alert.aiDraft });
  } catch (err) {
    logger.error(`[Alerts] Failed to generate reply for ${commentId}: ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to generate reply.' });
  }
});

app.post('/api/post-reply', async (req, res) => {
  const { commentId, replyText } = req.body;
  if (!commentId || !replyText) {
    return res.status(400).json({ success: false, error: 'Comment ID and reply copy are required.' });
  }

  try {
    const alert = await alertsStore.recordReply(commentId, replyText);
    if (!alert) return res.status(404).json({ success: false, error: 'Comment alert not found.' });

    console.log(`[Server] Response mock-posted back to ${alert.platform}: "${replyText}"`);
    sendNotification('AiWorXmiths Campaign Manager', `✓ Successfully posted response to ${alert.userName} on ${alert.platform}!`);

    res.json({ success: true });
  } catch (err) {
    logger.error(`[Alerts] Failed to post reply for ${commentId}: ${err.message}`);
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
app.post('/api/schedule-campaign', async (req, res) => {
  const { posts } = req.body;
  if (!posts || !Array.isArray(posts)) {
    return res.status(400).json({ success: false, error: 'Valid posts array is required.' });
  }

  try {
    // The store preserves the existing schedulerActive switch and, when
    // CAMPAIGN_HITL_APPROVAL is enabled, opens a hitl_queue task for each post
    // that still needs a human release instead of auto-approving it.
    const { schedulerActive, pendingHitl } = await campaignStore.replaceSchedule(posts);
    res.json({ success: true, schedulerActive, pendingHitl });
  } catch (err) {
    logger.error(`[Scheduler] Failed to write campaign schedule: ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to save the campaign schedule.' });
  }
});

// Endpoint to get the scheduler status and queue
app.get('/api/scheduler-status', async (req, res) => {
  try {
    const { schedulerActive, posts } = await campaignStore.getSchedule();
    res.json({ success: true, schedulerActive, posts });
  } catch (err) {
    logger.error(`[Scheduler] Failed to read campaign schedule: ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to read the campaign schedule.' });
  }
});

// Endpoint to toggle scheduler state
app.post('/api/toggle-scheduler', async (req, res) => {
  const { active } = req.body;
  if (active === undefined) {
    return res.status(400).json({ success: false, error: 'Active toggle state is required.' });
  }

  try {
    if (!(await campaignStore.hasSchedule())) {
      return res.status(400).json({ success: false, error: 'Campaign schedule has not been set yet. Please schedule posts first.' });
    }

    const schedulerActive = await campaignStore.setSchedulerActive(active);
    sendNotification('AiWorXmiths Campaign Scheduler', `Campaign Auto-Scheduler has been turned ${schedulerActive ? 'ON' : 'OFF'}.`);
    res.json({ success: true, schedulerActive });
  } catch (err) {
    logger.error(`[Scheduler] Failed to toggle scheduler: ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to update schedule status.' });
  }
});

// Endpoint to update a single post status in the schedule
app.post('/api/update-post-status', async (req, res) => {
  const { id, status } = req.body;
  if (!id || !status) {
    return res.status(400).json({ success: false, error: 'Post ID and status are required.' });
  }

  try {
    if (!(await campaignStore.hasSchedule())) {
      return res.status(400).json({ success: false, error: 'Campaign schedule has not been set yet.' });
    }
    const updated = await campaignStore.updatePostStatus(id, status);
    if (!updated) return res.status(404).json({ success: false, error: 'Post not found in schedule.' });
    res.json({ success: true });
  } catch (err) {
    logger.error(`[Scheduler] Failed to update status for ${id}: ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to update post status on server.' });
  }
});

// Endpoint to update a single post text and/or image in the schedule (real-time sync)
app.post('/api/update-post', async (req, res) => {
  const { id, text, image } = req.body;
  if (!id || text === undefined) {
    return res.status(400).json({ success: false, error: 'Post ID and text content are required.' });
  }

  try {
    if (!(await campaignStore.hasSchedule())) {
      return res.status(400).json({ success: false, error: 'Campaign schedule has not been set yet.' });
    }
    const updated = await campaignStore.updatePostContent(id, text, image);
    if (!updated) return res.status(404).json({ success: false, error: 'Post not found in schedule.' });
    res.json({ success: true });
  } catch (err) {
    logger.error(`[Scheduler] Failed to update post ${id}: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
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

// Bound the local analytics store so unauthenticated /api/track-event traffic
// can't grow the file without limit (disk-fill DoS). Each array is capped to the
// most-recent MAX entries; overflow is rotated to a dated JSONL archive.
const ANALYTICS_MAX_ENTRIES = parseInt(process.env.ANALYTICS_MAX_ENTRIES, 10) || 5000;

function trimWithArchive(arr, kind) {
  if (!Array.isArray(arr) || arr.length <= ANALYTICS_MAX_ENTRIES) return arr || [];
  const overflow = arr.slice(0, arr.length - ANALYTICS_MAX_ENTRIES);
  try {
    const logsDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    const date = new Date().toISOString().split('T')[0];
    const archivePath = path.join(logsDir, `analytics-${kind}-${date}.jsonl`);
    fs.appendFileSync(archivePath, overflow.map(e => JSON.stringify(e)).join('\n') + '\n', 'utf8');
  } catch (e) { /* archiving is best-effort */ }
  return arr.slice(arr.length - ANALYTICS_MAX_ENTRIES);
}

function saveLocalAnalytics(data) {
  data.pageviews = trimWithArchive(data.pageviews, 'pageviews');
  data.events = trimWithArchive(data.events, 'events');
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
    let localCtr = totalLocalClicks > 0 ? ((totalLocalConversions / totalLocalClicks) * 100).toFixed(2) + '%' : '0.00%';

    // Provenance rule for this endpoint: `summary` carries only figures we
    // actually measured. The tracking pixel records pageviews and CTA clicks —
    // it cannot observe an impression, and neither can the GA4 report we run
    // (see lib/ga.js). Impressions therefore stay null and any modelled figure
    // lives in the separately-named `estimated` block, never blended in.
    const LOCAL_IMPRESSIONS_PER_CLICK = 15;

    let summary = {
      impressions: null,
      clicks: totalLocalClicks,
      ctr: localCtr,
      conversions: totalLocalConversions
    };
    let estimated = {
      impressions: totalLocalClicks * LOCAL_IMPRESSIONS_PER_CLICK
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
        // ga4.summary.impressions is null by contract; only the modelled figure
        // crosses over, and it lands in `estimated` rather than `summary`.
        estimated.impressions += ga4.summary.estimatedImpressions || 0;
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
      // Measured figures only. `impressions` is null by design — see the
      // provenance block and the note above the summary construction.
      summary,
      // Modelled figures, kept structurally separate so a client cannot render
      // one as fact by accident. Label these as estimates in any UI.
      estimated,
      provenance: {
        clicks: ga4Connected ? 'verified:local-pixel+ga4' : 'verified:local-pixel',
        conversions: ga4Connected ? 'verified:local-pixel+ga4' : 'verified:local-pixel',
        ctr: 'derived:conversions/clicks',
        impressions: 'unavailable:not-measured-by-pixel-or-ga4',
        'estimated.impressions': `modelled:clicks*${LOCAL_IMPRESSIONS_PER_CLICK}`,
        trend: 'verified:local-pixel',
        breakdown: ga4Connected ? 'verified:local-pixel+ga4' : 'verified:local-pixel'
      },
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
// NOTE: Prospect scouting (/api/scout-prospects) and outreach sending
// (/api/outreach-send + the prospects_outreach.json registry) were removed —
// they are ASES sales-enablement functions, not CONVERGENCE-Ai systems
// evaluation. See docs/AUDITOR_REFRAME.md. The /api/export-crm endpoint below
// is retained but reframed to export an integration-readiness candidate.
// =================================================================

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

// Export an integration-readiness CANDIDATE to Supabase. This is NOT sales
// prospecting — it records a company the Auditor has evaluated, along with its
// systems inventory and recommended integrations, so a human can decide whether
// to connect those systems to the governed MCP layer. See docs/AUDITOR_REFRAME.md.
app.post('/api/export-crm', async (req, res) => {
  // `candidate` is the preferred field; `prospect` is accepted for backward compat.
  const candidate = req.body.candidate || req.body.prospect;
  if (!candidate || !candidate.domain) {
    return res.status(400).json({ success: false, error: 'Integration candidate data (with a domain) is required.' });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.'
    });
  }

  try {
    console.log(`[Server] Recording integration-readiness candidate ${candidate.domain} to Supabase...`);

    // Pooled, retry-capable Supabase REST writes (lib/supabase.js)
    const postTable = (table, payload) => insertRow(table, payload);

    const leadPayload = {
      ghl_contact_id: `candidate_${candidate.domain.replace(/\./g, '_')}_${Date.now()}`,
      raw_payload: candidate,
      enrichment: {
        domain: candidate.domain,
        businessName: candidate.businessName,
        vertical: candidate.vertical,
        systemsInventory: candidate.systemsInventory || candidate.technologies,
        integrationReadiness: candidate.integrationReadiness,
        recommendedIntegrations: candidate.recommendedIntegrations,
        personnel: candidate.personnel,
        workforce: candidate.workforce
      },
      status: 'evaluated'
    };

    console.log('[Server] Inserting integration-readiness candidate...');
    const leadResult = await postTable('inbound_leads', leadPayload);

    // Insert corresponding evaluation record.
    const discoveryPayload = {
      consultant_id: '00000000-0000-0000-0000-000000000000', // System default/service placeholder
      consultant_profile_id: 'convergence_auditor',
      status: 'evaluated',
      data: {
        company: candidate.businessName,
        domain: candidate.domain,
        business_context: {
          lead_name: candidate.personnel?.[0]?.name || 'Owner',
          vertical: candidate.vertical
        },
        evaluation: candidate
      },
      primary_bottleneck: candidate.recommendedIntegrations?.[0]?.system || 'Unassessed systems environment',
      recommended_service: candidate.recommendedIntegrations?.[0]?.integration || 'AiWorXmiths MCP Integration'
    };

    console.log('[Server] Inserting integration evaluation record...');
    await postTable('discoveries', discoveryPayload);

    res.json({ success: true, candidate: leadResult });
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

