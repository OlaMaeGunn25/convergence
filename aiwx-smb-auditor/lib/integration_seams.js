/**
 * Integration Seams — live-backend readiness (pre-cloud)
 * ======================================================
 * CONVERGENCE-Ai runs end-to-end today on deterministic LOCAL FALLBACKS. Several
 * capabilities have a marked seam where a live external client activates at
 * cloud-deploy time. This module reports, honestly, which optional backends are
 * configured (live) vs. running on their fallback — so operators can see exactly
 * what is stubbed, and so the eventual cloud-deploy task list is already seeded.
 *
 * Nothing here reaches the network; it only reads env flags.
 */

const embeddings = require('./embeddings');
const reranker = require('./reranker');
const { isSupabaseConfigured } = require('./supabase');

function seams() {
  const list = [
    {
      id: 'state_backend', name: 'Governed state store',
      configured: isSupabaseConfigured(), env: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
      fallback: 'local JSON store (single-node; process-local)',
      activation: 'Point at self-hosted or cloud Supabase for multi-instance + atomic claim + RLS.'
    },
    {
      id: 'vector_embeddings', name: 'RAG vector embeddings (Dify.ai / pgvector)',
      configured: embeddings.isVectorConfigured(), env: ['DIFY_API_URL', 'PGVECTOR_URL'],
      fallback: 'local hybrid keyword + keyword-set-overlap search',
      activation: 'Wire the live client in lib/embeddings.js createEmbedder().'
    },
    {
      id: 'reranker', name: 'Retrieval reranker (cross-encoder / Cohere Rerank)',
      configured: reranker.isRerankerConfigured(), env: ['COHERE_API_KEY', 'RERANKER_URL'],
      fallback: 'local precision reranker (phrase + coverage + density)',
      activation: 'Wire the live client in lib/reranker.js createReranker().'
    },
    {
      id: 'connector_fetchers', name: 'Live connector document fetchers (Drive/SharePoint/Notion/Zendesk)',
      configured: false, env: ['<connector OAuth vars: GOOGLE_*, MS_*, etc.>'],
      fallback: 'simulated connector scour + operator-supplied documents',
      activation: 'Wire live fetchers into lib/ingestion_adapters.js connectorRead({fetcher}).'
    },
    {
      id: 'regulatory_search', name: 'Live regulatory / legal search',
      configured: !!process.env.SERPAPI_API_KEY, env: ['SERPAPI_API_KEY'],
      fallback: 'simulated regulatory corpus + labeled Scholar fallback',
      activation: 'Set SERPAPI_API_KEY (or wire a dedicated regulatory API).'
    },
    {
      id: 'systems_crawl', name: 'Systems-evaluation crawl (Firecrawl)',
      configured: !!process.env.FIRECRAWL_API_KEY, env: ['FIRECRAWL_API_KEY'],
      fallback: 'simulated, vertical-accurate mock scrape',
      activation: 'Set FIRECRAWL_API_KEY.'
    },
    {
      id: 'negotiation_llm', name: 'Multi-agent negotiation + model cascade (Anthropic)',
      configured: !!process.env.ANTHROPIC_API_KEY, env: ['ANTHROPIC_API_KEY'],
      fallback: 'deterministic negotiation + advisory model-cascade routing',
      activation: 'Set ANTHROPIC_API_KEY (and per-provider keys for the LLM gateway).'
    }
  ];
  const total = list.length;
  const live = list.filter(s => s.configured).length;
  return {
    seams: list,
    summary: { total, live, fallback: total - live, allLive: live === total },
    note: 'Live backends activate at cloud-deploy time; every capability runs on a local fallback until then.'
  };
}

module.exports = { seams };
