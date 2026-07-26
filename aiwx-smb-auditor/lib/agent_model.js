/**
 * Agent Model — the roster spine of the Agentic Operations Layer (Phase 0)
 * =======================================================================
 * A first-class Agent entity: a focused, governed worker provisioned per tenant
 * and vertical (see docs/AGENTIC_OPERATIONS.md). Mirrors the lib/task_model.js +
 * lib/connection_registry.js store pattern (Supabase table `agents` in
 * production, a process-locked JSON file in dev/CI) so the two paths never drift.
 *
 * Lifecycle state machine:
 *   provisioned → configuring → training → ready → active
 *                                              ↕ paused
 *                                              ↘ shutdown (terminal → re-provision)
 * `ready → active` is the HITL go-live gate (ONB-05). `paused`/`shutdown` are the
 * kill-switch (CTL-04/05): a paused or shutdown agent is refused at the tool gate.
 */

const crypto = require('crypto');
const path = require('path');
const { isSupabaseConfigured, insertRow, selectRows, updateRows } = require('./supabase');
const jsonFile = require('./stores/json_file');
const roster = require('./agent_roster');

const STATES = ['provisioned', 'configuring', 'training', 'ready', 'active', 'paused', 'shutdown'];
const TERMINAL = new Set(['shutdown']);
// A paused or shutdown agent cannot invoke tools; only `active` and `ready`
// agents are "live" (ready can run read-only setup; operating work needs active).
const LIVE = new Set(['ready', 'active']);

const VALID_TRANSITIONS = {
  provisioned: ['configuring', 'shutdown'],
  configuring: ['training', 'provisioned', 'shutdown'],
  training: ['ready', 'configuring', 'shutdown'],
  ready: ['active', 'configuring', 'shutdown'],
  active: ['paused', 'ready', 'shutdown'],
  paused: ['active', 'shutdown'],
  shutdown: []
};

function canTransition(from, to) {
  if (!STATES.includes(to)) return false;
  if (from === to) return true;
  return (VALID_TRANSITIONS[from] || []).includes(to);
}

