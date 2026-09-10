/**
 * Consultancy Skills Library, Prompt Frameworks & Deployment Runbook (CON)
 * =======================================================================
 * The operating kit for the `ai_consultancy` vertical — a reseller that
 * operationalises SMBs on Convergence. Three things a consultant needs mid-
 * engagement, served as DATA so the operations hub, the chat surface and the
 * MCP layer all render the same content:
 *
 *   1. SKILLS LIBRARY   — what a consultant needs to be able to do, per phase,
 *                         with the concrete platform capability behind it. Not
 *                         motivational: every skill names the tool or gate that
 *                         does the work, so "I know this" is checkable.
 *   2. PROMPT FRAMEWORKS— reusable prompt structures. Every one is executed
 *                         through Graph-of-Thought re-engineering like any other
 *                         prompt; these are starting shapes, not a bypass.
 *   3. DEPLOYMENT RUNBOOK — the real-time, ordered instructions for standing a
 *                         client up, each step naming the tool that performs it
 *                         and the gate that must clear before the next step.
 *
 * Plus `requestGuidance()`: a consultant who is stuck gets the relevant runbook
 * step and skills back IMMEDIATELY, and — only if that is not enough — an
 * escalation object addressed to a named human. Answering first matters: an
 * escalation that blocks the consultant until someone replies is a worse
 * experience than the documentation they already had.
 *
 * This module holds NO client data and performs no I/O. It is reference content
 * plus a request shape, which is why it can be served to any surface without a
 * tenant scope.
 */

const { copy } = require('./immutable');

const VERTICAL = 'ai_consultancy';

// ── Skills library ───────────────────────────────────────────────────────────

const SKILLS = [
  {
    id: 'skill-discovery',
    phase: 'Discovery',
    title: 'Map the process before proposing the automation',
    why: 'Automating an unmapped process automates the confusion in it.',
    capabilities: ['run_audit', 'evaluate_system', 'match_integrations', 'detect_system'],
    proficiency: 'Can produce a systems inventory and name the system of record for each data class.'
  },
  {
    id: 'skill-scoping',
    phase: 'Discovery',
    title: 'Separate what is connectable from what is merely catalogued',
    why: 'A connector existing in the catalogue is not a connection. Promising a connected workflow before preconditions clear is how engagements slip.',
    capabilities: ['list_connectors', 'get_connection_preconditions', 'get_connection_modes'],
    proficiency: 'Can state, for any target system, what the client must do out-of-band before a first call is possible.'
  },
  {
    id: 'skill-connect',
    phase: 'Deployment',
    title: 'Establish governed connections in the right mode',
    why: 'Transport is a choice with consequences: strict MCP fails loudly, auto degrades quietly but honestly.',
    capabilities: ['get_connection_interview', 'connect_system', 'get_connection_status'],
    proficiency: 'Can run the interview end to end and explain which transport served and why.'
  },
  {
    id: 'skill-vertical',
    phase: 'Deployment',
    title: 'Install onto the correct locked vertical',
    why: 'The vertical is chosen once and cannot be changed afterwards; it carries the compliance profile that screens every later action.',
    capabilities: ['list_verticals', 'install_convergence', 'get_install_status'],
    proficiency: 'Can justify the vertical selection against the client compliance profile before installing.'
  },
  {
    id: 'skill-hitl',
    phase: 'Deployment',
    title: 'Assign the client’s own humans as approvers',
    why: 'Approving on behalf of a client transfers their accountability to the consultancy. HITL identity requires a company-domain email for exactly this reason.',
    capabilities: ['onboard_hitl', 'list_hitl', 'authorize_hitl'],
    proficiency: 'Every approver on a delivered deployment is a named client employee, never the consultant.'
  },
  {
    id: 'skill-govern',
    phase: 'Operate',
    title: 'Observe before delegating autonomy',
    why: 'An autonomy grant issued before the client has watched the agent work is a grant issued without evidence.',
    capabilities: ['get_agent_telemetry', 'list_tasks', 'grant_autonomy', 'revoke_autonomy'],
    proficiency: 'Can show a run history that justifies each grant, and revoke one on demand.'
  },
  {
    id: 'skill-compliance',
    phase: 'Operate',
    title: 'Read a compliance determination and act on it',
    why: 'A flagged action is information, not an obstacle. Consequential decisions about a person carry duties the consultancy inherits as deployer.',
    capabilities: ['validate_compliance', 'regulatory_search', 'compliance_report'],
    proficiency: 'Can explain to a client why an action flagged, and what changes to clear it.'
  },
  {
    id: 'skill-handover',
    phase: 'Handover',
    title: 'Leave the client able to operate without you',
    why: 'An engagement that cannot be handed over is a dependency, not a delivery.',
    capabilities: ['export_compliance_evidence', 'get_governance_report', 'list_playbooks'],
    proficiency: 'Client staff can run, approve and audit the deployment unaided.'
  },
  {
    id: 'skill-claims',
    phase: 'Sales',
    title: 'Substantiate every capability claim',
    why: 'Unsubstantiated AI outcome claims are an FTC Act §5 exposure for the consultancy itself, not for the client.',
    capabilities: ['get_governance_report', 'get_agent_telemetry'],
    proficiency: 'Every figure quoted to a prospect traces to a measured deployment.'
  }
];

