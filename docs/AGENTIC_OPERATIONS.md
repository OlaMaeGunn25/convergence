# CONVERGENCE-Ai — Agentic Operations Layer

**Status:** Implemented — all core phases shipped (see "Delivered since the original spec"). Suite 472/472 · 90 governed tools.
`aiwx-smb-auditor` gateway · **Date:** 2026-07-23

This document is the single source of truth for the multi-agent operations layer:
a governed roster of focused, autonomous agents that — per tenant, per vertical,
upon connection to that vertical's tool sets — evaluate connected systems, ingest
the company's knowledge, train, deploy under human-in-the-loop (HITL) authority,
execute work across every connected system, and report live to a floating monitor.

It composes with the shipped foundation: `lib/task_model.js` (state machine),
`lib/tool_registry.js` (17 governed tools), `lib/orchestrator.js`,
`lib/connection_registry.js` + `lib/connectors/*` (14-connector catalog, Clio),
`lib/integration_matcher.js`, `lib/negotiation.js`, `lib/governance_report.js`,
the `audit_log` + provenance layer, and `public/connection-status.js` (floating
component). See `docs/AUDITOR_REFRAME.md` and `SYSTEM_HANDOVER_SPECIFICATION.md`.

---

## Governing principle — HITL authority vs. autonomy

> HITL holds **ultimate, non-delegable authority**: observe, pause, course-correct,
> cancel, and shut down any agent or task at any time. Per-action **approval** is
> the default gate. The business's HITL lead **MAY grant an explicit, scoped,
> revocable *autonomy grant*** that delegates the per-action approval step for a
> specific task or task-type (full automation). Authority is never removed — only
> the approval step is optionally delegated — and trace, provenance, live
> monitoring, the kill-switch, and the compliance floor remain in force at all
> times.

**Cross-cutting invariants** (enforced in every phase):
- **I1** — *operationally-ready ≠ connected*: a credential-ready system is not
  usable by operating agents until it is `agent_ready`.
- **I2** — *HITL authority is absolute*: no agent action overrides, bypasses, or
  self-approves past a human stop.
- **I3** — *no untraceable action*: every agent action is traced,
  provenance-recorded, monitorable, and reversible.

## Locked decisions

| # | Decision |
|---|---|
| D1 | "Training" = configuration + KB-grounding + validation, **not** model fine-tuning. |
| D2 | One tenant = one locked vertical → **one roster per tenant**, scoped to that vertical's connected tools. |
| D3 | Default autonomy boundary: read/inspection = autonomous; **every write, outbound comm, and financial/trust action = HITL-gated** (unless an autonomy grant applies, above the compliance floor). |
| D4 | Three-level control: `cancel` (task) · `pause/resume` (agent, resumable) · `shutdown` (agent, terminal → re-provision). Course-correct revises a running task without cancelling. |
| D5 | Delivery and Q/A are **separate duties** (two gates around `done`). |
| D6 | SOP ingestion = **all three sources** via a pluggable adapter model: connector-read + client upload **now**; on-prem/server crawl **Roadmap**. |
| D7 | Go-live = **explicit HITL approval** (auto-run readiness → hold at `ready` → human approves deployment). |
| D8 | Telemetry = **short-interval polling** (reuses the floating-component pattern; no SSE/WS). |
| D9 | Admin-Support: email + scheduling **now**; Twilio voice **interface stubbed, flows Roadmap**. |

## Agent roster (8 roles)

| Role | Duty |
|---|---|
| **Orchestrator** (lead) | Provisions/assigns/deploys the roster; holds the plan; maintains the unified connected-capability model; enforces HITL gates + autonomy grants. |
| **System-State Evaluation / Config** | On connection, models each system's capabilities **and operational processes**; binds tool manifests to operating agents; produces readiness. |
| **Onboarding** | Drives company onboarding; runs the governed RAG SOP scour; builds the company knowledge base; tracks onboarding status. |
| **Operations** | Executes system tasks across connected systems (systems operations). |
| **Admin-Support** | Communications & outreach: email, appointment scheduling, onboarding comms; voice (Twilio) interface (Roadmap flows). |
| **Delivery** | Oversees task completion and system output; attests before `done`. |
| **Q/A** | Independently validates quality + compliance of completed tasks and reports (separation from Delivery). |
| **Monitoring & Reporting** | Emits live telemetry to the floating monitor; reports status/exceptions/approvals-needed to HITL. |

---

## Prompt re-engineering — Graph-of-Thought (CHT-02) `[N]`

