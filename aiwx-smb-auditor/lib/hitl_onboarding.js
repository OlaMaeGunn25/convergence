/**
 * HITL Onboarding Instance (HLC-01/02 + upskilling assignment)
 * ============================================================
 * HITLs are assigned in TWO ways, both through this one instance so they cannot
 * drift apart:
 *
 *   source: 'installation' — HITLs supplied when the company installs
 *                            CONVERGENCE-Ai (Installation.install()).
 *   source: 'post_install' — a SEPARATE HITL onboarding instance opened at any
 *                            time afterwards to add more HITLs.
 *
 * Each onboarded HITL is: identity-verified (corporate domain email, IDN-02),
 * created in the HITL lifecycle (HLC-01), and ENROLLED in their ROLE's upskilling
 * curriculum so they can train through the Human Companion immediately.
 *
 * Enrolment is keyed on the ROLE, so no personal training profile is created on
 * the business plane for anyone — which is what allows every HITL, added at any
 * time, to upskill with zero personal-data leakage.
 */

const crypto = require('crypto');
const path = require('path');
const { isSupabaseConfigured, insertRow, selectRows } = require('./supabase');
const jsonFile = require('./stores/json_file');

const SOURCES = ['installation', 'post_install'];
const EMPTY = { instances: [] };

class HitlOnboarding {
  constructor(options = {}) {
    this.usingSupabase = isSupabaseConfigured();
    this.file = options.file || path.join(__dirname, '..', 'config', 'hitl_onboarding.json');
    this.hitlRegistry = options.hitlRegistry || null;
    this.enrollment = options.enrollment || null;
  }

  /**
   * Open an onboarding instance and onboard a batch of HITLs.
   * @param hitls [{ email, name?, role?, authorityLevel? }]
   * @returns { instanceId, source, onboarded[], failed[] }
   */
  async onboardHitls({ tenantId = null, hitls = [], tenantDomain = null, source = 'post_install', actor = null }) {
    if (!SOURCES.includes(source)) throw new Error(`Invalid onboarding source "${source}".`);
    if (!this.hitlRegistry) throw new Error('A HITL registry is required to onboard HITLs.');

    const instanceId = `hob_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();
    const onboarded = [];
    const failed = [];

    for (const h of hitls) {
      try {
        const hitl = await this.hitlRegistry.onboard({
          email: h.email, tenantId, name: h.name || null,
          authorityLevel: h.authorityLevel || 'operator', tenantDomain
        });
        // Assign the role-keyed curriculum immediately (HLC-02: train each HITL).
        let enrolled = null;
        if (this.enrollment) {
          enrolled = await this.enrollment.enroll({ hitlId: hitl.id, role: h.role || 'general' });
        }
        onboarded.push({ hitlId: hitl.id, email: hitl.email, role: h.role || 'general', status: hitl.status, enrolled: !!enrolled });
      } catch (e) {
        // Never leak why beyond the identity rule that failed.
        failed.push({ email: h.email, reason: e.message });
      }
    }

    const record = { instanceId, tenantId, source, actor, onboarded: onboarded.length, failed: failed.length, openedAt: now };
    if (this.usingSupabase) {
      await insertRow('hitl_onboarding_instances', {
        id: instanceId, tenant_id: tenantId, source, actor,
        onboarded_count: onboarded.length, failed_count: failed.length, opened_at: now
      });
    } else {
      await jsonFile.mutate(this.file, EMPTY, (store) => {
        const arr = Array.isArray(store.instances) ? store.instances : [];
        arr.push(record);
        return { value: { instances: arr }, result: record };
      });
    }
    return { instanceId, source, onboarded, failed, tenantId };
  }

  /** List onboarding INSTANCES (counts only — never per-person training data). */
  async listInstances({ tenantId } = {}) {
    if (this.usingSupabase) {
      const f = ['select=*', 'order=opened_at.desc'];
      if (tenantId) f.push(`tenant_id=eq.${encodeURIComponent(tenantId)}`);
      return (await selectRows('hitl_onboarding_instances', f.join('&'))) || [];
    }
    const store = jsonFile.readSync(this.file, EMPTY);
    return (store.instances || []).filter(i => tenantId === undefined || i.tenantId === tenantId);
  }
}

module.exports = { HitlOnboarding, SOURCES };
