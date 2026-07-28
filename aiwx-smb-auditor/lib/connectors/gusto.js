/**
 * Gusto Connector (HR, Payroll & Benefits)
 * ========================================
 * Gusto is the SMB HR system of record. This connector lets the tenant's agents —
 * principally the HUMAN COMPANION (HR generalist) agent — read employee/time-off
 * state and submit HR requests on the employee's behalf, so a Convergence
 * installation can manage HR requests end-to-end through the HITL companion.
 *
 * Governance (this connector is unusually sensitive — treat it as such):
 *   - Credentials ONLY from env / Secret Manager (never over HTTP):
 *       GUSTO_ACCESS_TOKEN (bearer) + GUSTO_CLIENT_ID/SECRET for OAuth refresh.
 *   - Reads degrade to a clearly-labeled *simulated* dataset when unconfigured
 *     (same contract as scholar/clio) so onboarding + demos never blank.
 *   - Writes are DESTRUCTIVE and require HITL approval at the tool layer.
 *   - PAYROLL + TERMINATION sit on the COMPLIANCE FLOOR (see lib/autonomy.js):
 *     they move employee money / end employment and can never be delegated by a
 *     standard autonomy grant — only an elevated grant or explicit approval.
 *   - Compensation and payroll figures are CONFIDENTIAL: they belong to the
 *     human-care plane (see lib/human_companion.js) and must not be surfaced to
 *     business/ops agents. `redactCompensation()` enforces that at the boundary.
 *
 * Gusto uses versioned REST endpoints; set GUSTO_API_URL for the demo sandbox
 * (https://api.gusto-demo.com) vs. production (https://api.gusto.com).
 */

const API_VERSION = 'v1';

function baseUrl() {
  return process.env.GUSTO_API_URL || 'https://api.gusto.com';
}

function isGustoConfigured() {
  return !!process.env.GUSTO_ACCESS_TOKEN;
}

/** OAuth2 endpoints (for the connection builder / docs). */
function oauthConfig() {
  return {
    authorizeUrl: `${baseUrl()}/oauth/authorize`,
    tokenUrl: `${baseUrl()}/oauth/token`,
    scopesNote: 'Request only the scopes the workflow needs (principle of least privilege).'
  };
}

