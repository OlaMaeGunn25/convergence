/**
 * Composition Root (DI container)
 * ===============================
 * The single place the application's stateful services are constructed and
 * wired to each other.
 *
 * This used to live inline at the top of `lib/tool_registry.js`, which made that
 * file two things at once: a catalogue of 127 tool DEFINITIONS, and the wiring
 * that instantiates every store, registry and runtime the tools depend on.
 * Requiring the catalogue therefore booted the entire object graph — including a
 * bootstrapper that installs a process hook and can spawn children — so nothing
 * could read a tool definition without paying for the whole application, and
 * tests had no seam at which to substitute an isolated store.
 *
 * Separating them means:
 *   - `tool_registry.js` describes tools; `container.js` decides what they run against.
 *   - `build({ ... })` accepts overrides, so a test can construct an isolated
 *     graph without touching the shared one.
 *   - Construction order stays in one readable place, including the two ordering
 *     constraints that are easy to break by accident (noted below).
 *
 * Construction is still EAGER for the default graph, because the tool registry
 * closes over these instances at module load. That is a deliberate, contained
 * trade-off rather than an accident: `build()` exists for anyone who needs a
 * separate graph, and `resetDefault()` for tests that need a clean one.
 */

const { TaskModel } = require('./task_model');
const { ConnectionRegistry } = require('./connection_registry');
const { AgentRegistry } = require('./agent_model');
const { HitlRegistry } = require('./hitl_identity');
const { AttributionLog } = require('./attribution');
const { KnowledgeBase } = require('./knowledge_ingest');
const { TaskRecordStore } = require('./task_record');
const { PlaybookLibrary } = require('./playbook_library');
const { UpskillingEnrollment } = require('./upskilling');
const { HitlOnboarding } = require('./hitl_onboarding');
const { Installation } = require('./installation');
const { AttestationLog } = require('./attestation');
const { TelemetryStream } = require('./agent_telemetry');
const { AutonomyGrants } = require('./autonomy');
const { ChatSession } = require('./hitl_chat');
const { ComplianceReporting } = require('./compliance_reporting');
const { HumanCompanion } = require('./human_companion');
const { McpBootstrapper } = require('./mcp_bootstrapper');
const { createEmbedder } = require('./embeddings');
const { createReranker } = require('./reranker');
const gusto = require('./connectors/gusto');
const logger = require('./logger');

/**
 * Construct a complete service graph.
 *
 * Every service may be overridden, which is what makes this testable: pass a
 * store pointed at a temp file and the rest of the graph wires around it.
 *
 * @param {object} overrides  any subset of the returned service names
 * @returns {object} the wired services
 */
function build(overrides = {}) {
  const o = overrides || {};

  // One MCP runtime per graph: dynamic servers started here are tracked and torn
  // down on process exit, so a dying session cannot leak child processes.
  // Logs route through the logger module rather than console.log — MCP lifecycle
  // events were previously the one subsystem writing straight to stdout.
  const mcpBootstrapper = o.mcpBootstrapper || new McpBootstrapper({
    logger: msg => logger.info(msg)
  });

  const taskModel = o.taskModel || new TaskModel();
  const connectionRegistry = o.connectionRegistry || new ConnectionRegistry({ mcpBootstrapper });
  const agentRegistry = o.agentRegistry || new AgentRegistry();
  const hitlRegistry = o.hitlRegistry || new HitlRegistry();
  const attributionLog = o.attributionLog || new AttributionLog();
  const knowledgeBase = o.knowledgeBase || new KnowledgeBase({
    embedder: createEmbedder(),
    reranker: createReranker()
  });

  const taskRecords = o.taskRecords || new TaskRecordStore();
  const playbooks = o.playbooks || new PlaybookLibrary();

  // ORDERING CONSTRAINT 1: UpskillingEnrollment before HitlOnboarding — onboarding
  // enrols each HITL into its ROLE curriculum at assignment time.
  const upskillingEnrollment = o.upskillingEnrollment || new UpskillingEnrollment();
  const hitlOnboarding = o.hitlOnboarding || new HitlOnboarding({
    hitlRegistry,
    enrollment: upskillingEnrollment
  });

  // ORDERING CONSTRAINT 2: HitlOnboarding before Installation — install() onboards
  // HITLs as part of provisioning, so the dependency must already exist.
  const installation = o.installation || new Installation({
    agentRegistry,
    connectionRegistry,
    knowledgeBase,
    hitlOnboarding
  });

  const attestationLog = o.attestationLog || new AttestationLog();
  const telemetry = o.telemetry || new TelemetryStream();
  const autonomy = o.autonomy || new AutonomyGrants();
  const chatSession = o.chatSession || new ChatSession({
    connectionRegistry,
    taskModel,
    attributionLog,
    knowledgeBase
  });
  const complianceReporting = o.complianceReporting || new ComplianceReporting();
  const humanCompanion = o.humanCompanion || new HumanCompanion({
    hrSystem: o.hrSystem || gusto,
    enrollment: upskillingEnrollment
  });

  return {
    mcpBootstrapper,
    taskModel,
    connectionRegistry,
    agentRegistry,
    hitlRegistry,
    attributionLog,
    knowledgeBase,
    taskRecords,
    playbooks,
    upskillingEnrollment,
    hitlOnboarding,
    installation,
    attestationLog,
    telemetry,
    autonomy,
    chatSession,
    complianceReporting,
    humanCompanion
  };
}

/**
 * The process-wide default graph, built once. The tool registry closes over
 * these, so they are constructed on first require of this module.
 */
let defaultContainer = build();

/** The shared graph. */
function getDefault() {
  return defaultContainer;
}

/**
 * Replace the shared graph. Intended for tests and for embedders that need to
 * point the whole application at a different set of stores; disposes the
 * outgoing MCP runtime so its child processes do not outlive it.
 */
function resetDefault(overrides = {}) {
  const previous = defaultContainer;
  defaultContainer = build(overrides);
  if (previous && previous.mcpBootstrapper && previous.mcpBootstrapper !== defaultContainer.mcpBootstrapper) {
    try { previous.mcpBootstrapper.dispose(); } catch (e) { /* nothing left to release */ }
  }
  return defaultContainer;
}

module.exports = { build, getDefault, resetDefault };
