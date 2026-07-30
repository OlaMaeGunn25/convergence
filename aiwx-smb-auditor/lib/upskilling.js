/**
 * Upskilling Module — Companion-delivered, ZERO personal-data leakage
 * ===================================================================
 * The upskilling module is split along the plane boundary so that no personal
 * training data can reach the business plane by ANY path:
 *
 *   ROLE-KEYED CURRICULUM  (this half, business-safe)
 *     Generic role archetypes → modules, skills, a 90-day timeline. Contains NO
 *     person, no tenant, no company-specific assessment — it is derived from role
 *     archetypes, not from a given company's audit. Safe to read anywhere.
 *
 *   PERSON-KEYED ENROLLMENT + PROGRESS  (UpskillingEnrollment, human-care plane)
 *     Who is enrolled, what they completed, when. Stored in the human-care
 *     partition and reachable ONLY through the Human Companion.
 *
 * The two halves join on the ROLE, never on the person — which is what lets every
 * HITL upskill without the business plane ever holding a personal training record.
 *
 * HARD-WIRED ZERO OUTBOUND (the strongest option, deliberately chosen):
 *   There is NO aggregate, roll-up, cohort, count, or export function in this
 *   module. Every read of person-keyed data REQUIRES a hitlId and returns only
 *   that one person's record. Absence of the code path — not redaction — is the
 *   guarantee, so leakage cannot be reintroduced by a config flag.
 */

const path = require('path');
const crypto = require('crypto');
const { isSupabaseConfigured, insertRow, selectRows, updateRows } = require('./supabase');
const jsonFile = require('./stores/json_file');

// ── ROLE-KEYED CURRICULUM (no PII, no tenant, no company assessment) ──────────
const CURRICULA = {
  'operations': {
    role: 'Operations', hitlTarget: 'AI-Enabled Operations Director',
    modules: [
      { id: 'ops-1', title: 'Working with an AI operations agent', hours: 3 },
      { id: 'ops-2', title: 'Validating agent output (HITL review)', hours: 4 },
      { id: 'ops-3', title: 'Exception handling + escalation', hours: 3 },
      { id: 'ops-4', title: 'Process mapping for automation', hours: 4 }
    ],
    skills: ['AI output validation', 'Exception triage', 'Process mapping', 'Prompt basics']
  },
  'customer_support': {
    role: 'Customer Support', hitlTarget: 'AI Helpdesk Trainer & Live Escalator',
    modules: [
      { id: 'cs-1', title: 'Training a helpdesk agent on your knowledge base', hours: 3 },
      { id: 'cs-2', title: 'Live escalation + handoff patterns', hours: 3 },
      { id: 'cs-3', title: 'Quality review of AI responses', hours: 4 }
    ],
    skills: ['Knowledge-base curation', 'Escalation judgement', 'Response QA']
  },
  'billing': {
    role: 'Billing & Finance', hitlTarget: 'AI Billing Lifecycle Manager',
    modules: [
      { id: 'bil-1', title: 'Reviewing automated billing runs', hours: 3 },
      { id: 'bil-2', title: 'Variance detection + approval gates', hours: 4 },
      { id: 'bil-3', title: 'Financial controls with AI in the loop', hours: 4 }
    ],
    skills: ['Variance analysis', 'Approval discipline', 'Financial controls']
  },
  'front_desk': {
    role: 'Front Desk / Intake', hitlTarget: 'Digital Operations Coordinator',
    modules: [
      { id: 'fd-1', title: 'AI intake + scheduling assistants', hours: 3 },
      { id: 'fd-2', title: 'Confirming and correcting agent bookings', hours: 3 }
    ],
    skills: ['Intake validation', 'Scheduling oversight']
  },
  'administration': {
    role: 'Administration', hitlTarget: 'AI Operations Director',
    modules: [
      { id: 'adm-1', title: 'Delegating admin work to agents', hours: 3 },
      { id: 'adm-2', title: 'Reviewing drafts + documents', hours: 3 },
      { id: 'adm-3', title: 'Governance basics: approvals + audit', hours: 3 }
    ],
    skills: ['Delegation', 'Document review', 'Governance literacy']
  },
  'general': {
    role: 'General (all HITLs)', hitlTarget: 'Human-in-the-Loop Operator',
    modules: [
      { id: 'gen-1', title: 'What human-in-the-loop means here', hours: 2 },
      { id: 'gen-2', title: 'Reading a graph-of-thought plan before you confirm', hours: 2 },
      { id: 'gen-3', title: 'Approvals, autonomy grants + the compliance floor', hours: 3 },
      { id: 'gen-4', title: 'Course-correct, cancel, shut down: your controls', hours: 2 }
    ],
    skills: ['Confirm-before-act discipline', 'Reading agent plans', 'Using HITL controls']
  }
};

