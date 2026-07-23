/**
 * Clio Connector (Legal Practice Management)
 * ==========================================
 * Talks to the Clio v4 REST API for the Legal vertical. Follows the same
 * governance + graceful-degradation contract as the rest of CONVERGENCE-Ai:
 *
 *   - Credentials come ONLY from env / Secret Manager (never over HTTP):
 *       CLIO_ACCESS_TOKEN (bearer), plus CLIO_CLIENT_ID/SECRET for OAuth refresh.
 *   - Read operations degrade to a clearly-labeled *simulated* dataset when no
 *     token is configured (like lib/scholar.js) so demos never blank — simulated
 *     rows are tagged `simulated:true` and must never be presented as live data.
 *   - Write operations are DESTRUCTIVE and, at the tool layer, require HITL
 *     approval. Trust-account transactions ALWAYS require approval — moving money
 *     held in trust is the highest-risk action a legal integration can take.
 *
 * Clio hosts data in regional data centers; set CLIO_REGION (us|eu|ca|au).
 */

const REGIONS = {
  us: 'https://app.clio.com',
  eu: 'https://eu.app.clio.com',
  ca: 'https://ca.app.clio.com',
  au: 'https://au.app.clio.com'
};

const API_VERSION = 'api/v4';

function baseUrl() {
  const region = (process.env.CLIO_REGION || 'us').toLowerCase();
  return REGIONS[region] || REGIONS.us;
}

function isClioConfigured() {
  return !!process.env.CLIO_ACCESS_TOKEN;
}

/** OAuth2 endpoints for the configured region (for the connection builder / docs). */
function oauthConfig() {
  return {
    authorizeUrl: `${baseUrl()}/oauth/authorize`,
    tokenUrl: `${baseUrl()}/oauth/token`,
    scopesNote: 'Request only the scopes the workflow needs (principle of least privilege).'
  };
}

