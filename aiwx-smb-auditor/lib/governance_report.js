/**
 * Governance Report (Phase 5)
 * ===========================
 * The unified AI TRiSM surface: one snapshot cross-referencing the two
 * governance dimensions plus orchestration state.
 *
 *   WHO may act   — the immutable audit_log actor trail (access governance)
 *   WHAT is true  — reliability / distribution / validation across audits
 *                   (data-provenance governance)
 *   Orchestration — task-model state counts (pending approvals, failures)
 *
 * This is deliberately read-only and additive. It is exposed as a registry tool
 * (get_governance_report), so it is reachable through the existing /api/tools
 * surface and the MCP bridge without any new endpoint wiring — which keeps it
 * clear of the in-flight route cutover.
 */

const fs = require('fs');
const path = require('path');
const { isSupabaseConfigured, selectRows } = require('./supabase');
const { TaskModel } = require('./task_model');

// WHO — recent audit_log entries (Supabase-only; degrades gracefully in dev).
async function summarizeAccess(limit, tenantId) {
  if (!isSupabaseConfigured()) {
    return { available: false, note: 'audit_log lives in Supabase — configure SUPABASE_* to surface the actor trail.' };
  }
  try {
    let q = `select=actor,action,outcome,ts&order=ts.desc&limit=${Math.min(Math.max(limit, 1), 500)}`;
    if (tenantId) q += `&tenant_id=eq.${encodeURIComponent(tenantId)}`;
    const rows = (await selectRows('audit_log', q)) || [];
    const byAction = {}, byOutcome = {}, actors = new Set();
    for (const r of rows) {
      byAction[r.action] = (byAction[r.action] || 0) + 1;
      byOutcome[r.outcome] = (byOutcome[r.outcome] || 0) + 1;
      if (r.actor) actors.add(r.actor);
    }
    return { available: true, total: rows.length, byAction, byOutcome, uniqueActors: actors.size, recent: rows.slice(0, 10) };
  } catch (e) {
    return { available: false, error: e.message };
  }
}

// WHAT — aggregate reportGovernance across cached audit packages.
function summarizeDataQuality(dir) {
  const out = { available: false, totalAudits: 0, avgReliability: null, gradeBreakdown: {}, distributionBreakdown: {}, validationPassRate: null };
  try {
    if (!fs.existsSync(dir)) return out;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    let relSum = 0, relCount = 0, valPass = 0, valTotal = 0;
    for (const f of files) {
      let pkg;
      try { pkg = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { continue; }
      const g = pkg && pkg.reportGovernance;
      if (!g) continue;
      out.totalAudits++;
      if (g.reliability && typeof g.reliability.score === 'number') {
        relSum += g.reliability.score; relCount++;
        const gr = g.reliability.grade || '?';
        out.gradeBreakdown[gr] = (out.gradeBreakdown[gr] || 0) + 1;
      }
      if (g.distribution) {
        const c = g.distribution.classification || g.distribution.class || '?';
        out.distributionBreakdown[c] = (out.distributionBreakdown[c] || 0) + 1;
      }
      if (g.validation) {
        valTotal++;
        const s = g.validation.overallStatus || g.validation.status || '';
        if (s && !/fail/i.test(String(s))) valPass++;
      }
    }
    out.available = out.totalAudits > 0;
    out.avgReliability = relCount ? Math.round(relSum / relCount) : null;
    out.validationPassRate = valTotal ? Math.round((100 * valPass) / valTotal) : null;
  } catch (e) { /* best-effort */ }
  return out;
}

// Orchestration — task-model state counts.
async function summarizeTasks(taskModel) {
  try {
    const tasks = await taskModel.list();
    const byStatus = {};
    for (const t of tasks) byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    return { total: tasks.length, byStatus, pendingApproval: byStatus.pending_approval || 0, failed: byStatus.failed || 0 };
  } catch (e) {
    return { total: 0, byStatus: {}, error: e.message };
  }
}

/**
 * buildGovernanceReport({ auditsDir, taskModel, limit, tenantId })
 * @returns unified WHO × WHAT × orchestration snapshot with a TRiSM headline.
 */
async function buildGovernanceReport(options = {}) {
  const auditsDir = options.auditsDir || path.join(__dirname, '..', 'audits_cache');
  const taskModel = options.taskModel || new TaskModel();
  const limit = options.limit || 50;

  const [access, data, orchestration] = await Promise.all([
    summarizeAccess(limit, options.tenantId),
    Promise.resolve(summarizeDataQuality(auditsDir)),
    summarizeTasks(taskModel)
  ]);

  // Headline: green when data quality is healthy and nothing is stuck failing.
  const dataHealthy = data.avgReliability == null || data.avgReliability >= 70;
  const nothingFailing = (orchestration.failed || 0) === 0;
  const status = dataHealthy && nothingFailing ? 'healthy' : (data.avgReliability != null && data.avgReliability < 50) || orchestration.failed > 0 ? 'attention' : 'watch';

  return {
    generatedAt: new Date().toISOString(),
    trism: {
      status,
      avgReliability: data.avgReliability,
      pendingApprovals: orchestration.pendingApproval,
      failedTasks: orchestration.failed,
      accessTrail: access.available ? access.total : 0
    },
    access,       // WHO
    data,         // WHAT
    orchestration // task states
  };
}

module.exports = { buildGovernanceReport, summarizeDataQuality, summarizeTasks, summarizeAccess };
