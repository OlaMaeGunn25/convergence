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
const featureModules = require('./feature_modules');

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
    // Optional add-ons. When absent (or unlicensed) the orchestrator behaves
    // exactly as before — recording and learning are strictly additive.
    this.taskRecords = options.taskRecords || null;
    this.playbooks = options.playbooks || null;
    this.modules = options.modules || null; // tenant licence, e.g. ['task_record']
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

  /**
   * Whether step-by-step recording should run for this task. Entirely gated on the
   * `task_record` add-on, so an unlicensed tenant sees the original behaviour.
   */
  _recordingEnabled(task) {
    if (!this.taskRecords) return false;
    return featureModules.isEnabled('task_record', { modules: this.modulesFor(task) });
  }

  /** Per-tenant licence lookup. Override to read modules from the tenant token. */
  modulesFor() {
    return this.modules || null;
  }

  /**
   * Execute one claimed (executing) task: invoke its tool, then transition.
   *
   * When the `task_record` add-on is licensed, the run is recorded automatically —
   * the step is captured as it executes and the record is finalized (auto-named +
   * auto-categorized) on completion or failure. With `playbook_library` also
   * licensed, a successful run is promoted to a playbook, or improves the existing
   * one, so institutional memory compounds without anyone invoking it by hand.
   * Recording NEVER changes task outcome: any recorder error is swallowed.
   */
  async processTask(task) {
    const toolName = this.toolNameFor(task.type);
    const recording = this._recordingEnabled(task);

    if (recording) {
      try {
        await this.taskRecords.start({
          taskId: task.id, tenantId: task.tenantId || null, taskType: task.type,
          agentId: task.agentId || null, hitlId: task.actor || null
        });
      } catch (e) { /* recording must never block execution */ }
    }

    try {
      if (!toolName) throw new Error(`No tool mapped for task type "${task.type}".`);
      // Reaching 'executing' means the task was approved — authorize the call.
      const res = await this.registry.invoke(toolName, task.payload || {}, { actor: task.actor, approved: true });

      if (recording) {
        try {
          await this.taskRecords.recordStep({
            taskId: task.id, tool: toolName,
            system: (task.payload && task.payload.connectorId) || null,
            summary: `Executed ${toolName} for ${task.type}`,
            outcome: res.ok === false ? 'failed' : 'ok',
            actor: task.actor || null
          });
        } catch (e) { /* non-fatal */ }
      }

      if (res.ok === false) {
        if (recording) await this._finalizeRecord(task, 'failed', res, false);
        return this.taskModel.transition(task.id, 'failed', { result: res });
      }
      if (recording) await this._finalizeRecord(task, 'completed', res.result, true);
      return this.taskModel.transition(task.id, 'done', { result: res.result });
    } catch (err) {
      if (recording) await this._finalizeRecord(task, 'failed', { error: err.message }, false);
      return this.taskModel.transition(task.id, 'failed', { result: { error: err.message } });
    }
  }

  /** Close the record and, when licensed, compound it into the playbook library. */
  async _finalizeRecord(task, status, outcome, succeeded) {
    let record = null;
    try {
      record = await this.taskRecords.finalize({
        taskId: task.id, status,
        outcome: typeof outcome === 'string' ? outcome : JSON.stringify(outcome || null).slice(0, 500)
      });
    } catch (e) { return; }

    if (!this.playbooks) return;
    if (!featureModules.isEnabled('playbook_library', { modules: this.modulesFor(task) })) return;
    try {
      const existing = await this.playbooks.findForTask({ tenantId: task.tenantId || null, taskType: task.type });
      if (existing) {
        // The agent learns from every run — success or failure.
        await this.playbooks.improve({
          playbookId: existing.id,
          reason: succeeded ? 'optimization' : 'step_failure',
          note: succeeded ? null : 'Run failed; procedure needs review.',
          agentId: task.agentId || null, succeeded
        });
      } else if (succeeded && record && record.status === 'completed') {
        await this.playbooks.saveFromRecord(record, { ownerAgentId: task.agentId || null });
      }
    } catch (e) { /* learning is best-effort; never fail a task for it */ }
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
