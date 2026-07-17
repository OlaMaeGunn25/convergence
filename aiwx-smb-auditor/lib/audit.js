/**
 * Gateway Governance — Immutable Audit Trail
 * ==========================================
 * Records who did what, when, and with what outcome for every governed mutation
 * and HITL decision. Two sinks, best-effort and non-blocking:
 *   1. Structured Winston/console line (always) — captured by cloud log drains.
 *   2. Supabase `audit_log` table (when Supabase is configured) — durable,
 *      queryable trail for compliance in legal/healthcare/finance verticals.
 *
 * recordAudit never throws and never blocks the response path; a failed audit
 * write is itself logged but does not fail the user's request.
 */

const { isSupabaseConfigured, insertRow } = require('./supabase');

/**
 * @param {object} entry
 *   - actor     {string}  Authenticated identity (req.actor) or 'unauthenticated'.
 *   - role      {string}  Caller role.
 *   - action    {string}  e.g. 'audit.run', 'post.publish', 'crm.export', 'hitl.action'.
 *   - resource  {string}  Target of the action (domain, post id, task id, ...).
 *   - outcome   {string}  'success' | 'failure' | 'pending'.
 *   - status    {number}  HTTP status, if applicable.
 *   - metadata  {object}  Small, non-sensitive contextual detail.
 *   - req       {object}  Optional Express req for ip/method/path enrichment.
 */
async function recordAudit(entry = {}) {
  const record = {
    ts: new Date().toISOString(),
    actor: entry.actor || 'unknown',
    role: entry.role || null,
    action: entry.action || `${entry.req ? entry.req.method + ' ' + entry.req.path : 'unknown'}`,
    resource: entry.resource != null ? String(entry.resource) : null,
    outcome: entry.outcome || 'success',
    status: entry.status != null ? entry.status : null,
    ip: entry.req ? (entry.req.ip || null) : null,
    metadata: entry.metadata || {}
  };

  // Always emit a structured local trail line.
  try {
    // eslint-disable-next-line no-console
    console.log(`[AUDIT] ${JSON.stringify(record)}`);
  } catch (e) { /* never throw from audit */ }

  // Durable sink (best-effort, fire-and-forget).
  if (isSupabaseConfigured()) {
    try {
      await insertRow('audit_log', record);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[AUDIT] Failed to persist audit_log row (non-fatal): ${err.message}`);
    }
  }
}

/**
 * Express middleware factory: after the response finishes, record an audit entry
 * for a governed route. Derives outcome from the HTTP status code.
 */
function auditOnFinish(action) {
  return (req, res, next) => {
    res.on('finish', () => {
      const outcome = res.statusCode >= 200 && res.statusCode < 400 ? 'success' : 'failure';
      recordAudit({
        actor: req.actor,
        role: req.role,
        action,
        resource: (req.body && (req.body.domain || req.body.id || req.body.platform)) || req.query.q || null,
        outcome,
        status: res.statusCode,
        req
      });
    });
    next();
  };
}

module.exports = { recordAudit, auditOnFinish };
