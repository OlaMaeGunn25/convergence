/**
 * Connection Preconditions (PRE)
 * ==============================
 * Most connectors need a credential. Some need a great deal more before a
 * credential is even issuable: a signed agreement, a specific vertical, a
 * regulatory posture, a vendor registration, an approval from the counterparty's
 * own organisation. Those are PRECONDITIONS, and they are out-of-band — no amount
 * of correct code satisfies them.
 *
 * Modelling them explicitly does three things a "status: coming soon" label
 * cannot:
 *
 *   1. It tells a tenant exactly what THEY must do, in order, before the
 *      connection is even possible — rather than letting them discover it by
 *      failing.
 *   2. It keeps the connector honest. A connector with unmet blocking
 *      preconditions cannot be bound, so the system can never claim a connection
 *      it is not entitled to make (invariant I1, extended backwards).
 *   3. It produces evidence. Each attestation records who attested, when, and to
 *      what reference — which is what an auditor asks for when the question is
 *      "on what basis did you access this data".
 *
 * Scopes:
 *   tenant      — a fact about the business itself
 *   vertical    — the tenant must be operating on a particular vertical
 *   compliance  — a regulatory instrument must be in place
 *   vendor      — an out-of-band step with the system's vendor
 *   technical   — configuration/credential material must be present
 *
 * Verification:
 *   automatic   — the system can check it, and does
 *   attestation — only a human can assert it; recorded with identity and time
 *
 * A precondition that is `blocking` prevents connection. A non-blocking one is
 * advisory and surfaces as a warning.
 */

const { copy } = require('./immutable');

const SCOPES = ['tenant', 'vertical', 'compliance', 'vendor', 'technical'];
const VERIFICATION = ['automatic', 'attestation'];

/**
 * Attestations are claims by a named human, not by an agent. An agent asserting
 * that a BAA exists is worth nothing; a named person with a company-domain
 * identity asserting it is a record.
 */
function recordAttestation({ tenantId, connectorId, preconditionId, attestedBy, reference = null, at = null } = {}) {
  if (!tenantId || !connectorId || !preconditionId) {
    return { ok: false, error: 'tenantId, connectorId and preconditionId are required.' };
  }
  if (!attestedBy || !/@/.test(String(attestedBy))) {
    return { ok: false, error: 'A named human identity (company-domain email) must attest a precondition.' };
  }
  return {
    ok: true,
    attestation: {
      tenantId, connectorId, preconditionId,
      attestedBy,
      // e.g. a contract reference, a ticket, an Epic client ID — whatever makes
      // the claim checkable later by a person who was not present.
      reference: reference || null,
      at: at || new Date().toISOString()
    }
  };
}

/** Run the automatic checks a precondition declares. */
function checkAutomatic(pre, ctx) {
  const { tenant = {}, env = process.env } = ctx || {};

  switch (pre.scope) {
    case 'vertical': {
      const want = String(pre.requiresVertical || '').toLowerCase();
      const have = String(tenant.vertical || '').toLowerCase();
      return { met: !!want && want === have, observed: have || null };
    }
    case 'tenant': {
      if (pre.requiresField) {
        const v = tenant[pre.requiresField];
        return { met: !!(v && String(v).trim()), observed: v ? 'present' : 'absent' };
      }
      return { met: false, observed: null };
    }
    case 'technical': {
      const keys = pre.requiresEnv || [];
      const missing = keys.filter(k => !env[k]);
      return { met: keys.length > 0 && missing.length === 0, observed: missing.length ? `missing: ${missing.join(', ')}` : 'configured' };
    }
    default:
      return { met: false, observed: null };
  }
}

/**
 * Evaluate every precondition for a connector.
 *
 * @returns { connectorId, ready, blockers[], met[], pending[], nextAction }
 */
function evaluate({ connectorId, preconditions = [], tenant = {}, attestations = [], env = process.env } = {}) {
  const byId = new Map();
  for (const a of attestations) {
    if (a && a.connectorId === connectorId && a.preconditionId) byId.set(a.preconditionId, a);
  }

  const met = [];
  const pending = [];
  const blockers = [];

  for (const pre of preconditions) {
    let state, evidence = null, observed = null;

    if (pre.verification === 'automatic') {
      const res = checkAutomatic(pre, { tenant, env });
      state = res.met ? 'verified' : 'unmet';
      observed = res.observed;
    } else {
      const att = byId.get(pre.id);
      state = att ? 'attested' : 'unmet';
      evidence = att ? { attestedBy: att.attestedBy, at: att.at, reference: att.reference } : null;
    }

    const row = {
      id: pre.id, scope: pre.scope, label: pre.label, detail: pre.detail || null,
      verification: pre.verification, blocking: pre.blocking !== false,
      state, evidence, observed
    };

    if (state === 'unmet') {
      pending.push(row);
      if (row.blocking) blockers.push(row);
    } else {
      met.push(row);
    }
  }

  // The single most useful field: what to do next, rather than a list to decode.
  const next = blockers[0] || pending[0] || null;

  return {
    connectorId,
    ready: blockers.length === 0,
    total: preconditions.length,
    metCount: met.length,
    blockers: copy(blockers),
    pending: copy(pending),
    met: copy(met),
    nextAction: next ? { id: next.id, label: next.label, detail: next.detail, verification: next.verification } : null
  };
}

/**
 * Gate used by the connection builder. A connector whose blocking preconditions
 * are unmet cannot move toward `connected` — the refusal names the specific
 * precondition rather than failing generically, because "you are not allowed to
 * connect this" is useless without "and here is the one thing standing in the way".
 */
function gate(evaluation) {
  if (!evaluation) return { ok: true };
  if (evaluation.ready) return { ok: true };
  const b = evaluation.blockers[0];
  return {
    ok: false,
    status: 'preconditions_unmet',
    blockerId: b.id,
    reason: `Cannot connect ${evaluation.connectorId}: ${b.label}. ${b.detail || ''}`.trim(),
    remaining: evaluation.blockers.length
  };
}

module.exports = { SCOPES, VERIFICATION, recordAttestation, evaluate, gate, checkAutomatic };
