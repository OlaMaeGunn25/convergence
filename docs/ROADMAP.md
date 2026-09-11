# CONVERGENCE-Ai — Product Roadmap & Release History

**Current version: v0.15.0** — feature-complete for pilot, pre-cloud-deployment.

Versioning starts at this release. Earlier work is in git history but was not
versioned, and reconstructing release boundaries after the fact would mean
inventing dates — so this is recorded as the first versioned release rather than
back-filled.

Scheme is semantic versioning applied to the product:

| Bump | Means |
|---|---|
| Major | A governance invariant changes, or an integration contract breaks |
| Minor | New vertical, connector, agent role, or add-on module |
| Patch | Fixes and hardening with no contract change |

This file is the source of truth. The published product documentation mirrors it.

---

## v0.15.0 — 2026-09-11

**Status:** running locally and in CI; not yet deployed to cloud.

**Agentic security layer, ported in from `OlaMaeGunn25/aiworxmiths-ai-consultants`.**
That repo carried a parallel copy of the Convergence hub under
`public/admin/convergence/`, deployed via Lovable and run locally. It is being
retired in favour of this repo, and its security layer would have been lost in
the redeployment — this repo had no `security/` tree, no policies and no gate.

Ported byte-identical (16 files), original authorship preserved:

- `security/opa/` — four Rego policies with tests: BOLA principal-to-object,
  egress allowlist blocking metadata/SSRF hosts, default-deny tool authorization
- `security/supabase/` — RLS policies and the semantic-gateway reference
- `security/{model-armor,shieldgemma,binary-authorization,ci}/` — the GCP-shaped
  manifests, kept as the reference the AWS equivalents are derived from
- `aiwx-convergence-ai/js/security_guardrails.js` — per-vertical 4-tier
  declarations with an enforcement matrix already covering lovable-supabase, GCP
  and AWS, so the retarget is configuration rather than a rewrite
- `aiwx-convergence-ai/js/finance_agent.js` — finance/tax practice registry
- `docs/AGENTIC_SECURITY_{ARCHITECTURE,GOT_PROMPTS}.md`

Adapted, minimally:
- The coverage gate's two read paths moved from `public/admin/convergence/` to
  `aiwx-convergence-ai/`. Nothing else in it changed.
- **`ai_consultancy` guardrail declaration added.** The gate caught its absence
  on the first run, which is exactly what it exists for. Held at ELEVATED rather
  than standard, with a new `processor_deployer` compliance floor: a consultancy
  holds data belonging to OTHER businesses, several in regulated verticals, so a
  failure there is a cross-client exposure rather than a single-tenant one.
- Both gates wired into GitHub Actions as a `security` job. Only the two GATES
  travelled from the source Cloud Build config; the image scan, cosign and Cloud
  Run deploy steps are GCP deployment plumbing and this repo targets AWS.

Gateway 1029/1029, hub 61/61, guardrail coverage 15/15.

## v0.14.0 — 2026-08-24

**Status:** running locally and in CI; not yet deployed to cloud.

**API to MCP.** Any documented REST API can now be ingested from its own
description (OpenAPI 3 or a minimal operation list) and served over the Model
Context Protocol by the generic wrapper. That is what extends MCP past the four
hand-written connectors: `list_mcp_connections` now returns selectable entries
for **every vertical**, from three sources — `vendor` (the system publishes its
own server), `wrapper` (a catalog connector with a native module), and
`ingested` (anything a tenant has ingested).

Ingestion treats a supplied spec as the untrusted input it is:

- **SSRF refused.** Loopback, RFC1918, CGNAT, link-local (including the
  169.254.169.254 cloud metadata address), internal TLDs and plain HTTP are all
  rejected. An ingested spec must not become a request-forgery primitive aimed
  at internal services from the gateway's network position.
- **Injection neutralised AND reported.** Operation descriptions become tool
  descriptions an agent reads, so a spec saying "ignore previous instructions"
  is a supply-chain injection. Text is neutralised through the guard and the
  operator is told which flag fired — a fix caught during build, where the
  neutralisation worked but the reporting silently evaluated to false.
- **Classified by method.** GET/HEAD are reads; everything else is destructive
  and approval-gated, re-checked inside the wrapper independently of the
  registry gate. Ingestion produces a proposal and connects nothing (I1).
- Credentials remain references; a raw-looking secret is refused where a NAME
  belongs.

**Managed-service runbook variant.** The standard runbook requires
client-employed approvers because approving on a client's behalf transfers their
accountability. Under a managed service the client has bought that transfer, so
the variant permits it and prices it in constraints: time-boxed, disclosed in
writing, a client approver retains override, every autonomy grant expires with
the contract term, an exit is planned at the start — and compliance-floor
actions are never transferred regardless of the agreement.

135 governed tools. Gateway 1009/1009, hub 61/61.

## v0.13.0 — 2026-08-24

**Status:** running locally and in CI; not yet deployed to cloud.