> **Every prompt entered by every company running CONVERGENCE-Ai is re-engineered
> through the GRAPH-OF-THOUGHT framework** (`lib/graph_of_thought.js`) before it is
> planned, previewed, or executed. This replaces the earlier tree-of-thought.

A tree forces each line of reasoning into an isolated branch. A graph lets thoughts
**cross-inform, contradict, aggregate, and refine**:

| Property | Why a graph (not a tree) |
|---|---|
| **Cross-linking** | Candidate capabilities, the company KB, and industry practice inform one another. |
| **Contradiction** | An SOP that forbids the action is a first-class `contradicts` edge that measurably lowers the plan score — a tree can only annotate it. |
| **Aggregation** | Supporting thoughts merge into ONE synthesized plan node. |
| **Refinement loop** | The risk/compliance verdict feeds **back** into the plan node (a cycle a tree cannot express). |
| **Scoring** | Every node carries a support score; the graph yields a confidence + verdict for the whole plan. |

Node types: `request · understanding · candidate · knowledge · practice · risk ·
aggregate · refinement · outcome`. Edge types: `derives · informs · supports ·
contradicts · aggregates · refines`. Verdicts: `ready · hold_for_confirmation ·
needs_disambiguation · blocked_by_sop`. Enforced on **both** prompt paths (the HITL
chat and the task-request interface) and exposed as the `reengineer_prompt` tool.
The re-engineered graph is recorded in the attribution log (ATR-01).

---

## Delivered since the original spec (domains added during the build)

The layer grew beyond the 14 domains in Part B. These are all **shipped + tested**:

| Domain | Capability | Key modules |
|---|---|---|
| **CHT** | HITL primary chat: Graph-of-Thought re-engineering → understanding + projected outcomes → **confirm-before-act** | `hitl_chat.js`, `graph_of_thought.js` |
| **NEG** | Orchestrator-mediated **pre-commit checks-and-balances** (capability + practice/SOP + compliance) before the commit boundary | `precommit.js` |
| **CMP / RPT** | Compliance agent (industry/domain/vertical + local/state/federal regulatory search + I/O screening) → Reporting agent (visual + exportable JSON/CSV/HTML evidence) | `compliance.js`, `compliance_reporting.js` |
| **HRC** | Human Companion (HR generalist) on an isolated human-care plane; Gusto as HR system of record | `human_companion.js`, `connectors/gusto.js` |
| **UPS** | Companion-delivered upskilling, **zero personal-data leakage** (role-keyed curriculum ↔ person-keyed progress; no aggregate/export path exists) | `upskilling.js`, `hitl_onboarding.js` |
| **REG** | Regional/local data sources — real-estate **MLS via RESO Web API** + GPS/address region detection, HITL-gated | `regional_sources.js` |
| **ING / XREF** | Unified ingestion (upload · connector-read scour · audit-scour) all building ONE company KB, auto-created at onboarding and cross-referenced on every command | `ingestion_adapters.js`, `business_onboarding.js` |
| **RRK / MCR** | LLM cost levers: two-stage retrieval + reranker, and a model-cascade router (cheapest capable tier by confidence + risk) | `reranker.js`, `model_router.js` |
| **DEP** | Cloud **and** on-prem Docker deployment from one codebase; live-backend seam reporting | `deployment.js`, `integration_seams.js` |

**Cross-cutting hardening:** shared-mutable-state protection (`immutable.js` +
`stores/json_file.js` fallback copying) closes a defect class that caused a
cross-tenant state bleed in the JSON path and a latent least-privilege bypass in
the agent roster.

---

## Part A — Requirements derivation (authoring method)

**Branch 1 — Lifecycle (Connection → Comprehend → Ingest → Train → Ready → Deploy).**
A connected system is inert until an agent understands its capabilities *and*
processes, and the company's way of using them. → System-State Evaluation +
SOP/knowledge ingestion + an explicit readiness state distinct from `connected` +
an aggregate company-onboarding status gating deployment (I1).

**Branch 2 — Roster & orchestration under HITL authority.** Distinct duties need
focused, least-privilege agents; the orchestrator provisions the roster per
connected vertical; humans retain absolute control, with an *opt-in* autonomy
grant for delegated per-action approval (I2).

**Branch 3 — Observability.** Autonomy is safe only if observable and reversible:
live telemetry → floating monitor, full traceability + provenance per task, and
course-correct / cancel / shutdown primitives (I3).

**Synthesis → invariants I1–I3** (above).

---

## Part B — Requirements (INVEST + IREB/CPRE)

`[S]` shipped foundation · `[N]` net-new · `[R]` Roadmap.

