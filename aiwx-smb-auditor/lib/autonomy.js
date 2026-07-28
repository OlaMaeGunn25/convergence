/**
 * Autonomy Grants + Compliance Floor (Phase 5b, AUT)
 * ==================================================
 * The HITL lead may grant an explicit, scoped, revocable *autonomy grant* that
 * delegates the per-action approval step for a specific tool or task-type (full
 * automation, AUT-01/02). HITL authority is never removed — trace, provenance,
 * monitoring, and the kill-switch still apply, and grants are revocable at any
 * time, immediately reinstating per-action approval.
 *
 * COMPLIANCE FLOOR (AUT-04): the highest-risk actions (trust/IOLTA, PHI,
 * financial transfers/refunds) remain HITL-gated even under a standard grant —
 * only an *elevated* grant may delegate those.
 *
 * Store: Supabase table `autonomy_grants` + JSON fallback.
 */

const crypto = require('crypto');
const path = require('path');
const { isSupabaseConfigured, insertRow, selectRows, updateRows } = require('./supabase');
const jsonFile = require('./stores/json_file');

const FLOOR_TOOLS = new Set(['clio_record_trust_transaction', 'gusto_run_payroll', 'gusto_terminate_employee']);
// Highest-risk actions: money movement, trust funds, protected health info, and
// payroll/compensation (moves employee money + exposes compensation data).
const FLOOR_PATTERN = /trust|iolta|refund|payment|payout|transfer|wire|phi|payroll|compensation|salary|terminate/i;

function isComplianceFloor(toolName) {
  return FLOOR_TOOLS.has(toolName) || FLOOR_PATTERN.test(String(toolName || ''));
}

const EMPTY = { grants: [] };

function rowToGrant(row) {
  if (!row) return null;
  return {
    id: row.id, tenantId: row.tenant_id || null, hitlId: row.hitl_id,
    scope: row.scope || {}, elevated: !!row.elevated, active: row.active !== false,
    expiresAt: row.expires_at || null, createdAt: row.created_at
  };
}

class AutonomyGrants {
  constructor(options = {}) {
    this.usingSupabase = isSupabaseConfigured();
    this.file = options.file || path.join(__dirname, '..', 'config', 'autonomy_grants.json');
  }

  /** Grant autonomy. Must be authorized by a HITL (hitlId). */
  async grant({ tenantId = null, hitlId, scope = {}, elevated = false, expiresAt = null }) {
    if (!hitlId) throw new Error('An autonomy grant must be authorized by a HITL (hitlId).');
    const now = new Date().toISOString();
    const rec = { id: `grant_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, tenantId, hitlId, scope, elevated: !!elevated, active: true, expiresAt, createdAt: now };
    if (this.usingSupabase) {
      const rows = await insertRow('autonomy_grants', { id: rec.id, tenant_id: tenantId, hitl_id: hitlId, scope, elevated: rec.elevated, active: true, expires_at: expiresAt, created_at: now });
      return rowToGrant(Array.isArray(rows) ? rows[0] : rows) || rec;
    }
    return jsonFile.mutate(this.file, EMPTY, (store) => {
      const arr = Array.isArray(store.grants) ? store.grants : [];
      arr.push(rec);
      return { value: { grants: arr }, result: rec };
    });
  }

  /** Revoke a grant — immediately reinstates per-action approval (AUT-02). */
  async revoke(id) {
    if (this.usingSupabase) {
      const rows = await updateRows('autonomy_grants', `id=eq.${encodeURIComponent(id)}`, { active: false });
      return rowToGrant(Array.isArray(rows) ? rows[0] : rows);
    }
    return jsonFile.mutate(this.file, EMPTY, (store) => {
      const arr = Array.isArray(store.grants) ? store.grants : [];
      const g = arr.find(x => x.id === id);
      if (g) g.active = false;
      return { value: { grants: arr }, result: g ? { ...g } : null };
    });
  }

  async list({ tenantId } = {}) {
    if (this.usingSupabase) {
      const f = ['select=*'];
      if (tenantId) f.push(`tenant_id=eq.${encodeURIComponent(tenantId)}`);
      return ((await selectRows('autonomy_grants', f.join('&'))) || []).map(rowToGrant);
    }
    const store = jsonFile.readSync(this.file, EMPTY);
    return (store.grants || []).filter(g => tenantId === undefined || g.tenantId === tenantId);
  }

  _active(list) {
    const now = new Date().toISOString();
    return list.filter(g => g.active && (!g.expiresAt || g.expiresAt > now));
  }

  /**
   * Does an active grant delegate approval for `toolName` (optionally scoped to a
   * `taskType`)? Compliance-floor actions require an *elevated* grant (AUT-04).
   * @returns { ok:true, grantId } | { ok:false, floor?, reason? }
   */
  async covers({ tenantId = null, toolName, taskType = null }) {
    const floor = isComplianceFloor(toolName);
    // A grant applies only to calls with the SAME tenant scope — a tenant-scoped
    // grant never delegates approval for a different tenant (or a null-tenant call).
    const grants = this._active(await this.list({})).filter(g => (g.tenantId || null) === (tenantId || null));
    const match = grants.find(g => {
      const s = g.scope || {};
      const toolOk = !s.toolName || s.toolName === toolName || s.toolName === '*';
      const typeOk = !s.taskType || s.taskType === taskType || s.taskType === '*';
      return toolOk && typeOk;
    });
    if (!match) return { ok: false, floor };
    if (floor && !match.elevated) {
      return { ok: false, floor: true, reason: 'Compliance-floor action requires explicit approval or an elevated autonomy grant (AUT-04).' };
    }
    return { ok: true, grantId: match.id, elevated: match.elevated };
  }
}

module.exports = { AutonomyGrants, isComplianceFloor, FLOOR_TOOLS, FLOOR_PATTERN };
