/**
 * MCP Streamable-HTTP transport (Phase 4)
 * =======================================
 * Exposes the in-process MCP bridge as a REMOTE, multi-client MCP server over
 * streamable HTTP (stateless JSON), so a reseller's own agents can point at the
 * governed CONVERGENCE-Ai surface — not one local stdio process.
 *
 * Every request carries identity: `resolveContext(req)` turns the caller's
 * authenticated request into { actor, role, tenantId, approved }, which the
 * bridge threads into the shared registry so RLS + audit + the approval gate
 * apply to agent calls the same as to human calls.
 *
 * The @modelcontextprotocol/sdk dependency is loaded lazily and guarded: this
 * module always imports cleanly (so the test suite and gateway boot are never
 * blocked), and createMcpHttpHandler() throws an actionable error only if it is
 * actually invoked without the SDK installed. Wiring this handler into the
 * gateway is done after the Phase-2.5 route cutover lands.
 */

const { listMcpTools, callMcpTool } = require('./mcp_bridge');

let sdk = null;
function loadSdk() {
  if (sdk) return sdk;
  try {
    // eslint-disable-next-line global-require
    const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
    // eslint-disable-next-line global-require
    const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
    sdk = { McpServer, StreamableHTTPServerTransport };
    return sdk;
  } catch (e) {
    throw new Error('Remote MCP transport requires "@modelcontextprotocol/sdk". Install it in aiwx-smb-auditor to enable POST /mcp.');
  }
}

/** True when the SDK is present and the remote transport can be created. */
function isMcpTransportAvailable() {
  try { loadSdk(); return true; } catch (e) { return false; }
}

/**
 * Default identity resolver: reads req.actor/req.role/req.tenantId (set by the
 * gateway auth middleware) and treats an explicit `approved:true` in the JSON-RPC
 * params meta as the human sign-off for a destructive tool.
 */
function defaultResolveContext(req) {
  return {
    actor: (req && req.actor) || 'mcp-client',
    role: (req && req.role) || 'operator',
    tenantId: (req && req.tenantId) || null,
    approved: Boolean(req && req.headers && req.headers['x-mcp-approved'] === 'true')
  };
}

/**
 * Build a fresh MCP server wired to the bridge. Stateless: a new instance per
 * request keeps horizontal scaling simple (no session affinity).
 */
async function buildServer(ctx) {
  const { McpServer } = loadSdk();
  const server = new McpServer({ name: 'convergence-ai', version: '1.0.0' });
  for (const tool of listMcpTools()) {
    server.registerTool(
      tool.name,
      { title: tool.title, description: tool.description, inputSchema: tool.inputSchema, annotations: tool.annotations },
      async (args) => callMcpTool(tool.name, args, ctx)
    );
  }
  return server;
}

/**
 * Express handler for POST /mcp (stateless streamable HTTP). Mount behind the
 * gateway auth middleware so `req.actor` is populated before the resolver runs.
 */
function createMcpHttpHandler(options = {}) {
  const resolveContext = options.resolveContext || defaultResolveContext;
  const { StreamableHTTPServerTransport } = loadSdk(); // fail fast at wire time

  return async function mcpHandler(req, res) {
    try {
      const ctx = resolveContext(req);
      const server = await buildServer(ctx);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined }); // stateless
      res.on('close', () => { transport.close(); server.close(); });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: err.message }, id: null });
      }
    }
  };
}

module.exports = { createMcpHttpHandler, isMcpTransportAvailable, listMcpTools, defaultResolveContext };
