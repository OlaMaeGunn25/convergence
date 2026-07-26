/**
 * Ingestion Adapters — every source builds out the company knowledge base
 * =======================================================================
 * One governed pipeline so that RAG, connector-read *scour*, on-prem/server crawl,
 * document *upload*, and *audit* intelligence ALL feed the same per-tenant KB
 * (`lib/knowledge_ingest.js`). Each adapter turns its raw source into
 * `[{ ref, text }]` documents; the dispatcher ingests them under the shared
 * read-only + HITL-scope-approved + provenance contract.
 *
 * Adapters:
 *   upload         — parse uploaded files (text or base64) into documents.
 *   connector_read — pull docs from a connected doc system (Drive/SharePoint/
 *                    Notion/Zendesk) via a live `fetcher`, else a labeled
 *                    simulated fallback so onboarding never blanks.
 *   audit_scour    — turn a systems-evaluation audit package into KB documents.
 *   on_prem_crawl  — roadmap (refused by the KB).
 */

// ── upload ────────────────────────────────────────────────────────────────────
function parseUpload(files = []) {
  return (files || []).map((f, i) => {
    let text = f.content || '';
    if (f.encoding === 'base64') {
      try { text = Buffer.from(f.content || '', 'base64').toString('utf8'); } catch (e) { text = ''; }
    }
    // Binary office formats (PDF/DOCX) need a real extractor; flag non-text so the
    // caller can wire pdf-parse/mammoth without changing this contract.
    const ct = (f.contentType || 'text/plain').toLowerCase();
    const needsExtractor = /pdf|officedocument|msword/.test(ct) && !text.trim();
    return { ref: f.name || `upload-${i + 1}`, text, contentType: ct, needsExtractor: needsExtractor || false };
  });
}

// ── connector_read (scour a connected doc system) ─────────────────────────────
const SIMULATED_CONNECTOR_DOCS = {
  google_workspace: [{ ref: 'Company Handbook.gdoc', text: 'Company handbook: standard operating procedures for client onboarding, escalation, and data handling.' }],
  microsoft365: [{ ref: 'Policies.docx', text: 'Corporate policies: information security, acceptable use, and records retention.' }],
  zendesk: [{ ref: 'KB: Refund policy', text: 'Refund policy: refunds are issued within 14 days; escalate disputes to a supervisor.' }]
};
function simulatedConnectorDocs(connectorId) {
  return SIMULATED_CONNECTOR_DOCS[connectorId] || [{ ref: `${connectorId}-doc`, text: `Documentation scoured from ${connectorId} (simulated).` }];
}

async function connectorRead({ connectorId, tenantId = null, query = null, limit = 25, fetcher = null } = {}) {
  if (typeof fetcher === 'function') {
    try {
      const docs = await fetcher(connectorId, { tenantId, query, limit });
      if (Array.isArray(docs)) return { simulated: false, docs };
    } catch (e) { /* fall through to simulated */ }
  }
  return { simulated: true, docs: simulatedConnectorDocs(connectorId) };
}

// ── audit_scour (systems-evaluation intelligence -> KB) ───────────────────────
function auditToDocs(auditPackage) {
  if (!auditPackage) return [];
  const p = auditPackage;
  const docs = [];
  const techs = (p.scrapedData && p.scrapedData.technologies || []).map(t => t.name).filter(Boolean);
  docs.push({ ref: 'audit-summary', text: `Systems evaluation for ${p.businessName || 'the business'} (vertical: ${p.vertical || 'general'}). Detected technologies: ${techs.join(', ') || 'none detected'}.` });
  if (p.analyzerData && p.analyzerData.swot) {
    const s = p.analyzerData.swot;
    docs.push({ ref: 'audit-swot', text: `SWOT — strengths: ${(s.strengths || []).map(x => x.title || x).join('; ')}. weaknesses: ${(s.weaknesses || []).map(x => x.title || x).join('; ')}.` });
  }
  if (p.integrationReadiness && p.integrationReadiness.recommendedIntegrations) {
    docs.push({ ref: 'integration-roadmap', text: `Recommended integrations: ${p.integrationReadiness.recommendedIntegrations.map(r => r.name).join(', ')}.` });
  }
  return docs;
}

/**
 * Dispatch an ingestion by source and build out the KB. Returns { source,
 * ingested, docs, simulated? }.
 */
async function ingestAll({ tenantId, source, files = [], connectorId = null, auditPackage = null, fetcher = null, knowledgeBase, approvedScope = false, actor = null } = {}) {
  if (!knowledgeBase) throw new Error('A knowledgeBase is required to ingest.');
  let docs = [];
  let simulated;
  if (source === 'upload') {
    docs = parseUpload(files);
  } else if (source === 'connector_read') {
    const r = await connectorRead({ connectorId, tenantId, fetcher });
    docs = r.docs; simulated = r.simulated;
  } else if (source === 'audit_scour') {
    docs = auditToDocs(auditPackage);
  } else if (source === 'on_prem_crawl') {
    // Refused by the KB (roadmap) — surface a clear error.
    return knowledgeBase.ingest({ tenantId, source, docs: [], approvedScope });
  } else {
    throw new Error(`Unknown ingestion source "${source}".`);
  }
  const ingestable = docs.filter(d => (d.text || '').trim());
  const res = await knowledgeBase.ingest({ tenantId, source, docs: ingestable, approvedScope, actor });
  return { source, ingested: res.ingested, docs: docs.map(d => ({ ref: d.ref, needsExtractor: d.needsExtractor })), ...(simulated !== undefined ? { simulated } : {}) };
}

module.exports = { parseUpload, connectorRead, auditToDocs, ingestAll };