### AGT — Agent Roster & Roles
| ID | Requirement | Acceptance |
|---|---|---|
| AGT-01 `[N]` | Model an **Agent** entity: `id, role, tenantId, vertical, scopeConnectors[], boundTools[], status, createdAt`. | CRUD + transitions; Supabase + JSON fallback. |
| AGT-02 `[N]` | Support the 8 roles above, each registerable with duty + default tool bindings. | Each role documented + provisionable. |
| AGT-03 `[N]` | Bind each agent ONLY to tools within its role + connected-system scope (least privilege). | Out-of-scope connector call refused at the gate. |
| AGT-04 `[N]` | Admin-Support covers email + scheduling (**now**); Twilio voice interface (**Roadmap flows**). | Bound to email/calendar connectors; sends HITL-gated. |
| AGT-05 `[N]` | Delivery verifies task completion + output before `done`. | No `done` without a Delivery attestation. |
| AGT-06 `[N]` | Q/A independently validates + reports on completed tasks. | Q/A verdict attached; flags route to HITL. |

### INS — Installation & Setup
| ID | Requirement | Acceptance |
|---|---|---|
| INS-01 `[N]` | At install/setup, the operator selects which systems to connect for the tenant. | Wizard lists catalog connectors; selections persisted. |
| INS-02 `[N]` | On install, deploy the lead Orchestrator + full roster scoped to the tenant's vertical. | All 8 roles exist post-install; `GET /api/agents`. |
| INS-03 `[N]` | Install is complete only when every selected system is `agent_ready` and the roster is deployed (held at go-live per ONB-05). | Install status = complete at readiness 100% + roster deployed. |

### ONB — Onboarding & Readiness
| ID | Requirement | Acceptance |
|---|---|---|
| ONB-01 `[N]` | On `connected`, enqueue a readiness pipeline (evaluate → ingest → train → verify) before use. | Auto task chain; system → `agent_ready` only after all pass. |
| ONB-02 `[N]` | Expose an agent-company onboarding status aggregating per-system readiness. | `GET /api/onboarding/status` returns per-connector + overall %. |
| ONB-03 `[N]` | No operating agent deploys against a non-`agent_ready` system. | Governed error on premature deploy. |
| ONB-04 `[N]` | Onboarding status streams to the floating monitor and reports to HITL. | Live progress bars per system. |
| ONB-05 `[N]` | Operating agents shall not deploy until an explicit **HITL go-live approval**; the orchestrator holds the roster at `ready`. | Go-live is a first-class approval; deploy blocked until granted. |

### COMP — Full System Comprehension
| ID | Requirement | Acceptance |
|---|---|---|
| COMP-01 `[N]` | For each connected system, model **full operational capabilities AND operational processes** (how actions compose into workflows). | Per-system model has capability manifest + process map; provenance-tagged. |
| COMP-02 `[N]` | The Orchestrator maintains a complete, queryable model of ALL connected systems' capabilities + processes. | `GET /api/orchestrator/capabilities`; answers "can X do Y?". |
| COMP-03 `[N]` | Each agent can perform every action in any connected system required for its task (full coverage), subject to governance. | No capability gap for in-scope tasks. |

### TRN — Training + SOP/RAG Ingestion
| ID | Requirement | Acceptance |
|---|---|---|
| TRN-01 `[N]` | System-State-Eval agent enumerates capabilities/endpoints → capability manifest bound to operating agents. | Manifest read/destructive-classified; provenance-tagged. |
| TRN-02 `[N]` | Onboarding agent runs a governed **RAG SOP scour** (via ING adapters) → company KB (Dify.ai + pgvector). | Docs chunked, embedded, hybrid-search queryable; per-chunk provenance. |
| TRN-03 `[N]` | The scour is **read-only, HITL-scope-approved, provenance-recorded**; never exfiltrates credentials or writes to sources. | Scope pre-approved; audit_log of sources; zero writes. |
| TRN-04 `[N]` | Trained agents demonstrate **company awareness** grounded in the KB. | Q/A probe: agent cites KB for company-context; ungrounded → flagged. |
| TRN-05 `[N]` | Training + ingestion are **per-vertical** (connectors, SOP corpus, KPIs/SLAs, compliance). | Parameterized by vertical. |

