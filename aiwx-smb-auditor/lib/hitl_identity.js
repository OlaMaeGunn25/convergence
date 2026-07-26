/**
 * HITL Identity & Lifecycle (Phase 0.5)
 * =====================================
 * Every human-in-the-loop is an identifiable, authorized identity bound to a
 * corporate (domain-based) email (IDN), and moves through an onboard → train →
 * active → suspended → offboarded lifecycle driven by the Onboarding agent (HLC).
 * Only an ACTIVE, authorized HITL may approve, confirm, grant autonomy, or
 * exercise control (checked by the tool gate and, later, CHT/CTL/AUT).
 *
 * Mirrors the lib/connection_registry.js store pattern (Supabase table
 * `hitl_users` + JSON fallback). See docs/AGENTIC_OPERATIONS.md (IDN/HLC).
 */

const crypto = require('crypto');
const path = require('path');
const { isSupabaseConfigured, insertRow, selectRows, updateRows } = require('./supabase');
const jsonFile = require('./stores/json_file');

// Free/consumer domains can never be an authorized HITL — corporate identity is
// required for attribution + non-repudiation (IDN-02).
const CONSUMER_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'outlook.com', 'hotmail.com',
  'live.com', 'msn.com', 'aol.com', 'icloud.com', 'me.com', 'mac.com', 'proton.me',
  'protonmail.com', 'gmx.com', 'mail.com', 'yandex.com', 'zoho.com', 'pm.me'
]);

