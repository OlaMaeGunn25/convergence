/**
 * Audit Runner
 * ============
 * Single source of truth for running one full CONVERGENCE-Ai audit pipeline
 * (scrape -> scour -> analyze -> workforce -> Google Scholar for legal). Used by
 * both the synchronous /api/audit endpoint and the automated audit scheduler so
 * the two paths can never drift.
 */

const { scrapeDomain } = require('./scraper');
const { analyzeFootprint } = require('./analyzer');
const { analyzeWorkforce } = require('./workforce');
const { scourBusiness } = require('./scourer');
const { searchScholar } = require('./scholar');

// withTimeout / isLegalVertical are shared with the HTTP gateway — see lib/util.js.
const { withTimeout, isLegalVertical } = require('./util');

/**
 * runAuditPipeline(domain, { apiKey, vertical })
 * @returns {Promise<object>} the unified audit package (same shape as /api/audit).
 */
async function runAuditPipeline(domain, { apiKey, vertical } = {}) {
  const activeApiKey = apiKey || process.env.FIRECRAWL_API_KEY || null;
  if (!activeApiKey || activeApiKey.trim() === '') {
    throw new Error('Firecrawl API key is required. Simulation mode is disabled on this server.');
  }

  const scrapedData = await withTimeout(scrapeDomain(domain, activeApiKey), 30000);

  const teamNames = (scrapedData.rawTeamData || []).map(m => m.name);
  const scourerData = await scourBusiness(
    scrapedData.domain, scrapedData.businessName, scrapedData.vertical, activeApiKey, teamNames
  );

  const analyzerData = analyzeFootprint(scrapedData);
  const workforceData = analyzeWorkforce(scrapedData);

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

  return {
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
    workforceData,
    ...(scholarData ? { scholarData } : {})
  };
}

module.exports = { runAuditPipeline, isLegalVertical, withTimeout };
