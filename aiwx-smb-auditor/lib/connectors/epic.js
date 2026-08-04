/**
 * Epic Connector (EHR — system of record for the medical vertical)
 * ================================================================
 * Epic is the system of record for most US health systems, and connecting to it
 * is unlike every other connector in this catalogue. The difference is not
 * technical difficulty — the API is a clean FHIR R4 surface — it is that access
 * is granted by each health organisation individually, not by us and not by a
 * single vendor key.
 *
 * That shapes the whole design:
 *
 *   - CREDENTIALS ARE PER-ORGANISATION. Epic issues client IDs per app, and
 *     recommends unique credentials per customer and per environment. So this
 *     connector is multi-organisation from the outset: a tenant operating across
 *     three health systems holds three sets of credentials, and a call must name
 *     which organisation it is for. A single global token would be wrong in a way
 *     that is hard to unpick later.
 *   - AUTH IS A SIGNED JWT ASSERTION, not a client secret. The app registers a
 *     public key; each token request presents a JWT signed with the matching
 *     private key. There is no shared secret to leak, which is the point.
 *   - EVERY READ IS PHI. Not "may contain" — is. So reads minimise by default
 *     (`redactPhi`), a stated purpose is recorded on every access, and writes sit
 *     on the compliance floor.
 *   - IT CANNOT BE CONNECTED ON DEMAND. Vendor registration, a security review,
 *     a BAA and per-organisation enablement all precede a first call. Those are
 *     modelled as preconditions (see lib/preconditions.js), so the system refuses
 *     to pretend it could connect when it could not.
 *
 * Programme naming, current as of this writing: the developer programme is Epic
 * Vendor Services, the marketplace is Showroom, and OAuth client IDs are managed
 * in the Connection Hub. App Orchard is retired — documentation or advice citing
 * it is out of date.
 *
 * Docs: https://fhir.epic.com
 */

const { copy } = require('../immutable');

const FHIR_VERSION = 'R4';

/**
 * Per-organisation configuration. Epic credentials are not global, so neither is
 * this. Organisations are configured as a JSON map in EPIC_ORGANIZATIONS:
 *
 *   { "mercy-general": { "baseUrl": "https://.../api/FHIR/R4", "clientId": "..." } }
 *
 * The private key lives in EPIC_PRIVATE_KEY (or the secret store) and is never
 * read into a response, logged, or returned by any tool.
 */
