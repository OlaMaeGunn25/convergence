/**
 * Orchestrator (Phase 3)
 * ======================
 * Drives work through the task-model spine (Phase 1) using the tool registry
 * (Phase 2). One loop:
 *
 *   claimNext() a ready task  →  invoke its tool  →  write result + transition
 *   (approved → executing → done/failed), then dependent tasks become claimable.
 *
 * Human-in-the-loop is enforced structurally, in ONE place:
 *   - submit() routes a task to `pending_approval` when its tool is annotated
 *     requiresApproval (destructive), and only auto-approves non-destructive
 *     tools. A destructive task therefore cannot execute until a human moves it
 *     to `approved`.
 *   - Reaching the `approved`/`executing` state IS the human sign-off, so the
 *     orchestrator invokes with { approved: true }.
 *
 * Negotiation-as-a-strategy: submit(..., { strategy: 'negotiate' }) first runs
 * the Proposer/Critic/Arbiter loop; consensus auto-approves the task, otherwise
 * it is left in pending_approval for a human (matching the negotiation engine's
 * own high-risk escalation).
 *
 * The engine is deliberately transport-agnostic — start()/stop() provide the
 * interval loop, but wiring it into the gateway is done separately.
 */

const { TaskModel } = require('./task_model');
const defaultRegistry = require('./tool_registry');
const { negotiate } = require('./negotiation');

// task.type → registry tool name. task.payload is the tool input.
const TYPE_TO_TOOL = {
  audit: 'run_audit',
  scholar: 'search_scholar',
  negotiate: 'negotiate',
  publish: 'publish_post',
  crm_export: 'export_crm'
};

class Orchestrator {
  constructor(options = {}) {
    this.taskModel = options.taskModel || new TaskModel();
    this.registry = options.registry || defaultRegistry;
    this.typeMap = options.typeMap || TYPE_TO_TOOL;
    this._timer = null;
  }

  toolNameFor(type) {
    return this.typeMap[type] || null;
  }

  /**
   * Submit new work. Creates a Task, then routes it: destructive tools wait in
   * pending_approval for a human; non-destructive tools are auto-approved and
   * become immediately claimable. With { strategy: 'negotiate' }, a negotiation
   * decides whether to auto-approve.
   */
  async submit({ type, payload = {}, actor = null, tenantId = null, dependsOn = [], strategy = null }) {
    const toolName = this.toolNameFor(type);
    const tool = toolName ? this.registry.get(toolName) : null;

    const task = await this.taskModel.create({ type, payload, actor, tenantId, dependsOn });

    if (strategy === 'negotiate') {
      await this.taskModel.transition(task.id, 'negotiating', { actor });
      const outcome = await negotiate({ topic: payload.topic || `Execute ${type}`, context: payload.context, vertical: payload.vertical });
      await this.taskModel.transition(task.id, 'pending_approval', { actor: 'negotiator', result: { negotiation: outcome } });
      if (outcome.outcome === 'approved') {
        await this.taskModel.transition(task.id, 'approved', { actor: 'negotiator' });
      }
      return this.taskModel.get(task.id);
    }

    await this.taskModel.transition(task.id, 'pending_approval', { actor });
    // Auto-approve only what is safe to run unattended.
    if (!tool || !tool.annotations.requiresApproval) {
      await this.taskModel.transition(task.id, 'approved', { actor: 'orchestrator' });
    }
    return this.taskModel.get(task.id);
  }

  /** Execute one claimed (executing) task: invoke its tool, then transition. */
  async processTask(task) {
    const toolName = this.toolNameFor(task.type);
    try {
      if (!toolName) throw new Error(`No tool mapped for task type "${task.type}".`);
      // Reaching 'executing' means the task was approved — authorize the call.
      const res = await this.registry.invoke(toolName, task.payload || {}, { actor: task.actor, approved: true });
      if (res.ok === false) {
        return this.taskModel.transition(task.id, 'failed', { result: res });
      }
      return this.taskModel.transition(task.id, 'done', { result: res.result });
    } catch (err) {
      return this.taskModel.transition(task.id, 'failed', { result: { error: err.message } });
    }
  }

  /** Claim and process the next ready task; returns the updated task or null. */
  async tick(opts = {}) {
    const claimed = await this.taskModel.claimNext(opts);
    if (!claimed) return null;
    return this.processTask(claimed);
  }

  /** Process ready tasks until the queue drains (bounded). Returns processed tasks. */
  async drain(opts = {}, max = 500) {
    const processed = [];
    for (let i = 0; i < max; i++) {
      const t = await this.tick(opts);
      if (!t) break;
      processed.push(t);
    }
    return processed;
  }

  /** Start the background loop (not auto-wired into the gateway). */
  start(intervalMs = 5000, opts = {}) {
    if (this._timer) return;
    this._timer = setInterval(() => {
      this.tick(opts).catch(() => { /* per-tick errors already mark the task failed */ });
    }, intervalMs);
    if (this._timer.unref) this._timer.unref();
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }
}

module.exports = { Orchestrator, TYPE_TO_TOOL };