function newAgentId() {
  return `agent_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

const EMPTY = { agents: [] };

function rowToAgent(row) {
  if (!row) return null;
  return {
    id: row.id,
    role: row.role,
    tenantId: row.tenant_id || null,
    vertical: row.vertical || null,
    plane: row.plane || null,
    scopeConnectors: row.scope_connectors || [],
    boundTools: row.bound_tools || [],
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

class AgentRegistry {
  constructor(options = {}) {
    this.usingSupabase = isSupabaseConfigured();
    this.file = options.file || path.join(__dirname, '..', 'config', 'agents.json');
  }

  /** Provision a single agent for a role (defaults to `provisioned`). */
  async provision({ role, tenantId = null, vertical = null, scopeConnectors = [], status = 'provisioned' }) {
    if (!roster.isRole(role)) throw new Error(`Unknown agent role "${role}".`);
    if (!STATES.includes(status)) throw new Error(`Invalid initial status "${status}".`);
    const now = new Date().toISOString();
    const def = roster.ROLES[role];
    const agent = {
      id: newAgentId(), role, tenantId, vertical, plane: def.plane,
      scopeConnectors, boundTools: def.tools.slice(), status,
      createdAt: now, updatedAt: now
    };

    if (this.usingSupabase) {
      const rows = await insertRow('agents', {
        id: agent.id, role, tenant_id: tenantId, vertical, plane: def.plane,
        scope_connectors: scopeConnectors, bound_tools: agent.boundTools,
        status, created_at: now, updated_at: now
      });
      return rowToAgent(Array.isArray(rows) ? rows[0] : rows) || agent;
    }
    return jsonFile.mutate(this.file, EMPTY, (store) => {
      const agents = Array.isArray(store.agents) ? store.agents : [];
      agents.push(agent);
      return { value: { agents }, result: agent };
    });
  }

  /**
   * Provision the FULL roster (13 roles) for a tenant/vertical — the "team per
   * instance/vertical" (AGT-07). Idempotent per (tenant, role): re-provisioning
   * returns the existing agents rather than duplicating.
   */
  async provisionRoster({ tenantId = null, vertical = null, scopeConnectors = [] }) {
    const existing = await this.list({ tenantId });
    const have = new Set(existing.map(a => a.role));
    const created = [];
    for (const role of roster.ROLE_IDS) {
      if (have.has(role)) continue;
      created.push(await this.provision({ role, tenantId, vertical, scopeConnectors }));
    }
    return this.list({ tenantId });
  }

  async get(id) {
    if (this.usingSupabase) {
      const rows = await selectRows('agents', `id=eq.${encodeURIComponent(id)}&limit=1`);
      return rowToAgent(rows && rows[0]);
    }
    const store = jsonFile.readSync(this.file, EMPTY);
    return (store.agents || []).find(a => a.id === id) || null;
  }

  async list({ tenantId, role, vertical } = {}) {
    if (this.usingSupabase) {
      const filters = ['select=*', 'order=created_at.asc'];
      if (tenantId) filters.push(`tenant_id=eq.${encodeURIComponent(tenantId)}`);
      if (role) filters.push(`role=eq.${encodeURIComponent(role)}`);
      if (vertical) filters.push(`vertical=eq.${encodeURIComponent(vertical)}`);
      const rows = await selectRows('agents', filters.join('&'));
      return (rows || []).map(rowToAgent);
    }
    const store = jsonFile.readSync(this.file, EMPTY);
    return (store.agents || []).filter(a =>
      (tenantId === undefined || a.tenantId === tenantId) &&
      (role === undefined || a.role === role) &&
      (vertical === undefined || a.vertical === vertical));
  }

  /** Move an agent to a new lifecycle state, enforcing the state machine. */
  async transition(id, toStatus, { actor = null } = {}) {
    if (this.usingSupabase) {
      const current = await this.get(id);
      if (!current) throw new Error(`Agent ${id} not found.`);
      if (!canTransition(current.status, toStatus)) {
        throw new Error(`Illegal agent transition ${current.status} → ${toStatus} for ${id}.`);
      }
      const rows = await updateRows('agents', `id=eq.${encodeURIComponent(id)}`,
        { status: toStatus, updated_at: new Date().toISOString() });
      return rowToAgent(Array.isArray(rows) ? rows[0] : rows);
    }
    return jsonFile.mutate(this.file, EMPTY, (store) => {
      const agents = Array.isArray(store.agents) ? store.agents : [];
      const a = agents.find(x => x.id === id);
      if (!a) throw new Error(`Agent ${id} not found.`);
      if (!canTransition(a.status, toStatus)) {
        throw new Error(`Illegal agent transition ${a.status} → ${toStatus} for ${id}.`);
      }
      a.status = toStatus;
      a.updatedAt = new Date().toISOString();
      return { value: { agents }, result: { ...a } };
    });
  }

  /**
   * Governance check used by the tool-registry gate: may `agent` invoke
   * `toolName` right now? Enforces (1) live status (not paused/shutdown), and
   * (2) least-privilege role→tool binding (AGT-03/CTL-05).
   * Connector-scope enforcement is added in Phase 3.
   * @returns { ok:true } | { ok:false, reason }
   */
  async mayInvoke(agentId, toolName) {
    const agent = await this.get(agentId);
    if (!agent) return { ok: false, reason: `Unknown agent "${agentId}".` };
    if (!LIVE.has(agent.status)) return { ok: false, reason: `Agent ${agentId} is ${agent.status} (not live).` };
    if (!roster.roleAllowsTool(agent.role, toolName)) {
      return { ok: false, reason: `Role "${agent.role}" is not permitted to invoke "${toolName}".` };
    }
    return { ok: true };
  }
}

module.exports = { AgentRegistry, STATES, TERMINAL, LIVE, VALID_TRANSITIONS, canTransition, newAgentId };