/** Normalize any free-text role to a curriculum key (role-level only). */
function curriculumKeyForRole(role) {
  const r = String(role || '').toLowerCase();
  if (/support|helpdesk|service/.test(r)) return 'customer_support';
  if (/bill|financ|account|payroll/.test(r)) return 'billing';
  if (/front desk|reception|intake/.test(r)) return 'front_desk';
  if (/admin|assistant|coordinator/.test(r)) return 'administration';
  if (/ops|operation|manager|director/.test(r)) return 'operations';
  return 'general';
}

/** 90-day timeline template — role-level, identical for everyone in that role. */
function timelineFor(modules) {
  return [
    { window: 'Days 1-30', focus: 'Foundations', modules: modules.slice(0, 2).map(m => m.id) },
    { window: 'Days 31-60', focus: 'Supervised practice', modules: modules.slice(2, 4).map(m => m.id) },
    { window: 'Days 61-90', focus: 'Independent HITL operation', modules: modules.slice(4).map(m => m.id) }
  ];
}

/**
 * Role-keyed curriculum. Business-safe: no person, no tenant, no assessment.
 * Every HITL in a role receives the SAME curriculum — which is exactly why no
 * personal profile is needed to enrol.
 */
function curriculumForRole(role) {
  const key = curriculumKeyForRole(role);
  const c = CURRICULA[key];
  const general = CURRICULA.general;
  // Everyone gets the general HITL curriculum plus their role track.
  const modules = key === 'general' ? general.modules : general.modules.concat(c.modules);
  return {
    curriculumKey: key, role: c.role, hitlTarget: c.hitlTarget,
    modules, skills: c.skills, totalHours: modules.reduce((n, m) => n + m.hours, 0),
    timeline: timelineFor(modules),
    personalData: false // structural assertion: this half never carries PII
  };
}

function listCurricula() {
  return Object.keys(CURRICULA).map(k => {
    const c = curriculumForRole(CURRICULA[k].role);
    return { curriculumKey: k, role: c.role, hitlTarget: c.hitlTarget, moduleCount: c.modules.length, totalHours: c.totalHours };
  });
}

// ── PERSON-KEYED ENROLLMENT + PROGRESS (human-care partition) ─────────────────
const EMPTY = { enrollments: [] };

function rowToEnrollment(row) {
  if (!row) return null;
  return {
    id: row.id, hitlId: row.hitl_id, role: row.role, curriculumKey: row.curriculum_key,
    completedModules: row.completed_modules || [], status: row.status,
    enrolledAt: row.enrolled_at, updatedAt: row.updated_at
  };
}

/**
 * The employee's training record. Lives ONLY in the human-care partition.
 *
 * NOTE the deliberate absence: there is no list-all, no count, no cohort, no
 * aggregate, no export-for-business method anywhere in this class. Every accessor
 * takes a hitlId and returns exactly one person's record.
 */
class UpskillingEnrollment {
  constructor(options = {}) {
    this.usingSupabase = isSupabaseConfigured();
    this.file = options.file || path.join(__dirname, '..', 'config', 'upskilling_enrollment.json');
  }

