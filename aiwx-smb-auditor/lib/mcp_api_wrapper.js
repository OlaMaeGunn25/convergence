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
 *            node lib/mcp_api_wrapper.js --ingested <ingestedApiId>
 *
 * The second form is what makes MCP available to EVERY vertical rather than to
 * the four connectors with hand-written modules: an API ingested from its own
 * description (see lib/api_ingestion.js) is served generically, each operation
 * becoming an MCP tool that performs the underlying HTTP call. Destructive
 * operations refuse without an explicit approval flag, so an ingested API cannot
 * become a route around the approval gate.
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

/** Connectors with hand-written modules this wrapper can serve directly. */
const WRAPPABLE = ['clio', 'gusto', 'epic', 'realestateapi'];

/**
 * Build an adapter map from an INGESTED API descriptor. Each operation becomes a
 * callable that performs the real HTTP request.
 *
 * Governance carried through, not assumed:
 *   - Destructive operations (anything not GET/HEAD/OPTIONS) refuse unless the
 *     caller passes `approved: true`. The tool registry gate has already run by
 *     the time a call reaches here; this is the second, independent check that
 *     the connector modules also perform.
 *   - The credential is read from the environment BY REFERENCE at call time and
 *     never appears in a result, an error message or a log line.
 *   - Path parameters are substituted from arguments and URL-encoded, so an
 *     argument cannot escape its segment and re-target the request.
 */
function buildIngestedAdapters(api) {
  const adapters = {};
  const token = api.credentialRefs && api.credentialRefs.length
    ? process.env[api.credentialRefs[0]]
    : null;

  for (const op of api.operations || []) {
    adapters[op.capability] = async (input) => {
      const args = input || {};
      if (op.destructive && args.approved !== true) {
        return {
          success: false,
          requiresApproval: true,
          capability: op.capability,
          message: `"${op.capability}" performs ${op.method.toUpperCase()} against ${api.name} and requires explicit human approval.`
        };
      }
      if (typeof fetch !== 'function') {
        return { success: false, error: 'global fetch unavailable in this runtime.' };
      }

      // Substitute {placeholders} from arguments, encoded per segment.
      let path = op.path.replace(/\{([^}]+)\}/g, (_, key) =>
        encodeURIComponent(String(args[key] == null ? '' : args[key]))
      );

      const headers = { Accept: 'application/json' };
      if (token) headers[api.authHeader || 'Authorization'] = token;
      const init = { method: op.method.toUpperCase(), headers };
      if (!['get', 'head', 'options'].includes(op.method)) {
        headers['Content-Type'] = 'application/json';
        const body = Object.assign({}, args);
        delete body.approved;
        init.body = JSON.stringify(body);
      }

      try {
        const res = await fetch(`${api.baseUrl}${path}`, init);
        const text = await res.text();
        let data = text;
        try { data = JSON.parse(text); } catch (e) { /* not JSON; return as text */ }
        return { success: res.ok, status: res.status, capability: op.capability, data };
      } catch (e) {
        // The message may echo the URL but never the credential, which is only
        // ever placed in a header.
        return { success: false, capability: op.capability, error: `Request failed: ${e.message}` };
      }
    };
  }
  return adapters;
}

function serve(connectorId, { ingestedApi = null } = {}) {
  const adapters = ingestedApi ? buildIngestedAdapters(ingestedApi) : buildAdapters(connectorId);
  const label = ingestedApi ? ingestedApi.id : connectorId;
  if (!adapters || !Object.keys(adapters).length) {
    process.stderr.write(`No API adapter map for "${label}".\n`);
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
            serverInfo: {
              name: `aiwx-api-wrapper-${label}`,
              tier: 'api_wrapper_mcp',
              source: ingestedApi ? 'api_ingestion' : 'connector_module'
            },
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
        if (!fn) return err(msg.id, `Unknown tool "${msg.params && msg.params.name}" on ${label} wrapper.`);
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
  const argv = process.argv.slice(2);
  if (argv[0] === '--ingested') {
    const { IngestedApiStore } = require('./api_ingestion');
    const api = new IngestedApiStore().get(argv[1] || '');
    if (!api) {
      process.stderr.write(`No ingested API "${argv[1]}".
`);
      process.exit(1);
    }
    serve(api.id, { ingestedApi: api });
  } else {
    serve(argv[0] || '');
  }
}

module.exports = { WRAPPABLE, buildAdapters, buildIngestedAdapters, serve };