### ING — Knowledge Ingestion Sources (pluggable adapters)
| ID | Requirement | Acceptance |
|---|---|---|
| ING-01 `[N]` | Ingest via governed read-only connectors (Workspace/Drive, M365/SharePoint, Notion, Zendesk KB). | Read-only pull; provenance + audit per source touch. |
| ING-02 `[N]` | Accept direct client upload of SOP/manual/FAQ files into the KB. | Upload → chunk → embed; per-file provenance. |
| ING-03 `[R]` | Define an on-prem/server-crawl adapter (installed agent) behind the same interface. | Interface + contract now; impl deferred behind a security gate. |
| ING-04 `[N]` | All adapters share one scope-approval + provenance + **no-write** contract. | Uniform pre-scan approval; zero source writes; chain-of-custody per chunk. |

### KNW — Industry Practice + Correlation
| ID | Requirement | Acceptance |
|---|---|---|
| KNW-01 `[N]` | Maintain a per-vertical **industry-standard-practices** KB for all 14 verticals. | Curated corpus per vertical; RAG-queryable. |
| KNW-02 `[N]` | Agents correlate industry practices ↔ company KB/SOPs ↔ connected-system capabilities when planning/executing every task. | Plans cite practice + governing SOP + system action. |
| KNW-03 `[N]` | Where practice conflicts with a company SOP, the **SOP governs**; conflict surfaced to HITL. | Conflict → HITL flag; SOP wins in execution. |

### ORC — Orchestration & Assignment
| ID | Requirement | Acceptance |
|---|---|---|
| ORC-01 `[N]` | On connection to a vertical's tools, provision + assign the full roster scoped to that vertical. | `GET /api/agents?vertical=…` shows the scoped roster. |
| ORC-02 `[S]` | Assign tasks to agents, invoke bound tools, transition state per the task model. | Orchestrator routes by role. |
| ORC-03 `[N]` | Deploy the System-State-Eval/Config capability so operating agents access ALL connected features. | Operations agent tools == full manifest (COMP-03). |
| ORC-04 `[N]` | Deploy a Monitoring-&-Reporting agent per tenant keeping the monitor current + reporting to HITL. | Monitor reflects state within the telemetry interval. |
| ORC-05 `[N]` | Hold the roster at `ready` until the HITL go-live approval (with ONB-05). | Deploy gated on explicit approval. |

### AUT — Autonomy Authorization
| ID | Requirement | Acceptance |
|---|---|---|
| AUT-01 `[N]` | HITL lead may authorize **full automation of a specific task/task-type**, delegating per-action approval for that scope only. | Grant → scoped autonomy token; matching tasks skip per-action prompts. |
| AUT-02 `[N]` | Autonomy grants are explicit, scoped, revocable, recorded; HITL keeps ultimate authority. | Revoke immediately reinstates gating; all changes audit-logged. |
| AUT-03 `[N]` | Under full automation, actions stay fully traced, provenance-recorded, monitored, cancellable. | Autonomous runs on the monitor with working kill-switch. |
| AUT-04 `[N]` | A **compliance floor** keeps highest-risk actions (trust/IOLTA, PHI, transfers) HITL-gated even under a grant, absent a separate elevated grant. | Legal trust / Medical PHI still prompt under a standard grant. |

### TRQ — Task Request Interface (voice + typed)
| ID | Requirement | Acceptance |
|---|---|---|
| TRQ-01 `[N]` | Task-request interface accepts typed text and voice command (STT), processed identically. | Both create task requests. |
| TRQ-02 `[N]` | The UI is populated/suggested from connected systems' capabilities (COMP-02). | No task offered for an unconnected/unsupported action. |
| TRQ-03 `[N]` | Interpret NL/voice → closest matching executable task(s) with a confidence score. | Ranked candidates + confidence returned. |
| TRQ-04 `[N]` | Low-confidence/ambiguous → present closest candidates for human selection (no silent guess). | Below threshold → disambiguation prompt. |
| TRQ-05 `[N]` | A confirmed task enters the governed task model under normal HITL/autonomy rules. | Selected task routes through orchestrator. |

### MON — Monitoring, Floating Monitor & Reporting
| ID | Requirement | Acceptance |
|---|---|---|
| MON-01 `[N]` | Emit a telemetry stream of agent + task events, served over polling. | `GET /api/agents/telemetry` returns ordered events. |
| MON-02 `[N]` | The floating monitor shows live agent states, task completion, onboarding/readiness (extends `connection-status.js`). | Per-agent status + last task + % complete. |
| MON-03 `[N]` | The Monitoring agent reports status to HITL (summaries, exceptions, approvals-needed). | HITL status feed; exceptions/approvals surfaced. |
| MON-04 `[N]` | Task completion, output, and Q/A verdicts reflect on the monitor + governance report. | Completion updates monitor tile + TRiSM counts. |

