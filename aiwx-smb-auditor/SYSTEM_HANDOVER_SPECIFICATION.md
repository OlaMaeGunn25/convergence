# 📄 CONVERGENCE-Ai — System Handover Specification (Integration Contract)

> **This is the integration contract between two repos.** It lives in BOTH and
> must be kept in sync:
> - CONVERGENCE-Ai: `aiwx-smb-auditor/SYSTEM_HANDOVER_SPECIFICATION.md` (source of truth)
> - ASES (Sales Enablement, repo `aiworxmiths-cdqe`): `docs/SYSTEM_HANDOVER_SPECIFICATION.md` (copy)
>
> If the Auditor's endpoints, schemas, auth, or env change, update this file here
> and copy it to ASES. Downstream ASES agents integrate against **this** contract.

**Status:** Phase 5 complete · Suite **128/128** · Gateway on **port 3003** ·
Node **20** · repo `github.com/OlaMaeGunn25/convergence` @ branch `main`.

---

## 1. What CONVERGENCE-Ai Is (for a downstream integrator)

A governed, multi-agent automation hub + SMB pre-sales auditor. It exposes ONE
authenticated, audited HTTP surface (and an equivalent MCP surface) that a
downstream system (ASES) can call to run audits, search legal precedent, drive
orchestrated tasks, and read governance state.

Two governance dimensions are enforced on everything:
- **WHO may act** — API-key auth + RBAC on mutating endpoints; immutable
  `audit_log`; human-in-the-loop (HITL) approval for side-effectful actions.
- **WHAT is true** — every audit data point carries provenance + confidence; every
  report gets a reliability score, distribution gate, methodology, disclaimer, and
  pre-delivery validation.

## 2. Modules (repo layout — use these paths, NOT retired `scratch/aiwx-*`)

| Module | Role |
|---|---|
| `aiwx-smb-auditor/` | Express gateway (**:3003**), single entry point: audit pipeline, governance, tool registry, orchestrator, scholar, negotiation, Supabase stores, tests. |
| `aiwx-convergence-ai/` | Vite dashboard (deployment/operations/training hubs) + tenant-provisioning middleware (Cloud Run, HITL queue, RLS). Renamed from `aiwx-admin-agent/`. |
| `aiwx-social-media-agent/` | Publishing agent — Graph API primary; Puppeteer headless is **emergency-only** (against Meta ToS as a primary path). |
| `aiwx-mcp-server/` | MCP surface over the governed gateway (see §6). |

## 3. Authentication (required for integration)

- Mutating endpoints and cost-incurring reads require an **operator API key**:
  header `x-api-key: <key>` or `Authorization: Bearer <key>`. Configured via
  `GATEWAY_API_KEY` (or a JSON `GATEWAY_API_KEYS` map for RBAC: `operator` |
  `viewer`). Missing/invalid key → **401**; viewer on a mutation → **403**.
- Public (no key): `/health`, `/api/track-event(s)` (browser pixel).
- If no key is configured the gateway runs open with a loud boot warning — set a
  key in any shared/staging/prod environment.

## 4. HTTP API surface (what ASES calls)

Base URL: `http://<host>:3003`. All under `/api/…`. Key endpoints:

| Method & path | Purpose | Notes |
|---|---|---|
| `POST /api/audit` | Full SMB audit (tech/WAF, SWOT, workforce, + Scholar if legal) | Returns the **audit package** (§5). Rate-limited. |
| `GET  /api/tools` | Discover the governed capability registry | Lists 10 tools + annotations + JSON input schema. |
| `POST /api/tools/:name` | Invoke a registry tool | Body `{ input, approved? }`. Destructive tools return **202 requires_approval** unless `approved:true`. |
| `POST /api/negotiate` | Multi-agent (Proposer/Critic/Arbiter) decision | High-risk verticals escalate to HITL. |
| `GET  /api/scholar/search` | Google Scholar case-law / expert vetting | `q`, `num`; simulated fallback if no SerpApi key. |
| `POST /api/export-crm` | Write a prospect to Supabase (`inbound_leads`) | 503 if Supabase unconfigured. |
| `POST /api/audit-queue` / `GET /api/audit-queue` | Enqueue/inspect automated audits | Crash-safe background loop. |
| `GET  /api/analytics` | Local + GA4 metrics | Modelled figures kept separate from measured GA4. |
| `GET  /health` | Liveness + config flags | Public; container HEALTHCHECK. |

