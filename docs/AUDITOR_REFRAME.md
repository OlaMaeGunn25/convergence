# Auditor Reframe — Systems Evaluation & Integration-Readiness

**Status:** Applied · **Date:** 2026-07-23 · **Scope:** `aiwx-smb-auditor/`

## Why this change exists

The Auditor's true purpose is **systems evaluation for MCP integration**, not sales
prospecting. Given a company, the Auditor:

1. Inventories the company's **technology stack and server/infrastructure
   environment** (from the crawler + WAF/security-header scan).
2. Scores **integration readiness** across AI-readiness dimensions.
3. Determines **which systems can and should be connected** to the CONVERGENCE-Ai
   governed **MCP** layer.
4. Returns a **provenance-scored report** with a prioritized **integration roadmap**.

A public **pre-sales prospecting** layer had been **co-mingled** into the Auditor
during the period four agent instances ran side-by-side (see
`docs/ANTIGRAVITY_HANDOFF.md` §1). That prospecting layer — public-records
scouring, prospect scouting, outbound outreach, and copy-pasteable sales-pitch
generation — belongs to **ASES** (AiWorXmiths Sales Enablement System, repo
`aiworxmiths-cdqe`), **not** CONVERGENCE-Ai. This document records its removal.

## What was REMOVED (moved to ASES)

| Area | Removed |
|---|---|
| `lib/scourer.js` | Public-records scour (revenue/headcount/filings/news mentions) — **deleted** |
| `lib/scouting.js` | Local prospect scouting — **deleted** |
| `lib/stores/outreach.js` | Outreach registry store — **deleted** |
| `routes/prospecting.js` | `scout-prospects` + `outreach-send` + prospecting router — **deleted** |
| `server.js` | Prospecting scheduler, `/api/run-prospecting`, `/api/scout-prospects`, `/api/outreach-send`, the `scourBusiness` call in the inline audit, `scoutLimiter`, and their auth/limiter wiring — **removed** |
| `routes/audit.js` | `scourBusiness` call + `scourerData` field — **removed** |
| `lib/audit_runner.js` | `scourBusiness` call + `scourerData` field + provenance registration — **removed** |
| `lib/analyzer.js` | `generateSalesPitches()` + `pitchOpportunities` — **removed** (SWOT, scoring, AI-readiness scorecard, multi-agent grid, competitor benchmark all **kept**) |
| `test/run.js`, `test/test_scouting.js`, `test/e2e.js`, `test_benchmark.js` | Scourer/scouting/pitch assertions — **removed** |
| Frontends (`app.js`, `smb-auditor.html`, `outreach_ui.js`, `admin/*`) | `scourerData` display surfaces + outreach UI — **removed** |

## What was KEPT (systems evaluation)

- **Crawler + WAF/security scan** → systems + server-environment inventory.
- **Analyzer** → tech/security/marketing scoring, **SWOT** (posture assessment),
  AI-readiness scorecard, competitor benchmark, multi-agent capability grid.
- **Workforce** HITL transition model.
- **Scholar** (legal vertical) case-law / expert-witness cross-reference.
- **Reporting governance** (provenance, reliability, distribution gate,
  methodology, disclaimer, validation).

## What was KEPT-BUT-REFRAMED

The CRM export is **retained** but reframed from "export a sales **prospect**" to
"record an integration-readiness **candidate**":

- **HTTP:** `POST /api/export-crm` (now in `routes/crm.js`; inline copy in
  `server.js`) accepts `{ candidate }` (`{ prospect }` still accepted for
  backward compatibility). It records the evaluated company plus its
  `systemsInventory` and `recommendedIntegrations`, with `status: 'evaluated'`.
- **Registry tool:** `export_crm` — retitled "Export integration-readiness
  candidate to CRM"; sales-pitch/bottleneck framing dropped.

## Follow-on (additive) — DELIVERED 2026-07-23

The additive "which systems should connect + roadmap" half of the reframe is now
built (the audit is no longer removal-only):

- **Connector catalog** — `lib/connectors/catalog.js` (14 connectors: Clio,
  HubSpot, Salesforce, QuickBooks, Xero, Stripe, Shopify, Google Calendar,
  Calendly, Google Workspace, Microsoft 365, Slack, Zendesk, Twilio). Secret
  values never leak — only expected env keys + a configured flag.
- **Integration matcher** — `lib/integration_matcher.js`; the audit package now
  carries `integrationReadiness` (detected systems → ready/likely/exploratory
  recommendations → a phased roadmap). Wired into `audit_runner`, `routes/audit`,
  and the inline `server.js` audit.
- **Connection registry + builder** — `lib/connection_registry.js` (state machine
  not_connected→configuring→connected/error/disconnected; Supabase + JSON
  fallback). Credentials are env-only; the builder refuses secret-looking config.
- **Clio connector** — `lib/connectors/clio.js` + `docs/CLIO_INTEGRATION.md`
  (OAuth2, regional REST, simulated fallback, webhook→task, trust-account HITL).
- **HTTP + MCP surface** — `GET /api/connectors`, `GET /api/connections`,
  `POST /api/connections` (approval-gated), `POST /api/clio/webhook`
  (`routes/connections.js` + inline parity). 7 new registry tools.
- **Floating status component** — `public/connection-status.js`, injected into
  `public/index.html`; polls `GET /api/connections` and shows live per-system
  connection health.

Still shallow (future): deeper server-environment eval (hosting/DNS/MX/cloud
region/ports) beyond WAF + security headers.

## Guardrails preserved

- Route **parity guard** stays green: prospecting was removed from **both** the
  inline `server.js` routes and the `routes/` mirror, so the pending Phase-2.5
  cutover has *less* to reconcile, not a broken mirror.
- Two-dimensional **AI TRiSM governance** (WHO may act / WHAT is true) untouched.
- Test suite green after removal.
