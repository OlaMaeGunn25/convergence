/**
 * Automated audit queue store (crash-safe JSON on disk).
 *
 * Writes go through json_file's atomic replace so a reader never sees a
 * half-written queue and a crash mid-write cannot truncate it. This store
 * predates json_file.js and kept doing bare readFileSync/writeFileSync long
 * after the hardening landed next door — the scheduler and the HTTP handlers
 * both touch this file, which is precisely the interleaving json_file exists
 * to serialise.
 *
 * `saveAuditQueue` stays synchronous-looking for its existing callers but now
 * returns a promise; callers that already `await` it are unaffected, and the
 * fire-and-forget callers still get atomic writes, just without back-pressure.
 */

const jsonFile = require('./json_file');
const { AUDIT_QUEUE_FILE } = require('../paths');

const EMPTY = { active: false, jobs: [] };

function loadAuditQueue() {
  const store = jsonFile.readSync(AUDIT_QUEUE_FILE, EMPTY);
  // Preserve the original contract: always an object with `active` + `jobs`,
  // even if the file on disk holds something unexpected.
  return {
    active: typeof store.active === 'boolean' ? store.active : false,
    jobs: Array.isArray(store.jobs) ? store.jobs : []
  };
}

function saveAuditQueue(data) {
  return jsonFile.mutate(AUDIT_QUEUE_FILE, EMPTY, () => ({
    value: {
      active: typeof data.active === 'boolean' ? data.active : false,
      jobs: Array.isArray(data.jobs) ? data.jobs : []
    },
    result: data
  }));
}

/**
 * Read-modify-write under the lock. Use this instead of load→mutate→save when
 * the new value depends on the current one: the load/save pair is a lost-update
 * race if two callers interleave.
 */
function updateAuditQueue(mutator) {
  return jsonFile.mutate(AUDIT_QUEUE_FILE, EMPTY, (store) => {
    const current = {
      active: typeof store.active === 'boolean' ? store.active : false,
      jobs: Array.isArray(store.jobs) ? store.jobs : []
    };
    const next = mutator(current) || current;
    return { value: next, result: next };
  });
}

module.exports = { loadAuditQueue, saveAuditQueue, updateAuditQueue };
