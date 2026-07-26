/**
 * Deployment Mode (DEP)
 * =====================
 * CONVERGENCE-Ai runs from ONE codebase in two modes — cloud-native or self-hosted
 * on-prem (Docker). Deployment mode is a CONFIG, not a code fork (DEP-03): the
 * orchestrator, the 13-agent roster, and every governed store run identically; only
 * the state backend differs (Supabase in the cloud, or the local JSON store / a
 * self-hosted Postgres/Supabase on-prem). This helper reports the active mode.
 */

const { isSupabaseConfigured } = require('./supabase');

function deploymentInfo() {
  const supa = isSupabaseConfigured();
  const mode = (process.env.DEPLOYMENT_MODE || (supa ? 'cloud' : 'onprem')).toLowerCase();
  const optionalBackends = require('./integration_seams').seams().summary;
  return {
    mode, // 'cloud' | 'onprem'
    selfHosted: mode === 'onprem',
    stateBackend: supa ? 'supabase' : 'json-file',
    chromium: process.env.PUPPETEER_EXECUTABLE_PATH || 'bundled',
    cloudDependencies: supa ? ['supabase'] : [],
    optionalBackends, // { total, live, fallback } — live backends activate at cloud-deploy time
    note: mode === 'onprem'
      ? 'On-prem: all governed state is local (JSON store or a self-hosted Postgres/Supabase); no mandatory external cloud dependency.'
      : 'Cloud-native: Supabase-backed governed state (mandatory at multi-instance scale).'
  };
}

module.exports = { deploymentInfo };
