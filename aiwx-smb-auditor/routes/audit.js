/**
 * Audit routes — the synchronous audit endpoint and the automated audit queue.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const logger = require('../lib/logger');
const { sendError, asyncHandler } = require('../lib/http');
const { DOMAIN_REGEX, withTimeout, isLegalVertical } = require('../lib/util');
const { AUDITS_CACHE_DIR } = require('../lib/paths');
const { loadAuditQueue, saveAuditQueue } = require('../lib/stores/audit_queue');

const { scrapeDomain } = require('../lib/scraper');
const { analyzeFootprint } = require('../lib/analyzer');
const { analyzeWorkforce } = require('../lib/workforce');
const { searchScholar } = require('../lib/scholar');
const { matchIntegrations } = require('../lib/integration_matcher');

const router = express.Router();

/**
 * Persist a completed audit package to the on-disk cache. Best-effort: a cache
 * write failure is logged but never fails the request.
 */
function cacheAuditPackage(domain, auditPackage) {
  try {
    if (!fs.existsSync(AUDITS_CACHE_DIR)) {
      fs.mkdirSync(AUDITS_CACHE_DIR, { recursive: true });
    }
    const safeFilename = domain.replace(/[^a-zA-Z0-9.-]/g, '_') + '.json';
    fs.writeFileSync(path.join(AUDITS_CACHE_DIR, safeFilename), JSON.stringify(auditPackage, null, 2), 'utf-8');
    logger.info(`[Audit] Audit package saved to cache: ${safeFilename}`);
  } catch (fsErr) {
    logger.error(`[Audit] Failed to write audit package cache file :: ${fsErr.stack || fsErr.message}`);
  }
}

/**
 * Primary Audit Endpoint
 *
 * @openapi
 * /api/audit:
 *   post:
 *     summary: Run a full external audit for a domain
 *     responses:
 *       200: { description: Unified audit package }
 */
router.post('/api/audit', asyncHandler('[Audit]', 'Audit failed. Please try again.', async (req, res) => {
  const { domain, apiKey, vertical } = req.body;

  if (!domain || !DOMAIN_REGEX.test(domain.trim())) {
    return sendError(res, 400, 'Please provide a valid target domain name (e.g. example.com).', { context: '[Audit]' });
  }

  logger.info(`[Audit] Audit request received for domain: ${domain}`);

  // 1. Scrape domain (live Firecrawl only, simulation disabled)
  const activeApiKey = apiKey || process.env.FIRECRAWL_API_KEY || null;
  if (!activeApiKey || activeApiKey.trim() === '') {
    return sendError(res, 400, 'Firecrawl API key is required. Simulation mode is disabled on this server.', { context: '[Audit]' });
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
      logger.info(`[Audit] Legal vertical detected — running Google Scholar cross-reference: ${scholarQuery}`);
      const scholarResult = await withTimeout(searchScholar(scholarQuery, { num: 8 }), 25000);
      const expertPublications = (scholarResult.results || []).filter(r => r.type === 'expert_publication' || r.type === 'scientific_precedent').length;
      scholarData = {
        ...scholarResult,
        crossReferencedNames: teamNames,
        expertPublicationCount: expertPublications,
        verifiedCaseCitations: (scholarResult.results || []).filter(r => r.type === 'case_law').length
      };
    } catch (scholarErr) {
      logger.error(`[Audit] Scholar cross-reference failed (non-fatal) :: ${scholarErr.stack || scholarErr.message}`);
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

  cacheAuditPackage(scrapedData.domain, auditPackage);

  res.json(auditPackage);
}));

/**
 * Enqueue one or more domains for automated auditing (and toggle the loop).
 */
router.post('/api/audit-queue', (req, res) => {
  const { domains, active, vertical } = req.body || {};
  const queue = loadAuditQueue();
  if (Array.isArray(domains)) {
    for (const d of domains) {
      const domain = String(d || '').trim();
      if (!DOMAIN_REGEX.test(domain)) continue;
      if (queue.jobs.some(j => j.domain === domain && j.status === 'queued')) continue;
      queue.jobs.push({ id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, domain, vertical: vertical || null, status: 'queued', queuedAt: new Date().toISOString() });
    }
  }
  if (active !== undefined) queue.active = Boolean(active);
  saveAuditQueue(queue);
  res.json({ success: true, active: queue.active, queued: queue.jobs.filter(j => j.status === 'queued').length });
});

/**
 * Inspect the automated audit queue.
 */
router.get('/api/audit-queue', (req, res) => {
  res.json({ success: true, ...loadAuditQueue() });
});

module.exports = router;
