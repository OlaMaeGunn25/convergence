/**
 * Integration Matcher
 * ===================
 * The additive half of the Auditor reframe (see docs/AUDITOR_REFRAME.md): given a
 * company's detected systems + vertical, decide WHICH systems can/should connect
 * to the governed MCP layer and produce a prioritized integration ROADMAP.
 *
 * Readiness tiers:
 *   - ready        a connector's signature matched a *detected technology* — the
 *                  system is demonstrably in use; connect it first.
 *   - likely       matched the company's vertical/domain/name — probable fit.
 *   - exploratory  a high-value universal (CRM/accounting/calendar/docs) worth
 *                  proposing even without a detected signature.
 *
 * Pure + deterministic (no network) so it is unit-testable and safe to run inside
 * the audit pipeline.
 */

const catalog = require('./connectors/catalog');

// Universal connectors always worth surfacing as an exploratory baseline.
const HIGH_VALUE_UNIVERSAL = new Set(['hubspot', 'quickbooks', 'google_calendar', 'google_workspace']);

function credsConfigured(connector) {
  return (connector.envKeys || []).every(k => !!process.env[k]);
}

function buildRationale(connector, readiness, matchedOn) {
  if (readiness === 'ready') {
    return `Detected ${connector.name} (or a direct signal: ${matchedOn.join(', ')}) in the company's live stack — connect via ${connector.kind.toUpperCase()} to automate ${connector.category.toLowerCase()}.`;
  }
  if (readiness === 'likely') {
    return `No direct signature, but ${connector.name} is a strong fit for this profile (${matchedOn.join(', ')}). Confirm usage, then connect.`;
  }
  return `${connector.name} is a high-value ${connector.category.toLowerCase()} integration most SMBs benefit from; propose during discovery.`;
}

/**
 * matchIntegrations({ technologies, vertical, businessName, domain })
 * @param technologies array of { name, category } from the scraper.
 * @returns { detectedSystems, recommendedIntegrations, roadmap, summary }
 */
function matchIntegrations({ technologies = [], vertical = '', businessName = '', domain = '' } = {}) {
  const techBlob = (technologies || []).map(t => `${t.name || ''} ${t.category || ''}`).join(' | ').toLowerCase();
  const contextBlob = `${vertical} ${businessName} ${domain}`.toLowerCase();

  const detectedSystems = (technologies || []).map(t => ({
    name: t.name, category: t.category || 'Unknown', source: 'live_crawl'
  }));

  const recommendations = [];
  for (const c of catalog.list()) {
    const techMatches = c.matchSignals.filter(s => techBlob.includes(s.toLowerCase()));
    const contextMatches = c.matchSignals.filter(s => contextBlob.includes(s.toLowerCase()));
    const verticalAffinity = Array.isArray(c.vertical) &&
      c.vertical.some(x => x.toLowerCase() === (vertical || '').toLowerCase());

    let readiness = null, priority = 99, matchedOn = [];
    if (techMatches.length) {
      readiness = 'ready'; priority = 1; matchedOn = techMatches;
    } else if (contextMatches.length || verticalAffinity) {
      readiness = 'likely'; priority = 2;
      matchedOn = contextMatches.length ? contextMatches : [`vertical:${vertical}`];
    } else if (c.vertical === 'universal' && HIGH_VALUE_UNIVERSAL.has(c.id)) {
      readiness = 'exploratory'; priority = 3; matchedOn = ['universal-baseline'];
    }
    if (!readiness) continue;

    recommendations.push({
      connectorId: c.id, name: c.name, category: c.category,
      kind: c.kind, auth: c.auth, status: c.status,
      readiness, priority, matchedOn,
      credentialsConfigured: credsConfigured(c),
      requiredEnvKeys: c.envKeys || [],
      governance: {
        requiresApprovalToConnect: true,
        destructiveCapabilities: c.destructiveCapabilities || []
      },
      rationale: buildRationale(c, readiness, matchedOn)
    });
  }

  recommendations.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

  const roadmap = recommendations.map((r, i) => ({
    order: i + 1,
    phase: r.priority, // 1 = ready, 2 = likely, 3 = exploratory
    connectorId: r.connectorId,
    name: r.name,
    action: `Connect ${r.name} via ${r.kind.toUpperCase()} (${r.auth})`,
    blockedBy: r.credentialsConfigured ? null : `Provide credentials: ${r.requiredEnvKeys.join(', ') || 'n/a'}`
  }));

  const summary = {
    detectedSystems: detectedSystems.length,
    recommended: recommendations.length,
    ready: recommendations.filter(r => r.readiness === 'ready').length,
    likely: recommendations.filter(r => r.readiness === 'likely').length,
    exploratory: recommendations.filter(r => r.readiness === 'exploratory').length
  };

  return { detectedSystems, recommendedIntegrations: recommendations, roadmap, summary, generatedAt: new Date().toISOString() };
}

module.exports = { matchIntegrations };
