# Integration Seams — Live Backends vs. Local Fallbacks

CONVERGENCE-Ai runs **end-to-end today on deterministic local fallbacks** — no
cloud, no external accounts. Several capabilities have a single, marked seam where
a **live external client activates at cloud-deploy time**. This is the honest map
of what is stubbed and what turning it on takes. It doubles as the backbone of the
future cloud-deploy task list.

**Self-report at runtime:** `GET /health` → `deployment.optionalBackends` (counts),
or the `get_integration_seams` tool (full detail). Everything below is env-gated —
no code fork.

| Seam | Live when set | Falls back to | Activation (deploy-time) |
|---|---|---|---|
| **Governed state store** | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | local JSON store (single-node, process-local) | Point at self-hosted or cloud Supabase for multi-instance + atomic `claim_next_task` + RLS. |
| **RAG vector embeddings** | `DIFY_API_URL` / `PGVECTOR_URL` | local hybrid keyword + overlap search | Wire the Dify.ai/pgvector client in `lib/embeddings.js` → `createEmbedder()`. |
| **Retrieval reranker** | `COHERE_API_KEY` / `RERANKER_URL` | local precision reranker (phrase + coverage + density) | Wire the cross-encoder / Cohere Rerank client in `lib/reranker.js` → `createReranker()`. |
| **Connector doc fetchers** | connector OAuth vars (`GOOGLE_*`, `MS_*`, …) | simulated connector scour + operator-supplied docs | Wire live fetchers into `lib/ingestion_adapters.js` → `connectorRead({ fetcher })`. |
| **Regulatory / legal search** | `SERPAPI_API_KEY` | simulated regulatory corpus + labeled Scholar fallback | Set the key (or wire a dedicated regulatory API) in `lib/compliance.js`. |
| **Systems-evaluation crawl** | `FIRECRAWL_API_KEY` | simulated, vertical-accurate mock scrape | Set `FIRECRAWL_API_KEY`. |
| **Negotiation + model cascade** | `ANTHROPIC_API_KEY` (+ provider keys) | deterministic negotiation + advisory routing | Set the LLM-gateway provider keys. |

## What "not wiring these yet" means

Every governed flow works now on the fallback: the KB builds from onboarding,
every command is cross-referenced + reranked (locally), the model router advises a
tier, compliance/regulatory checks run on the simulated corpus, and audits run on
the mock crawl. The seams change *quality/scale/cost of the backend*, **not the
governance or the API contract** — so nothing downstream (ASES, the MCP surface,
the agent roster) changes when they flip on.

## Relationship to cloud deploy

When you're ready for GCP or AWS, the deploy task list is essentially: pick the
state store (managed Supabase/Postgres), flip the seams above that you want live
(embeddings, reranker, Firecrawl, SerpApi, provider keys), set secrets in the
cloud secret manager, and configure CPU-always-on + min-instances ≥ 1 for the
background loops. Until then, this file is the checklist-in-waiting.
