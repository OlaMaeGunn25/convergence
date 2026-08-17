/**
 * Connection Modes — dual-mode (API / MCP) connection specification (DMC)
 * =======================================================================
 * One standardized shape for "how do we talk to this system", shared by the
 * onboarding interview, the connection builder, and the dual-mode client:
 *
 *   {
 *     systemType:     'salesforce' | 'clio' | ... (a catalog connector id)
 *     connectionMode: 'mcp' | 'api' | 'auto'
 *     credentialRefs: ['SALESFORCE_TOKEN', ...]   // NAMES of secrets, never values
 *     params:         { host, region, subdomain } // non-secret only
 *     mcpConfig:      { transport: 'stdio'|'sse', command/args/envRefs | url/headerRefs }
 *   }
 *
 * CREDENTIALS ARE REFERENCES, DELIBERATELY. The connection builder refuses
 * secret-shaped values over the API (see connection_registry.build), and this
 * module keeps that invariant: a spec carries the NAMES of env/secret-store keys,
 * and only the process that actually opens the connection resolves them. A spec
 * is therefore safe to store on a connection record, show to the approving
 * human, and write to the audit log.
 *
 * Transport never changes governance. Whether a capability is reached over MCP
 * or a native API, it enters through the same tool-registry gates (approval,
 * compliance floor, autonomy, preconditions). Mode is plumbing, not permission.
 */

const catalog = require('./connectors/catalog');
const { matchIntegrations } = require('./integration_matcher');
const { copy } = require('./immutable');

const MODES = ['mcp', 'api', 'auto'];
const TRANSPORTS = ['stdio', 'sse'];

// Connector modules that publish their own MCP surface descriptor.
const MCP_DESCRIPTORS = {
  realestateapi: () => require('./connectors/realestateapi').mcpConfig()
};

const path = require('path');
const { WRAPPABLE } = require('./mcp_api_wrapper');

/**
 * Which modes a connector can honestly offer. Every connector has an API path;
 * MCP is offered when EITHER rung of the MCP ladder exists — the system's own
 * server, or a spun-up wrapper around its native API.
 */
function modesFor(connectorId) {
  const c = catalog.get(connectorId);
  if (!c) return [];
  const hasMcp = !!(c.mcp || MCP_DESCRIPTORS[connectorId] || WRAPPABLE.includes(connectorId));
  return hasMcp ? ['api', 'mcp', 'auto'] : ['api'];
}

/**
 * The MCP priority ladder, in the order it is attempted (DMC):
 *
 *   1. vendor_mcp      — the connected system's OWN MCP server. It is the
 *                        system speaking its native protocol contract, so it
 *                        outranks anything we stand up ourselves.
 *   2. api_wrapper_mcp — a spun-up local MCP server wrapping the connector's
 *                        native API, so agents stay in one protocol even when
 *                        the vendor publishes no MCP surface.
 *
 * The raw native API adapter is deliberately NOT on this ladder: it is the
 * fallback FLOOR beneath it (auto mode only), not a peer protocol.
 */
function mcpLadderFor(connectorId) {
  const ladder = [];
  const vendor = mcpConfigFor(connectorId);
  if (vendor) ladder.push(Object.assign({ tier: 'vendor_mcp' }, vendor));
  if (WRAPPABLE.includes(connectorId)) {
    ladder.push({
      tier: 'api_wrapper_mcp',
      transport: 'stdio',
      command: process.execPath,
      args: [path.join(__dirname, 'mcp_api_wrapper.js'), connectorId],
      // No required refs: the wrapper inherits the gateway env, and the
      // connector modules degrade to labelled simulated data when unconfigured.
      envRefs: []
    });
  }
  return ladder;
}

/** The MCP server descriptor for a connector, when it has one. Refs only. */
function mcpConfigFor(connectorId) {
  const make = MCP_DESCRIPTORS[connectorId];
  if (!make) return null;
  const d = make();
  return {
    transport: d.transport === 'stdio' ? 'stdio' : 'sse',
    url: d.url || null,
    // Header/env material is carried as REFS the runtime resolves at bind time.
    headerRefs: d.authHeader && d.secretRef ? { [d.authHeader]: d.secretRef } : {},
    command: d.command || null,
    args: d.args || [],
    envRefs: d.envRefs || (d.secretRef ? [d.secretRef] : []),
    docs: d.docs || null
  };
}

/**
 * Detect which system a set of connection parameters points at (Phase 1 item 3).
 * Delegates to the catalog's matchSignals via the integration matcher, so
 * detection and integration-proposal cannot disagree about what a signal means.
 */
