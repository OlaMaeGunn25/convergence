/**
 * Delivery + Q/A Attestation (Phase 3, AGT-05 / AGT-06)
 * ====================================================
 * Two independent gates around task completion:
 *   - Delivery attestation: the Delivery agent confirms the task's output was
 *     produced/delivered. A task cannot reach `done` without one (AGT-05).
 *   - Q/A verdict: the Q/A agent independently validates quality/compliance
 *     (pass|flag). A `flag` blocks completion and routes to HITL (AGT-06).
 * Separation of duties: Delivery and Q/A are distinct roles/attestations.
 *
 * Append-only store (Supabase table `attestations` + JSON fallback).
 */

const crypto = require('crypto');
const path = require('path');
const { isSupabaseConfigured, insertRow, selectRows } = require('./supabase');
const jsonFile = require('./stores/json_file');

const EMPTY = { attestations: [] };
const KINDS = ['delivery', 'qa'];

class AttestationLog {
  constructor(options = {}) {
    this.usingSupabase = isSupabaseConfigured();
    this.file = options.file || path.join(__dirname, '..', 'config', 'attestations.json');
  }

  async record({ taskId, kind, actor = null, agentId = null, verdict = null, note = null }) {
    if (!taskId) throw new Error('taskId is required for an attestation.');
    if (!KINDS.includes(kind)) throw new Error(`Invalid attestation kind "${kind}".`);
    if (kind === 'qa' && !['pass', 'flag'].includes(verdict)) throw new Error('A Q/A attestation requires a verdict of pass|flag.');
    const now = new Date().toISOString();
    const rec = { id: `att_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, taskId, kind, actor, agentId, verdict, note, createdAt: now };
    if (this.usingSupabase) {
      await insertRow('attestations', { id: rec.id, task_id: taskId, kind, actor, agent_id: agentId, verdict, note, created_at: now });
      return rec;
    }
    return jsonFile.mutate(this.file, EMPTY, (store) => {
      const arr = Array.isArray(store.attestations) ? store.attestations : [];
      arr.push(rec); // append-only
      return { value: { attestations: arr }, result: rec };
    });
  }

  attestDelivery(args) { return this.record({ ...args, kind: 'delivery' }); }
  recordQa(args) { return this.record({ ...args, kind: 'qa' }); }

  async list(taskId) {
    if (this.usingSupabase) {
      return (await selectRows('attestations', `task_id=eq.${encodeURIComponent(taskId)}&order=created_at.asc`)) || [];
    }
    const store = jsonFile.readSync(this.file, EMPTY);
    return (store.attestations || []).filter(a => a.taskId === taskId);
  }

  /**
   * Completion gate: a task may reach `done` only with a Delivery attestation and
   * no outstanding Q/A flag.
   * @returns { ok:true } | { ok:false, reason }
   */
  async canComplete(taskId) {
    const atts = await this.list(taskId);
    const hasDelivery = atts.some(a => a.kind === 'delivery');
    const qaFlagged = atts.some(a => a.kind === 'qa' && a.verdict === 'flag');
    if (!hasDelivery) return { ok: false, reason: 'No Delivery attestation — task output is not attested (AGT-05).' };
    if (qaFlagged) return { ok: false, reason: 'Q/A flagged this task — resolve before completion (AGT-06).' };
    return { ok: true };
  }
}

module.exports = { AttestationLog, KINDS };
