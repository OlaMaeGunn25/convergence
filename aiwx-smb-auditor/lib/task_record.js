/**
 * Task Record — capture of what an agent actually did (ADD-ON)
 * ============================================================
 * A governed task used to execute and terminate: nothing captured the steps, gave
 * the run a human name, filed it under a category, or made it reusable. This
 * module records each step AS IT HAPPENS, then names + categorizes the run and
 * saves it — the raw material the Playbook Library turns into something the agent
 * can improve.
 *
 * Add-on module: `task_record` (see lib/feature_modules.js). Disabled by default.
 *
 * Record lifecycle:  recording → completed | failed | abandoned
 * Steps are append-only, each carrying tool, summary, outcome, actor/agent and a
 * timestamp, so a finished record reads as a step-by-step procedure.
 */

const crypto = require('crypto');
const path = require('path');
const { isSupabaseConfigured, insertRow, selectRows, updateRows } = require('./supabase');
const jsonFile = require('./stores/json_file');

const EMPTY = { records: [] };
const STATES = ['recording', 'completed', 'failed', 'abandoned'];

// Category inference from the capability/tool being exercised. Deterministic so a
// record is categorized the same way every time.
const CATEGORY_RULES = [
  { re: /trust|payroll|invoice|payment|billing|refund/i, category: 'Finance & Billing' },
  { re: /matter|legal|clio|case/i, category: 'Legal Operations' },
  { re: /time_off|employee|hr_|gusto|onboard/i, category: 'People & HR' },
  { re: /listing|mls|property|reso/i, category: 'Real Estate' },
  { re: /audit|scan|evaluate|readiness/i, category: 'Systems Evaluation' },
  { re: /email|message|schedule|appointment|calendar/i, category: 'Communications & Scheduling' },
  { re: /connect|connector|integration/i, category: 'Integrations' },
  { re: /ingest|knowledge|document/i, category: 'Knowledge & Documentation' }
];

function inferCategory(seed) {
  const s = String(seed || '');
  const hit = CATEGORY_RULES.find(r => r.re.test(s));
  return hit ? hit.category : 'General Operations';
}

/** Human-readable name from the steps actually performed. */
function inferName({ taskType = null, steps = [] } = {}) {
  const verbs = steps.map(s => String(s.tool || '').replace(/_/g, ' ')).filter(Boolean);
  if (verbs.length) {
    const first = verbs[0];
    const systems = Array.from(new Set(steps.map(s => s.system).filter(Boolean)));
    const sys = systems.length ? ` in ${systems.join(' + ')}` : '';
    return verbs.length === 1
      ? `${first.charAt(0).toUpperCase()}${first.slice(1)}${sys}`
      : `${first.charAt(0).toUpperCase()}${first.slice(1)}${sys} (+${verbs.length - 1} step${verbs.length > 2 ? 's' : ''})`;
  }
  return taskType ? `Run: ${String(taskType).replace(/[._]/g, ' ')}` : 'Untitled task run';
}

function rowToRecord(row) {
  if (!row) return null;
  return {
    id: row.id, taskId: row.task_id, tenantId: row.tenant_id || null,
    name: row.name, category: row.category, taskType: row.task_type || null,
    agentId: row.agent_id || null, hitlId: row.hitl_id || null,
    steps: row.steps || [], status: row.status, outcome: row.outcome || null,
    startedAt: row.started_at, completedAt: row.completed_at || null
  };
}

class TaskRecordStore {
  constructor(options = {}) {
    this.usingSupabase = isSupabaseConfigured();
    this.file = options.file || path.join(__dirname, '..', 'config', 'task_records.json');
  }