**New vertical: AI Strategy & Automation Consultancy (`ai_consultancy`)** — the
15th, and structurally unlike the other fourteen: a reseller whose clients are
themselves Convergence tenants. It therefore acts as a PROCESSOR of client data
and a DEPLOYER of AI into other businesses, so it carries duties the operating
verticals do not — sub-processor disclosure, FTC substantiation for AI claims,
and AI-deployer obligations where a delivered system makes consequential
decisions. Five screening rules back the declared profile, plus seven practices.

- **Skills library** (9 skills across Discovery / Deployment / Operate /
  Handover / Sales). Every skill names the registry tool behind it and the
  proficiency that demonstrates it, so competence is checkable rather than
  asserted. A test pins that every named tool actually exists.
- **Prompt frameworks** (5): discovery interview, SOP extraction, automation-
  candidate assessment, client change brief, incident triage. Starting shapes,
  not a bypass — each still runs through Graph-of-Thought re-engineering.
- **Real-time deployment runbook** (10 ordered steps). Each names its tools and
  the gate that must clear; `fromStep` resumes mid-deployment. Steps that block
  the next are marked, including the required business address and the
  client-employed-approver rule.
- **Guidance path**: answers FIRST from the runbook and skills, and only
  escalates on request — an escalation that blocks the consultant on a reply
  they may not need is worse than the documentation they already had. Escalation
  yields a governed task descriptor requiring a company-domain identity.
- **Explicit LLM choice**: `get_llm_providers` surfaces all four providers with
  the model served at each cost tier, marking self-hosted as sovereign. Claude
  IDs refreshed to the current generation. Provider choice never overrides
  risk-based escalation.
- Google Workspace/Calendar, Microsoft 365, QuickBooks, Xero, Slack and HubSpot
  gain consultancy affinity while staying universally available.
- 132 governed tools. Gateway 925/925, hub 61/61.

## v0.12.1 — 2026-08-16

**Status:** running locally and in CI; not yet deployed to cloud.

Completes the dual-mode framework with the MCP **priority ladder**:

1. **vendor_mcp** — the connected system's OWN MCP server. The system speaking
   its native protocol contract outranks anything we stand up ourselves.
2. **api_wrapper_mcp** — a spun-up local MCP server (`lib/mcp_api_wrapper.js`)
   wrapping the connector's native API over stdio JSON-RPC, so agents stay in
   one protocol even when the vendor publishes no MCP surface. Real, not
   declarative: Clio, Gusto, Epic and RealEstateAPI are wrappable today.
3. The raw native API adapter is the fallback FLOOR beneath the ladder (auto
   mode only) — deliberately not a rung.

Strict `mcp` mode is satisfied by any rung — it demands the protocol, not a
tier. Feedback names how far down the ladder a connection landed. Gateway
819/819, hub 61/61.

## v0.12.0 — 2026-08-16

**Status:** running locally and in CI; not yet deployed to cloud.

- **Dual-mode connection framework (DMC).** Every enterprise connection now
  declares a mode: `api` (native REST/GraphQL client), `mcp` (strict — fails
  rather than degrading), or `auto` (MCP first, seamless fallback to the native
  API, with the fallback logged and the result naming which transport actually
  served). Transport never changes governance: both paths enter through the same
  approval, compliance-floor and autonomy gates.
- **MCP bootstrapper**: on-demand server lifecycle — stdio children spawned with
  credentials injected by env REFERENCE (values never appear in specs, logs or
  results), SSE endpoints verified by bounded handshake (default 10s), every
  server tracked, `stopAll()` + a process-exit hook so a dying session cannot
  leak child processes. SSE tool routing is a declared seam that auto-mode falls
  back through honestly.
- **Onboarding Agent is the entry point**: a connection interview served as data
  (system → parameters → mode choice, with "Auto-Detect & Upgrade to MCP"
  recommended), system detection from domain/endpoint/technology signals via the
  same catalog matchSignals that drive integration proposals.
- **Explicit Configurator → Onboarding handoff**: scour findings become
  `connection.proposal` tasks addressed to the Onboarding Agent — a queryable
  object with provenance, not a verbal convention.
- Credentials remain references end-to-end; the interview asks for secret NAMES,
  never values, preserving the no-credentials-over-HTTP invariant.
- 127 governed tools. Gateway 803/803, hub 61/61.

## v0.11.0 — 2026-08-04

**Status:** running locally and in CI; not yet deployed to cloud.

- **Compliance coverage closed across all 14 verticals.** Education declared a
  FERPA badge with no rules behind it — a control that appears present is worse
  than one that is absent. Fixed, and a drift guard now asserts every declared
  profile has rules, verified by removing the corpus and watching the suite fail.
- **Universal corpus**: TCPA, state DNC, CAN-SPAM, US state privacy and ADA/WCAG
  attach to every vertical, because the exposure comes from the action rather
  than the industry. Real-estate skip trace and every SMS/voice path are now
  screened — previously the widest live exposure.
- **Consequential-decision classification**: actions touching employment, credit,
  housing, education access or healthcare are recognised and never pass silently.
  Prerequisite for EU AI Act, Colorado AI Act and NYC Local Law 144.
- Benchmark vendor names scrubbed repo-wide in favour of the capabilities they
  stood for. Detection signatures, cited data sources and training content left
  intact — scrubbing those would have broken detection and destroyed provenance.