function detectSystem({ domain = '', endpoint = '', technologies = [], metadata = null } = {}) {
  const signals = [...technologies];
  const hay = [domain, endpoint, metadata ? JSON.stringify(metadata) : ''].join(' ').toLowerCase();
  for (const c of catalog.list()) {
    if ((c.matchSignals || []).some(sig => hay.includes(String(sig).toLowerCase()))) signals.push(c.id);
  }
  const out = matchIntegrations({ technologies: signals.map(s => (typeof s === 'string' ? { name: s } : s)), domain });
  // DETECTION is stricter than PROPOSAL: only rows grounded in an actual signal
  // match count. Vertical-affinity and universal-baseline rows are suggestions
  // for the roadmap, and treating one as a detection would "identify" a system
  // on any unknown domain.
  const list = (out.recommendedIntegrations || []).filter(r =>
    (r.matchedOn || []).length &&
    !String(r.matchedOn[0]).startsWith('vertical:') &&
    r.matchedOn[0] !== 'universal-baseline'
  );
  const best = list[0] || null;
  return {
    detected: !!best,
    systemType: best ? (best.connectorId || best.id) : null,
    confidence: best ? (best.confidence ?? best.score ?? null) : null,
    candidates: copy(list.slice(0, 5))
  };
}

/**
 * Normalize + validate a connection spec. Fails closed on anything that looks
 * like a raw secret in `params` — that belongs in the secret store, referenced
 * by name in credentialRefs.
 */
function normalizeSpec({ systemType, connectionMode = 'auto', credentialRefs = [], params = {}, mcpConfig = null } = {}) {
  const c = catalog.get(systemType);
  if (!c) return { ok: false, error: `Unknown systemType "${systemType}".` };
  if (!MODES.includes(connectionMode)) return { ok: false, error: `connectionMode must be one of ${MODES.join('|')}.` };

  const available = modesFor(systemType);
  if (connectionMode === 'mcp' && !available.includes('mcp')) {
    return { ok: false, status: 'mcp_unsupported', error: `"${c.name}" has no MCP surface; available modes: ${available.join(', ')}.` };
  }

  const suspect = Object.keys(params || {}).find(k => /secret|token|password|api[_-]?key|credential/i.test(k));
  if (suspect) {
    return { ok: false, error: `Refusing raw credential-shaped param "${suspect}". Put the value in the secret store and pass its NAME in credentialRefs.` };
  }

  const mcp = mcpConfig || (available.includes('mcp') ? mcpConfigFor(systemType) : null);
  if (mcp && !TRANSPORTS.includes(mcp.transport)) {
    return { ok: false, error: `mcpConfig.transport must be one of ${TRANSPORTS.join('|')}.` };
  }

  return {
    ok: true,
    spec: {
      systemType,
      connectionMode,
      credentialRefs: [...new Set([...(credentialRefs || []), ...(c.envKeys || [])])],
      params: copy(params || {}),
      mcpConfig: mcp,
      availableModes: available
    }
  };
}

/**
 * The onboarding interview, as data — same pattern as the location disclosure:
 * every surface (hub, installer, chat) renders the identical questions, because
 * an interview that differs between surfaces is not one interview.
 */
function connectionInterview(systemType = null) {
  const c = systemType ? catalog.get(systemType) : null;
  const available = systemType ? modesFor(systemType) : null;
  return {
    steps: [
      {
        id: 'system',
        prompt: 'Which enterprise system do you want to connect?',
        how: 'Name it, or provide a domain/endpoint and the system will be detected from its signals.',
        detected: c ? { systemType: c.id, name: c.name, category: c.category } : null
      },
      {
        id: 'parameters',
        prompt: 'Connection parameters',
        how: 'Non-secret parameters (host, region, subdomain, port) are entered here. Secrets are NOT: place API keys and tokens in the environment / secret store and provide the key NAMES below.',
        secretRefsNeeded: c ? (c.envKeys || []) : [],
        note: 'This system never accepts a credential value over the API — a spec carries references, so it is safe to store, display and audit.'
      },
      {
        id: 'mode',
        prompt: 'How should this connection be made?',
        options: [
          {
            value: 'auto',
            label: 'Auto-Detect & Upgrade to MCP (Recommended)',
            detail: 'Attempts the MCP server first; on timeout, error or an unsupported surface it falls back to the native API and says so.',
            recommended: true,
            available: !available || available.includes('auto')
          },
          {
            value: 'mcp',
            label: 'Connect via MCP',
            detail: 'Standardized Model Context Protocol server interface. Fails rather than silently degrading.',
            available: !available || available.includes('mcp')
          },
          {
            value: 'api',
            label: 'Connect via API',
            detail: 'The native REST/GraphQL client for this system.',
            available: true
          }
        ]
      },
      {
        id: 'verify',
        prompt: 'Verify',
        how: 'The connection is built and verified, and you are told exactly which transport is live — e.g. "Connected via MCP server" or "MCP connection failed; fell back to the native API".'
      }
    ],
    governanceNote: 'Transport never changes governance: MCP-routed and API-routed capabilities pass the same approval, compliance-floor and autonomy gates.'
  };
}

module.exports = { MODES, TRANSPORTS, modesFor, mcpConfigFor, mcpLadderFor, detectSystem, normalizeSpec, connectionInterview };
