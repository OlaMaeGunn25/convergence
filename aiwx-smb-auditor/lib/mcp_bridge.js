/**
 * MCP Bridge (Phase 4) — in-process registry ↔ MCP adapter
 * ========================================================
 * The heart of the remote, multi-tenant MCP surface. Instead of the MCP server
 * HTTP-round-tripping back into the gateway, it draws tools straight from the
 * ONE internal tool registry (Phase 2) and calls tool_registry.invoke()
 * IN-PROCESS — so there is a single capability definition and one governance
 * path for both HTTP and MCP callers.
 *
 * Identity is threaded: callMcpTool receives a ctx { actor, role, tenantId,
 * approved } resolved from the caller's authenticated request, so RLS, the
 * audit trail, and the destructive-tool approval gate all apply to agent calls
 * exactly as they do to a human's.
 *
 * This module is transport-agnostic and dependency-light (registry +
 * zod-to-json-schema). The streamable-HTTP transport lives in lib/mcp_http.js.
 */

const { zodToJsonSchema } = require('zod-to-json-schema');
const registry = require('./tool_registry');

// Map registry annotations to MCP tool hints.
function toMcpAnnotations(a = {}) {
  return {
    readOnlyHint: Boolean(a.readOnly),
    destructiveHint: Boolean(a.destructive),
    idempotentHint: false,
    openWorldHint: Boolean(a.openWorld)
  };
}

/**
 * MCP tool descriptors built from the registry: name, description, a real JSON
 * Schema (from each tool's Zod schema), governance hints, and the provenance
 * contract. This is what an MCP tools/list returns.
 */
function listMcpTools() {
  return registry.list().map(meta => {
    const tool = registry.get(meta.name);
    let inputSchema = { type: 'object', properties: {} };
    try {
      inputSchema = zodToJsonSchema(tool.inputSchema, { target: 'jsonSchema7', $refStrategy: 'none' });
    } catch (e) { /* fall back to permissive schema */ }
    return {
      name: meta.name,
      title: meta.title,
      description: meta.description,
      inputSchema,
      annotations: toMcpAnnotations(meta.annotations),
      _provenance: meta.provenance
    };
  });
}

/**
 * Invoke a tool for an MCP caller. Threads identity/approval into the shared
 * registry and shapes the result as MCP content. A destructive tool without
 * approval returns a non-error result flagged requiresApproval (so an agent can
 * route it to a human) rather than executing.
 *
 * @param ctx { actor, role, tenantId, approved }
 */
async function callMcpTool(name, args = {}, ctx = {}) {
  if (!registry.has(name)) {
    return { content: [{ type: 'text', text: `Error: unknown tool "${name}".` }], isError: true };
  }
  const res = await registry.invoke(name, args, {
    actor: ctx.actor || 'mcp-client',
    role: ctx.role || 'operator',
    tenantId: ctx.tenantId || null,
    approved: ctx.approved === true
  });

  if (res.ok === false && res.status === 'requires_approval') {
    return {
      content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
      structuredContent: res,
      _meta: { requiresApproval: true }
    };
  }
  if (res.ok === false) {
    return { content: [{ type: 'text', text: `Error: ${res.error || 'invocation failed.'}` }], isError: true, structuredContent: res };
  }
  return {
    content: [{ type: 'text', text: typeof res.result === 'string' ? res.result : JSON.stringify(res.result, null, 2) }],
    structuredContent: res.result
  };
}

module.exports = { listMcpTools, callMcpTool, toMcpAnnotations };