const STATES = ['onboarding', 'trained', 'active', 'suspended', 'offboarded'];
const VALID_TRANSITIONS = {
  onboarding: ['trained', 'offboarded'],
  trained: ['active', 'offboarded'],
  active: ['suspended', 'offboarded'],
  suspended: ['active', 'offboarded'],
  offboarded: []
};
function canTransition(from, to) {
  if (!STATES.includes(to)) return false;
  if (from === to) return true;
  return (VALID_TRANSITIONS[from] || []).includes(to);
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Validate that `email` is a corporate/domain email suitable for an authorized
 * HITL. If `tenantDomain` is supplied, the email domain must match it.
 * @returns { ok:true, domain } | { ok:false, reason }
 */
function validateDomainEmail(email, tenantDomain = null) {
  if (!email || !EMAIL_RE.test(email)) return { ok: false, reason: 'A valid email address is required.' };
  const domain = email.split('@')[1].toLowerCase();
  if (CONSUMER_DOMAINS.has(domain)) {
    return { ok: false, reason: `Consumer email domain "${domain}" cannot be an authorized HITL; a corporate/domain email is required.` };
  }
  if (tenantDomain && domain !== String(tenantDomain).toLowerCase()) {
    return { ok: false, reason: `Email domain "${domain}" does not match the tenant domain "${tenantDomain}".` };
  }
  return { ok: true, domain };
}

function newHitlId() {
  return `hitl_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

const EMPTY = { hitl_users: [] };

function rowToHitl(row) {
  if (!row) return null;
  return {
    id: row.id, email: row.email, domain: row.domain, name: row.name || null,
    tenantId: row.tenant_id || null, authorityLevel: row.authority_level || 'operator',
    status: row.status, createdAt: row.created_at, updatedAt: row.updated_at
  };
}

class HitlRegistry {
  constructor(options = {}) {
    this.usingSupabase = isSupabaseConfigured();
    this.file = options.file || path.join(__dirname, '..', 'config', 'hitl_users.json');
  }

  /** Onboard a HITL (Onboarding agent, HLC-01). Enforces the domain-email rule. */
  async onboard({ email, tenantId = null, name = null, authorityLevel = 'operator', tenantDomain = null }) {
    const v = validateDomainEmail(email, tenantDomain);
    if (!v.ok) throw new Error(v.reason);
    if (!['operator', 'lead'].includes(authorityLevel)) throw new Error(`Invalid authorityLevel "${authorityLevel}".`);
    const now = new Date().toISOString();
    const hitl = {
      id: newHitlId(), email: email.toLowerCase(), domain: v.domain, name,
      tenantId, authorityLevel, status: 'onboarding', createdAt: now, updatedAt: now
    };
    if (this.usingSupabase) {
      const rows = await insertRow('hitl_users', {
        id: hitl.id, email: hitl.email, domain: hitl.domain, name, tenant_id: tenantId,
        authority_level: authorityLevel, status: 'onboarding', created_at: now, updated_at: now
      });
      return rowToHitl(Array.isArray(rows) ? rows[0] : rows) || hitl;
    }
    return jsonFile.mutate(this.file, EMPTY, (store) => {
      const users = Array.isArray(store.hitl_users) ? store.hitl_users : [];
      if (users.some(u => u.email === hitl.email && u.status !== 'offboarded')) {
        throw new Error(`An active HITL already exists for ${hitl.email}.`);
      }
      users.push(hitl);
      return { value: { hitl_users: users }, result: hitl };
    });
  }

  async get(id) {
    if (this.usingSupabase) {
      const rows = await selectRows('hitl_users', `id=eq.${encodeURIComponent(id)}&limit=1`);
      return rowToHitl(rows && rows[0]);
    }
    const store = jsonFile.readSync(this.file, EMPTY);
    return (store.hitl_users || []).find(u => u.id === id) || null;
  }

  async list({ tenantId, status } = {}) {
    if (this.usingSupabase) {
      const filters = ['select=*', 'order=created_at.asc'];
      if (tenantId) filters.push(`tenant_id=eq.${encodeURIComponent(tenantId)}`);
      if (status) filters.push(`status=eq.${encodeURIComponent(status)}`);
      const rows = await selectRows('hitl_users', filters.join('&'));
      return (rows || []).map(rowToHitl);
    }
    const store = jsonFile.readSync(this.file, EMPTY);
    return (store.hitl_users || []).filter(u =>
      (tenantId === undefined || u.tenantId === tenantId) &&
      (status === undefined || u.status === status));
  }

  /** Lifecycle transition (train/activate/suspend/offboard), enforcing HLC. */
  async setStatus(id, toStatus) {
    if (this.usingSupabase) {
      const cur = await this.get(id);
      if (!cur) throw new Error(`HITL ${id} not found.`);
      if (!canTransition(cur.status, toStatus)) throw new Error(`Illegal HITL transition ${cur.status} → ${toStatus}.`);
      const rows = await updateRows('hitl_users', `id=eq.${encodeURIComponent(id)}`,
        { status: toStatus, updated_at: new Date().toISOString() });
      return rowToHitl(Array.isArray(rows) ? rows[0] : rows);
    }
    return jsonFile.mutate(this.file, EMPTY, (store) => {
      const users = Array.isArray(store.hitl_users) ? store.hitl_users : [];
      const u = users.find(x => x.id === id);
      if (!u) throw new Error(`HITL ${id} not found.`);
      if (!canTransition(u.status, toStatus)) throw new Error(`Illegal HITL transition ${u.status} → ${toStatus}.`);
      u.status = toStatus;
      u.updatedAt = new Date().toISOString();
      return { value: { hitl_users: users }, result: { ...u } };
    });
  }

  /** Offboard: terminal — revokes authorization + access (HLC-03). */
  async offboard(id) {
    return this.setStatus(id, 'offboarded');
  }

  /**
   * Authorization check (IDN-03): may this HITL act right now?
   * @returns { ok:true, hitl } | { ok:false, reason }
   */
  async isAuthorized(id) {
    const hitl = await this.get(id);
    if (!hitl) return { ok: false, reason: `Unknown HITL "${id}".` };
    if (hitl.status !== 'active') return { ok: false, reason: `HITL ${id} is ${hitl.status} (not an authorized, active HITL).` };
    return { ok: true, hitl };
  }
}

module.exports = { HitlRegistry, STATES, VALID_TRANSITIONS, canTransition, validateDomainEmail, CONSUMER_DOMAINS };
