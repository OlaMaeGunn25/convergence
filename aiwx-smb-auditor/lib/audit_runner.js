/**
 * Audit Runner — Systems Evaluation & Integration-Readiness pipeline
 * ==================================================================
 * Evaluates a company's technology stack and server/infrastructure environment
 * to determine which systems can/should be connected to the CONVERGENCE-Ai
 * governed MCP layer, and returns a provenance-scored report. Used by both the
 * synchronous /api/audit endpoint and the automated audit scheduler so the two
 * paths can never drift.
 *
 * NOTE: the public pre-sales *prospecting* layer (public-records scouring,
 * prospect scouting, outreach/pitch generation) has been removed from
 * CONVERGENCE-Ai — that is a sales-enablement function and lives in ASES
 * (repo aiworxmiths-cdqe). See docs/AUDITOR_REFRAME.md.
 */

const { scrapeDomain } = require('./scraper');
const { analyzeFootprint } = require('./analyzer');
const { analyzeWorkforce } = require('./workforce');
const { searchScholar } = require('./scholar');
const { matchIntegrations } = require('./integration_matcher');

// withTimeout / isLegalVertical are shared with the HTTP gateway — see lib/util.js.
const { withTimeout, isLegalVertical } = require('./util');

// Data-provenance & reporting governance (the "WHAT is true" half of AI TRiSM).
const { tagDataPoint, DATA_SOURCE } = require('./fact_checker');
const {
  AuditTrailLogger, classifyDistribution, generateMethodologyDisclosure,
  generateDisclaimer, validateForDelivery, getPercentileContext
} = require('./reporting_framework');

/**
 * runAuditPipeline(domain, { apiKey, vertical })
 * @returns {Promise<object>} the unified audit package (same shape as /api/audit).
 */
async function runAuditPipeline(domain, { apiKey, vertical } = {}) {
  const activeApiKey = apiKey || process.env.FIRECRAWL_API_KEY || null;
  if (!activeApiKey || activeApiKey.trim() === '') {
    throw new Error('Firecrawl API key is required. Simulation mode is disabled on this server.');
  }

  // Audit trail: records every extraction phase (ISO 27001 A.12.4) and collects
  // provenance-tagged data points for the report reliability score.
  const auditLogger = new AuditTrailLogger(domain.trim(), null);
  auditLogger.log('init', 'Audit pipeline started', 'success', { domain: domain.trim() });

  const scrapedData = await withTimeout(scrapeDomain(domain, activeApiKey), 30000);
  auditLogger.log('scraper', 'Domain scrape completed', 'success', {
    techCount: scrapedData.technologies?.length || 0
  });
  auditLogger.businessName = scrapedData.businessName;

  // Tag detected technologies + firewall as live-sourced data points.
  (scrapedData.technologies || []).forEach(tech => {
    auditLogger.registerDataPoint(tagDataPoint(
      tech.name, DATA_SOURCE.LIVE_CRAWL, tech.confidence || 0.85,
      `Technology detected (category: ${tech.category})`,
      'HTML source + HTTP header + cookie + CNAME multi-vector detection'
    ));
  });
  if (scrapedData.firewallAudit) {
    auditLogger.registerDataPoint(tagDataPoint(
      scrapedData.firewallAudit, DATA_SOURCE.LIVE_HEADER_SCAN,
      scrapedData.firewallAudit.wafConfidence || 0.85,
      'Direct HTTPS header inspection at port 443',
      'WAF signature detection + security header analysis'
    ));
  }

  // teamNames feeds the legal-vertical Scholar cross-reference below.
  const teamNames = (scrapedData.rawTeamData || []).map(m => m.name);

  const analyzerData = analyzeFootprint(scrapedData);
  const workforceData = analyzeWorkforce(scrapedData);
  auditLogger.log('analyzer', 'SWOT + readiness analysis completed', 'success', {
    overallScore: analyzerData.metrics?.overallHealth
  });

  // Integration-readiness: map the detected systems to CONVERGENCE-Ai connectors
  // and produce a prioritized MCP/API integration roadmap (the core deliverable
  // of the reframed systems-evaluation Auditor — see docs/AUDITOR_REFRAME.md).
  const integrationReadiness = matchIntegrations({
    technologies: scrapedData.technologies,
    vertical: scrapedData.vertical,
    businessName: scrapedData.businessName,
    domain: scrapedData.domain
  });
  auditLogger.log('integration_matcher', 'Integration-readiness roadmap generated', 'success', {
    detected: integrationReadiness.summary.detectedSystems,
    recommended: integrationReadiness.summary.recommended
  });

  // Tag AI-readiness dimensions (inferred) + attach SMB peer percentile context.
  if (analyzerData.aiReadinessScorecard && Array.isArray(analyzerData.aiReadinessScorecard.dimensions)) {
    analyzerData.aiReadinessScorecard.dimensions.forEach(dim => {
      auditLogger.registerDataPoint(tagDataPoint(
        dim.score, DATA_SOURCE.INFERRED, 0.60,
        'Scored via calibrated multi-factor model (MIT Sloan / BCG 2024 alignment)',
        `${dim.name} dimension scoring`
      ));
      dim.percentileContext = getPercentileContext(dim.score, dim.name, scrapedData.vertical);
    });
  }

  let scholarData = null;
  if (isLegalVertical(vertical, scrapedData.vertical, scrapedData.businessName)) {
    try {
      const primaryName = teamNames[0];
      const scholarQuery = primaryName
        ? `"${scrapedData.businessName}" "${primaryName}" case law precedent`
        : `"${scrapedData.businessName}" legal precedent`;
      const scholarResult = await withTimeout(searchScholar(scholarQuery, { num: 8 }), 25000);
      const expertPublications = (scholarResult.results || []).filter(r => r.type === 'expert_publication' || r.type === 'scientific_precedent').length;
      scholarData = {
        ...scholarResult,
        crossReferencedNames: teamNames,
        expertPublicationCount: expertPublications,
        verifiedCaseCitations: (scholarResult.results || []).filter(r => r.type === 'case_law').length
      };
    } catch (scholarErr) {
      scholarData = { success: false, error: scholarErr.message, results: [] };
    }
  }

  // ── Reporting governance: reliability, distribution gate, methodology,
  //    disclaimer, and pre-delivery validation (AI TRiSM data-quality layer). ──
  auditLogger.log('governance', 'Reporting framework validation started', 'success');
  const auditTrail = auditLogger.finalize();
  const reliability = auditTrail.reliability;
  const methodology = generateMethodologyDisclosure(
    { domain: scrapedData.domain, businessName: scrapedData.businessName, timestamp: new Date().toISOString() },
    reliability
  );
  const distribution = classifyDistribution(reliability);
  const disclaimer = generateDisclaimer(distribution, reliability);

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
    ...(scholarData ? { scholarData } : {}),
    reportGovernance: { reliability, distribution, methodology, disclaimer }
  };

  const validation = validateForDelivery(auditPackage, auditTrail);
  auditPackage.reportGovernance.validation = validation;
  auditPackage.reportGovernance.auditTrail = auditTrail;
  return auditPackage;
}

module.exports = { runAuditPipeline, isLegalVertical, withTimeout };
