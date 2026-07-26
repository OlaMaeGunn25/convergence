/**
 * Task Request Interface (Phase 7, TRQ)
 * =====================================
 * Turns a natural-language request (typed or voice-transcribed — same path) into
 * the closest EXECUTABLE task, drawn ONLY from what the tenant's connected systems
 * can actually do (TRQ-02). Returns ranked candidates with a confidence score;
 * a low-confidence/ambiguous request is flagged for human disambiguation rather
 * than guessed (TRQ-03/04). A confirmed candidate feeds the governed task model.
 *
 * Pure over the Orchestrator's unified capability model + a hybrid matcher (reuses
 * the KB tokenizer) so it is deterministic and testable.
 */

const systemEvaluator = require('./system_evaluator');
const { keywordsOf } = require('./knowledge_ingest');

function humanize(s) { return String(s || '').replace(/_/g, ' '); }

/** Build the capability-populated task catalog for a tenant (connected only). */
async function buildCatalog({ tenantId, connectionRegistry }) {
  const model = await systemEvaluator.buildTenantCapabilityModel({ tenantId, connectionRegistry });
  const items = [];
  for (const sys of model.systems) {
    for (const cap of sys.capabilities) {
      const processes = (sys.processes || []).filter(p => (p.steps || []).includes(cap.name)).map(p => p.name);
      items.push({
        connectorId: sys.connectorId, system: sys.name, capability: cap.name, type: cap.type, processes,
        _text: `${sys.connectorId} ${sys.name} ${humanize(cap.name)} ${processes.join(' ')}`.toLowerCase()
      });
    }
  }
  return { model, items };
}

/** The full task catalog the UI can offer (populated from connected systems). */
async function suggestTasks({ tenantId, connectionRegistry }) {
  const { items } = await buildCatalog({ tenantId, connectionRegistry });
  return {
    count: items.length,
    tasks: items.map(i => ({
      connectorId: i.connectorId, system: i.system, capability: i.capability, type: i.type,
      action: `${humanize(i.capability)} via ${i.system}`
    }))
  };
}

/** Interpret a NL/voice request → ranked executable candidates + confidence. */
async function interpretRequest({ query, tenantId, connectionRegistry, threshold = 0.34, k = 5 }) {
  const { items } = await buildCatalog({ tenantId, connectionRegistry });
  const qk = keywordsOf(query || '');
  const qset = new Set(qk);
  const scored = items.map(it => {
    const tset = new Set(keywordsOf(it._text));
    let lex = 0; for (const t of qk) if (it._text.includes(t)) lex++;
    let inter = 0; for (const t of qset) if (tset.has(t)) inter++;
    const sem = qset.size ? inter / qset.size : 0;
    const score = 0.5 * (qk.length ? lex / qk.length : 0) + 0.5 * sem;
    return { it, score };
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, k);

  const candidates = scored.map(s => ({
    connectorId: s.it.connectorId, system: s.it.system, capability: s.it.capability, type: s.it.type,
    action: `${humanize(s.it.capability)} via ${s.it.system}`, score: Number(s.score.toFixed(3))
  }));
  const top = candidates[0] || null;
  const confidence = top ? top.score : 0;
  return {
    query, candidates, top, confidence,
    needsDisambiguation: !top || confidence < threshold,
    offeredFrom: items.length
  };
}

module.exports = { suggestTasks, interpretRequest, buildCatalog };