/** Low-level authenticated request. Throws if not configured — callers fall back. */
async function clioRequest(resourcePath, { method = 'GET', body = null, query = '' } = {}) {
  if (!isClioConfigured()) throw new Error('Clio is not configured (CLIO_ACCESS_TOKEN missing).');
  if (typeof fetch !== 'function') throw new Error('global fetch unavailable in this runtime.');
  const url = `${baseUrl()}/${API_VERSION}/${resourcePath}${query ? `?${query}` : ''}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.CLIO_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`Clio API ${method} ${resourcePath} failed: ${res.status}`);
  return res.json();
}

// ── Simulated fallback datasets (clearly labeled) ────────────────────────────
function simulated(kind, rows) {
  return { success: true, simulated: true, provenance: 'simulated', source: 'clio_simulator', kind, data: rows };
}

const SIM_MATTERS = [
  { id: 101, display_number: '00001-Smith', description: 'Smith v. Regional Insurance — MVA', status: 'open', practice_area: 'Personal Injury' },
  { id: 102, display_number: '00002-Delgado', description: 'Delgado Estate Planning', status: 'open', practice_area: 'Estate' }
];
const SIM_CONTACTS = [
  { id: 5001, name: 'Maria Smith', type: 'Person', primary_email_address: 'maria@example.com' },
  { id: 5002, name: 'Delgado Family Trust', type: 'Company' }
];
const SIM_ACTIVITIES = [
  { id: 9001, type: 'TimeEntry', quantity: 1.5, note: 'Draft demand letter', matter: { id: 101 } }
];

// ── Read operations (degrade to simulated) ───────────────────────────────────
async function listMatters({ limit = 25 } = {}) {
  try {
    const res = await clioRequest('matters.json', { query: `limit=${limit}` });
    return { success: true, simulated: false, provenance: 'live', kind: 'matters', data: res.data || res };
  } catch (e) {
    return simulated('matters', SIM_MATTERS);
  }
}
async function listContacts({ limit = 25 } = {}) {
  try {
    const res = await clioRequest('contacts.json', { query: `limit=${limit}` });
    return { success: true, simulated: false, provenance: 'live', kind: 'contacts', data: res.data || res };
  } catch (e) {
    return simulated('contacts', SIM_CONTACTS);
  }
}
async function listActivities({ limit = 25 } = {}) {
  try {
    const res = await clioRequest('activities.json', { query: `limit=${limit}` });
    return { success: true, simulated: false, provenance: 'live', kind: 'activities', data: res.data || res };
  } catch (e) {
    return simulated('activities', SIM_ACTIVITIES);
  }
}

// ── Write operations (DESTRUCTIVE — gated by HITL at the tool layer) ──────────
async function createActivity({ matterId, quantity, note, type = 'TimeEntry' }) {
  const payload = { data: { type, quantity, note, matter: { id: matterId } } };
  if (!isClioConfigured()) {
    return { success: true, simulated: true, staged: true, kind: 'activity', wouldCreate: payload.data,
      note: 'Simulated (no CLIO_ACCESS_TOKEN). In production this creates a billable activity after HITL approval.' };
  }
  const res = await clioRequest('activities.json', { method: 'POST', body: payload });
  return { success: true, simulated: false, kind: 'activity', data: res.data || res };
}

async function createMatter({ clientId, description, practiceArea }) {
  const payload = { data: { description, practice_area: practiceArea, client: { id: clientId } } };
  if (!isClioConfigured()) {
    return { success: true, simulated: true, staged: true, kind: 'matter', wouldCreate: payload.data,
      note: 'Simulated (no CLIO_ACCESS_TOKEN). In production this opens a matter after HITL approval.' };
  }
  const res = await clioRequest('matters.json', { method: 'POST', body: payload });
  return { success: true, simulated: false, kind: 'matter', data: res.data || res };
}

/**
 * Record a trust-account (IOLTA) transaction. HIGHEST-RISK operation: money held
 * in trust on a client's behalf. ALWAYS requires human approval — the tool
 * registry marks this requiresApproval, and this function additionally refuses to
 * proceed unless the caller passes an explicit approval flag.
 */
async function recordTrustTransaction({ matterId, amount, kind, memo, approved = false }) {
  if (!approved) {
    return { success: false, requiresApproval: true, kind: 'trust_transaction',
      message: 'Trust-account transactions require explicit human approval (IOLTA compliance).',
      pending: { matterId, amount, kind, memo } };
  }
  const payload = { data: { matter: { id: matterId }, amount, type: kind, description: memo } };
  if (!isClioConfigured()) {
    return { success: true, simulated: true, staged: true, kind: 'trust_transaction', wouldRecord: payload.data,
      note: 'Simulated (no CLIO_ACCESS_TOKEN). Approved trust entry; would post to Clio in production.' };
  }
  const res = await clioRequest('trust_line_items.json', { method: 'POST', body: payload });
  return { success: true, simulated: false, kind: 'trust_transaction', data: res.data || res };
}

/**
 * Map a Clio webhook event to a CONVERGENCE-Ai task descriptor (for task_model).
 * High-risk events (bills, trust) are flagged requiresApproval so the orchestrator
 * routes them through HITL rather than auto-executing.
 */
function mapWebhookToTask(event = {}) {
  const kind = event.event || event.type || 'unknown';
  const data = event.data || event.payload || {};
  const TABLE = {
    'matter.created': { type: 'clio.matter.review', requiresApproval: false, summary: 'Review newly opened matter' },
    'contact.created': { type: 'clio.contact.enrich', requiresApproval: false, summary: 'Enrich new contact' },
    'activity.created': { type: 'clio.activity.review', requiresApproval: false, summary: 'Review logged activity' },
    'bill.created': { type: 'clio.bill.review', requiresApproval: true, summary: 'Review bill before send' },
    'trust.transaction.created': { type: 'clio.trust.review', requiresApproval: true, summary: 'Review trust transaction (IOLTA)' }
  };
  const entry = TABLE[kind] || { type: 'clio.event.unhandled', requiresApproval: true, summary: `Unhandled Clio event: ${kind}` };
  return {
    type: entry.type,
    status: entry.requiresApproval ? 'pending_approval' : 'proposed',
    actor: 'clio-webhook',
    payload: { source: 'clio', event: kind, summary: entry.summary, data },
    provenance: { source: 'clio_webhook', event: kind }
  };
}

module.exports = {
  isClioConfigured, oauthConfig, baseUrl, REGIONS,
  listMatters, listContacts, listActivities,
  createActivity, createMatter, recordTrustTransaction,
  mapWebhookToTask
};