  /** Enrol a HITL using only their ROLE — no personal profile required. */
  async enroll({ hitlId, role = 'general' }) {
    if (!hitlId) throw new Error('hitlId is required to enrol.');
    const existing = await this.myRecord({ hitlId });
    if (existing) return existing;
    const c = curriculumForRole(role);
    const now = new Date().toISOString();
    const rec = {
      id: `enr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      hitlId, role, curriculumKey: c.curriculumKey, completedModules: [],
      status: 'enrolled', enrolledAt: now, updatedAt: now
    };
    if (this.usingSupabase) {
      await insertRow('upskilling_enrollment', {
        id: rec.id, hitl_id: hitlId, role, curriculum_key: c.curriculumKey,
        completed_modules: [], status: 'enrolled', enrolled_at: now, updated_at: now
      });
      return rec;
    }
    return jsonFile.mutate(this.file, EMPTY, (store) => {
      const arr = Array.isArray(store.enrollments) ? store.enrollments : [];
      arr.push(rec);
      return { value: { enrollments: arr }, result: rec };
    });
  }

  /** The employee's OWN record — the only read path that exists. */
  async myRecord({ hitlId }) {
    if (!hitlId) throw new Error('hitlId is required — there is no cross-person read path.');
    if (this.usingSupabase) {
      const rows = await selectRows('upskilling_enrollment', `hitl_id=eq.${encodeURIComponent(hitlId)}&limit=1`);
      return rowToEnrollment(rows && rows[0]);
    }
    const store = jsonFile.readSync(this.file, EMPTY);
    return (store.enrollments || []).find(e => e.hitlId === hitlId) || null;
  }

  /** The employee's learning path: role curriculum + their own progress. */
  async myLearningPath({ hitlId }) {
    const rec = await this.myRecord({ hitlId });
    if (!rec) return null;
    const c = curriculumForRole(rec.role);
    const done = new Set(rec.completedModules || []);
    return {
      hitlId, role: rec.role, hitlTarget: c.hitlTarget, status: rec.status,
      modules: c.modules.map(m => Object.assign({}, m, { completed: done.has(m.id) })),
      timeline: c.timeline,
      completed: done.size, total: c.modules.length,
      percentComplete: c.modules.length ? Math.round((100 * done.size) / c.modules.length) : 0
    };
  }

  /** Record that the employee completed a module (their own record only). */
  async completeModule({ hitlId, moduleId }) {
    const rec = await this.myRecord({ hitlId });
    if (!rec) throw new Error(`No enrolment for ${hitlId}.`);
    const c = curriculumForRole(rec.role);
    if (!c.modules.some(m => m.id === moduleId)) throw new Error(`Module "${moduleId}" is not in this role's curriculum.`);
    const done = new Set(rec.completedModules || []); done.add(moduleId);
    const completedModules = Array.from(done);
    const status = completedModules.length >= c.modules.length ? 'completed' : 'in_progress';
    const now = new Date().toISOString();
    if (this.usingSupabase) {
      const rows = await updateRows('upskilling_enrollment', `hitl_id=eq.${encodeURIComponent(hitlId)}`,
        { completed_modules: completedModules, status, updated_at: now });
      return rowToEnrollment(Array.isArray(rows) ? rows[0] : rows);
    }
    return jsonFile.mutate(this.file, EMPTY, (store) => {
      const arr = Array.isArray(store.enrollments) ? store.enrollments : [];
      const e = arr.find(x => x.hitlId === hitlId);
      if (!e) throw new Error(`No enrolment for ${hitlId}.`);
      e.completedModules = completedModules; e.status = status; e.updatedAt = now;
      return { value: { enrollments: arr }, result: { ...e } };
    });
  }

  /** Employee-owned erasure of their own training record. */
  async eraseMyRecord({ hitlId }) {
    if (!hitlId) throw new Error('hitlId is required.');
    if (this.usingSupabase) {
      await updateRows('upskilling_enrollment', `hitl_id=eq.${encodeURIComponent(hitlId)}`, { status: 'erased', completed_modules: [], updated_at: new Date().toISOString() });
      return { erased: true, hitlId };
    }
    return jsonFile.mutate(this.file, EMPTY, (store) => {
      const arr = (Array.isArray(store.enrollments) ? store.enrollments : []).filter(e => e.hitlId !== hitlId);
      return { value: { enrollments: arr }, result: { erased: true, hitlId } };
    });
  }
}

module.exports = { curriculumForRole, curriculumKeyForRole, listCurricula, UpskillingEnrollment, CURRICULA };
