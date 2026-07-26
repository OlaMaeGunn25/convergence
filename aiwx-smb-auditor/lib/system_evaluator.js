/**
 * System Evaluator (Phase 1, COMP + ONB)
 * ======================================
 * The Systems Configurator agent's comprehension engine. For each connected
 * system it builds a **capability manifest** (every action, classified read vs.
 * write/destructive) AND an **operational-process map** (how those actions
 * compose into the system's real workflows) — COMP-01. It aggregates all of a
 * tenant's connected systems into the Orchestrator's unified capability model
 * (COMP-02), and reports onboarding readiness per system (ONB-02).
 *
 * Pure derivation over the connector catalog + curated process templates (no
 * network) so it is deterministic and unit-testable. Live per-system probing
 * plugs in behind buildManifest() later without changing callers.
 */

const catalog = require('./connectors/catalog');

// Curated operational-process templates: how a connector's capabilities compose
// into real workflows. Connectors without a template get a generic derivation.
const PROCESS_TEMPLATES = {
  clio: [
    { name: 'Client intake → matter', steps: ['list_contacts', 'create_matter'] },
    { name: 'Time capture → billing', steps: ['list_matters', 'create_activity'] },
    { name: 'Trust accounting (HITL)', steps: ['list_matters', 'record_trust_transaction'] }
  ],
  quickbooks: [
    { name: 'Invoice → payment', steps: ['list_customers', 'create_invoice', 'record_payment'] }
  ],
  shopify: [
    { name: 'Order fulfillment', steps: ['list_orders', 'update_inventory'] }
  ],
  google_calendar: [
    { name: 'Schedule appointment', steps: ['list_calendars', 'create_event'] }
  ],
  hubspot: [
    { name: 'Lead → deal', steps: ['list_contacts', 'create_contact', 'update_deal'] }
  ],
  stripe: [
    { name: 'Charge → refund (HITL)', steps: ['list_charges', 'create_refund'] }
  ]
};

function genericProcesses(connector) {
  const reads = connector.capabilities || [];
  const writes = connector.destructiveCapabilities || [];
  const steps = reads.concat(writes);
  return steps.length ? [{ name: 'Standard operations', steps }] : [];
}

/**
 * Build the capability manifest + operational-process map for one connector.
 * @returns { connectorId, name, category, kind, capabilities[], processes[], provenance }
 */
function buildManifest(connectorId) {
  const c = catalog.get(connectorId);
  if (!c) return null;
  const capabilities = (c.capabilities || []).map(n => ({ name: n, type: 'read' }))
    .concat((c.destructiveCapabilities || []).map(n => ({ name: n, type: 'write' })));
  const processes = (PROCESS_TEMPLATES[connectorId] || genericProcesses(c)).map(p => ({
    name: p.name,
    steps: p.steps,
    // A process is destructive if any step is a write capability.
    destructive: p.steps.some(s => (c.destructiveCapabilities || []).includes(s))
  }));
  return {
    connectorId: c.id, name: c.name, category: c.category, kind: c.kind,
    capabilities, processes,
    provenance: {
      source: PROCESS_TEMPLATES[connectorId] ? 'catalog + curated process template' : 'catalog + generic derivation',
      confidence: PROCESS_TEMPLATES[connectorId] ? 0.85 : 0.6
    }
  };
}

/** Evaluate a single connected system (manifest + a one-line readiness note). */
function evaluateSystem(connectorId) {
  const manifest = buildManifest(connectorId);
  if (!manifest) return { connectorId, error: `Unknown connector "${connectorId}".` };
  return {
    manifest,
    reads: manifest.capabilities.filter(c => c.type === 'read').length,
    writes: manifest.capabilities.filter(c => c.type === 'write').length,
    processes: manifest.processes.length
  };
}

function deriveReadiness(board) {
  if (board.status === 'connected') return board.credentialsConfigured ? 'ready' : 'evaluating';
  if (board.status === 'configuring') return 'evaluating';
  if (board.status === 'error') return 'blocked';
  if (board.status === 'disconnected') return 'not_ready';
  return 'not_ready';
}

/**
 * Build the Orchestrator's unified capability model for a tenant: a manifest for
 * every CONNECTED system plus a queryable summary (COMP-02).
 */
async function buildTenantCapabilityModel({ tenantId = null, connectionRegistry }) {
  const board = await connectionRegistry.statusBoard({ tenantId });
  const connected = board.filter(b => b.status === 'connected');
  const systems = connected.map(b => buildManifest(b.connectorId)).filter(Boolean);
  const totalCapabilities = systems.reduce((n, s) => n + s.capabilities.length, 0);
  const totalProcesses = systems.reduce((n, s) => n + s.processes.length, 0);
  return {
    tenantId,
    systems,
    summary: { connectedSystems: systems.length, totalCapabilities, totalProcesses },
    generatedAt: new Date().toISOString()
  };
}

/** Query the unified model: can `connectorId` perform `capability`? (COMP-02) */
function canDo(model, connectorId, capability) {
  const sys = (model.systems || []).find(s => s.connectorId === connectorId);
  if (!sys) return { ok: false, reason: `System "${connectorId}" is not connected for this tenant.` };
  const cap = sys.capabilities.find(c => c.name === capability);
  if (!cap) return { ok: false, reason: `System "${connectorId}" does not expose "${capability}".` };
  return { ok: true, type: cap.type };
}

/**
 * Onboarding readiness board for a tenant (ONB-02): per-system readiness plus an
 * aggregate. `agentReady` is true only when every attempted system is ready.
 */
async function onboardingStatus({ tenantId = null, connectionRegistry }) {
  const board = await connectionRegistry.statusBoard({ tenantId });
  const perSystem = board.map(b => ({
    connectorId: b.connectorId, name: b.name,
    connectionStatus: b.status, credentialsConfigured: b.credentialsConfigured,
    readiness: deriveReadiness(b)
  }));
  const attempted = perSystem.filter(s => s.connectionStatus !== 'not_connected');
  const ready = attempted.filter(s => s.readiness === 'ready').length;
  return {
    tenantId,
    systems: perSystem,
    overall: {
      attempted: attempted.length,
      ready,
      readyPct: attempted.length ? Math.round((100 * ready) / attempted.length) : 0,
      agentReady: attempted.length > 0 && ready === attempted.length
    },
    generatedAt: new Date().toISOString()
  };
}

module.exports = { buildManifest, evaluateSystem, buildTenantCapabilityModel, canDo, onboardingStatus, PROCESS_TEMPLATES };