### TRC — Traceability & Provenance
| ID | Requirement | Acceptance |
|---|---|---|
| TRC-01 `[N]` | Every agent action → immutable trace record (agent, role, task, tool calls, I/O digest, timestamp, outcome) in `audit_log`. | Full per-task trace; append-only. |
| TRC-02 `[S]` | Every data point carries provenance + confidence. | Provenance on agent outputs; unverified labeled. |
| TRC-03 `[N]` | Reconstruct a complete chain-of-custody per task (agent, tools, KB sources). | `GET /api/tasks/:id/trace` returns the ordered chain incl. cited KB sources. |

### CTL — HITL Ultimate Control
| ID | Requirement | Acceptance |
|---|---|---|
| CTL-01 `[N]` | HITL has absolute authority; no agent action overrides/bypasses/self-approves past a stop. | Self-approval rejected; invariant test. |
| CTL-02 `[S]` | Destructive/outbound actions require HITL approval (absent an applicable autonomy grant above the compliance floor). | Approval gate applies to every roster agent. |
| CTL-03 `[N]` | HITL can course-correct a running task (re-instruct/revise) without cancelling. | `POST /api/tasks/:id/correct`; recorded in trace. |
| CTL-04 `[N]` | HITL can pause, cancel, or shut down any agent/task at any time (kill-switch). | `POST /api/agents/:id/{pause,resume,shutdown}` + task cancel; in-flight halts + recorded. |
| CTL-05 `[N]` | Shutdown/pause immediately suspends new tool invocations by that agent. | Post-shutdown calls refused at the gate until resumed/redeployed. |

### VRT — Per-Vertical Application
| ID | Requirement | Acceptance |
|---|---|---|
| VRT-01 `[N]` | All of the above instantiate per vertical, upon connection to that vertical's tools, for all 14 verticals. | Connecting any vertical provisions the full governed roster scoped to it. |
| VRT-02 `[N]` | Vertical compliance rules constrain destructive actions (Legal IOLTA, Medical HIPAA/BAA, Finance transactions). | Vertical-specific gates enforced. |

---

## Part C — Implementation plan (phased)

Enforce I1–I3 in every phase; each phase ships tested with the suite green.

| Phase | Goal | Key new/changed |
|---|---|---|
| **0** | Agent model & roster registry | `lib/agent_model.js` (state machine `provisioned→configuring→training→ready→active→paused→shutdown`), `lib/agent_roster.js` (8 roles), registry-gate scope + paused/shutdown enforcement. Tests. |
| **1** | System-State Eval + **COMP** | `lib/system_evaluator.js` (capabilities **+ processes**), orchestrator unified capability store (`GET /api/orchestrator/capabilities`), `connection_registry` `agent_ready` sub-state + `GET /api/onboarding/status`, readiness task chain. |
| **2** | RAG SOP scour + **ING** + **KNW** | `lib/knowledge_ingest.js` (adapters: connector-read + upload now, on-prem interface Roadmap), unified scope-approval/provenance/no-write contract, per-vertical **industry-practice** corpora + a correlation planner (practice ↔ SOP ↔ capability). |
| **2.5** `[R]` | On-prem crawl adapter | Isolated installed-agent adapter; own security review; deferred. |
| **3** | Roster orchestration + **INS** + go-live | Provision roster on connection/install (INS-01/02/03), route by role, Delivery + Q/A gates, tools: `provision_roster`, `assign_agent`, `get_agent`, `list_agents`, `deploy_operations_agent` (HITL). |
| **4** | Telemetry + floating agent monitor (**MON/TRC**) | `lib/agent_telemetry.js`, `GET /api/agents/telemetry`, `GET /api/tasks/:id/trace`; extend `connection-status.js` → agent monitor with HITL status feed; governance-report roster health. |
| **5** | HITL control (**CTL**) | `POST /api/tasks/:id/correct`, `POST /api/agents/:id/{pause,resume,shutdown}`; absolute-authority + immediate-suspension enforcement. |
| **5b** | Autonomy grants (**AUT**) | Scoped, revocable full-automation grants + compliance floor; reconciled with CTL-01. |
| **6** | Per-vertical rollout (**VRT**) | Parameterize by vertical; 14-vertical verification matrix; compliance overlays. |
| **7** | Task-request interface (**TRQ**) | Capability-populated UI, typed + voice (STT), intent→capability matcher (confidence + disambiguation), feeds the task model. |

**Sequencing:** 0 → 1 → 2 → 3 → (4 ∥ 5 → 5b) → 6 → 7. Phase 2.5 (on-prem) and
the Twilio voice flows are Roadmap, taken independently.

---

*End of spec. Amend here first; implementation PRs reference these requirement IDs.*