// ── Prompt frameworks ────────────────────────────────────────────────────────

const PROMPT_FRAMEWORKS = [
  {
    id: 'pf-discovery',
    name: 'Process Discovery Interview',
    use: 'First client session — extract the real process, not the described one.',
    structure: [
      'ROLE: an operations analyst mapping a process for automation.',
      'CONTEXT: the business, its vertical, and the systems already named.',
      'ASK: walk one recent real instance end to end, naming who touched it and which system held the record at each step.',
      'PROBE: where does this break, who notices, and what do they do about it?',
      'OUTPUT: a step list with system-of-record per step and the exceptions named.'
    ],
    pairsWith: ['skill-discovery', 'skill-scoping']
  },
  {
    id: 'pf-sop',
    name: 'SOP Extraction',
    use: 'Turn tribal knowledge into a governing SOP the knowledge base can hold.',
    structure: [
      'ROLE: a documentarian producing an SOP another employee could follow unaided.',
      'INPUT: the transcript or notes from the discovery session.',
      'CONSTRAINT: state the rule, its owner, and when it was set. An unowned rule is a habit, not an SOP.',
      'OUTPUT: numbered steps, decision points, and the exception path for each.'
    ],
    pairsWith: ['skill-discovery', 'skill-handover']
  },
  {
    id: 'pf-automation-case',
    name: 'Automation Candidate Assessment',
    use: 'Decide whether a step should be automated at all.',
    structure: [
      'ROLE: a sceptical reviewer whose default answer is "do not automate this yet".',
      'INPUT: one process step, its volume, its variance, and its failure cost.',
      'TEST: is the step stable, observable, and reversible? If any is no, say so plainly.',
      'OUTPUT: a recommendation with the condition that would change it.'
    ],
    pairsWith: ['skill-scoping', 'skill-govern']
  },
  {
    id: 'pf-client-brief',
    name: 'Client-Facing Change Brief',
    use: 'Explain a deployment to the people whose work it changes.',
    structure: [
      'ROLE: explaining a change to the staff affected by it, not to their executive.',
      'CONSTRAINT: no capability claim without evidence behind it.',
      'COVER: what changes, what stays the same, who approves what, and how to stop it.',
      'OUTPUT: one page, no jargon, ending with the name of the human who can halt the system.'
    ],
    pairsWith: ['skill-hitl', 'skill-claims']
  },
  {
    id: 'pf-incident',
    name: 'Deployment Incident Triage',
    use: 'A delivered deployment behaved unexpectedly at a client.',
    structure: [
      'ROLE: an incident responder establishing what actually happened before proposing a fix.',
      'FIRST: retrieve the task chain and the audit entries for the affected action.',
      'SEPARATE: what the agent did, what it was permitted to do, and what the client believed it would do.',
      'OUTPUT: sequence of events, the governing gate at each step, and the single corrective action.'
    ],
    pairsWith: ['skill-govern', 'skill-compliance']
  }
];

// ── Deployment runbook ───────────────────────────────────────────────────────

