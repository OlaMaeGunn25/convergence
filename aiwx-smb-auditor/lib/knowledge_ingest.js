/**
 * Knowledge Ingestion + Company Knowledge Base (Phase 2, ING + KNW-04)
 * ===================================================================
 * The Knowledge Compilation agent's engine. Ingests the company's SOPs and
 * documentation from pluggable, governed sources into one company knowledge base,
 * then serves hybrid (keyword + semantic-overlap) search for agent grounding.
 *
 * Ingestion contract (ING-04), identical across adapters:
 *   - READ-ONLY: adapters supply already-read text; this module NEVER writes back
 *     to any source system (there is no write path).
 *   - SCOPE-APPROVED: ingestion refuses to run unless the scope is HITL-approved.
 *   - PROVENANCE: every chunk records its source + reference + ingest time.
 *
 * Sources: connector_read + upload (live), on_prem_crawl (roadmap — refused).
 * Production backs this with Dify.ai + pgvector; here it is a self-contained,
 * deterministic store (same fallback philosophy as lib/scholar.js).
 */

const crypto = require('crypto');
const path = require('path');
const { isSupabaseConfigured, insertRow, selectRows } = require('./supabase');
const jsonFile = require('./stores/json_file');

const SOURCES = ['connector_read', 'upload', 'on_prem_crawl', 'audit_scour'];
const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'on', 'is', 'are', 'with', 'by', 'at', 'as', 'be', 'this', 'that', 'it', 'from', 'must', 'shall', 'any', 'all']);

function tokenize(text) { return (String(text || '').toLowerCase().match(/[a-z0-9]+/g) || []); }
function keywordsOf(text) {
  return Array.from(new Set(tokenize(text).filter(t => t.length > 2 && !STOP.has(t))));
}
function chunkText(text, size = 400) {
  const parts = [];
  let buf = '';
  for (const sentence of String(text || '').split(/(?<=[.!?])\s+/)) {
    if ((buf + sentence).length > size && buf) { parts.push(buf.trim()); buf = ''; }
    buf += sentence + ' ';
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts.length ? parts : (text ? [String(text)] : []);
}

const EMPTY = { chunks: [] };

class KnowledgeBase {
  constructor(options = {}) {
    this.usingSupabase = isSupabaseConfigured();
    this.file = options.file || path.join(__dirname, '..', 'config', 'knowledge_base.json');
    // Optional vector-embedding backend (Dify.ai / pgvector). When present, chunks
    // are upserted to it on ingest and semantic queries route through it; otherwise
    // the local hybrid search is used. See lib/embeddings.js.
    this.embedder = options.embedder || null;
  }

  /**
   * Ingest documents from a source into the company KB.
   * @param docs [{ ref, text }] already read by an adapter (read-only).
   * @param approvedScope must be true — the HITL-approved scour scope (ING-04).
   */
  async ingest({ tenantId = null, source, docs = [], approvedScope = false, actor = null }) {
    if (!SOURCES.includes(source)) throw new Error(`Unknown ingestion source "${source}".`);
    if (source === 'on_prem_crawl') throw new Error('On-prem crawl adapter is roadmap and not enabled.');
    if (approvedScope !== true) throw new Error('Ingestion scope must be HITL-approved before any scour (ING-04).');

    const now = new Date().toISOString();
    const chunks = [];
    for (const d of docs) {
      chunkText(d.text || '').forEach((text, i) => {
        chunks.push({
          id: `kb_${Date.now()}_${crypto.randomBytes(3).toString('hex')}_${i}`,
          tenantId, source, sourceRef: d.ref || null, text,
          keywords: keywordsOf(text),
          provenance: { source, ref: d.ref || null, ingestedAt: now, actor },
          createdAt: now
        });
      });
    }

    // Push to the vector backend (Dify/pgvector) when configured — best-effort;
    // the local store below remains the source of truth + fallback.
    if (this.embedder && typeof this.embedder.upsert === 'function') {
      try { await this.embedder.upsert(chunks); } catch (e) { /* non-fatal: local store still holds it */ }
    }

    if (this.usingSupabase) {
      for (const c of chunks) {
        await insertRow('knowledge_base', {
          id: c.id, tenant_id: tenantId, source, source_ref: c.sourceRef,
          text: c.text, keywords: c.keywords, provenance: c.provenance, created_at: now
        });
      }
      return { ingested: chunks.length, source };
    }
    return jsonFile.mutate(this.file, EMPTY, (store) => {
      const arr = Array.isArray(store.chunks) ? store.chunks : [];
      arr.push(...chunks); // append-only
      return { value: { chunks: arr }, result: { ingested: chunks.length, source } };
    });
  }

  async all(tenantId) {
    if (this.usingSupabase) {
      const q = tenantId ? `tenant_id=eq.${encodeURIComponent(tenantId)}` : 'select=*';
      return (await selectRows('knowledge_base', q)) || [];
    }
    const store = jsonFile.readSync(this.file, EMPTY);
    return (store.chunks || []).filter(c => tenantId === undefined || c.tenantId === tenantId);
  }

  /** Hybrid search: semantic vectors when a backend is configured, else lexical
   *  (substring hits) + keyword-set overlap over the local store. */
  async search({ tenantId = null, query, k = 5 }) {
    if (this.embedder && typeof this.embedder.query === 'function') {
      try { return await this.embedder.query({ tenantId, query, k }); }
      catch (e) { /* fall through to local hybrid search */ }
    }
    const qk = keywordsOf(query || '');
    const qset = new Set(qk);
    const chunks = await this.all(tenantId);
    const scored = chunks.map(c => {
      const ck = new Set(c.keywords || []);
      let lex = 0; for (const t of qk) if (String(c.text || '').toLowerCase().includes(t)) lex++;
      let inter = 0; for (const t of qset) if (ck.has(t)) inter++;
      const sem = qset.size ? inter / qset.size : 0;
      const score = 0.5 * (qk.length ? lex / qk.length : 0) + 0.5 * sem;
      return { chunk: c, score };
    }).filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, k);
    return {
      query,
      results: scored.map(s => ({
        text: s.chunk.text, sourceRef: s.chunk.sourceRef, source: s.chunk.source,
        provenance: s.chunk.provenance, score: Number(s.score.toFixed(3))
      }))
    };
  }

  /** Knowledge Compilation agent aggregate (KNW-04): the compiled company KB. */
  async compile({ tenantId = null }) {
    const chunks = await this.all(tenantId);
    const bySource = {};
    const refs = new Set();
    for (const c of chunks) {
      bySource[c.source] = (bySource[c.source] || 0) + 1;
      if (c.sourceRef) refs.add(c.sourceRef);
    }
    return {
      tenantId, totalChunks: chunks.length, bySource, documents: refs.size,
      ready: chunks.length > 0, generatedAt: new Date().toISOString()
    };
  }
}

module.exports = { KnowledgeBase, SOURCES, keywordsOf, chunkText };