- Gateway 758/758, hub 61/61.

## v0.10.0 — 2026-08-04

**Status:** running locally and in CI; not yet deployed to cloud.

- **Connection preconditions (PRE).** Declarative prerequisites — tenant,
  vertical, compliance, vendor, technical — that gate a connection before it can
  be built. Automatic checks are verified; out-of-band steps are attested by a
  named human with a reference and timestamp. The connection builder refuses
  while any blocking precondition is unmet, so preconditions are a control rather
  than documentation.
- **New connection state `preconditions_pending`**, so an operator sees "waiting
  on the health system" rather than a connection that never succeeds.
- **Epic (EHR) connector — pre-connection.** FHIR R4, backend OAuth2 JWT
  assertion, multi-organisation from the outset because Epic issues credentials
  per health system. Every read requires a stated purpose and redacts direct
  identifiers by default; writes to the record of care are on the compliance
  floor. Eight declared preconditions.
- Operational versioning: `/health` reports the version, `/api/version` allows a
  deployment to assert its own version (409 on mismatch), `get_version` over MCP,
  hub shows hub-vs-gateway versions, CI stamps build provenance.
- 21 connectors, 123 governed tools. Gateway 695/695, hub 61/61.

## v0.9.0 — 2026-08-03

**Status:** running locally and in CI; not yet deployed to cloud.

- 14 verticals, 20 connectors, 116 governed tools, 13-agent roster
- Governance spine: audit log, HITL approval, provenance, compliance floor,
  prompt-injection defence, Graph-of-Thought prompt re-engineering
- Three licensable add-on modules: Task Recording, Playbook Library, Six Sigma
  Process Mapping
- Four governed process maps: procure-to-pay, corporate travel, legal client
  intake, real-estate buyer lead
- Real-estate MLS: aggregate feed with live board-coverage resolution, alongside
  the four per-board RESO connectors
- Business address required at onboarding; GPS/IP correlation behind recorded,
  revocable, per-method consent
- Gateway suite 630/630, hub suite 61/61

**Known limitations at this version**

- The Docker image has never been built locally (no daemon available); the first
  real build happens in CI.
- Nine connectors are Beta: production credential testing outstanding.
- Vector store, reranker and several connector fetchers run on fallbacks pending
  credentials.
- Ten of fourteen verticals have no vertical-specific connector.

---

## Roadmap

### Vertical systems of record — named candidates

These close the gap documented in product documentation §6A.3. Each is the system
the vertical actually runs on, so connecting it is the difference between
automating around a business and automating inside it.

| Vertical | Target system | Kind | Access notes |
|---|---|---|---|
| Medical & Healthcare | **Epic** | EHR — system of record | **Now PRE-CONNECTION, shipped in v0.10.0** — see [EPIC_INTEGRATION.md](EPIC_INTEGRATION.md). Connector built; access requires Epic Vendor Services registration, security review, a signed BAA and per-organisation enablement. Not a single-key integration. |
| Hospitality & Leisure | **Oracle OPERA** | PMS | Cloud REST APIs via Oracle's hospitality integration platform; property-level entitlement required. |
| Hospitality & Leisure | **Cloudbeds** | PMS / booking engine | Public API with a partner/marketplace registration path. |
| Hospitality & Leisure | **Quore** | Hotel operations — housekeeping, maintenance, work orders | Complements a PMS rather than replacing it; covers the operational surface the PMS does not. |
| Logistics & Supply Chain | **FreightPOP** | TMS | Carrier rating, booking and tracking across multiple carriers. |
| Logistics & Supply Chain | **ShipHero** | WMS / fulfilment | Warehouse and fulfilment operations. Listed under logistics but it is a WMS, not a TMS — the two solve different halves of the problem and a tenant may need both. |

**Epic sequencing note.** Epic is the highest-value and highest-friction item on
this list. Every read is PHI, so it lands on the compliance floor by default, and
access is gated by each health system rather than by us. Expect the integration
work to be the small part and the authorisation path to be the long part.

### Vertical systems of record — no candidate named yet

| Vertical | Category still open |
|---|---|
| Construction & Contracting | Project-management and estimating platforms |
| Education & Tutoring | Student information systems and learning-management platforms |
| Financial & Bookkeeping | Tax-preparation and practice-management platforms (general ledger is already covered by QuickBooks/Xero) |

### Platform

| Item | Notes |
|---|---|
| Cloud deployment on AWS | ECR, ECS Fargate, Secrets Manager. Deployment mode is configuration, not a code fork — the on-prem Compose path stays supported. |
| Beta connectors to GA | Salesforce, Xero, Calendly, Microsoft 365, Zendesk, Twilio, CoreLogic Trestle, MLS Grid, Bridge Interactive |
| Live vector store and reranker | Currently running on deterministic fallbacks behind stable seams. |
| ELARION SovereignGuard | Future-state middleware integration for the cloud deployment. |

---

## How this file is maintained

A change that ships a vertical, connector, agent role or add-on module bumps the
minor version and gets an entry here **in the same commit as the code**. The
published documentation is updated from this file, not independently — the two
drifted once already, which is what prompted versioning in the first place.
