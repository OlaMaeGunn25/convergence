/**
 * Internal Tool Registry (Phase 2)
 * ================================
 * One typed definition of every CONVERGENCE-Ai capability. This is the single
 * surface both the HTTP routes and the MCP server draw from, so the two can
 * never drift and every capability carries the same governance metadata:
 *
 *   - annotations: readOnly / destructive / requiresApproval / openWorld
 *   - provenance:  whether the tool returns provenance-tagged data (WHAT-is-true)
 *
 * invoke() validates input against the tool's Zod schema and enforces the
 * approval policy centrally: a tool marked requiresApproval will not execute
 * unless the caller presents an approval in ctx. The orchestrator (Phase 3)
 * turns a `requires_approval` result into a pending_approval Task (HITL).
 */

const { z } = require('zod');
const { runAuditPipeline } = require('./audit_runner');
const { searchScholar } = require('./scholar');
const { negotiate } = require('./negotiation');
const { TaskModel } = require('./task_model');
const { isSupabaseConfigured, insertRow } = require('./supabase');

const taskModel = new TaskModel();

const registry = new Map();

/** Register a tool definition. */
function register(def) {
  if (!def || !def.name) throw new Error('A tool definition requires a name.');
  if (registry.has(def.name)) throw new Error(`Tool "${def.name}" is already registered.`);
  registry.set(def.name, {
    name: def.name,
    title: def.title || def.name,
    description: def.description || '',
    inputSchema: def.inputSchema || z.object({}),
    annotations: Object.assign({ readOnly: false, destructive: false, requiresApproval: false, openWorld: false }, def.annotations || {}),
    provenance: Object.assign({ returnsProvenance: false }, def.provenance || {}),
    handler: def.handler
  });
}

function has(name) { return registry.has(name); }
function get(name) { return registry.get(name); }

/** Derive a serializable field summary from a Zod object schema (best-effort). */
function describeSchema(schema) {
  try {
    const shape = schema && schema.shape ? schema.shape : {};
    return Object.entries(shape).map(([name, field]) => ({
      name,
      optional: typeof field.isOptional === 'function' ? field.isOptional() : false,
      type: (field._def && field._def.typeName || '').replace(/^Zod/, '').toLowerCase() || 'any'
    }));
  } catch (e) {
    return [];
  }
}

/** Discovery: metadata for every tool (for /api/tools and MCP tools/list). */
function list() {
  return Array.from(registry.values()).map(t => ({
    name: t.name,
    title: t.title,
    description: t.description,
    annotations: t.annotations,
    provenance: t.provenance,
    input: describeSchema(t.inputSchema)
  }));
}

/**
 * invoke(name, input, ctx)
 * @param ctx { actor, tenantId, approved } — approved:true satisfies a
 *            requiresApproval tool (the caller has confirmed a human decision).
 * @returns { ok, result } | { ok:false, error } | { ok:false, status:'requires_approval' }
 */
async function invoke(name, input = {}, ctx = {}) {
  const tool = registry.get(name);
  if (!tool) return { ok: false, error: `Unknown tool "${name}".` };

  const parsed = tool.inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Input validation failed.', issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) };
  }

  // Central governance gate: destructive/approval-required tools cannot execute
  // without an explicit approval in the calling context.
  if (tool.annotations.requiresApproval && ctx.approved !== true) {
    return {
      ok: false,
      status: 'requires_approval',
      tool: name,
      message: `Tool "${name}" is destructive and requires human approval. Stage it as a pending_approval task or invoke with an approved context.`,
      input: parsed.data
    };
  }

  const result = await tool.handler(parsed.data, ctx);
  return { ok: true, result };
}

// ── Capability registrations ────────────────────────────────────────────────

register({
  name: 'run_audit',
  title: 'Run SMB readiness audit',
  description: 'Full external audit (tech/WAF, SWOT, workforce, + Scholar for legal). Returns a provenance-tagged, governance-scored audit package.',
  inputSchema: z.object({ domain: z.string().min(3), vertical: z.string().optional(), apiKey: z.string().optional() }),
  annotations: { readOnly: false, destructive: false, openWorld: true },
  provenance: { returnsProvenance: true, note: 'Every field carries source + confidence; report carries reliability + distribution gate.' },
  handler: (input) => runAuditPipeline(input.domain, { vertical: input.vertical, apiKey: input.apiKey })
});

