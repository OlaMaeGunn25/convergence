/**
 * Business Onboarding — Auto-Create the Company Knowledge Base (ONB-KB)
 * ====================================================================
 * When a business onboards (install), the system reviews that company's business
 * intelligence and AUTOMATICALLY scours + ingests it into a per-tenant company
 * knowledge base — no separate manual step (ONB-KB-01). The KB is seeded from the
 * intelligence the system already gathers: a synthesized business-intelligence
 * profile (purpose, customers, databases, connected systems) plus any operator-
 * provided SOP/manual/FAQ documents, all HITL-scope-approved and provenance-tagged
 * (ONB-KB-02). The onboarding operator initiating install IS the scope approval.
 */

const ingestionAdapters = require('./ingestion_adapters');

/** Synthesize a business-intelligence profile document from what onboarding knows. */
function buildProfileDoc({ businessName, vertical, purpose = null, customers = null, databases = null, systems = [] } = {}) {
  const lines = [];
  lines.push(`Company profile for ${businessName || 'the business'}. Business vertical: ${vertical || 'general'}.`);
  if (purpose) lines.push(`Company purpose: ${purpose}.`);
  if (customers) lines.push(`Primary customers: ${customers}.`);
  if (databases) lines.push(`Databases and systems of record: ${databases}.`);
  if (systems && systems.length) lines.push(`Connected or known systems: ${systems.join(', ')}.`);
  return { ref: 'business-intelligence-profile', text: lines.join(' ') };
}

/**
 * Create the company KB on onboarding.
 * @returns { tenantId, ingested, compiled }
 */
async function onboard({ tenantId, vertical = null, businessName = null, profile = {}, seedDocs = [], systems = [], auditPackage = null, knowledgeBase, actor = null }) {
  if (!knowledgeBase) throw new Error('A knowledgeBase is required to onboard business knowledge.');
  if (!tenantId) throw new Error('tenantId is required.');

  const profileDoc = buildProfileDoc(Object.assign({ businessName, vertical, systems }, profile));
  const sources = {};
  let ingested = 0;

  // The system-gathered business intelligence profile (connector_read source).
  const profileRes = await knowledgeBase.ingest({ tenantId, source: 'connector_read', docs: [profileDoc], approvedScope: true, actor });
  ingested += profileRes.ingested; sources.profile = profileRes.ingested;

  // Operator-provided SOPs/manuals/FAQs (upload source).
  if (Array.isArray(seedDocs) && seedDocs.length) {
    const seedRes = await knowledgeBase.ingest({ tenantId, source: 'upload', docs: seedDocs, approvedScope: true, actor });
    ingested += seedRes.ingested; sources.upload = seedRes.ingested;
  }

  // Systems-evaluation audit/scour intelligence (audit_scour source).
  if (auditPackage) {
    const auditRes = await ingestionAdapters.ingestAll({ tenantId, source: 'audit_scour', auditPackage, knowledgeBase, approvedScope: true, actor });
    ingested += auditRes.ingested; sources.audit_scour = auditRes.ingested;
  }

  const compiled = await knowledgeBase.compile({ tenantId });
  return { tenantId, ingested, sources, compiled };
}

module.exports = { onboard, buildProfileDoc };
