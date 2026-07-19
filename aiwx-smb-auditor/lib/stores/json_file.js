/**
 * JSON-file fallback backend — used only when Supabase is not configured
 * (local dev, offline demos, CI). Supabase is the production path.
 * =====================================================================
 * The stores that sit on top of this used to do bare
 * `JSON.parse(readFileSync(...))` → mutate → `writeFileSync(...)`, which loses
 * writes whenever two handlers interleave and can leave a truncated file if the
 * process dies mid-write. This module keeps the file format identical but adds:
 *
 *   1. A per-path async mutex, so a read-modify-write inside `mutate()` is
 *      serialised against every other `mutate()` on the same file *in this
 *      process*.
 *   2. Atomic replacement (write to a temp file, then rename), so a reader
 *      never observes a half-written file.
 *
 * The mutex is process-local: it does not protect against two Node processes
 * writing the same file (server.js and scheduler_daemon.js, for instance). That
 * is precisely the gap that only the database backend closes, which is why the
 * fallback is documented as dev-only.
 */

const fs = require('fs');
const path = require('path');

/** @type {Map<string, Promise<any>>} tail of the pending operation chain per path */
const chains = new Map();

/**
 * Serialise `fn` against other operations on the same file path.
 * Failures are isolated: a rejected operation does not poison the chain.
 */
function withLock(filePath, fn) {
  const key = path.resolve(filePath);
  const prev = chains.get(key) || Promise.resolve();
  const next = prev.then(fn, fn);
  // Keep the chain alive but swallow the result so one failure doesn't cascade.
  chains.set(key, next.then(() => {}, () => {}));
  return next;
}

function readSync(filePath, fallbackValue) {
  try {
    if (!fs.existsSync(filePath)) return fallbackValue;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return fallbackValue;
    return JSON.parse(raw);
  } catch (e) {
    return fallbackValue;
  }
}

/**
 * Replace the file's contents atomically. The temp file lives in the same
 * directory so the rename stays on one filesystem (rename across devices is not
 * atomic and fails outright on Windows).
 */
function writeAtomicSync(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

/** Read the file under the lock (no write). */
function read(filePath, fallbackValue) {
  return withLock(filePath, () => readSync(filePath, fallbackValue));
}

/**
 * Read-modify-write under the lock.
 * @param {Function} mutator receives the parsed contents; returns either the
 *        value to persist, or `{ value, result }` to persist `value` and hand
 *        `result` back to the caller.
 */
function mutate(filePath, fallbackValue, mutator) {
  return withLock(filePath, async () => {
    const current = readSync(filePath, fallbackValue);
    const outcome = await mutator(current);
    const hasResult = outcome && typeof outcome === 'object' && 'value' in outcome && 'result' in outcome;
    const value = hasResult ? outcome.value : outcome;
    if (value !== undefined) writeAtomicSync(filePath, value);
    return hasResult ? outcome.result : value;
  });
}

module.exports = { read, mutate, withLock, readSync, writeAtomicSync };
