/**
 * Pre-Commit Checks-and-Balances (NEG-02/03)
 * ==========================================
 * The independent review the Orchestrator runs BEFORE any action crosses the
 * commit boundary (the point it executes / mutates a connected system). It is the
 * deterministic "Critic/Arbiter" of the commit boundary — separate from the agent
 * that proposed the action — and a failure BLOCKS the commit and routes to HITL.
 *
 * Three checks:
 *   1. capability      — the action is within a CONNECTED system's capability.
 *   2. practice_sop    — aligned with industry practice + the governing company
 *                        SOP (SOP governs; a conflict routes to HITL, KNW-03).
 *   3. compliance_floor— trust/PHI/financial actions require explicit approval or
 *                        an elevated autonomy grant (AUT-04).
 *
 * Deterministic (no network) so it is unit-testable; high-risk verticals may also
 * escalate to the LLM negotiation engine, but these checks are the floor.
 *
 * NEG-01: agents never negotiate peer-to-peer — only the Orchestrator invokes this
 * reviewer, so the checks-and-balances are always mediated and traceable.
 */

const systemEvaluator = require('./system_evaluator');
const industry = require('./industry_practices');
const { isComplianceFloor } = require('./autonomy');

async function review({ tenantId = null, vertical = null, connectorId = null, capability = null, toolName = null, connectionRegistry = null, knowledgeBase = null, approved = false, elevated = false } = {}) {
  const checks = [];
  const blockers = [];

  // 1. Capability — must be an action a connected system actually exposes.
  if (connectionRegistry && connectorId && capability) {
    const model = await systemEvaluator.buildTenantCapabilityModel({ tenantId, connectionRegistry });
    const cap = systemEvaluator.canDo(model, connectorId, capability);
    checks.push({ name: 'capability', pass: cap.ok, detail: cap.ok ? `${connectorId} exposes "${capability}"` : cap.reason });
    if (!cap.ok) blockers.push('capability');
  }

  // 2. Practice + governing SOP — company SOP governs; a conflict routes to HITL.
  if (vertical && capability) {
    const corr = await industry.correlate({ vertical, capability, connectorId, knowledgeBase, tenantId });
    checks.push({
      name: 'practice_sop', pass: !corr.conflictFlaggedToHitl,
      detail: corr.conflictFlaggedToHitl
        ? 'Company SOP conflicts with the planned action — SOP governs; routed to HITL.'
        : `Aligned with ${corr.industryPractices.map(p => p.title).join('; ') || 'standard practice'}.`
    });
    if (corr.conflictFlaggedToHitl) blockers.push('sop_conflict');
  }

  // 3. Compliance floor — highest-risk actions require explicit approval/elevated.
  const floor = isComplianceFloor(toolName || capability || '');
  if (floor) {
    const floorOk = approved === true || elevated === true;
    checks.push({ name: 'compliance_floor', pass: floorOk, detail: floorOk ? 'Compliance-floor action explicitly approved.' : 'Compliance-floor action requires explicit approval or an elevated autonomy grant (AUT-04).' });
    if (!floorOk) blockers.push('compliance_floor');
  } else {
    checks.push({ name: 'compliance_floor', pass: true, detail: 'Not a compliance-floor action.' });
  }

  const ok = blockers.length === 0;
  return { ok, verdict: ok ? 'pass' : 'blocked', checks, blockers, routeToHitl: !ok, reviewedAt: new Date().toISOString() };
}

module.exports = { review };
