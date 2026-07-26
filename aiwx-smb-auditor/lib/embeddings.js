/**
 * Vector Embedding Backend (Dify.ai / pgvector) — optional
 * ========================================================
 * The production RAG path: chunks are embedded and stored in a vector index, and
 * semantic queries route through it. This module is the injection point — the KB
 * (`lib/knowledge_ingest.js`) accepts an `embedder` and uses it when present,
 * falling back to its local hybrid search otherwise (same contract as the Scholar
 * / Clio simulated fallbacks — the system never blanks).
 *
 * An embedder implements:
 *   upsert(chunks)                 -> push {id,text,tenantId,provenance} to the index
 *   query({tenantId,query,k})      -> { query, results:[{text,sourceRef,source,provenance,score}] }
 *
 * `createEmbedder()` returns a live embedder when a vector backend is configured
 * (DIFY_API_URL or PGVECTOR_URL), else null (local search). The live Dify/pgvector
 * HTTP client plugs in at the marked seam without changing any caller.
 */

function isVectorConfigured() {
  return !!(process.env.DIFY_API_URL || process.env.PGVECTOR_URL);
}

function createEmbedder() {
  if (!isVectorConfigured()) return null;
  // ── SEAM: construct the live Dify.ai / pgvector client here ──────────────────
  //   const client = new DifyClient({ url: process.env.DIFY_API_URL, key: process.env.DIFY_API_KEY });
  //   return {
  //     async upsert(chunks) { /* client.index(chunks) */ },
  //     async query({ tenantId, query, k }) { /* return client.search(...) */ }
  //   };
  // Until the live client is wired in this environment, fall back to local search.
  return null;
}

module.exports = { isVectorConfigured, createEmbedder };