const RUNBOOK = [
  {
    step: 1, phase: 'Prepare', title: 'Confirm the vertical and its compliance profile',
    instruction: 'Select the client vertical and read its compliance overlay aloud with the client. The vertical is LOCKED at install and cannot be changed afterwards.',
    tools: ['list_verticals', 'regulatory_search'],
    gate: 'Client agrees the compliance profile matches their obligations.',
    blocksNext: true
  },
  {
    step: 2, phase: 'Prepare', title: 'Collect the required business address',
    instruction: 'The business address is mandatory — installation refuses without it. Ask the location-sharing questions exactly as served; GPS and IP are optional and default to denied.',
    tools: ['get_location_disclosure', 'record_location_consent'],
    gate: 'Address captured; any device-location consent recorded against a named human.',
    blocksNext: true
  },
  {
    step: 3, phase: 'Discover', title: 'Evaluate the systems the client already runs',
    instruction: 'Scour and match. Produce the candidate connector list with confidence, then hand the findings to onboarding as governed proposals rather than a verbal list.',
    tools: ['run_audit', 'evaluate_system', 'match_integrations', 'handoff_connection_candidates'],
    gate: 'A connection proposal exists for each system in scope.',
    blocksNext: false
  },
  {
    step: 4, phase: 'Connect', title: 'Check preconditions before promising anything',
    instruction: 'For every proposed system, read its preconditions. Systems whose access is granted out-of-band (an EHR, for example) cannot be connected on demand — surface that to the client in this session, not later.',
    tools: ['get_connection_preconditions', 'attest_precondition'],
    gate: 'Every blocking precondition is either satisfied or scheduled with an owner and a date.',
    blocksNext: true
  },
  {
    step: 5, phase: 'Connect', title: 'Run the connection interview per system',
    instruction: 'Ask for secret REFERENCES, never values — the platform refuses credentials over the API by design. Offer the three modes and recommend Auto-Detect & Upgrade to MCP.',
    tools: ['get_connection_interview', 'get_connection_modes', 'connect_system'],
    gate: 'Each connection reports connected, and you can state which transport served it.',
    blocksNext: true
  },
  {
    step: 6, phase: 'Install', title: 'Install and provision the roster',
    instruction: 'Install onto the locked vertical with the selected connectors. The full thirteen-agent roster provisions automatically and the company knowledge base is created from onboarding intelligence.',
    tools: ['install_convergence', 'get_install_status'],
    gate: 'Install status reports the roster provisioned and the knowledge base ready.',
    blocksNext: true
  },
  {
    step: 7, phase: 'Install', title: 'Assign client HITL approvers',
    instruction: 'Approvers must be the client’s own named employees with company-domain identities. Do not assign consultancy staff as the approver of record.',
    tools: ['onboard_hitl', 'list_hitl', 'authorize_hitl'],
    gate: 'At least one client-employed approver is active per approval domain.',
    blocksNext: true
  },
  {
    step: 8, phase: 'Operate', title: 'Run supervised before delegating',
    instruction: 'Leave every destructive action approval-gated. Watch the task chain and telemetry through a real cycle of the client’s work before considering autonomy.',
    tools: ['list_tasks', 'get_agent_telemetry', 'get_task_trace'],
    gate: 'A complete cycle has run with human approval at every gate.',
    blocksNext: true
  },
  {
    step: 9, phase: 'Operate', title: 'Grant autonomy narrowly, with evidence',
    instruction: 'Grant per tool or task type, never globally. Compliance-floor actions require an elevated grant or a live approval and should usually keep the live approval.',
    tools: ['grant_autonomy', 'list_autonomy_grants', 'revoke_autonomy'],
    gate: 'Each grant traces to observed runs; the client knows how to revoke it.',
    blocksNext: false
  },
  {
    step: 10, phase: 'Handover', title: 'Hand over the evidence and the controls',
    instruction: 'Export the compliance evidence pack and the governance report. Walk the client through approving, halting and auditing without you in the room.',
    tools: ['export_compliance_evidence', 'get_governance_report', 'list_playbooks'],
    gate: 'Client staff complete one approval and one halt unaided.',
    blocksNext: true
  }
];

// ── Accessors (detached copies — see lib/immutable) ──────────────────────────

