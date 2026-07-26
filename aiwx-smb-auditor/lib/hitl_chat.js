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

const EMPTY = { plans: [] };

function treeOfThought(query, top, vertical) {
  return {
    root: `Fulfill the request: "${query}"`,
    branches: [
      { thought: 'Understand the request', detail: top ? `Interpreted intent: ${top.action}.` : 'Intent is unclear — human disambiguation needed.' },
      { thought: 'Locate the capability', detail: top ? `Matched connected capability "${top.capability}" on ${top.system} (confidence ${top.confidence}).` : 'No connected system exposes a matching capability.' },
      { thought: 'Apply governing practice + SOP', detail: top ? `Governed by ${vertical || 'general'} industry practice + the company SOP.` : 'n/a' },
      { thought: 'Assess risk', detail: top ? (top.type === 'write' ? 'Write/destructive action — requires HITL confirmation (or an autonomy grant + compliance floor check).' : 'Read-only action — low risk.') : 'n/a' },
      { thought: 'Project the outcome', detail: top ? `Will ${top.action}.` : 'Cannot proceed until a valid capability is identified.' }
    ]
  };
}

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
  }

  /**
   * Interpret a HITL prompt → ToT + understanding + projected outcomes, stored as
   * a pending plan AWAITING confirmation. Nothing executes here.
   */
  async interpret({ query, tenantId = null, hitlId = null, vertical = null }) {
    const interpretation = await taskRequest.interpretRequest({ query, tenantId, connectionRegistry: this.connectionRegistry });
    const top = interpretation.top;
    const tot = treeOfThought(query, top, vertical);
    const understanding = {
      interpretedIntent: top ? top.action : null,
      capability: top || null,
      needsDisambiguation: interpretation.needsDisambiguation,
      candidates: interpretation.candidates
    };
    const projectedOutcomes = top ? [{
      system: top.system, connectorId: top.connectorId, capability: top.capability,
      type: top.type, destructive: top.type === 'write',
      effect: top.action
    }] : [];
    const correlation = (top && vertical)
      ? await industry.correlate({ vertical, capability: top.capability, connectorId: top.connectorId, tenantId })
      : null;

    const now = new Date().toISOString();
    const planBody = { treeOfThought: tot, understanding, projectedOutcomes, correlation, top: top || null };
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
        content: { query: plan.query, treeOfThought: plan.plan.treeOfThought, understanding: plan.plan.understanding },
        summary: `HITL chat: ${plan.query}`
      });
    }
    await this._setStatus(planId, 'confirmed');
    return { confirmed: true, planId, task };
  }
}

module.exports = { ChatSession, treeOfThought };
