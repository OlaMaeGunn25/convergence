/**
 * Retrieval Reranker (RRK) — second-stage precision for RAG
 * =========================================================
 * The agent-equivalent of a search-results reranker: the KB retrieves broadly
 * (recall), this reorders by true relevance (precision) so only the top-k, most-
 * relevant chunks ground the LLM. That trims prompt/context tokens on every
 * KB-grounded command — the main RAG cost lever.
 *
 * A live cross-encoder / Cohere Rerank client plugs into `createReranker()` when
 * configured (COHERE_API_KEY / RERANKER_URL); until then the local precision
 * reranker is used (deterministic, free, never blanks). A reranker implements:
 *   rerank({ query, candidates, k }) -> reordered candidates with `rerankScore`.
 */

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'on', 'is', 'are', 'with', 'by', 'at', 'as', 'be', 'this', 'that', 'it', 'from']);
function terms(text) {
  return Array.from(new Set((String(text || '').toLowerCase().match(/[a-z0-9]+/g) || []).filter(t => t.length > 2 && !STOP.has(t))));
}

function isRerankerConfigured() {
  return !!(process.env.COHERE_API_KEY || process.env.RERANKER_URL);
}

/**
 * Local precision reranker — re-scores first-stage candidates with a richer signal
 * than the retriever: exact-phrase presence, query-term coverage, and match
 * density. Blends lightly with the retriever's score for stability.
 */
function localReranker() {
  return {
    provider: 'local',
    async rerank({ query, candidates = [], k } = {}) {
      const q = String(query || '').toLowerCase();
      const qterms = terms(query);
      const scored = candidates.map(c => {
        const text = String(c.text || '').toLowerCase();
        const phrase = q && text.includes(q) ? 1 : 0;
        let cov = 0; for (const t of qterms) if (text.includes(t)) cov++;
        const coverage = qterms.length ? cov / qterms.length : 0;
        const density = text.length ? Math.min(cov / Math.sqrt(text.length) * 4, 1) : 0;
        const precision = 0.5 * phrase + 0.4 * coverage + 0.1 * density;
        const base = c.score != null ? c.score : 0;
        const rerankScore = Number((0.7 * precision + 0.3 * base).toFixed(4));
        return Object.assign({}, c, { rerankScore });
      }).sort((a, b) => b.rerankScore - a.rerankScore);
      return typeof k === 'number' ? scored.slice(0, k) : scored;
    }
  };
}

function createReranker() {
  // ── SEAM: construct a live cross-encoder / Cohere Rerank client here ──────────
  //   if (isRerankerConfigured()) return { provider:'cohere', async rerank({query,candidates,k}){ ... } };
  // Until a live reranker is wired, the local precision reranker is used.
  return localReranker();
}

module.exports = { isRerankerConfigured, createReranker, localReranker };
