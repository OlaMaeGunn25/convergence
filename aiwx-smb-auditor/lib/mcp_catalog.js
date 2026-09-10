/**
 * Pre-loaded MCP Connections (MCPC)
 * =================================
 * The set of MCP connections a tenant can SELECT, available to every vertical
 * rather than only to the connectors with hand-written modules.
 *
 * Three sources feed it, and the distinction is the useful part:
 *
 *   vendor      — the system publishes its own MCP server. Highest fidelity: the
 *                 system speaking its native protocol contract.
 *   wrapper     — a catalog connector with a native module, served over MCP by
 *                 the spun-up API→MCP wrapper.
 *   ingested    — an API ingested from its own description (OpenAPI or an
 *                 operation list) and served generically by the same wrapper.
 *                 This is what makes MCP reachable for systems nobody hand-coded.
 *
 * `verticals: ['universal']` means every vertical may select it. A pre-loaded
 * entry is an OFFER, never a connection: selecting one still runs the connection
 * builder, its preconditions and its approval gate (invariant I1).
 */

const { copy } = require('./immutable');
const catalog = require('./connectors/catalog');
const { WRAPPABLE } = require('./mcp_api_wrapper');

/**
 * Vendor-published MCP servers we know how to reach. Credentials are carried by
 * REFERENCE — a descriptor is safe to store on a connection record and show to
 * the human approving it.
 */
const VENDOR_SERVERS = [
  {
    id: 'realestateapi_mcp',
    name: 'RealEstateAPI (MLS & property records)',
    connectorId: 'realestateapi',
    transport: 'sse',
    url: 'https://mcp.realestateapi.com/sse',
    authHeader: 'x-api-key',
    secretRef: 'REALESTATEAPI_KEY',
    verticals: ['realestate'],
    docs: 'https://developer.realestateapi.com/reference/mcp'
  }
];

/**
 * Everything selectable, for a vertical.
 *
 * @param vertical      restrict to entries available to this vertical
 * @param ingestedApis  descriptors from lib/api_ingestion (pass the store's list)
 */
function list({ vertical = null, ingestedApis = [] } = {}) {
  const available = v => !v || (v || []).includes('universal') || (v || []).includes(vertical);
  const entries = [];

  for (const s of VENDOR_SERVERS) {
    if (vertical && !available(s.verticals)) continue;
    entries.push({
      id: s.id, name: s.name, source: 'vendor', tier: 'vendor_mcp',
      connectorId: s.connectorId, transport: s.transport,
      secretRef: s.secretRef, verticals: s.verticals,
      selectable: true, docs: s.docs || null,
      note: 'Published by the system itself — the highest-fidelity MCP surface available for it.'
    });
  }

  for (const cid of WRAPPABLE) {
    const c = catalog.get(cid);
    if (!c) continue;
    const verts = Array.isArray(c.vertical) ? c.vertical : [c.vertical];
    if (vertical && !available(verts)) continue;
    entries.push({
      id: `${cid}_wrapper_mcp`, name: `${c.name} (via API→MCP wrapper)`,
      source: 'wrapper', tier: 'api_wrapper_mcp',
      connectorId: cid, transport: 'stdio',
      secretRef: (c.envKeys || [])[0] || null, verticals: verts,
      selectable: true,
      note: 'Served over MCP by a locally spun-up wrapper around the native connector module.'
    });
  }

  for (const api of ingestedApis || []) {
    if (vertical && !available(api.verticals)) continue;
    entries.push({
      id: api.id, name: `${api.name} (ingested API)`,
      source: 'ingested', tier: 'api_wrapper_mcp',
      connectorId: null, transport: 'stdio',
      secretRef: (api.credentialRefs || [])[0] || null,
      verticals: api.verticals || ['universal'],
      operations: (api.operations || []).length,
      destructiveOperations: (api.destructiveCapabilities || []).length,
      selectable: true,
      note: 'Ingested from its own API description and served generically over MCP. Destructive operations remain approval-gated.'
    });
  }

  return copy(entries);
}

/** One selectable entry by id. */
function get(id, { ingestedApis = [] } = {}) {
  return list({ ingestedApis }).find(e => e.id === id) || null;
}

/**
 * The spawn/connect spec for a selected entry, ready for the bootstrapper.
 * Carries refs, never values.
 */
function specFor(entry) {
  if (!entry) return null;
  if (entry.source === 'vendor') {
    const v = VENDOR_SERVERS.find(s => s.id === entry.id);
    if (!v) return null;
    return {
      tier: 'vendor_mcp', transport: 'sse', url: v.url,
      headerRefs: v.authHeader && v.secretRef ? { [v.authHeader]: v.secretRef } : {}
    };
  }
  const path = require('path');
  if (entry.source === 'wrapper') {
    return {
      tier: 'api_wrapper_mcp', transport: 'stdio',
      command: process.execPath,
      args: [path.join(__dirname, 'mcp_api_wrapper.js'), entry.connectorId],
      envRefs: []
    };
  }
  if (entry.source === 'ingested') {
    return {
      tier: 'api_wrapper_mcp', transport: 'stdio',
      command: process.execPath,
      args: [path.join(__dirname, 'mcp_api_wrapper.js'), '--ingested', entry.id],
      envRefs: entry.secretRef ? [entry.secretRef] : []
    };
  }
  return null;
}

module.exports = { list, get, specFor, VENDOR_SERVERS };
