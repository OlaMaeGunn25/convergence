# CONVERGENCE-Ai — Product Roadmap & Release History

**Current version: v0.11.0** — feature-complete for pilot, pre-cloud-deployment.

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
