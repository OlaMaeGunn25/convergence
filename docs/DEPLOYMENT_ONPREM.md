# CONVERGENCE-Ai — On-Prem / Self-Hosted Deployment (DEP)

CONVERGENCE-Ai runs from **one codebase** in two modes. Deployment mode is a
**config, not a code fork** (DEP-03): the Express gateway, the orchestrator, the
**13-agent roster**, and every governed store run identically — only the state
backend differs.

| | Cloud-native | On-prem (self-hosted) |
|---|---|---|
| Container | root `Dockerfile` (Node 20 + Chromium) | same image |
| State backend | Supabase (REST + RLS) | **local JSON store** (single node) or **self-hosted Supabase** (multi-node) |
| External cloud dependency | Supabase, Secret Manager | **none required** |
| Verify | `GET /health` → `deployment.mode: "cloud"` | `deployment.mode: "onprem"` |

## Quick start (single-node on-prem)

```bash
cp .env.onprem.example .env.onprem      # edit GATEWAY_API_KEY + secrets
docker compose -f docker-compose.onprem.yml up -d
curl -H "x-api-key: <key>" http://localhost:3003/health
# -> { ..., deployment: { mode: "onprem", stateBackend: "json-file", cloudDependencies: [] } }
```

Services stood up:
- **gateway** (:3003) — the governed hub; state persists to the `convergence_state`
  volume (`aiwx-smb-auditor/config/*.json`).
- **postgres** (pgvector) — vector store for the RAG knowledge base / Dify.
- **n8n** (:5678) — workflow runner (bookkeeping / integration workflows).

## What is local

All governed state persists in local Docker volumes via the JSON store — tasks,
agents, connections, HITL identities, attribution, the company knowledge base,
autonomy grants, chat plans, compliance evidence, and HR requests. Nothing leaves
the host. Connector credentials remain **env-only** (never accepted over the API),
exactly as in the cloud build.

## RAG brain (Dify)

Dify.ai ships its own Docker Compose stack. Run it alongside this one and point it
at the `postgres` (pgvector) service. The gateway's knowledge-ingest layer
(`lib/knowledge_ingest.js`) uses the same read-only, HITL-scope-approved,
provenance-tagged contract in both modes.

## Multi-instance on-prem

The local JSON store is process-local and does not coordinate multiple gateway
instances. To scale out on-prem, run **self-hosted Supabase** and set
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env.onprem` — the governed stores
switch to the Supabase backend automatically (`isSupabaseConfigured()`), and the
atomic `claim_next_task` / RLS guarantees apply just as in the cloud.

## Security notes

- Set `GATEWAY_API_KEY` (fail-closed governance auth) in any shared environment.
- Chromium runs `--no-sandbox` as a non-root user in the container.
- Keep `.env.onprem` out of version control (it holds secrets); only
  `.env.onprem.example` is committed.
- HIPAA / regulated verticals: keep PHI on the on-prem host and review the
  compliance-evidence export (`export_compliance_evidence`) retention policy.