function skills({ phase = null } = {}) {
  const rows = phase ? SKILLS.filter(s => s.phase.toLowerCase() === String(phase).toLowerCase()) : SKILLS;
  return copy(rows);
}

function promptFrameworks({ id = null } = {}) {
  const rows = id ? PROMPT_FRAMEWORKS.filter(f => f.id === id) : PROMPT_FRAMEWORKS;
  return copy(rows);
}

/**
 * The deployment runbook. `fromStep` returns the remainder, which is what a
 * consultant mid-deployment actually wants.
 */
function runbook({ fromStep = null, phase = null } = {}) {
  let rows = RUNBOOK;
  if (fromStep != null) rows = rows.filter(r => r.step >= Number(fromStep));
  if (phase) rows = rows.filter(r => r.phase.toLowerCase() === String(phase).toLowerCase());
  return {
    vertical: VERTICAL,
    totalSteps: RUNBOOK.length,
    steps: copy(rows),
    note: 'Steps marked blocksNext must clear before the following step is attempted. Nothing here bypasses a governance gate; the runbook orders the work, the gates still decide.'
  };
}

/**
 * A consultant asks for guidance.
 *
 * Answers FIRST from the runbook and skills library, then attaches an escalation
 * descriptor only when the caller says the self-serve answer will not do. The
 * escalation is a descriptor, not a side effect — the caller decides whether to
 * turn it into a governed task, which keeps this module free of I/O and of any
 * ability to message someone on its own.
 *
 * @returns { question, answered, runbookStep, relatedSkills, frameworks, escalation }
 */
function requestGuidance({ question = '', atStep = null, topic = null, escalate = false, requestedBy = null } = {}) {
  const q = String(question || '').toLowerCase();
  const hay = `${q} ${String(topic || '').toLowerCase()}`;

  const step = atStep != null
    ? RUNBOOK.find(r => r.step === Number(atStep)) || null
    : RUNBOOK.find(r => hay && (hay.includes(r.title.toLowerCase().slice(0, 18)) || r.tools.some(t => hay.includes(t)))) || null;

  const relatedSkills = SKILLS.filter(s =>
    (step && s.capabilities.some(c => step.tools.includes(c))) ||
    (hay && (hay.includes(s.phase.toLowerCase()) || s.capabilities.some(c => hay.includes(c))))
  );

  const frameworks = PROMPT_FRAMEWORKS.filter(f =>
    relatedSkills.some(s => f.pairsWith.includes(s.id)) || (hay && hay.includes(f.name.toLowerCase().slice(0, 12)))
  );

  const answered = !!(step || relatedSkills.length || frameworks.length);

  const result = {
    question: String(question || ''),
    answered,
    runbookStep: step ? copy(step) : null,
    relatedSkills: copy(relatedSkills),
    frameworks: copy(frameworks),
    escalation: null
  };

  if (!answered && !escalate) {
    result.note = 'No runbook step or skill matched. Re-ask naming the step number or the tool involved, or set escalate to raise it with a human.';
  }

  if (escalate) {
    if (!requestedBy || !/@/.test(String(requestedBy))) {
      result.escalation = { ok: false, error: 'A named identity (company-domain email) is required to escalate a guidance request.' };
    } else {
      result.escalation = {
        ok: true,
        // A descriptor for the caller to submit as a governed task. Deliberately
        // NOT sent from here: this module does not message people.
        taskType: 'consultancy.guidance.request',
        status: 'proposed',
        requestedBy,
        payload: {
          vertical: VERTICAL,
          question: String(question || ''),
          atStep: step ? step.step : null,
          selfServeAnswered: answered,
          alreadyProvided: {
            runbookStep: step ? step.step : null,
            skills: relatedSkills.map(s => s.id),
            frameworks: frameworks.map(f => f.id)
          }
        },
        note: 'Submit via create_task to raise this with a human. The self-serve answer above is already available and does not depend on the escalation being picked up.'
      };
    }
  }

  return result;
}

module.exports = {
  VERTICAL,
  SKILLS,
  PROMPT_FRAMEWORKS,
  RUNBOOK,
  skills,
  promptFrameworks,
  runbook,
  requestGuidance
};
