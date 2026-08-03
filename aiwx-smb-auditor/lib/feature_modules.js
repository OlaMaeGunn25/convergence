/**
 * Feature Modules — optional, licensable ADD-ONS
 * ==============================================
 * Core CONVERGENCE-Ai (governance, agents, connectors, HITL) is always on.
 * Everything declared here is an ADD-ON: shipped in the codebase but disabled
 * until enabled for a tenant, so features can be packaged and sold separately
 * (mirrors the existing `upskill: true` licence-flag pattern in the hub).
 *
 * Enablement precedence (most specific wins):
 *   1. ctx.modules            — per-call / per-tenant list (from the licence token)
 *   2. AIWX_ENABLED_MODULES   — env allow-list (comma-separated, or "*" for all)
 *   3. module.defaultEnabled  — false for add-ons
 *
 * Enforcement: `tool_registry.invoke()` refuses a tool whose module is disabled
 * (status `module_disabled`), so an add-on cannot be used by simply knowing the
 * tool name — the same gate style as the agent/HITL checks.
 *
 * Adding an add-on = one entry here + tools listed. No core changes.
 */

const MODULES = {
  task_record: {
    id: 'task_record',
    name: 'Task Recording (Scribe-style)',
    description: 'Captures every step an agent performs as it executes, then names, categorizes and saves the run as a reusable record.',
    defaultEnabled: false,
    dependsOn: [],
    tools: ['start_task_record', 'record_task_step', 'finalize_task_record', 'get_task_record', 'list_task_records']
  },
  playbook_library: {
    id: 'playbook_library',
    name: 'Playbook Library',
    description: 'Turns completed task records into named, categorized, versioned playbooks — and lets the assigned agent improve them run over run.',
    defaultEnabled: false,
    dependsOn: ['task_record'],
    tools: ['save_playbook', 'list_playbooks', 'get_playbook', 'improve_playbook', 'find_playbook_for_task']
  },
  process_mapping: {
    id: 'process_mapping',
    name: 'Six Sigma Process Mapping',
    description: 'Six Sigma swimlane / SIPOC process maps whose HITL checkpoints emit REAL governed approval gates instead of drawings of them.',
    defaultEnabled: false,
    dependsOn: [],
    tools: ['list_process_maps', 'get_process_map', 'instantiate_process_map']
  }
};

const MODULE_IDS = Object.keys(MODULES);

/** Reverse index: tool name -> module id (built once). */
const TOOL_TO_MODULE = {};
for (const m of Object.values(MODULES)) {
  for (const t of m.tools) TOOL_TO_MODULE[t] = m.id;
}

function envAllowList() {
  const raw = (process.env.AIWX_ENABLED_MODULES || '').trim();
  if (!raw) return null;
  if (raw === '*') return '*';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Is `moduleId` enabled for this caller?
 * @param ctx { modules?: string[] | '*' }
 */
function isEnabled(moduleId, ctx = {}) {
  const mod = MODULES[moduleId];
  if (!mod) return false;
  // Dependencies must also be enabled (a playbook needs task records).
  const depsOk = (mod.dependsOn || []).every(d => isEnabled(d, ctx));
  if (!depsOk) return false;

  if (ctx && ctx.modules) {
    if (ctx.modules === '*') return true;
    if (Array.isArray(ctx.modules)) return ctx.modules.includes(moduleId);
  }
  const allow = envAllowList();
  if (allow === '*') return true;
  if (Array.isArray(allow)) return allow.includes(moduleId);
  return mod.defaultEnabled === true;
}

/** The module a tool belongs to, or null when the tool is core (always on). */
function moduleForTool(toolName) {
  return TOOL_TO_MODULE[toolName] || null;
}

/**
 * Gate used by the tool registry.
 * @returns { ok:true } | { ok:false, moduleId, reason }
 */
function checkToolAccess(toolName, ctx = {}) {
  const moduleId = moduleForTool(toolName);
  if (!moduleId) return { ok: true }; // core tool
  if (isEnabled(moduleId, ctx)) return { ok: true, moduleId };
  const mod = MODULES[moduleId];
  const missingDep = (mod.dependsOn || []).find(d => !isEnabled(d, ctx));
  return {
    ok: false, moduleId,
    reason: missingDep
      ? `Add-on "${mod.name}" requires the "${MODULES[missingDep].name}" module, which is not enabled for this tenant.`
      : `Add-on "${mod.name}" is not enabled for this tenant.`
  };
}

/** Public catalog of add-ons + whether each is currently enabled. */
function listModules(ctx = {}) {
  return MODULE_IDS.map(id => ({
    id, name: MODULES[id].name, description: MODULES[id].description,
    dependsOn: MODULES[id].dependsOn, tools: MODULES[id].tools.slice(),
    enabled: isEnabled(id, ctx)
  }));
}

module.exports = { MODULES, MODULE_IDS, isEnabled, moduleForTool, checkToolAccess, listModules };