  /** Begin recording a run. Name/category may be supplied or inferred at finalize. */
  async start({ taskId, tenantId = null, taskType = null, name = null, category = null, agentId = null, hitlId = null }) {
    if (!taskId) throw new Error('taskId is required to start a task record.');
    const existing = await this.getByTask(taskId);
    if (existing) return existing;
    const now = new Date().toISOString();
    const rec = {
      id: `rec_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      taskId, tenantId, name, category, taskType, agentId, hitlId,
      steps: [], status: 'recording', outcome: null, startedAt: now, completedAt: null
    };
    if (this.usingSupabase) {
      await insertRow('task_records', {
        id: rec.id, task_id: taskId, tenant_id: tenantId, name, category, task_type: taskType,
        agent_id: agentId, hitl_id: hitlId, steps: [], status: 'recording', started_at: now
      });
      return rec;
    }
    return jsonFile.mutate(this.file, EMPTY, (store) => {
      const arr = Array.isArray(store.records) ? store.records : [];
      arr.push(rec);
      return { value: { records: arr }, result: rec };
    });
  }

  /** Append a step as it executes (append-only — a record is a procedure log). */
  async recordStep({ taskId, tool, summary = null, system = null, outcome = 'ok', actor = null, agentId = null }) {
    const rec = await this.getByTask(taskId);
    if (!rec) throw new Error(`No task record for ${taskId} — start() first.`);
    if (rec.status !== 'recording') throw new Error(`Task record for ${taskId} is ${rec.status}; cannot append.`);
    const step = {
      n: (rec.steps || []).length + 1,
      tool, system, summary, outcome, actor, agentId,
      at: new Date().toISOString()
    };
    const steps = (rec.steps || []).concat([step]);
    await this._patch(rec.id, { steps });
    return step;
  }

  /**
   * Close the record: auto-NAME and auto-CATEGORIZE from what was actually done,
   * unless explicitly provided.
   */
  async finalize({ taskId, status = 'completed', outcome = null, name = null, category = null }) {
    if (!STATES.includes(status)) throw new Error(`Invalid record status "${status}".`);
    const rec = await this.getByTask(taskId);
    if (!rec) throw new Error(`No task record for ${taskId}.`);
    const seed = [rec.taskType, ...(rec.steps || []).map(s => s.tool)].join(' ');
    const patch = {
      status,
      outcome,
      name: name || rec.name || inferName({ taskType: rec.taskType, steps: rec.steps }),
      category: category || rec.category || inferCategory(seed),
      completed_at: new Date().toISOString()
    };
    await this._patch(rec.id, patch);
    return this.getByTask(taskId);
  }

  async _patch(id, patch) {
    if (this.usingSupabase) {
      await updateRows('task_records', `id=eq.${encodeURIComponent(id)}`, patch);
      return;
    }
    await jsonFile.mutate(this.file, EMPTY, (store) => {
      const arr = Array.isArray(store.records) ? store.records : [];
      const r = arr.find(x => x.id === id);
      if (r) {
        Object.assign(r, patch);
        if (patch.completed_at) { r.completedAt = patch.completed_at; delete r.completed_at; }
      }
      return { value: { records: arr }, result: r || null };
    });
  }

  async getByTask(taskId) {
    if (this.usingSupabase) {
      const rows = await selectRows('task_records', `task_id=eq.${encodeURIComponent(taskId)}&limit=1`);
      return rowToRecord(rows && rows[0]);
    }
    const store = jsonFile.readSync(this.file, EMPTY);
    return (store.records || []).find(r => r.taskId === taskId) || null;
  }

  async list({ tenantId, category, status } = {}) {
    if (this.usingSupabase) {
      const f = ['select=*', 'order=started_at.desc'];
      if (tenantId) f.push(`tenant_id=eq.${encodeURIComponent(tenantId)}`);
      if (category) f.push(`category=eq.${encodeURIComponent(category)}`);
      if (status) f.push(`status=eq.${encodeURIComponent(status)}`);
      return ((await selectRows('task_records', f.join('&'))) || []).map(rowToRecord);
    }
    const store = jsonFile.readSync(this.file, EMPTY);
    return (store.records || []).filter(r =>
      (tenantId === undefined || r.tenantId === tenantId) &&
      (category === undefined || r.category === category) &&
      (status === undefined || r.status === status));
  }
}

module.exports = { TaskRecordStore, inferName, inferCategory, STATES };