function organizations() {
  const raw = (process.env.EPIC_ORGANIZATIONS || '').trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function isEpicConfigured(orgId = null) {
  const orgs = organizations();
  if (!process.env.EPIC_PRIVATE_KEY) return false;
  if (!orgId) return Object.keys(orgs).length > 0;
  return !!(orgs[orgId] && orgs[orgId].baseUrl && orgs[orgId].clientId);
}

/** Organisations this deployment currently holds credentials for. */
function listOrganizations() {
  const orgs = organizations();
  return Object.entries(orgs).map(([id, o]) => ({
    id,
    baseUrl: o.baseUrl || null,
    // The client ID identifies the app to that organisation. Non-secret, but
    // shown truncated because it is still an identifier tied to a customer.
    clientIdPresent: !!o.clientId,
    environment: o.environment || 'production',
    configured: isEpicConfigured(id)
  }));
}

/**
 * The connection descriptor for the builder. Carries references, never material:
 * a private key must not appear in something that gets stored on a connection
 * record and shown to a human approving it.
 */
function connectionDescriptor() {
  return {
    kind: 'fhir',
    fhirVersion: FHIR_VERSION,
    authFlow: 'backend_oauth2_jwt_assertion',
    signingAlgorithms: ['RS384', 'ES384'],
    secretRef: 'EPIC_PRIVATE_KEY',
    organizationsRef: 'EPIC_ORGANIZATIONS',
    perOrganizationCredentials: true,
    note: 'Epic issues credentials per app and recommends unique credentials per customer organisation and per environment. The gateway resolves the signing key from the secret store at call time.',
    docs: 'https://fhir.epic.com'
  };
}

// ── PHI boundary ─────────────────────────────────────────────────────────────

const PHI_REDACTION = '[redacted — PHI; requires a stated clinical or operational purpose]';

/**
 * Direct patient identifiers. Minimisation is the default posture: a workflow
 * that schedules an appointment does not need a date of birth or an address, and
 * a payload that carries them anyway becomes a breach the moment it is logged,
 * exported or shown to the wrong agent.
 */
const PHI_FIELDS = /^(birthDate|deceasedDateTime|ssn|address|telecom|photo|contact|maritalStatus|multipleBirth|communication|generalPractitioner|identifier)$/i;

function redactPhi(record) {
  if (!record || typeof record !== 'object') return record;
  if (Array.isArray(record)) return record.map(redactPhi);
  const out = {};
  for (const [k, v] of Object.entries(record)) {
    if (PHI_FIELDS.test(k)) { out[k] = PHI_REDACTION; continue; }
    out[k] = (v && typeof v === 'object') ? redactPhi(v) : v;
  }
  return out;
}

/** Does this payload still carry unredacted direct identifiers? */
function containsPhi(record) {
  if (!record || typeof record !== 'object') return false;
  if (Array.isArray(record)) return record.some(containsPhi);
  for (const [k, v] of Object.entries(record)) {
    if (PHI_FIELDS.test(k)) {
      if (v !== PHI_REDACTION) return true;
      continue;
    }
    if (v && typeof v === 'object' && containsPhi(v)) return true;
  }
  return false;
}

// ── Request path ─────────────────────────────────────────────────────────────

async function epicRequest(orgId, resourcePath, { method = 'GET', query = '', body = null } = {}) {
  if (!isEpicConfigured(orgId)) {
    throw new Error(`Epic is not configured for organisation "${orgId}".`);
  }
  if (typeof fetch !== 'function') throw new Error('global fetch unavailable in this runtime.');

  const org = organizations()[orgId];
  // Token acquisition is a signed-JWT assertion exchange. Kept behind this seam
  // so the crypto and the token cache land in one place when credentials exist.
  const token = await acquireToken(orgId);

  const url = `${org.baseUrl.replace(/\/$/, '')}/${resourcePath}${query ? `?${query}` : ''}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/fhir+json',
      'Content-Type': 'application/fhir+json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error(`Epic rejected the request for "${orgId}" (${res.status}) — the app may not be enabled for this organisation.`);
  }
  if (!res.ok) throw new Error(`Epic ${method} ${resourcePath} failed for "${orgId}": ${res.status}`);
  return res.json();
}

/**
 * Backend OAuth2: exchange a signed JWT assertion for an access token.
 * Unimplemented until credentials exist — it throws rather than returning a
 * placeholder, so a caller can never mistake an unconfigured connector for a
 * working one.
 */
async function acquireToken(orgId) {
  throw new Error(`No Epic access token available for "${orgId}" (backend JWT assertion not configured).`);
}

// ── Simulated fallback (clearly labelled, no real PHI) ────────────────────────

function simulated(kind, rows, extra = {}) {
  return Object.assign({
    success: true, simulated: true, provenance: 'simulated',
    source: 'epic_simulator', fhirVersion: FHIR_VERSION, kind, data: copy(rows)
  }, extra);
}

const SIM_APPOINTMENTS = [
  { resourceType: 'Appointment', id: 'appt-3011', status: 'booked', start: '2026-08-05T14:00:00Z', end: '2026-08-05T14:30:00Z',
    serviceType: [{ text: 'Follow-up' }], participant: [{ actor: { reference: 'Patient/pat-88', display: 'Patient 88' }, status: 'accepted' }] },
  { resourceType: 'Appointment', id: 'appt-3012', status: 'proposed', start: '2026-08-06T09:15:00Z', end: '2026-08-06T09:45:00Z',
    serviceType: [{ text: 'New patient' }], participant: [{ actor: { reference: 'Patient/pat-91', display: 'Patient 91' }, status: 'needs-action' }] }
];

const SIM_PRACTITIONERS = [
  { resourceType: 'Practitioner', id: 'prac-12', active: true, name: [{ family: 'Adeyemi', given: ['R.'], prefix: ['Dr'] }] },
  { resourceType: 'Practitioner', id: 'prac-19', active: true, name: [{ family: 'Nakamura', given: ['S.'], prefix: ['Dr'] }] }
];

// ── Reads (PHI-minimised by default) ─────────────────────────────────────────

/**
 * Every read requires a stated purpose. Not ceremony: HIPAA's minimum-necessary
 * standard is about the purpose of the access, so a system that cannot say why it
 * read something cannot demonstrate compliance with it.
 */
function requirePurpose(purpose, kind) {
  if (!purpose || !String(purpose).trim()) {
    return { success: false, kind, error: 'A stated purpose is required for any access to patient data (minimum-necessary standard). It is recorded with the result.' };
  }
  return null;
}

async function listAppointments({ orgId, date = null, practitionerId = null, purpose = null, includePhi = false } = {}) {
  const bad = requirePurpose(purpose, 'appointments');
  if (bad) return bad;
  if (!orgId) return { success: false, kind: 'appointments', error: 'orgId is required — Epic credentials are per health organisation.' };

  const q = [];
  if (date) q.push(`date=${encodeURIComponent(date)}`);
  if (practitionerId) q.push(`practitioner=${encodeURIComponent(practitionerId)}`);

  let res;
  try {
    const data = await epicRequest(orgId, 'Appointment', { query: q.join('&') });
    const rows = (data.entry || []).map(e => e.resource);
    res = { success: true, simulated: false, provenance: 'live', fhirVersion: FHIR_VERSION, kind: 'appointments', orgId, data: rows };
  } catch (e) {
    res = simulated('appointments', SIM_APPOINTMENTS, { orgId, note: `Simulated: ${e.message}` });
  }
  if (!includePhi) res.data = redactPhi(res.data);
  res.purpose = purpose;
  res.minimumNecessary = !includePhi;
  return res;
}

async function listPractitioners({ orgId, purpose = null } = {}) {
  const bad = requirePurpose(purpose, 'practitioners');
  if (bad) return bad;
  if (!orgId) return { success: false, kind: 'practitioners', error: 'orgId is required — Epic credentials are per health organisation.' };
  try {
    const data = await epicRequest(orgId, 'Practitioner');
    const rows = (data.entry || []).map(e => e.resource);
    return { success: true, simulated: false, provenance: 'live', fhirVersion: FHIR_VERSION, kind: 'practitioners', orgId, purpose, data: rows };
  } catch (e) {
    return simulated('practitioners', SIM_PRACTITIONERS, { orgId, purpose, note: `Simulated: ${e.message}` });
  }
}

// ── Writes (COMPLIANCE FLOOR) ────────────────────────────────────────────────

/**
 * Book or amend an appointment. Writing into a health system's system of record
 * is a clinical-operations action with real consequences for a real person's
 * care, so it requires explicit approval regardless of any autonomy grant.
 */
async function scheduleAppointment({ orgId, patientRef, practitionerRef, start, end, serviceType = null, purpose = null, approved = false } = {}) {
  if (!approved) {
    return {
      success: false, requiresApproval: true, kind: 'appointment_write',
      message: 'Writing to a health system\'s record of care requires explicit human approval (compliance floor).',
      pending: { orgId, patientRef, practitionerRef, start, end }
    };
  }
  const bad = requirePurpose(purpose, 'appointment_write');
  if (bad) return bad;
  if (!orgId || !patientRef || !start) {
    return { success: false, kind: 'appointment_write', error: 'orgId, patientRef and start are required.' };
  }

  const resource = {
    resourceType: 'Appointment', status: 'proposed', start, end: end || null,
    serviceType: serviceType ? [{ text: serviceType }] : undefined,
    participant: [
      { actor: { reference: patientRef }, status: 'needs-action' },
      practitionerRef ? { actor: { reference: practitionerRef }, status: 'needs-action' } : null
    ].filter(Boolean)
  };

  try {
    const data = await epicRequest(orgId, 'Appointment', { method: 'POST', body: resource });
    return { success: true, simulated: false, kind: 'appointment_write', orgId, purpose, data: redactPhi(data) };
  } catch (e) {
    return {
      success: true, simulated: true, staged: true, kind: 'appointment_write', orgId, purpose,
      wouldCreate: redactPhi(resource),
      note: `Simulated (${e.message}). In production this writes the appointment after approval.`
    };
  }
}

/** Map an Epic event to a governed task. Clinical events fail closed to approval. */
function mapEventToTask(event = {}) {
  const kind = event.event_type || event.event || 'unknown';
  const data = event.payload || event.data || {};
  const TABLE = {
    'appointment.booked': { type: 'epic.appointment.confirm', requiresApproval: false, summary: 'Confirm booked appointment' },
    'appointment.cancelled': { type: 'epic.appointment.rebook', requiresApproval: false, summary: 'Offer rebooking for a cancelled appointment' },
    'appointment.noshow': { type: 'epic.appointment.recover', requiresApproval: false, summary: 'Run no-show recovery' },
    'referral.received': { type: 'epic.referral.route', requiresApproval: true, summary: 'Route an inbound referral' },
    'order.result_available': { type: 'epic.result.review', requiresApproval: true, summary: 'Clinical result requires review' }
  };
  const entry = TABLE[kind] || { type: 'epic.event.unhandled', requiresApproval: true, summary: `Unhandled Epic event: ${kind}` };
  return {
    type: entry.type,
    status: entry.requiresApproval ? 'pending_approval' : 'proposed',
    actor: 'epic-webhook',
    payload: { source: 'epic', event: kind, summary: entry.summary, plane: 'clinical', data: redactPhi(data) },
    provenance: { source: 'epic_webhook', event: kind }
  };
}

module.exports = {
  FHIR_VERSION, isEpicConfigured, listOrganizations, connectionDescriptor,
  listAppointments, listPractitioners, scheduleAppointment,
  redactPhi, containsPhi, mapEventToTask, PHI_REDACTION
};