register({
  name: 'search_scholar',
  title: 'Search Google Scholar (legal)',
  description: 'Case-law + expert-witness vetting via SerpApi Google Scholar; simulated fallback when no key.',
  inputSchema: z.object({ q: z.string().min(1), num: z.number().int().min(1).max(20).optional() }),
  annotations: { readOnly: true, openWorld: true },
  provenance: { returnsProvenance: true, note: 'Results carry a simulated-vs-verified provenance flag.' },
  handler: (input) => searchScholar(input.q, { num: input.num })
});

register({
  name: 'negotiate',
  title: 'Multi-agent negotiation',
  description: 'Proposer/Critic/Arbiter loop to consensus; high-risk verticals escalate to HITL.',
  inputSchema: z.object({ topic: z.string().min(1), context: z.string().optional(), vertical: z.string().optional() }),
  annotations: { readOnly: true, openWorld: true },
  handler: (input) => negotiate({ topic: input.topic, context: input.context, vertical: input.vertical })
});

register({
  name: 'create_task',
  title: 'Create an orchestration task',
  description: 'Create a Task in the orchestration spine (state machine + dependencies).',
  inputSchema: z.object({
    type: z.string().min(1),
    payload: z.record(z.any()).optional(),
    dependsOn: z.array(z.string()).optional(),
    tenantId: z.string().optional()
  }),
  annotations: { readOnly: false },
  handler: (input, ctx) => taskModel.create({ type: input.type, payload: input.payload, dependsOn: input.dependsOn, tenantId: input.tenantId, actor: ctx.actor })
});

register({
  name: 'get_task',
  title: 'Get a task',
  description: 'Fetch one Task by id.',
  inputSchema: z.object({ id: z.string().min(1) }),
  annotations: { readOnly: true },
  handler: (input) => taskModel.get(input.id)
});

register({
  name: 'list_tasks',
  title: 'List tasks',
  description: 'List Tasks, optionally filtered by status.',
  inputSchema: z.object({ status: z.string().optional(), tenantId: z.string().optional() }),
  annotations: { readOnly: true },
  handler: (input) => taskModel.list({ status: input.status, tenantId: input.tenantId })
});

register({
  name: 'transition_task',
  title: 'Transition a task',
  description: 'Move a Task to a new state (state machine enforced).',
  inputSchema: z.object({ id: z.string().min(1), toStatus: z.string().min(1), result: z.record(z.any()).optional() }),
  annotations: { readOnly: false },
  handler: (input, ctx) => taskModel.transition(input.id, input.toStatus, { actor: ctx.actor, result: input.result })
});

register({
  name: 'export_crm',
  title: 'Export prospect to CRM',
  description: 'Write a prospect record to Supabase (inbound_leads). Requires Supabase configured.',
  inputSchema: z.object({ prospect: z.object({ domain: z.string() }).passthrough() }),
  annotations: { readOnly: false, openWorld: true },
  handler: async (input) => {
    if (!isSupabaseConfigured()) return { success: false, error: 'Supabase not configured.' };
    return insertRow('inbound_leads', { raw_payload: input.prospect, status: 'received' });
  }
});

register({
  name: 'publish_post',
  title: 'Publish a social post',
  description: 'Publish to a social channel. DESTRUCTIVE — requires human approval; the orchestrator stages a pending_approval task and the publisher executes only after sign-off.',
  inputSchema: z.object({
    platform: z.enum(['linkedin', 'facebook', 'instagram', 'threads']),
    text: z.string().min(1),
    image: z.string().optional()
  }),
  annotations: { readOnly: false, destructive: true, requiresApproval: true, openWorld: true },
  handler: async (input, ctx) => {
    // Reached only when ctx.approved === true (the registry gate enforces this).
    // Execution is wired to the publisher in Phase 3; here we return a staged
    // acknowledgement so the approved-path contract is explicit and testable.
    return { staged: true, platform: input.platform, approvedBy: ctx.actor || 'unknown', note: 'Approved; queued for publisher execution.' };
  }
});

module.exports = { register, has, get, list, invoke, describeSchema, _registry: registry };
