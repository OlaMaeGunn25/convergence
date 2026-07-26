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
const { buildGovernanceReport } = require('./governance_report');
const catalog = require('./connectors/catalog');
const { matchIntegrations } = require('./integration_matcher');
const { ConnectionRegistry } = require('./connection_registry');
const clio = require('./connectors/clio');
const roster = require('./agent_roster');
const { AgentRegistry } = require('./agent_model');
const { HitlRegistry } = require('./hitl_identity');
const { AttributionLog } = require('./attribution');
const systemEvaluator = require('./system_evaluator');
const { KnowledgeBase } = require('./knowledge_ingest');
const industry = require('./industry_practices');
const { Installation } = require('./installation');
const { AttestationLog } = require('./attestation');

const taskModel = new TaskModel();
const connectionRegistry = new ConnectionRegistry();
const agentRegistry = new AgentRegistry();
const hitlRegistry = new HitlRegistry();
const attributionLog = new AttributionLog();
const knowledgeBase = new KnowledgeBase();
const installation = new Installation({ agentRegistry, connectionRegistry });
const attestationLog = new AttestationLog();

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

  // HITL identity gate (IDN-03): when a HITL identity is attached, it must be an
  // authorized, active HITL. Callers without ctx.hitlId are unaffected.
  if (ctx.hitlId) {
    const auth = await hitlRegistry.isAuthorized(ctx.hitlId);
    if (!auth.ok) return { ok: false, status: 'hitl_unauthorized', error: auth.reason };
  }

  // Agent governance gate (AGT-03 / CTL-05): when a specific agent is the caller,
  // enforce its live status (paused/shutdown agents are refused) and its
  // least-privilege role→tool binding. Callers without ctx.agentId are unaffected.
  if (ctx.agentId) {
    const permit = await agentRegistry.mayInvoke(ctx.agentId, name);
    if (!permit.ok) return { ok: false, status: 'agent_forbidden', error: permit.reason };
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
  title: 'Export integration-readiness candidate to CRM',
  description: 'Record a company the Auditor evaluated — with its systems inventory and recommended integrations — to Supabase (inbound_leads). NOT sales prospecting. Requires Supabase configured.',
  // `candidate` is preferred; `prospect` is accepted for backward compatibility.
  inputSchema: z.object({
    candidate: z.object({ domain: z.string() }).passthrough().optional(),
    prospect: z.object({ domain: z.string() }).passthrough().optional()
  }).refine(v => v.candidate || v.prospect, { message: 'candidate (with a domain) is required.' }),
  annotations: { readOnly: false, openWorld: true },
  handler: async (input) => {
    if (!isSupabaseConfigured()) return { success: false, error: 'Supabase not configured.' };
    const candidate = input.candidate || input.prospect;
    return insertRow('inbound_leads', { raw_payload: candidate, status: 'evaluated' });
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

register({
  name: 'get_governance_report',
  title: 'Unified AI TRiSM governance report',
  description: 'Cross-references the audit_log actor trail (WHO), audit reliability/distribution/validation (WHAT), and task-model state into one governance snapshot with a health headline.',
  inputSchema: z.object({ limit: z.number().int().min(1).max(500).optional(), tenantId: z.string().optional() }),
  annotations: { readOnly: true, openWorld: true },
  handler: (input, ctx) => buildGovernanceReport({ limit: input.limit, tenantId: input.tenantId || ctx.tenantId })
});

// ── Systems-evaluation / integration capabilities ───────────────────────────

register({
  name: 'list_connectors',
  title: 'List available MCP/API connectors',
  description: 'Discover the connector catalog CONVERGENCE-Ai can wire into the governed MCP layer. Never leaks credential values — only which env keys are expected and whether they are populated.',
  inputSchema: z.object({ vertical: z.string().optional() }),
  annotations: { readOnly: true, openWorld: false },
  handler: (input) => {
    const items = input.vertical ? catalog.byVertical(input.vertical) : catalog.list();
    return { connectors: items.map(catalog.publicView) };
  }
});

register({
  name: 'match_integrations',
  title: 'Match detected systems to connectors + roadmap',
  description: 'Given a company\'s detected technologies + vertical, return the recommended MCP/API integrations and a prioritized connection roadmap (the systems-evaluation deliverable).',
  inputSchema: z.object({
    technologies: z.array(z.object({ name: z.string(), category: z.string().optional() })).optional(),
    vertical: z.string().optional(),
    businessName: z.string().optional(),
    domain: z.string().optional()
  }),
  annotations: { readOnly: true, openWorld: false },
  handler: (input) => matchIntegrations({
    technologies: input.technologies || [],
    vertical: input.vertical || '',
    businessName: input.businessName || '',
    domain: input.domain || ''
  })
});

register({
  name: 'get_connection_status',
  title: 'Connection status of every system',
  description: 'The live connection state of each catalog connector (not_connected | configuring | connected | error | disconnected) plus whether its credentials are configured. Feeds the floating status component.',
  inputSchema: z.object({ tenantId: z.string().optional() }),
  annotations: { readOnly: true, openWorld: false },
  handler: (input, ctx) => connectionRegistry.statusBoard({ tenantId: input.tenantId || ctx.tenantId || null })
    .then(systems => ({ systems, generatedAt: new Date().toISOString() }))
});

register({
  name: 'connect_system',
  title: 'Connect a system to the MCP layer',
  description: 'Establish (build) a connection for a catalog connector. Governed: establishing an external integration requires human approval. Credentials are NEVER accepted here — the builder only checks env/Secret-Manager keys and reports the auth action needed.',
  inputSchema: z.object({
    connectorId: z.string(),
    tenantId: z.string().optional(),
    config: z.record(z.any()).optional()
  }),
  annotations: { readOnly: false, destructive: false, requiresApproval: true, openWorld: true },
  handler: (input, ctx) => connectionRegistry.build(input.connectorId, {
    tenantId: input.tenantId || ctx.tenantId || null,
    actor: ctx.actor || null,
    config: input.config || {}
  })
});

register({
  name: 'clio_list_matters',
  title: 'Clio — list matters',
  description: 'Read open matters from Clio (Legal vertical). Degrades to a clearly-labeled simulated dataset when CLIO_ACCESS_TOKEN is not configured.',
  inputSchema: z.object({ limit: z.number().int().min(1).max(200).optional() }),
  annotations: { readOnly: true, openWorld: true },
  provenance: { returnsProvenance: true, note: 'Rows carry provenance live|simulated.' },
  handler: (input) => clio.listMatters({ limit: input.limit || 25 })
});

register({
  name: 'clio_create_activity',
  title: 'Clio — log a billable activity',
  description: 'Create a billable time/expense activity on a Clio matter. DESTRUCTIVE — writes to the practice-management system; requires human approval.',
  inputSchema: z.object({
    matterId: z.number().int(),
    quantity: z.number(),
    note: z.string().min(1),
    type: z.enum(['TimeEntry', 'ExpenseEntry']).optional()
  }),
  annotations: { readOnly: false, destructive: true, requiresApproval: true, openWorld: true },
  handler: (input) => clio.createActivity(input)
});

register({
  name: 'clio_record_trust_transaction',
  title: 'Clio — record a trust (IOLTA) transaction',
  description: 'Record a client trust-account transaction in Clio. HIGHEST-RISK legal action (money held in trust) — requires human approval and passes the approval through to the connector.',
  inputSchema: z.object({
    matterId: z.number().int(),
    amount: z.number(),
    kind: z.enum(['deposit', 'withdrawal']),
    memo: z.string().min(1)
  }),
  annotations: { readOnly: false, destructive: true, requiresApproval: true, openWorld: true },
  handler: (input, ctx) => clio.recordTrustTransaction(Object.assign({}, input, { approved: ctx.approved === true }))
});

// ── Agentic Operations Layer (Phase 0): roster + lifecycle ───────────────────

register({
  name: 'list_agent_roles',
  title: 'List the agent roster roles',
  description: 'Discover the 13 agent roles CONVERGENCE-Ai provisions per tenant/vertical (business plane + the human-care plane), with each role\'s duty and permitted tools.',
  inputSchema: z.object({}),
  annotations: { readOnly: true, openWorld: false },
  handler: () => ({ roles: roster.listRoles() })
});

register({
  name: 'provision_roster',
  title: 'Provision the agent team for a tenant/vertical',
  description: 'Provision the full 13-role agent team for a tenant + vertical (the isolated team-per-instance). Idempotent per (tenant, role). Agents start in "provisioned"; going live to "active" is a separate HITL-gated step.',
  inputSchema: z.object({
    tenantId: z.string().optional(),
    vertical: z.string().optional(),
    scopeConnectors: z.array(z.string()).optional()
  }),
  annotations: { readOnly: false, destructive: false, openWorld: false },
  handler: (input, ctx) => agentRegistry.provisionRoster({
    tenantId: input.tenantId || ctx.tenantId || null,
    vertical: input.vertical || null,
    scopeConnectors: input.scopeConnectors || []
  }).then(agents => ({ provisioned: agents.length, agents }))
});

register({
  name: 'list_agents',
  title: 'List provisioned agents',
  description: 'List agents for a tenant (optionally filtered by role or vertical) with their lifecycle status.',
  inputSchema: z.object({ tenantId: z.string().optional(), role: z.string().optional(), vertical: z.string().optional() }),
  annotations: { readOnly: true, openWorld: false },
  handler: (input, ctx) => agentRegistry.list({
    tenantId: input.tenantId || ctx.tenantId || undefined,
    role: input.role, vertical: input.vertical
  }).then(agents => ({ agents }))
});

register({
  name: 'get_agent',
  title: 'Get an agent',
  description: 'Fetch a single agent by id (role, scope, bound tools, lifecycle status).',
  inputSchema: z.object({ id: z.string() }),
  annotations: { readOnly: true, openWorld: false },
  handler: (input) => agentRegistry.get(input.id).then(agent => ({ agent }))
});

register({
  name: 'deploy_agent',
  title: 'Deploy an agent (go live)',
  description: 'Transition an agent from ready → active (go-live). Governed: deploying an operating agent requires explicit human approval (ONB-05).',
  inputSchema: z.object({ id: z.string() }),
  annotations: { readOnly: false, destructive: false, requiresApproval: true, openWorld: false },
  handler: (input, ctx) => agentRegistry.transition(input.id, 'active', { actor: ctx.actor }).then(agent => ({ agent }))
});

register({
  name: 'control_agent',
  title: 'HITL control: pause / resume / shutdown an agent',
  description: 'Exercise HITL control over an agent (CTL-04/05). pause suspends new tool invocations; resume returns to active; shutdown is terminal (re-provision to restore).',
  inputSchema: z.object({ id: z.string(), action: z.enum(['pause', 'resume', 'shutdown']) }),
  annotations: { readOnly: false, destructive: false, openWorld: false },
  handler: (input, ctx) => {
    const toStatus = input.action === 'pause' ? 'paused' : input.action === 'resume' ? 'active' : 'shutdown';
    return agentRegistry.transition(input.id, toStatus, { actor: ctx.actor }).then(agent => ({ agent }));
  }
});

// ── HITL identity, lifecycle & attribution (Phase 0.5) ───────────────────────

register({
  name: 'onboard_hitl',
  title: 'Onboard a HITL user',
  description: 'Onboard a human-in-the-loop (Onboarding agent, HLC-01). Requires a corporate/domain email — consumer domains and (when a tenant domain is set) mismatched domains are rejected. Starts in "onboarding".',
  inputSchema: z.object({
    email: z.string(),
    tenantId: z.string().optional(),
    name: z.string().optional(),
    authorityLevel: z.enum(['operator', 'lead']).optional(),
    tenantDomain: z.string().optional()
  }),
  annotations: { readOnly: false, destructive: false, openWorld: false },
  handler: (input, ctx) => hitlRegistry.onboard({
    email: input.email, tenantId: input.tenantId || ctx.tenantId || null,
    name: input.name || null, authorityLevel: input.authorityLevel || 'operator',
    tenantDomain: input.tenantDomain || null
  }).then(hitl => ({ hitl }))
});

register({
  name: 'set_hitl_status',
  title: 'HITL lifecycle: train / activate / suspend / offboard',
  description: 'Move a HITL through its lifecycle (onboarding→trained→active→suspended, or →offboarded). Offboarding is terminal and revokes authorization + access (HLC-03).',
  inputSchema: z.object({ id: z.string(), status: z.enum(['trained', 'active', 'suspended', 'offboarded']) }),
  annotations: { readOnly: false, destructive: false, openWorld: false },
  handler: (input) => hitlRegistry.setStatus(input.id, input.status).then(hitl => ({ hitl }))
});

register({
  name: 'list_hitl',
  title: 'List HITL users',
  description: 'List HITL users for a tenant (optionally filtered by lifecycle status).',
  inputSchema: z.object({ tenantId: z.string().optional(), status: z.string().optional() }),
  annotations: { readOnly: true, openWorld: false },
  handler: (input, ctx) => hitlRegistry.list({ tenantId: input.tenantId || ctx.tenantId || undefined, status: input.status }).then(hitl => ({ hitl }))
});

register({
  name: 'get_hitl',
  title: 'Get a HITL user',
  description: 'Fetch a HITL identity by id (email, domain, authority level, lifecycle status).',
  inputSchema: z.object({ id: z.string() }),
  annotations: { readOnly: true, openWorld: false },
  handler: (input) => hitlRegistry.get(input.id).then(hitl => ({ hitl }))
});

register({
  name: 'authorize_hitl',
  title: 'Check HITL authorization',
  description: 'Return whether a HITL is an authorized, active identity permitted to approve/confirm/grant/control (IDN-03).',
  inputSchema: z.object({ id: z.string() }),
  annotations: { readOnly: true, openWorld: false },
  handler: (input) => hitlRegistry.isAuthorized(input.id)
});

register({
  name: 'record_attribution',
  title: 'Record an attributable prompt or output',
  description: 'Append an immutable, attributable record of a re-engineered prompt or a system output (ATR-01/02). Requires an attributable HITL (hitlId) — unattributable events are rejected.',
  inputSchema: z.object({
    type: z.enum(['prompt', 'output']),
    hitlId: z.string(),
    agentId: z.string().optional(),
    taskId: z.string().optional(),
    content: z.any(),
    summary: z.string().optional()
  }),
  annotations: { readOnly: false, destructive: false, openWorld: false },
  handler: (input) => attributionLog.record(input).then(record => ({ record }))
});

register({
  name: 'get_attribution_trace',
  title: 'Attribution chain-of-custody',
  description: 'Return the ordered, attributable record chain (prompts + outputs) for a task or a HITL (ATR-03 / TRC-03).',
  inputSchema: z.object({ taskId: z.string().optional(), hitlId: z.string().optional() }),
  annotations: { readOnly: true, openWorld: false },
  handler: (input) => input.taskId
    ? attributionLog.trace(input.taskId)
    : attributionLog.list({ hitlId: input.hitlId }).then(records => ({ hitlId: input.hitlId, records, count: records.length }))
});

// ── System comprehension: capabilities + processes (Phase 1, COMP/ONB) ───────

register({
  name: 'evaluate_system',
  title: 'Evaluate a connected system (capabilities + processes)',
  description: 'The Systems Configurator builds a capability manifest (actions classified read vs. write) AND an operational-process map for a connector (COMP-01).',
  inputSchema: z.object({ connectorId: z.string() }),
  annotations: { readOnly: true, openWorld: false },
  provenance: { returnsProvenance: true, note: 'Manifest carries source + confidence.' },
  handler: (input) => systemEvaluator.evaluateSystem(input.connectorId)
});

register({
  name: 'get_orchestrator_capabilities',
  title: 'Orchestrator unified capability model',
  description: 'The complete, queryable model of ALL connected systems\' capabilities + processes for a tenant (COMP-02) — what the Orchestrator uses to route and populate the task interface.',
  inputSchema: z.object({ tenantId: z.string().optional() }),
  annotations: { readOnly: true, openWorld: false },
  handler: (input, ctx) => systemEvaluator.buildTenantCapabilityModel({ tenantId: input.tenantId || ctx.tenantId || null, connectionRegistry })
});

register({
  name: 'get_onboarding_status',
  title: 'Agent-company onboarding readiness',
  description: 'Per-system onboarding readiness (not_ready | evaluating | ready | blocked) plus an aggregate agentReady flag (ONB-02).',
  inputSchema: z.object({ tenantId: z.string().optional() }),
  annotations: { readOnly: true, openWorld: false },
  handler: (input, ctx) => systemEvaluator.onboardingStatus({ tenantId: input.tenantId || ctx.tenantId || null, connectionRegistry })
});

// ── Knowledge ingestion + industry-practice correlation (Phase 2, ING/KNW) ───

register({
  name: 'ingest_source',
  title: 'Ingest company documents into the knowledge base',
  description: 'Knowledge Compilation agent: ingest SOPs/docs from a source (connector_read | upload) into the company KB. READ-ONLY + scope must be HITL-approved (approvedScope:true) + provenance-tagged (ING-04). on_prem_crawl is roadmap.',
  inputSchema: z.object({
    tenantId: z.string().optional(),
    source: z.enum(['connector_read', 'upload', 'on_prem_crawl']),
    docs: z.array(z.object({ ref: z.string().optional(), text: z.string() })),
    approvedScope: z.boolean()
  }),
  annotations: { readOnly: false, destructive: false, openWorld: false },
  handler: (input, ctx) => knowledgeBase.ingest({
    tenantId: input.tenantId || ctx.tenantId || null, source: input.source,
    docs: input.docs, approvedScope: input.approvedScope, actor: ctx.actor || null
  })
});

register({
  name: 'search_knowledge_base',
  title: 'Hybrid search the company knowledge base',
  description: 'Hybrid (keyword + semantic-overlap) search over the ingested company SOPs/docs, with provenance on every hit (grounds agent actions).',
  inputSchema: z.object({ tenantId: z.string().optional(), query: z.string(), k: z.number().int().min(1).max(20).optional() }),
  annotations: { readOnly: true, openWorld: false },
  provenance: { returnsProvenance: true, note: 'Each hit carries source + reference provenance.' },
  handler: (input, ctx) => knowledgeBase.search({ tenantId: input.tenantId || ctx.tenantId || null, query: input.query, k: input.k || 5 })
});

register({
  name: 'compile_knowledge_base',
  title: 'Compile the company knowledge base',
  description: 'Knowledge Compilation agent aggregate (KNW-04): the compiled company KB summary (chunks, sources, documents, readiness) the Orchestrator uses to ground task assignment.',
  inputSchema: z.object({ tenantId: z.string().optional() }),
  annotations: { readOnly: true, openWorld: false },
  handler: (input, ctx) => knowledgeBase.compile({ tenantId: input.tenantId || ctx.tenantId || null })
});

register({
  name: 'get_industry_practices',
  title: 'Per-vertical industry-standard practices',
  description: 'Return the industry-standard-practices corpus for a vertical (KNW-01).',
  inputSchema: z.object({ vertical: z.string() }),
  annotations: { readOnly: true, openWorld: false },
  handler: (input) => ({ vertical: input.vertical, practices: industry.getPractices(input.vertical) })
});

register({
  name: 'correlate_task',
  title: 'Correlate a task: practice ↔ SOP ↔ capability',
  description: 'Ground an intended capability against the industry practice, the governing company SOP (from the KB), and the system capability. The company SOP governs on conflict, which is flagged to HITL (KNW-02/03).',
  inputSchema: z.object({ vertical: z.string(), capability: z.string(), connectorId: z.string().optional(), tenantId: z.string().optional() }),
  annotations: { readOnly: true, openWorld: false },
  handler: (input, ctx) => industry.correlate({
    vertical: input.vertical, capability: input.capability, connectorId: input.connectorId || null,
    knowledgeBase, tenantId: input.tenantId || ctx.tenantId || null
  })
});

// ── Installation orchestration + Delivery/Q-A completion gate (Phase 3) ───────

register({
  name: 'install_convergence',
  title: 'Install CONVERGENCE-Ai for a tenant/vertical',
  description: 'Provision the full 13-agent roster scoped to the locked vertical and record the selected systems (INS-01/02, ORC-01). Agents start provisioned; go-live to active is a separate HITL-gated step.',
  inputSchema: z.object({
    tenantId: z.string(),
    vertical: z.string(),
    selectedConnectors: z.array(z.string()).optional()
  }),
  annotations: { readOnly: false, destructive: false, openWorld: false },
  handler: (input, ctx) => installation.install({
    tenantId: input.tenantId, vertical: input.vertical,
    selectedConnectors: input.selectedConnectors || [], actor: ctx.actor || null
  })
});

register({
  name: 'get_install_status',
  title: 'Installation completeness',
  description: 'Report install completeness (INS-03): roster deployed AND every selected system agent_ready.',
  inputSchema: z.object({ tenantId: z.string() }),
  annotations: { readOnly: true, openWorld: false },
  handler: (input) => installation.status({ tenantId: input.tenantId })
});

register({
  name: 'attest_delivery',
  title: 'Delivery attestation',
  description: 'The Delivery agent attests a task\'s output was produced/delivered (AGT-05) — required before a task can complete.',
  inputSchema: z.object({ taskId: z.string(), note: z.string().optional() }),
  annotations: { readOnly: false, destructive: false, openWorld: false },
  handler: (input, ctx) => attestationLog.attestDelivery({ taskId: input.taskId, actor: ctx.actor || null, agentId: ctx.agentId || null, note: input.note || null })
});

register({
  name: 'record_qa_verdict',
  title: 'Q/A verdict',
  description: 'The Q/A agent independently records a quality/compliance verdict (pass|flag). A flag blocks completion and routes to HITL (AGT-06).',
  inputSchema: z.object({ taskId: z.string(), verdict: z.enum(['pass', 'flag']), note: z.string().optional() }),
  annotations: { readOnly: false, destructive: false, openWorld: false },
  handler: (input, ctx) => attestationLog.recordQa({ taskId: input.taskId, verdict: input.verdict, actor: ctx.actor || null, agentId: ctx.agentId || null, note: input.note || null })
});

register({
  name: 'complete_task',
  title: 'Complete a task (Delivery + Q/A gated)',
  description: 'Transition a task executing → done, enforced by the completion gate: a Delivery attestation is required and no Q/A flag may be outstanding (AGT-05/06).',
  inputSchema: z.object({ taskId: z.string() }),
  annotations: { readOnly: false, destructive: false, openWorld: false },
  handler: async (input, ctx) => {
    const gate = await attestationLog.canComplete(input.taskId);
    if (!gate.ok) return { ok: false, status: 'completion_blocked', reason: gate.reason };
    const task = await taskModel.transition(input.taskId, 'done', { actor: ctx.actor });
    return { ok: true, task };
  }
});

module.exports = { register, has, get, list, invoke, describeSchema, _registry: registry };
