/**
 * HITL Primary Chat / Orchestrator Session (Phase 8, CHT)
 * ======================================================
 * The surface where the human directs the Orchestrator. Every HITL prompt is:
 *   1. re-engineered into a TREE-OF-THOUGHT (CHT-02),
 *   2. echoed back as "what the system understood" — the complete interpreted
 *      action plan (CHT-03),
 *   3. shown with its PROJECTED OUTCOMES before anything runs (CHT-04),
 *   4. held as a pending plan that only executes after the HITL CONFIRMS (CHT-05).
 *
 * `interpret()` produces the ToT + understanding + projected outcomes and stores a
 * pending plan; `confirm()` turns a confirmed plan into a governed task (proposed)
 * and records the re-engineered prompt in the attribution log (ATR-01). Execution
 * then flows through the normal approval / autonomy / attestation gates.
 *
 * Store: Supabase table `chat_plans` + JSON fallback.
 */

const crypto = require('crypto');
const path = require('path');
const { isSupabaseConfigured, insertRow, selectRows, updateRows } = require('./supabase');
const jsonFile = require('./stores/json_file');
const taskRequest = require('./task_request');
const industry = require('./industry_practices');
const precommit = require('./precommit');
const { reengineerPrompt } = require('./graph_of_thought');

const EMPTY = { plans: [] };

// Prompt re-engineering is performed by the Graph-of-Thought framework
// (lib/graph_of_thought.js) — see CHT-02. Every prompt from every installation
// passes through it before planning, preview, or execution.

function rowToPlan(row) {
  if (!row) return null;
  return {
    planId: row.id, query: row.query, hitlId: row.hitl_id || null, tenantId: row.tenant_id || null,
    vertical: row.vertical || null, status: row.status, plan: row.plan || {},
    createdAt: row.created_at, updatedAt: row.updated_at
  };
}

class ChatSession {
  constructor(options = {}) {
    this.usingSupabase = isSupabaseConfigured();
    this.file = options.file || path.join(__dirname, '..', 'config', 'chat_plans.json');
    this.connectionRegistry = options.connectionRegistry || null;
    this.taskModel = options.taskModel || null;
    this.attributionLog = options.attributionLog || null;
    this.knowledgeBase = options.knowledgeBase || null;
  }

  /**
   * Interpret a HITL prompt → ToT + understanding + projected outcomes, stored as
   * a pending plan AWAITING confirmation. Nothing executes here.
   */
  async interpret({ query, tenantId = null, hitlId = null, vertical = null }) {
    const interpretation = await taskRequest.interpretRequest({ query, tenantId, connectionRegistry: this.connectionRegistry, knowledgeBase: this.knowledgeBase });
    const top = interpretation.top;
    const knowledgeRefs = interpretation.knowledgeRefs || [];

    // Correlate FIRST so an SOP conflict becomes a real `contradicts` edge in the
    // graph rather than a note appended after the fact.
    const correlation = (top && vertical)
      ? await industry.correlate({ vertical, capability: top.capability, connectorId: top.connectorId, tenantId, knowledgeBase: this.knowledgeBase })
      : null;

    // CHT-02: re-engineer the prompt via the Graph-of-Thought framework.
    const graph = reengineerPrompt({
      query, top, candidates: interpretation.candidates || [], vertical, knowledgeRefs, correlation
    });

    const understanding = {
      interpretedIntent: top ? top.action : null,
      capability: top || null,
      needsDisambiguation: interpretation.needsDisambiguation,
      candidates: interpretation.candidates,
      knowledgeRefs
    };
    const projectedOutcomes = top ? [{
      system: top.system, connectorId: top.connectorId, capability: top.capability,
      type: top.type, destructive: top.type === 'write',
      effect: top.action
    }] : [];

    const now = new Date().toISOString();
    const planBody = { graphOfThought: graph, understanding, projectedOutcomes, correlation, top: top || null };
    const rec = {
      planId: `plan_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      query, hitlId, tenantId, vertical,
      status: understanding.needsDisambiguation ? 'needs_disambiguation' : 'awaiting_confirmation',
      plan: planBody, createdAt: now, updatedAt: now
    };
    if (this.usingSupabase) {
      await insertRow('chat_plans', { id: rec.planId, query, hitl_id: hitlId, tenant_id: tenantId, vertical, status: rec.status, plan: planBody, created_at: now, updated_at: now });
    } else {
      await jsonFile.mutate(this.file, EMPTY, (store) => {
        const arr = Array.isArray(store.plans) ? store.plans : [];
        arr.push(rec);
        return { value: { plans: arr }, result: rec };
      });
    }
    return rec;
  }

  async getPlan(planId) {
    if (this.usingSupabase) {
      const rows = await selectRows('chat_plans', `id=eq.${encodeURIComponent(planId)}&limit=1`);
      return rowToPlan(rows && rows[0]);
    }
    const store = jsonFile.readSync(this.file, EMPTY);
    return (store.plans || []).find(p => p.planId === planId) || null;
  }

  async _setStatus(planId, status) {
    if (this.usingSupabase) {
      await updateRows('chat_plans', `id=eq.${encodeURIComponent(planId)}`, { status, updated_at: new Date().toISOString() });
      return;
    }
    await jsonFile.mutate(this.file, EMPTY, (store) => {
      const arr = Array.isArray(store.plans) ? store.plans : [];
      const p = arr.find(x => x.planId === planId);
      if (p) { p.status = status; p.updatedAt = new Date().toISOString(); }
      return { value: { plans: arr }, result: p || null };
    });
  }

  /**
   * Confirm a pending plan (CHT-05): create the governed task (proposed) and
   * record the re-engineered prompt in the attribution log (ATR-01). The task then
   * flows through the normal approval / autonomy / attestation gates.
   */
  async confirm({ planId, hitlId = null, actor = null }) {
    const plan = await this.getPlan(planId);
    if (!plan) throw new Error(`Chat plan ${planId} not found.`);
    if (plan.status === 'confirmed') throw new Error(`Chat plan ${planId} is already confirmed.`);
    if (plan.status === 'needs_disambiguation' || !plan.plan.top) {
      throw new Error('This request needs disambiguation before it can be confirmed.');
    }
    const top = plan.plan.top;

    // Pre-commit checks-and-balances at the commit boundary (NEG-02/03): an
    // independent review must pass before the action is committed to a task.
    const review = await precommit.review({
      tenantId: plan.tenantId, vertical: plan.vertical,
      connectorId: top.connectorId, capability: top.capability, toolName: top.capability,
      connectionRegistry: this.connectionRegistry, approved: false
    });
    if (!review.ok) {
      await this._setStatus(planId, 'blocked_precommit');
      return { confirmed: false, routeToHitl: true, planId, review };
    }

    let task = null;
    if (this.taskModel) {
      task = await this.taskModel.create({
        type: `chat.${top.connectorId}.${top.capability}`,
        payload: { source: 'hitl_chat', query: plan.query, connectorId: top.connectorId, capability: top.capability, type: top.type },
        tenantId: plan.tenantId, actor: actor || hitlId || null
      });
    }
    const attributionHitl = hitlId || plan.hitlId;
    if (this.attributionLog && attributionHitl) {
      await this.attributionLog.recordPrompt({
        hitlId: attributionHitl, taskId: task ? task.id : null,
        content: { query: plan.query, graphOfThought: plan.plan.graphOfThought, understanding: plan.plan.understanding },
        summary: `HITL chat: ${plan.query}`
      });
    }
    await this._setStatus(planId, 'confirmed');
    return { confirmed: true, planId, task, review };
  }
}

module.exports = { ChatSession };
