/**
 * Gateway middleware
 * ==================
 * Every cross-cutting concern applied ahead of the routers: security headers,
 * request logging, CORS/caching, rate limiting, the governance layer (auth +
 * audit trail), and static asset mounts.
 *
 * Order matters and is preserved exactly as it was in the monolithic server.js:
 * body parsing -> security headers -> request logging -> compression ->
 * cache/CORS -> governance -> rate limits -> docs -> static.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const compression = require('compression');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const logger = require('./logger');
const { authenticate } = require('./auth');
const { auditOnFinish } = require('./audit');
const { SOCIAL_AGENT_DIR, ADMIN_DIST_DIR, PUBLIC_DIR, APP_ROOT } = require('./paths');

// --- CORS allowlist ---------------------------------------------------------

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

function cacheAndCors(req, res, next) {
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
}

// --- Rate limiting ----------------------------------------------------------
// Global API ceiling plus tighter limits on expensive endpoints.

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

const scholarLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_SCHOLAR_PER_MIN, 10) || 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Google Scholar search rate limit reached. Please wait.' }
});

// --- Governance -------------------------------------------------------------
// Authentication (fail-closed once a key is configured) is applied to every
// side-effectful endpoint; high-value actions also emit an audit_log entry.

const PROTECTED_MUTATIONS = [
  '/api/audit',
  '/api/publish-post',
  '/api/outreach-send',
  '/api/run-prospecting',
  '/api/scout-prospects',
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
  '/api/audit-queue'
];

const AUDITED_ACTIONS = [
  ['/api/audit', 'audit.run'],
  ['/api/publish-post', 'post.publish'],
  ['/api/outreach-send', 'outreach.send'],
  ['/api/run-prospecting', 'prospecting.run'],
  ['/api/export-crm', 'crm.export']
];

// --- Static asset serving ---------------------------------------------------
// SECURITY: the social agent folder also holds session cookies, API
// credentials, and schedule state under config/ — those must never be reachable
// over HTTP, so only whitelisted asset extensions are served and sensitive
// paths are hard-blocked.

const SOCIAL_ASSET_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.html', '.css', '.ttf', '.woff', '.woff2', '.mp4', '.pdf']);
const SOCIAL_BLOCKED_PATH = /^\/(config|chrome_junction|temp_profile|__pycache__)(\/|$)|\.env|cookie|credential|\.pem|\.key$/i;

function noCacheHtml(res, filePath) {
  if (filePath.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}

function socialAssetGuard(req, res, next) {
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
    setHeaders: (res2, filePath) => noCacheHtml(res2, filePath)
  })(req, res, next);
}

// --- OpenAPI ----------------------------------------------------------------

const swaggerSpec = swaggerJsdoc({
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
  // Annotations now live alongside the handlers in routes/, so both are scanned.
  apis: [
    path.join(APP_ROOT, 'server.js'),
    path.join(APP_ROOT, 'routes', '*.js')
  ]
});

/**
 * Apply the full pre-router middleware stack to an Express app, in order.
 */
function applyMiddleware(app) {
  // Behind a cloud load balancer / reverse proxy, trust the first hop so
  // req.ip and the rate limiter see the real client address.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '2mb' }));
  app.use(helmet({ contentSecurityPolicy: false }));

  // Structured HTTP request logging routed through Winston
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: { write: (msg) => logger.info(msg.trim()) }
  }));

  app.use(compression());
  app.use(cacheAndCors);

  app.use(PROTECTED_MUTATIONS, authenticate);
  for (const [route, action] of AUDITED_ACTIONS) {
    app.use(route, auditOnFinish(action));
  }

  app.use('/api/', globalApiLimiter);
  app.use('/api/audit', auditLimiter);
  app.use('/api/scout-prospects', scoutLimiter);
  app.use('/api/scholar/search', scholarLimiter);
  app.use('/api/publish-post', publishLimiter);
  app.use('/api/outreach-send', publishLimiter);
  app.use('/api/run-prospecting', publishLimiter);

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Serve static assets from public/ with HTML cache-busting headers
  app.use(express.static(PUBLIC_DIR, { setHeaders: noCacheHtml }));

  // Mount the social media logs directory to serve execution screenshots
  app.use('/logs', express.static(path.join(SOCIAL_AGENT_DIR, 'logs'), { dotfiles: 'deny' }));

  // Serve the admin agent's production Vite build (if present) under /admin
  if (fs.existsSync(ADMIN_DIST_DIR)) {
    app.use('/admin', express.static(ADMIN_DIST_DIR, { dotfiles: 'deny' }));
    logger.info(`[BOOT] Admin dashboard mounted at /admin from ${ADMIN_DIST_DIR}`);
  } else {
    logger.warn(`[BOOT] Admin Vite build not found at ${ADMIN_DIST_DIR} — /admin not mounted. Run "npm run build" in aiwx-admin-agent.`);
  }

  app.use('/', socialAssetGuard);
}

module.exports = { applyMiddleware, isOriginAllowed, ALLOWED_ORIGINS, PROTECTED_MUTATIONS, swaggerSpec };
