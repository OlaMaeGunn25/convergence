/**
 * Playbook Library — reusable, versioned procedures the agent improves (ADD-ON)
 * ============================================================================
 * A completed Task Record says "here is what was done once". A PLAYBOOK is that
 * run promoted into a named, categorized, reusable procedure — and, crucially,
 * one the assigned agent makes BETTER each time it runs.
 *
 * This is the institutional-memory loop: run → record → playbook → improved
 * playbook → better next run. Memory compounds instead of resetting.
 *
 * Add-on module: `playbook_library` (depends on `task_record`).
 *
 * Improvement is GOVERNED, not silent:
 *   - every revision creates a NEW VERSION (previous versions are never edited),
 *   - each revision records WHY it changed (failure, HITL correction, course-
 *     correct) and WHO/what triggered it, so a human can audit how a procedure
 *     drifted over time,
 *   - HITL corrections are weighted as the strongest improvement signal.
 */

const crypto = require('crypto');
const path = require('path');
const { isSupabaseConfigured, insertRow, selectRows, updateRows } = require('./supabase');
const jsonFile = require('./stores/json_file');

const EMPTY = { playbooks: [] };
const REVISION_REASONS = ['hitl_correction', 'step_failure', 'course_correction', 'optimization', 'manual'];

function rowToPlaybook(row) {
  if (!row) return null;
  return {
    id: row.id, tenantId: row.tenant_id || null, name: row.name, category: row.category,
    taskType: row.task_type || null, steps: row.steps || [], version: row.version,
    revisions: row.revisions || [], runCount: row.run_count || 0,
    successCount: row.success_count || 0, ownerAgentId: row.owner_agent_id || null,
    createdAt: row.created_at, updatedAt: row.updated_at
  };
}

class PlaybookLibrary {
  constructor(options = {}) {
    this.usingSupabase = isSupabaseConfigured();
    this.file = options.file || path.join(__dirname, '..', 'config', 'playbooks.json');
  }

  /** Promote a completed task record into a v1 playbook (or reuse the match). */
  async saveFromRecord(record, { ownerAgentId = null } = {}) {
    if (!record || !record.taskId) throw new Error('A completed task record is required.');
    if (record.status !== 'completed') throw new Error('Only a completed task record can become a playbook.');
    const existing = await this.findForTask({ tenantId: record.tenantId, taskType: record.taskType, category: record.category });
    if (existing) return existing;

    const now = new Date().toISOString();
    const pb = {
      id: `pb_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      tenantId: record.tenantId || null,
      name: record.name, category: record.category, taskType: record.taskType || null,
      steps: (record.steps || []).map(s => ({ n: s.n, tool: s.tool, system: s.system, summary: s.summary })),
      version: 1, revisions: [], runCount: 1,
      successCount: 1,
      ownerAgentId: ownerAgentId || record.agentId || null,
      createdAt: now, updatedAt: now
    };
    if (this.usingSupabase) {
      await insertRow('playbooks', {
        id: pb.id, tenant_id: pb.tenantId, name: pb.name, category: pb.category, task_type: pb.taskType,
        steps: pb.steps, version: 1, revisions: [], run_count: 1, success_count: 1,
        owner_agent_id: pb.ownerAgentId, created_at: now, updated_at: now
      });
      return pb;
    }
    return jsonFile.mutate(this.file, EMPTY, (store) => {
      const arr = Array.isArray(store.playbooks) ? store.playbooks : [];
      arr.push(pb);
      return { value: { playbooks: arr }, result: pb };
    });
  }

  /**
   * The improvement loop. The agent revises the procedure from what actually
   * happened; every revision bumps the version and is recorded with its reason.
   */
  async improve({ playbookId, reason, note = null, steps = null, agentId = null, hitlId = null, succeeded = null }) {
    if (!REVISION_REASONS.includes(reason)) throw new Error(`Invalid revision reason "${reason}".`);
    const pb = await this.get(playbookId);
    if (!pb) throw new Error(`Playbook ${playbookId} not found.`);
    const now = new Date().toISOString();
    const revision = {
      version: pb.version + 1, reason, note,
      // A human correction is the strongest signal — mark it so drift is auditable.
      weight: reason === 'hitl_correction' ? 'high' : reason === 'step_failure' ? 'medium' : 'low',
      agentId, hitlId, at: now,
      stepsChanged: Array.isArray(steps)
    };
    const patch = {
      version: pb.version + 1,
      revisions: (pb.revisions || []).concat([revision]),
      steps: Array.isArray(steps) ? steps : pb.steps,
      run_count: (pb.runCount || 0) + 1,
      success_count: (pb.successCount || 0) + (succeeded === false ? 0 : 1),
      updated_at: now
    };
    await this._patch(pb.id, patch);
    return this.get(pb.id);
  }

  async _patch(id, patch) {
    if (this.usingSupabase) {
      await updateRows('playbooks', `id=eq.${encodeURIComponent(id)}`, patch);
      return;
    }
    await jsonFile.mutate(this.file, EMPTY, (store) => {
      const arr = Array.isArray(store.playbooks) ? store.playbooks : [];
      const p = arr.find(x => x.id === id);
      if (p) {
        p.version = patch.version; p.revisions = patch.revisions; p.steps = patch.steps;
        p.runCount = patch.run_count; p.successCount = patch.success_count; p.updatedAt = patch.updated_at;
      }
      return { value: { playbooks: arr }, result: p || null };
    });
  }

  async get(id) {
    if (this.usingSupabase) {
      const rows = await selectRows('playbooks', `id=eq.${encodeURIComponent(id)}&limit=1`);
      return rowToPlaybook(rows && rows[0]);
    }
    const store = jsonFile.readSync(this.file, EMPTY);
    return (store.playbooks || []).find(p => p.id === id) || null;
  }

  async list({ tenantId, category } = {}) {
    if (this.usingSupabase) {
      const f = ['select=*', 'order=updated_at.desc'];
      if (tenantId) f.push(`tenant_id=eq.${encodeURIComponent(tenantId)}`);
      if (category) f.push(`category=eq.${encodeURIComponent(category)}`);
      return ((await selectRows('playbooks', f.join('&'))) || []).map(rowToPlaybook);
    }
    const store = jsonFile.readSync(this.file, EMPTY);
    return (store.playbooks || []).filter(p =>
      (tenantId === undefined || p.tenantId === tenantId) &&
      (category === undefined || p.category === category));
  }

  /** Reuse: is there already a playbook for this kind of task? */
  async findForTask({ tenantId = null, taskType = null, category = null } = {}) {
    const all = await this.list({ tenantId: tenantId || undefined });
    return all.find(p =>
      (taskType && p.taskType === taskType) ||
      (!taskType && category && p.category === category)) || null;
  }

  /** Reliability signal a HITL can weigh before trusting a procedure. */
  successRate(pb) {
    if (!pb || !pb.runCount) return null;
    return Math.round((100 * (pb.successCount || 0)) / pb.runCount);
  }
}

module.exports = { PlaybookLibrary, REVISION_REASONS };
