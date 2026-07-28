/**
 * Human Companion / HR Generalist Agent (Phase 10, HRC)
 * =====================================================
 * The one agent that serves the PERSON, not the business (the human-care plane).
 * It assists employees with PTO, assignment status, manager approvals, complaints
 * /grievances, and work-life balance, mandated to PROTECT THE EMPLOYEE (HRC-01/02).
 *
 * Confidentiality partition (HRC-03/04): personal/HR data is isolated from the
 * business/ops plane. Complaints are confidential by default; a manager view is
 * REDACTED (type + status only, never the private detail); approval workflows
 * route to a manager with least-necessary disclosure, while complaints route to a
 * designated confidential channel rather than a manager.
 *
 * Store: Supabase table `hr_requests` + JSON fallback — a separate partition from
 * the business audit_log.
 */

const crypto = require('crypto');
const path = require('path');
const { isSupabaseConfigured, insertRow, selectRows, updateRows } = require('./supabase');
const jsonFile = require('./stores/json_file');

const TYPES = ['pto', 'assignment_status', 'manager_approval', 'complaint', 'wellbeing'];
const CONFIDENTIAL_TYPES = new Set(['complaint']);
const CLOSED = new Set(['approved', 'denied', 'resolved']);
const EMPTY = { requests: [] };

function rowToReq(row) {
  if (!row) return null;
  return {
    id: row.id, employeeId: row.employee_id, tenantId: row.tenant_id || null,
    type: row.type, detail: row.detail || null, confidential: !!row.confidential,
    status: row.status, assignedManager: row.assigned_manager || null,
    createdAt: row.created_at, updatedAt: row.updated_at
  };
}

class HumanCompanion {
  constructor(options = {}) {
    this.usingSupabase = isSupabaseConfigured();
    this.file = options.file || path.join(__dirname, '..', 'config', 'hr_requests.json');
    // Optional HR system of record (e.g. the Gusto connector). The Companion owns
    // the employee-facing record; filing it into the HR system is a separate,
    // approval-gated step so the human stays in control (HRC-04 + CTL-02).
    this.hrSystem = options.hrSystem || null;
  }

