/**
 * API→MCP Wrapper — a spun-up MCP server around a connector's native API (DMC)
 * ============================================================================
 * Tier 2 of the connection-priority ladder. When a connected system publishes
 * no MCP server of its own, this process IS one: the bootstrapper spawns it
 * over stdio, it speaks newline-delimited JSON-RPC (initialize / tools/list /
 * tools/call), and each tool call is served by the connector module's native
 * API client in-process.
 *
 * What this buys: agents converse in ONE protocol regardless of what the vendor
 * ships. The native API stops being a parallel path agents talk to directly and
 * becomes the implementation detail behind an MCP surface — which is why the
 * raw API adapter is the FLOOR of the ladder, not a peer of it.
 *
 * Runs as:   node lib/mcp_api_wrapper.js <connectorId>
 *
 * Credentials: none are passed as arguments and none are printed. The child
 * inherits the gateway's environment, and the connector modules read their own
 * env keys exactly as they do in-process — including their simulated fallbacks
 * when unconfigured, so a wrapper for an uncredentialed system still handshakes
 * and serves clearly-labelled simulated data rather than dying ambiguously.
 *
 * Governance: this process is a child of the gateway, reached only through
 * DualModeClient INSIDE connector implementations — i.e. after the tool
 * registry's approval/compliance/autonomy gates have already run. Destructive
 * connector functions additionally re-check `approved` themselves (e.g. payroll,
 * trust transactions), so the defence-in-depth holds even here.
 */

/** Connector capability → native function maps. Names match catalog capabilities. */
function buildAdapters(connectorId) {
  switch (connectorId) {
    case 'clio': {
      const m = require('./connectors/clio');
      return {
        list_matters: i => m.listMatters(i || {}),
        create_activity: i => m.createActivity(i || {}),
        record_trust_transaction: i => m.recordTrustTransaction(i || {})
      };
    }
    case 'gusto': {
      const m = require('./connectors/gusto');
      return {
        list_employees: i => m.listEmployees(i || {}),
        list_time_off_requests: i => m.listTimeOffRequests(i || {}),
        list_payrolls: i => m.listPayrolls(i || {}),
        submit_time_off_request: i => m.submitTimeOffRequest(i || {}),
        decide_time_off_request: i => m.decideTimeOffRequest(i || {}),
        run_payroll: i => m.runPayroll(i || {})
      };
    }
    case 'epic': {
      const m = require('./connectors/epic');
      return {
        list_appointments: i => m.listAppointments(i || {}),
        list_practitioners: i => m.listPractitioners(i || {}),
        schedule_appointment: i => m.scheduleAppointment(i || {})
      };
    }
    case 'realestateapi': {
      const m = require('./connectors/realestateapi');
      return {
        search_listings: i => m.searchListings(i || {}),
        get_listing: i => m.getListing(i || {}),
        mls_board_coverage: i => m.boardCoverage(i || {}),
        search_properties: i => m.searchProperties(i || {}),
        get_property: i => m.getProperty(i || {})
      };
    }
    default:
      return null;
  }
}

/** Connectors this wrapper can stand up an MCP surface for. */
const WRAPPABLE = ['clio', 'gusto', 'epic', 'realestateapi'];

function serve(connectorId) {
  const adapters = buildAdapters(connectorId);
  if (!adapters) {
    process.stderr.write(`No API adapter map for connector "${connectorId}".\n`);
    process.exit(1);
  }

  const write = obj => process.stdout.write(JSON.stringify(obj) + '\n');
  const err = (id, message) => write({ jsonrpc: '2.0', id, error: { code: -32000, message } });

  let buffer = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch (e) { continue; }
      handle(msg);
    }
  });
  // Parent gone → no reason to exist. This is the leak guard from the child's side.
  process.stdin.on('end', () => process.exit(0));

  async function handle(msg) {
    try {
      if (msg.method === 'initialize') {
        return write({
          jsonrpc: '2.0', id: msg.id,
          result: {
            protocolVersion: '2025-06-18',
            serverInfo: { name: `aiwx-api-wrapper-${connectorId}`, tier: 'api_wrapper_mcp' },
            capabilities: { tools: {} }
          }
        });
      }
      if (msg.method === 'tools/list') {
        return write({
          jsonrpc: '2.0', id: msg.id,
          result: { tools: Object.keys(adapters).map(name => ({ name })) }
        });
      }
      if (msg.method === 'tools/call') {
        const fn = adapters[msg.params && msg.params.name];
        if (!fn) return err(msg.id, `Unknown tool "${msg.params && msg.params.name}" on ${connectorId} wrapper.`);
        const out = await fn((msg.params && msg.params.arguments) || {});
        return write({
          jsonrpc: '2.0', id: msg.id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(out) }],
            structuredContent: out
          }
        });
      }
      if (msg.id !== undefined) err(msg.id, `Unknown method "${msg.method}".`);
    } catch (e) {
      if (msg.id !== undefined) err(msg.id, e.message);
    }
  }
}

if (require.main === module) {
  serve(process.argv[2] || '');
}

module.exports = { WRAPPABLE, buildAdapters };