**Registry tools (via `/api/tools/:name` and MCP):** `run_audit`, `search_scholar`,
`negotiate`, `create_task`, `get_task`, `list_tasks`, `transition_task`,
`export_crm`, `publish_post` (destructive → HITL), `get_governance_report`.

## 5. Data contracts

### 5.1 Audit package (`POST /api/audit` response)
```
{
  success, timestamp, domain, businessName, vertical, isSimulated,
  scrapedData: { technologies[], subdomains[], metaData, scrapedPages[], firewallAudit },
  scourerData:   { revenueEstimate:{value,provenance}, headcountEstimate:{value,provenance},
                   growthRate, filings:{ state:{value,provenance}, federal:{value,provenance} },
                   publicMentions:{value,provenance}, ... },   // per-field provenance-tagged
  analyzerData:  { metrics, swot, aiReadinessScorecard, pitchOpportunities, ... },
  workforceData: { summary, roles[], timeframeMilestones, calibration },
  scholarData?:  { results[], verifiedCaseCitations, expertPublicationCount },  // legal only
  reportGovernance: {
     reliability: { score, grade, ... },                 // 0-100 + A–F
     distribution: { classification, canDistribute },     // Client-Ready | Internal | Sales Demo | Quarantined
     methodology, disclaimer, validation, auditTrail
  }
}
```
**Integrator note:** provenance-tagged fields are `{ value, provenance }` — read
`.value` for display. A helper `normalizeScourerForDisplay()` unwraps them.

### 5.2 Task model (orchestration spine — `tasks` table / task tools)
States: `proposed → negotiating → pending_approval → approved → executing →
done | failed` (`rejected → proposed` to revise; `cancelled` from any non-terminal).
Dependency edges gate execution; claims are atomic (`claim_next_task` SQL fn,
`FOR UPDATE SKIP LOCKED`). Fields: `id, type, status, payload, actor, tenant_id,
depends_on[], result, provenance, created_at, updated_at`.

### 5.3 Supabase tables
`tenant_configs`, `hitl_queue`, `task_events`, `audit_log` (append-only),
`knowledge_base`, `tasks` — all with RLS tenant-isolation policies.

## 6. MCP surface (equivalent to the HTTP surface)

The same registry is exposed to agents via MCP (`lib/mcp_bridge.js` in-process +
`lib/mcp_http.js` streamable-HTTP transport). Identity (`actor`, `tenantId`,
`approved`) threads through, so RLS + audit + the approval gate apply to agent
calls identically. (Remote `POST /mcp` mount is pending the route cutover.)

## 7. Environment (`.env` / secret manager — env-only, never in source)

```ini
PORT=3003
NODE_ENV=production
GATEWAY_API_KEY=            # operator key (governance)
FIRECRAWL_API_KEY=         # audits/scouring
GA4_PROPERTY_ID=  GA4_MEASUREMENT_ID=  GA4_CREDENTIALS_BASE64=   # analytics
SERPAPI_API_KEY=          # legal-vertical Google Scholar
SUPABASE_URL=  SUPABASE_SERVICE_ROLE_KEY=                        # DB + governance
ANTHROPIC_API_KEY=        # multi-agent negotiation (claude-opus-4-8)
ENCRYPTION_KEY=  JWT_SECRET=                                     # admin vault (AES-256-GCM) + tokens
```

## 8. Run, test, deploy

```bash
cd aiwx-smb-auditor && npm install
node test/run.js            # MUST print 128 passed, 0 failed
npm start                   # gateway on :3003
```
Production: root multi-stage `Dockerfile` (Node 20 + system Chromium, non-root,
HEALTHCHECK on `/health`). **Cloud caveats:** background loops need CPU-always-on +
`min-instances >= 1`; **Supabase is mandatory at multi-instance scale** (file-based
state won't survive); Chromium needs 2-4 GB; HIPAA vertical needs a BAA.

> [!WARNING]
> Do not deprecate the **Smart Simulator Fallback** in `lib/scraper.js` /
> `lib/scourer.js`: with no/invalid `FIRECRAWL_API_KEY` the engine must still
> return vertical-accurate mock data so the UI never blanks. Likewise the Scholar
> module falls back to a labeled simulated dataset — never present simulated
> citations as verified.

## 9. HITL Workforce Transition Model (product framing)

AI augments rather than replaces SMB staff: existing roles are upskilled into "AI
Operator/Validator" positions, and high-risk automated actions (e.g. invoice
variance > 5%) route to the HITL queue for human approval before execution. A
90-day transition timeline and role-transition map are produced per audit.

---
*End of contract. Keep this file in sync between the CONVERGENCE-Ai and ASES repos.*