  /** Submit an HR request. Complaints are confidential by default. */
  async submit({ employeeId, type, detail = null, tenantId = null, confidential } = {}) {
    if (!employeeId) throw new Error('employeeId is required.');
    if (!TYPES.includes(type)) throw new Error(`Unknown HR request type "${type}".`);
    const isConfidential = confidential === true || CONFIDENTIAL_TYPES.has(type);
    const now = new Date().toISOString();
    const rec = {
      id: `hr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      employeeId, tenantId, type, detail, confidential: isConfidential,
      status: 'submitted', assignedManager: null, createdAt: now, updatedAt: now
    };
    if (this.usingSupabase) {
      await insertRow('hr_requests', { id: rec.id, employee_id: employeeId, tenant_id: tenantId, type, detail, confidential: isConfidential, status: 'submitted', assigned_manager: null, created_at: now, updated_at: now });
      return rec;
    }
    return jsonFile.mutate(this.file, EMPTY, (store) => {
      const arr = Array.isArray(store.requests) ? store.requests : [];
      arr.push(rec);
      return { value: { requests: arr }, result: rec };
    });
  }

  async get(id) {
    if (this.usingSupabase) {
      const rows = await selectRows('hr_requests', `id=eq.${encodeURIComponent(id)}&limit=1`);
      return rowToReq(rows && rows[0]);
    }
    const store = jsonFile.readSync(this.file, EMPTY);
    return (store.requests || []).find(r => r.id === id) || null;
  }

  /** Employee-owned view: full detail (the employee owns their data). */
  async list({ employeeId, tenantId } = {}) {
    if (this.usingSupabase) {
      const f = ['select=*', 'order=created_at.asc'];
      if (employeeId) f.push(`employee_id=eq.${encodeURIComponent(employeeId)}`);
      if (tenantId) f.push(`tenant_id=eq.${encodeURIComponent(tenantId)}`);
      return ((await selectRows('hr_requests', f.join('&'))) || []).map(rowToReq);
    }
    const store = jsonFile.readSync(this.file, EMPTY);
    return (store.requests || []).filter(r =>
      (employeeId === undefined || r.employeeId === employeeId) &&
      (tenantId === undefined || r.tenantId === tenantId));
  }

  /**
   * Manager view: a confidential request is REDACTED (never the private detail),
   * enforcing the confidentiality partition (HRC-03/04).
   */
  async managerView(id) {
    const r = await this.get(id);
    if (!r) return null;
    if (r.confidential) {
      return { id: r.id, type: r.type, status: r.status, assignedManager: r.assignedManager, confidential: true, detail: '[redacted — confidential HR matter]' };
    }
    return r;
  }

  async _patch(id, patch) {
    if (this.usingSupabase) {
      const rows = await updateRows('hr_requests', `id=eq.${encodeURIComponent(id)}`, Object.assign({ updated_at: new Date().toISOString() }, patch));
      return rowToReq(Array.isArray(rows) ? rows[0] : rows);
    }
    return jsonFile.mutate(this.file, EMPTY, (store) => {
      const arr = Array.isArray(store.requests) ? store.requests : [];
      const r = arr.find(x => x.id === id);
      if (!r) throw new Error(`HR request ${id} not found.`);
      Object.assign(r, patch, { updatedAt: new Date().toISOString() });
      return { value: { requests: arr }, result: { ...r } };
    });
  }

  /**
   * Route an approval (PTO/assignment) to a manager with least-necessary
   * disclosure. A confidential complaint is NOT routed to a manager — it goes to
   * the designated confidential HR channel (HRC-04).
   */
  async routeApproval({ id, managerHitlId }) {
    const r = await this.get(id);
    if (!r) throw new Error(`HR request ${id} not found.`);
    if (r.confidential) throw new Error('A confidential complaint routes to the confidential HR channel, not a manager.');
    return this._patch(id, { assignedManager: managerHitlId || null, status: 'in_review' });
  }

  async setStatus(id, status) {
    return this._patch(id, { status });
  }

  /**
   * File an HR request into the HR system of record (e.g. Gusto) on the
   * employee's behalf. DESTRUCTIVE + approval-gated: refuses without an explicit
   * approval, and refuses confidential complaints outright (a grievance is never
   * auto-filed into payroll/HR software — it goes to the confidential channel).
   */
  async fileWithHrSystem({ id, approved = false, startDate = null, endDate = null, hours = null }) {
    if (!this.hrSystem) throw new Error('No HR system of record is connected.');
    const r = await this.get(id);
    if (!r) throw new Error(`HR request ${id} not found.`);
    if (r.confidential) throw new Error('A confidential complaint is never filed into the HR system — it routes to the confidential HR channel.');
    if (!approved) {
      return { ok: false, requiresApproval: true, id, message: 'Filing into the HR system of record requires explicit human approval.' };
    }
    if (r.type !== 'pto') throw new Error(`Only PTO requests can be filed into the HR system (got "${r.type}").`);
    const filed = await this.hrSystem.submitTimeOffRequest({
      employeeId: r.employeeId, policy: 'Vacation',
      startDate: startDate || r.startDate || null, endDate: endDate || r.endDate || null,
      hours, note: r.detail || null
    });
    await this._patch(id, { status: 'filed', hrSystemRef: (filed.data && filed.data.id) || null, hrSystemSimulated: !!filed.simulated });
    return { ok: true, id, filed };
  }

  /** Work-life-balance signal — the Companion advocates for the employee. */
  async wellbeing({ employeeId } = {}) {
    const reqs = await this.list({ employeeId });
    const open = reqs.filter(r => !CLOSED.has(r.status)).length;
    return {
      employeeId, openRequests: open,
      message: open > 3
        ? 'Several open items — the Companion recommends a check-in and protecting your time off.'
        : 'Your balance looks healthy. The Companion is here whenever you need support.',
      mandate: 'protect the employee'
    };
  }
}

module.exports = { HumanCompanion, TYPES, CONFIDENTIAL_TYPES };
