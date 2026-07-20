/**
 * Task Model — the orchestration spine (Phase 1)
 * ==============================================
 * One canonical representation for every unit of work in CONVERGENCE-Ai: an
 * audit, a publish, a negotiation, a HITL item. Everything the orchestrator
 * (Phase 3) coordinates is a Task row with a state machine and dependency edges.
 *
 * States:
 *   proposed → negotiating → pending_approval → approved → executing → done
 *                                             ↘ rejected ↗ (revise)   ↘ failed
 *   (cancelled is reachable from any non-terminal state)
 *
 * A task cannot be claimed for execution until every task in its `dependsOn`
 * list is `done` — this is what lets the orchestrator compose multi-step work.
 *
 * Backing: Supabase (production, atomic claim via `claim_next_task` RPC using
 * FOR UPDATE SKIP LOCKED) or a process-locked JSON file (dev/CI). Mirrors the
 * lib/stores/* pattern so the two paths can never drift.
 */

const crypto = require('crypto');
const path = require('path');
const { isSupabaseConfigured, insertRow, selectRows, updateRows, rpc } = require('./supabase');
const jsonFile = require('./stores/json_file');

const STATES = ['proposed', 'negotiating', 'pending_approval', 'approved', 'executing', 'done', 'failed', 'rejected', 'cancelled'];
const TERMINAL = new Set(['done', 'failed', 'cancelled']);

// Allowed forward transitions. `cancelled` is appended to every non-terminal
// state below; `rejected` may be revised back to `proposed`.
const VALID_TRANSITIONS = {
  proposed: ['negotiating', 'pending_approval'],
  negotiating: ['pending_approval', 'failed'],
  pending_approval: ['approved', 'rejected'],
  approved: ['executing'],
  executing: ['done', 'failed'],
  rejected: ['proposed'],
  done: [],
  failed: [],
  cancelled: []
};

function canTransition(from, to) {
  if (!STATES.includes(to)) return false;
  if (to === 'cancelled') return !TERMINAL.has(from) && from !== 'cancelled';
  return (VALID_TRANSITIONS[from] || []).includes(to);
}

