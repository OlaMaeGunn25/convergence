/**
 * Attribution Log (Phase 0.5, ATR)
 * ================================
 * An append-only record of every re-engineered (graph-of-thought) prompt and every
 * system output, each attributable to the assigned HITL and the acting agent —
 * the non-repudiation spine (ATR-01..04). Nothing may be recorded without an
 * attributable HITL; records are never updated or deleted.
 *
 * Mirrors the store pattern (Supabase table `attributions` + JSON fallback). It
 * complements the immutable `audit_log` (WHO acted) with WHAT was asked/produced.
 */

const crypto = require('crypto');
const path = require('path');
const { isSupabaseConfigured, insertRow, selectRows } = require('./supabase');
const jsonFile = require('./stores/json_file');

const TYPES = ['prompt', 'output'];

function digest(value) {
  const s = typeof value === 'string' ? value : JSON.stringify(value ?? null);
  return crypto.createHash('sha256').update(s).digest('hex');
}

function newRecordId() {
  return `attr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

const EMPTY = { attributions: [] };

function rowToRecord(row) {
  if (!row) return null;
  return {
    id: row.id, type: row.type, hitlId: row.hitl_id, agentId: row.agent_id || null,
    taskId: row.task_id || null, summary: row.summary || null, digest: row.digest,
    createdAt: row.created_at
  };
}

class AttributionLog {
  constructor(options = {}) {
    this.usingSupabase = isSupabaseConfigured();
    this.file = options.file || path.join(__dirname, '..', 'config', 'attributions.json');
  }

  /**
   * Append an attribution record. REQUIRES a hitlId (ATR-04): an unattributable
   * event is rejected.
   */
  async record({ type, hitlId, agentId = null, taskId = null, content, summary = null }) {
    if (!TYPES.includes(type)) throw new Error(`Invalid attribution type "${type}".`);
    if (!hitlId) throw new Error('Attribution requires an attributable HITL (hitlId).');
    const now = new Date().toISOString();
    const rec = {
      id: newRecordId(), type, hitlId, agentId, taskId,
      summary: summary || (typeof content === 'string' ? content.slice(0, 280) : null),
      digest: digest(content), createdAt: now
    };
    if (this.usingSupabase) {
      const rows = await insertRow('attributions', {
        id: rec.id, type, hitl_id: hitlId, agent_id: agentId, task_id: taskId,
        summary: rec.summary, digest: rec.digest, created_at: now
      });
      return rowToRecord(Array.isArray(rows) ? rows[0] : rows) || rec;
    }
    return jsonFile.mutate(this.file, EMPTY, (store) => {
      const records = Array.isArray(store.attributions) ? store.attributions : [];
      records.push(rec); // append-only — never mutate/remove existing
      return { value: { attributions: records }, result: rec };
    });
  }

  recordPrompt(args) { return this.record({ ...args, type: 'prompt' }); }
  recordOutput(args) { return this.record({ ...args, type: 'output' }); }

  async list({ hitlId, taskId } = {}) {
    if (this.usingSupabase) {
      const filters = ['select=*', 'order=created_at.asc'];
      if (hitlId) filters.push(`hitl_id=eq.${encodeURIComponent(hitlId)}`);
      if (taskId) filters.push(`task_id=eq.${encodeURIComponent(taskId)}`);
      const rows = await selectRows('attributions', filters.join('&'));
      return (rows || []).map(rowToRecord);
    }
    const store = jsonFile.readSync(this.file, EMPTY);
    return (store.attributions || []).filter(r =>
      (hitlId === undefined || r.hitlId === hitlId) &&
      (taskId === undefined || r.taskId === taskId));
  }

  /** Chain-of-custody for a task: ordered prompts + outputs with attribution. */
  async trace(taskId) {
    const records = await this.list({ taskId });
    return { taskId, records, count: records.length };
  }
}

module.exports = { AttributionLog, TYPES, digest };