/** Low-level authenticated request. Throws if unconfigured — callers fall back. */
async function gustoRequest(resourcePath, { method = 'GET', body = null, query = '' } = {}) {
  if (!isGustoConfigured()) throw new Error('Gusto is not configured (GUSTO_ACCESS_TOKEN missing).');
  if (typeof fetch !== 'function') throw new Error('global fetch unavailable in this runtime.');
  const url = `${baseUrl()}/${API_VERSION}/${resourcePath}${query ? `?${query}` : ''}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GUSTO_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`Gusto API ${method} ${resourcePath} failed: ${res.status}`);
  return res.json();
}

// ── Simulated fallback datasets (clearly labeled) ────────────────────────────
function simulated(kind, rows) {
  return { success: true, simulated: true, provenance: 'simulated', source: 'gusto_simulator', kind, data: rows };
}

const SIM_EMPLOYEES = [
  { id: 'emp_1001', first_name: 'Dana', last_name: 'Ruiz', email: 'dana@example.com', department: 'Operations', jobs: [{ title: 'Operations Specialist' }] },
  { id: 'emp_1002', first_name: 'Sam', last_name: 'Whitfield', email: 'sam@example.com', department: 'Support', jobs: [{ title: 'Support Lead' }] }
];
const SIM_TIME_OFF = [
  { id: 'to_5001', employee_id: 'emp_1001', policy: 'Vacation', status: 'pending', start_date: '2026-08-04', end_date: '2026-08-08', hours: 40 },
  { id: 'to_5002', employee_id: 'emp_1002', policy: 'Sick', status: 'approved', start_date: '2026-07-15', end_date: '2026-07-15', hours: 8 }
];
const SIM_PAYROLLS = [
  { id: 'pay_9001', pay_period: { start_date: '2026-07-01', end_date: '2026-07-15' }, processed: true, check_date: '2026-07-20' }
];

/**
 * Strip compensation/payroll figures before anything crosses to the business/ops
 * plane. The Human Companion may see them; task agents may not (HRC-03).
 */
function redactCompensation(record) {
  if (!record || typeof record !== 'object') return record;
  if (Array.isArray(record)) return record.map(redactCompensation);
  const SENSITIVE = /^(compensation|payment_method|salary|rate|hourly_rate|annual_salary|net_pay|gross_pay|taxes|deductions|ssn|social_security_number)$/i;
  const out = {};
  for (const [k, v] of Object.entries(record)) {
    if (SENSITIVE.test(k)) { out[k] = '[redacted — confidential HR/compensation data]'; continue; }
    out[k] = (v && typeof v === 'object') ? redactCompensation(v) : v;
  }
  return out;
}

// ── Read operations (degrade to simulated) ───────────────────────────────────
async function listEmployees({ companyId = null, limit = 25, includeCompensation = false } = {}) {
  let res;
  try {
    const data = await gustoRequest(`companies/${companyId || process.env.GUSTO_COMPANY_ID || 'me'}/employees`, { query: `per=${limit}` });
    res = { success: true, simulated: false, provenance: 'live', kind: 'employees', data: data.data || data };
  } catch (e) {
    res = simulated('employees', SIM_EMPLOYEES);
  }
  if (!includeCompensation) res.data = redactCompensation(res.data);
  return res;
}

async function listTimeOffRequests({ companyId = null, status = null } = {}) {
  try {
    const data = await gustoRequest(`companies/${companyId || process.env.GUSTO_COMPANY_ID || 'me'}/time_off_requests`, { query: status ? `status=${encodeURIComponent(status)}` : '' });
    return { success: true, simulated: false, provenance: 'live', kind: 'time_off_requests', data: data.data || data };
  } catch (e) {
    const rows = status ? SIM_TIME_OFF.filter(r => r.status === status) : SIM_TIME_OFF;
    return simulated('time_off_requests', rows);
  }
}

async function listPayrolls({ companyId = null } = {}) {
  try {
    const data = await gustoRequest(`companies/${companyId || process.env.GUSTO_COMPANY_ID || 'me'}/payrolls`);
    return { success: true, simulated: false, provenance: 'live', kind: 'payrolls', data: redactCompensation(data.data || data) };
  } catch (e) {
    return simulated('payrolls', redactCompensation(SIM_PAYROLLS));
  }
}

// ── Write operations (DESTRUCTIVE — HITL-gated at the tool layer) ─────────────
async function submitTimeOffRequest({ employeeId, policy = 'Vacation', startDate, endDate, hours = null, note = null }) {
  const payload = { employee_id: employeeId, policy, start_date: startDate, end_date: endDate, hours, note };
  if (!isGustoConfigured()) {
    return { success: true, simulated: true, staged: true, kind: 'time_off_request', wouldCreate: payload,
      note: 'Simulated (no GUSTO_ACCESS_TOKEN). In production this files the time-off request after HITL approval.' };
  }
  const res = await gustoRequest('time_off_requests', { method: 'POST', body: payload });
  return { success: true, simulated: false, kind: 'time_off_request', data: res.data || res };
}

async function decideTimeOffRequest({ requestId, decision, approverId = null, note = null }) {
  if (!['approve', 'deny'].includes(decision)) throw new Error('decision must be approve|deny.');
  const payload = { status: decision === 'approve' ? 'approved' : 'denied', approver_id: approverId, note };
  if (!isGustoConfigured()) {
    return { success: true, simulated: true, staged: true, kind: 'time_off_decision', requestId, wouldApply: payload,
      note: 'Simulated (no GUSTO_ACCESS_TOKEN). In production this records the manager decision after HITL approval.' };
  }
  const res = await gustoRequest(`time_off_requests/${requestId}`, { method: 'PUT', body: payload });
  return { success: true, simulated: false, kind: 'time_off_decision', data: res.data || res };
}

/**
 * Run payroll. COMPLIANCE-FLOOR action (money movement): refuses without an
 * explicit approval, in addition to the registry's requiresApproval gate.
 */
async function runPayroll({ payrollId, companyId = null, approved = false }) {
  if (!approved) {
    return { success: false, requiresApproval: true, kind: 'payroll',
      message: 'Running payroll moves employee money — explicit human approval is required (compliance floor).',
      pending: { payrollId, companyId } };
  }
  if (!isGustoConfigured()) {
    return { success: true, simulated: true, staged: true, kind: 'payroll', wouldRun: { payrollId, companyId },
      note: 'Simulated (no GUSTO_ACCESS_TOKEN). Approved payroll run; would submit to Gusto in production.' };
  }
  const res = await gustoRequest(`companies/${companyId || process.env.GUSTO_COMPANY_ID || 'me'}/payrolls/${payrollId}/submit`, { method: 'PUT' });
  return { success: true, simulated: false, kind: 'payroll', data: res.data || res };
}

/**
 * Map a Gusto webhook event to a CONVERGENCE-Ai task descriptor. HR events are
 * routed to the Human Companion; high-risk events land pending_approval.
 */
function mapWebhookToTask(event = {}) {
  const kind = event.event_type || event.event || 'unknown';
  const data = event.payload || event.data || {};
  const TABLE = {
    'time_off_request.created': { type: 'gusto.timeoff.review', requiresApproval: false, summary: 'Review new time-off request' },
    'employee.created': { type: 'gusto.employee.onboard', requiresApproval: false, summary: 'Onboard new employee' },
    'employee.terminated': { type: 'gusto.employee.offboard', requiresApproval: true, summary: 'Offboard terminated employee' },
    'payroll.submitted': { type: 'gusto.payroll.review', requiresApproval: true, summary: 'Review submitted payroll' },
    'payroll.processed': { type: 'gusto.payroll.reconcile', requiresApproval: true, summary: 'Reconcile processed payroll' }
  };
  const entry = TABLE[kind] || { type: 'gusto.event.unhandled', requiresApproval: true, summary: `Unhandled Gusto event: ${kind}` };
  return {
    type: entry.type,
    status: entry.requiresApproval ? 'pending_approval' : 'proposed',
    actor: 'gusto-webhook',
    // HR payloads are confidential: carry a redacted copy on the task.
    payload: { source: 'gusto', event: kind, summary: entry.summary, plane: 'human', data: redactCompensation(data) },
    provenance: { source: 'gusto_webhook', event: kind }
  };
}

module.exports = {
  isGustoConfigured, oauthConfig, baseUrl,
  listEmployees, listTimeOffRequests, listPayrolls,
  submitTimeOffRequest, decideTimeOffRequest, runPayroll,
  mapWebhookToTask, redactCompensation
};