function newTaskId() {
  return `task_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

const EMPTY = { tasks: [] };

// ── Row <-> object mapping (snake_case DB columns <-> camelCase objects) ──
function rowToTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    payload: row.payload || {},
    actor: row.actor || null,
    tenantId: row.tenant_id || null,
    dependsOn: row.depends_on || [],
    result: row.result || null,
    provenance: row.provenance || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

class TaskModel {
  constructor(options = {}) {
    this.usingSupabase = isSupabaseConfigured();
    this.file = options.file || path.join(__dirname, '..', 'config', 'tasks.json');
  }

  /** Create a task (defaults to the `proposed` state). */
  async create({ type, payload = {}, actor = null, tenantId = null, dependsOn = [], status = 'proposed', provenance = null }) {
    if (!type) throw new Error('A task "type" is required.');
    if (!STATES.includes(status)) throw new Error(`Invalid initial status "${status}".`);
    const now = new Date().toISOString();
    const task = { id: newTaskId(), type, status, payload, actor, tenantId, dependsOn, result: null, provenance, createdAt: now, updatedAt: now };

    if (this.usingSupabase) {
      const rows = await insertRow('tasks', {
        id: task.id, type, status, payload, actor, tenant_id: tenantId,
        depends_on: dependsOn, provenance, created_at: now, updated_at: now
      });
      return rowToTask(Array.isArray(rows) ? rows[0] : rows) || task;
    }
    return jsonFile.mutate(this.file, EMPTY, (store) => {
      const tasks = Array.isArray(store.tasks) ? store.tasks : [];
      tasks.push(task);
      return { value: { tasks }, result: task };
    });
  }

  async get(id) {
    if (this.usingSupabase) {
      const rows = await selectRows('tasks', `id=eq.${encodeURIComponent(id)}&limit=1`);
      return rowToTask(rows && rows[0]);
    }
    const store = jsonFile.readSync(this.file, EMPTY);
    return (store.tasks || []).find(t => t.id === id) || null;
  }

  async list({ status, tenantId } = {}) {
    if (this.usingSupabase) {
      const filters = ['select=*', 'order=created_at.asc'];
      if (status) filters.push(`status=eq.${encodeURIComponent(status)}`);
      if (tenantId) filters.push(`tenant_id=eq.${encodeURIComponent(tenantId)}`);
      const rows = await selectRows('tasks', filters.join('&'));
      return (rows || []).map(rowToTask);
    }
    const store = jsonFile.readSync(this.file, EMPTY);
    return (store.tasks || []).filter(t =>
      (status === undefined || t.status === status) &&
      (tenantId === undefined || t.tenantId === tenantId));
  }

  /**
   * Move a task to a new state, enforcing the state machine. Records the actor
   * and an optional result payload. Throws on an illegal transition.
   */
  async transition(id, toStatus, { actor = null, result = undefined } = {}) {
    if (this.usingSupabase) {
      const current = await this.get(id);
      if (!current) throw new Error(`Task ${id} not found.`);
      if (!canTransition(current.status, toStatus)) {
        throw new Error(`Illegal transition ${current.status} → ${toStatus} for ${id}.`);
      }
      const patch = { status: toStatus, updated_at: new Date().toISOString() };
      if (actor) patch.actor = actor;
      if (result !== undefined) patch.result = result;
      const rows = await updateRows('tasks', `id=eq.${encodeURIComponent(id)}`, patch);
      return rowToTask(Array.isArray(rows) ? rows[0] : rows);
    }
    return jsonFile.mutate(this.file, EMPTY, (store) => {
      const tasks = Array.isArray(store.tasks) ? store.tasks : [];
      const t = tasks.find(x => x.id === id);
      if (!t) throw new Error(`Task ${id} not found.`);
      if (!canTransition(t.status, toStatus)) {
        throw new Error(`Illegal transition ${t.status} → ${toStatus} for ${id}.`);
      }
      t.status = toStatus;
      if (actor) t.actor = actor;
      if (result !== undefined) t.result = result;
      t.updatedAt = new Date().toISOString();
      return { value: { tasks }, result: { ...t } };
    });
  }

  /** True when every dependency of `task` is in the `done` state. */
  async dependenciesMet(task) {
    if (!task.dependsOn || task.dependsOn.length === 0) return true;
    const deps = await Promise.all(task.dependsOn.map(depId => this.get(depId)));
    return deps.every(d => d && d.status === 'done');
  }

  /**
   * Atomically claim the next ready task (status `approved`, all dependencies
   * `done`) and move it to `executing`. Returns the claimed task or null.
   * Production uses a FOR UPDATE SKIP LOCKED SQL function so two orchestrator
   * workers never claim the same task.
   */
  async claimNext({ types = null, tenantId = null } = {}) {
    if (this.usingSupabase) {
      const rows = await rpc('claim_next_task', { p_types: types, p_tenant_id: tenantId });
      return rowToTask(rows && rows[0]);
    }
    // Dev fallback: process-locked scan.
    let claimed = null;
    await jsonFile.mutate(this.file, EMPTY, (store) => {
      const tasks = Array.isArray(store.tasks) ? store.tasks : [];
      const doneIds = new Set(tasks.filter(t => t.status === 'done').map(t => t.id));
      const ready = tasks.find(t =>
        t.status === 'approved' &&
        (!types || types.includes(t.type)) &&
        (tenantId == null || t.tenantId === tenantId) &&
        (t.dependsOn || []).every(d => doneIds.has(d)));
      if (ready) {
        ready.status = 'executing';
        ready.updatedAt = new Date().toISOString();
        claimed = { ...ready };
      }
      return { value: { tasks }, result: claimed };
    });
    return claimed;
  }
}

module.exports = { TaskModel, STATES, TERMINAL, VALID_TRANSITIONS, canTransition, newTaskId };
