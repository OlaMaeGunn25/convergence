/**
 * Agent Roster — role catalog for the Agentic Operations Layer
 * ============================================================
 * The canonical set of agent ROLES CONVERGENCE-Ai provisions per tenant/vertical
 * (see docs/AGENTIC_OPERATIONS.md). Each role declares its plane (business vs the
 * human-care plane), its duty, and the registry tools it is allowed to invoke
 * (least privilege — enforced at the tool-registry gate, AGT-03/CTL-05).
 *
 * Tool bindings reference EXISTING registry tools; capabilities that are not yet
 * built (RAG ingest, regulatory search, email/voice, agent telemetry) are noted
 * with `pending:` tags so later phases can bind them without changing callers.
 * `'*'` means the role may invoke any tool (reserved for the lead Orchestrator).
 */

const { copy } = require('./immutable');

const PLANES = { BUSINESS: 'business', HUMAN: 'human' };

const ROLES = {
  orchestrator: {
    title: 'Orchestrator (lead)',
    plane: PLANES.BUSINESS,
    duty: 'Provisions/assigns/deploys the roster; sole mediator of inter-agent negotiation; maintains the unified connected-capability model; enforces HITL gates + autonomy grants; assigns tasks based on negotiation outcome.',
    tools: ['*']
  },
  configurator: {
    title: 'Convergence-Ai Configurator',
    plane: PLANES.BUSINESS,
    duty: 'Configures the instance at install: vertical, LLM selection + cost disclosures, RAG, and roster; hands the ready instance to the Orchestrator.',
    tools: ['connect_system', 'list_connectors', 'provision_roster']
  },
  onboarding: {
    title: 'Onboarding Agent',
    plane: PLANES.BUSINESS,
    duty: 'Coordinates all pre-conditions (connections, credentials, scope approvals, disclosures); onboards/trains/offboards HITL users; hands off to the Systems Configurator.',
    tools: ['list_connectors', 'get_connection_status', 'provision_roster']
  },
  systems_configurator: {
    title: 'Systems Configurator (System-State Eval/Config)',
    plane: PLANES.BUSINESS,
    duty: 'Comprehends each connected system’s full capabilities AND operational processes; binds capability manifests to operating agents; produces readiness.',
    tools: ['list_connectors', 'match_integrations', 'get_connection_status', 'connect_system',
      // Resolving which MLS board covers the tenant's geography is connection
      // work, not listing work — it happens before anything is bound.
      'realestate_mls_board_coverage', 'realestate_mls_connection_options',
      // Preconditions are connection work: establishing what must be true before
      // a system can be bound at all.
      'get_connection_preconditions', 'epic_list_organizations']
  },
  knowledge_compilation: {
    title: 'Knowledge Compilation Agent',
    plane: PLANES.BUSINESS,
    duty: 'Compiles one company knowledge base from RAG scour + upload + connector-read + system manifests, for the Orchestrator to ground task assignment.',
    tools: ['ingest_source', 'compile_knowledge_base', 'search_knowledge_base', 'correlate_task', 'search_scholar']
  },
  compliance: {
    title: 'Compliance Agent',
    plane: PLANES.BUSINESS,
    duty: 'Validates compliance by industry/domain/vertical; runs a governed external search of local/state/federal regulations; screens all I/O before the commit boundary; hands evidence to the Reporting Agent.',
    tools: ['regulatory_search', 'validate_compliance', 'precommit_review', 'search_scholar', 'get_governance_report']
  },
  operations: {
    title: 'Operations Agent',
    plane: PLANES.BUSINESS,
    duty: 'Executes system tasks across connected systems (systems operations).',
    tools: ['run_audit', 'clio_list_matters', 'clio_create_activity', 'clio_record_trust_transaction',
      'realestate_search_listings', 'realestate_get_listing',
      'realestate_search_properties', 'realestate_get_property',
      // Bound but not free: compliance-floor + requiresApproval, so holding the
      // tool is not the same as being able to run it unattended.
      'realestate_skip_trace',
      'epic_list_appointments', 'epic_list_practitioners',
      // Bound but approval-gated and on the compliance floor.
      'epic_schedule_appointment']
  },
  admin_support: {
    title: 'Admin-Support Agent',
    plane: PLANES.BUSINESS,
    duty: 'Communications & outreach: email + appointment scheduling (now); Twilio voice (roadmap).',
    tools: [], // email/calendar tools bind when those connectors land
    pending: ['send_email', 'schedule_appointment', 'place_voice_call']
  },
  delivery: {
    title: 'Delivery Agent',
    plane: PLANES.BUSINESS,
    duty: 'Oversees task completion and system output; attests before a task may reach done.',
    tools: ['get_task', 'list_tasks', 'transition_task']
  },
  qa: {
    title: 'Q/A Agent',
    plane: PLANES.BUSINESS,
    duty: 'Independently validates quality + compliance of completed tasks and reports (separation from Delivery).',
    tools: ['get_task', 'list_tasks', 'get_governance_report']
  },
  monitoring: {
    title: 'Monitoring Agent',
    plane: PLANES.BUSINESS,
    duty: 'Emits live telemetry to the floating monitor; keeps agent/task/onboarding state current.',
    tools: ['emit_telemetry', 'get_agent_telemetry', 'get_connection_status', 'get_governance_report']
  },
  reporting: {
    title: 'Reporting Agent',
    plane: PLANES.BUSINESS,
    duty: 'Generates visual compliance reports and keeps immutable, exportable record evidence.',
    tools: ['compliance_report', 'export_compliance_evidence', 'get_governance_report']
  },
  human_companion: {
    title: 'Human Companion (HR Generalist) Agent',
    plane: PLANES.HUMAN,
    duty: 'HR generalist assigned to protect the human: PTO, assignment status, manager approvals, complaints/grievances, work-life balance. Operates under a confidentiality partition isolated from the business/ops plane.',
    tools: [
      'hr_submit_request', 'hr_list_requests', 'hr_manager_view', 'hr_route_approval', 'hr_set_status', 'hr_wellbeing_check',
      // Gusto = the HR system of record. Bound ONLY to the human-care plane so
      // business/ops agents can never read employee or payroll data.
      'gusto_list_employees', 'gusto_list_time_off_requests', 'gusto_list_payrolls',
      'gusto_submit_time_off_request', 'gusto_decide_time_off_request', 'gusto_run_payroll',
      'hr_file_with_hr_system',
      // Upskilling DELIVERY. The person-keyed tools are bound here and NOWHERE
      // else, so no business/ops agent can read an individual's training record.
      // (The role-keyed curriculum tools are business-safe and bound below too.)
      'hr_my_learning_path', 'hr_enroll_upskilling', 'hr_complete_training_module',
      'hr_erase_my_training_record', 'get_role_curriculum', 'list_curricula'
    ]
  }
};

const ROLE_IDS = Object.keys(ROLES);

function isRole(role) {
  return Object.prototype.hasOwnProperty.call(ROLES, role);
}

/** Least-privilege check: may an agent of `role` invoke `toolName`? */
function roleAllowsTool(role, toolName) {
  const def = ROLES[role];
  if (!def) return false;
  if (def.tools.includes('*')) return true;
  return def.tools.includes(toolName);
}

/**
 * Public view of the roster (for discovery / GET /api/agent-roles).
 * Returns DETACHED copies: handing out the live `tools` array would let a caller
 * push a tool onto a role and permanently bypass least privilege (AGT-03).
 */
function listRoles() {
  return ROLE_IDS.map(id => copy({
    id, title: ROLES[id].title, plane: ROLES[id].plane, duty: ROLES[id].duty,
    tools: ROLES[id].tools, pending: ROLES[id].pending || []
  }));
}

module.exports = { ROLES, ROLE_IDS, PLANES, isRole, roleAllowsTool, listRoles };
