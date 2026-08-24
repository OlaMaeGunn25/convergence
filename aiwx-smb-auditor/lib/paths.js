/**
 * Filesystem layout
 * =================
 * Sibling-folder path resolution — every entry is overridable so the
 * container/cloud host can relocate the workspace without breaking relative
 * `../` assumptions.
 */

const path = require('path');

const APP_ROOT = path.resolve(__dirname, '..');

const REPO_ROOT = process.env.CONVERGENCE_ROOT
  ? path.resolve(process.env.CONVERGENCE_ROOT)
  : path.resolve(APP_ROOT, '..');

const SOCIAL_AGENT_DIR = process.env.SOCIAL_AGENT_DIR
  ? path.resolve(process.env.SOCIAL_AGENT_DIR)
  : path.join(REPO_ROOT, 'aiwx-social-media-agent');

const ADMIN_DIST_DIR = process.env.ADMIN_DIST_DIR
  ? path.resolve(process.env.ADMIN_DIST_DIR)
  : path.join(REPO_ROOT, 'aiwx-convergence-ai', 'dist');

const PUBLIC_DIR = path.join(APP_ROOT, 'public');
const LOGS_DIR = path.join(APP_ROOT, 'logs');
const AUDITS_CACHE_DIR = path.join(APP_ROOT, 'audits_cache');

/**
 * Mutable runtime state (tasks, connections, HITL identities, chat plans…).
 *
 * Overridable via CONVERGENCE_STATE_DIR because the default — the repo's own
 * `config/` — is the wrong home for anything a test run produces. Every store
 * used to hard-code `__dirname/../config/<name>.json`, so a test that exercised
 * a tool through the registry wrote governance state, including identity-bearing
 * records, straight into the working tree. Routing all of them through one
 * overridable directory means the test runner can point at a temp dir and leave
 * the repo untouched.
 */
const STATE_DIR = process.env.CONVERGENCE_STATE_DIR
  ? path.resolve(process.env.CONVERGENCE_STATE_DIR)
  : path.join(APP_ROOT, 'config');

/** Resolve a runtime-state file inside STATE_DIR. */
function stateFile(name) {
  return path.join(STATE_DIR, name);
}

// State files. The audit queue lives under this app's own state dir; the
// campaign, alerts, and outreach state belong to the social media agent's config/.
const AUDIT_QUEUE_FILE = stateFile('audit_queue.json');
const SCHEDULE_FILE = path.join(SOCIAL_AGENT_DIR, 'config', 'campaign_schedule.json');
const ALERTS_FILE = path.join(SOCIAL_AGENT_DIR, 'config', 'activity_alerts.json');
const OUTREACH_REGISTRY_FILE = path.join(SOCIAL_AGENT_DIR, 'config', 'prospects_outreach.json');
const LOCAL_ANALYTICS_FILE = stateFile('local_analytics.json');
const POSTS_LIBRARY_FILE = path.join(PUBLIC_DIR, 'posts_data.json');

module.exports = {
  APP_ROOT,
  REPO_ROOT,
  SOCIAL_AGENT_DIR,
  ADMIN_DIST_DIR,
  PUBLIC_DIR,
  LOGS_DIR,
  AUDITS_CACHE_DIR,
  STATE_DIR,
  stateFile,
  AUDIT_QUEUE_FILE,
  SCHEDULE_FILE,
  ALERTS_FILE,
  OUTREACH_REGISTRY_FILE,
  LOCAL_ANALYTICS_FILE,
  POSTS_LIBRARY_FILE
};
