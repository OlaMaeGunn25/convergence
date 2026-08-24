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
 *
 * The chain entry is EVICTED once it settles and nothing newer has queued behind
 * it. Without that the map grew one permanent entry per distinct path for the
 * lifetime of the process — harmless for the fixed store set, a slow leak for
 * per-tenant or temp-directory paths (which is exactly what the test suite uses).
 */
function withLock(filePath, fn) {
  const key = path.resolve(filePath);
  const prev = chains.get(key) || Promise.resolve();
  const next = prev.then(fn, fn);
  // Keep the chain alive but swallow the result so one failure doesn't cascade.
  const tail = next.then(() => {}, () => {});
  chains.set(key, tail);
  tail.then(() => {
    // Only evict if we are still the tail — otherwise a later operation is
    // queued behind us and must keep its ordering guarantee.
    if (chains.get(key) === tail) chains.delete(key);
  });
  return next;
}

/**
 * Deep-copy the caller's fallback before handing it back.
 *
 * Callers pass a module-level constant (e.g. `const EMPTY = { tasks: [] }`) and
 * then push into the array they get back. Returning the constant BY REFERENCE let
 * those pushes mutate the shared object, so a store whose file did not exist yet
 * would start out holding records written by an unrelated store/tenant earlier in
 * the same process. Copying makes the fallback inert.
 */
function cloneFallback(fallbackValue) {
  if (fallbackValue === null || typeof fallbackValue !== 'object') return fallbackValue;
  try {
    return JSON.parse(JSON.stringify(fallbackValue));
  } catch (e) {
    return fallbackValue;
  }
}

/**
 * Read WITHOUT taking the lock.
 *
 * Safe for a pure read because `writeAtomicSync` replaces by rename, so a reader
 * observes either the whole old file or the whole new one — never a torn one.
 *
 * It is NOT safe as the read half of a read-modify-write: two callers can both
 * read, both modify, and the second write silently discards the first. Use
 * `mutate()` for anything that writes back. The name says "unlocked" so the
 * hazard is visible at the call site rather than buried here; `readSync` remains
 * exported as an alias for the ~20 existing read-only callers.
 */
function readSyncUnlocked(filePath, fallbackValue) {
  try {
    if (!fs.existsSync(filePath)) return cloneFallback(fallbackValue);
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return cloneFallback(fallbackValue);
    return JSON.parse(raw);
  } catch (e) {
    return cloneFallback(fallbackValue);
  }
}

/**
 * Replace the file's contents atomically. The temp file lives in the same
 * directory so the rename stays on one filesystem (rename across devices is not
 * atomic and fails outright on Windows).
 *
 * If the rename fails the temp file is removed rather than left behind: a crash
 * between write and rename used to strand `.name.pid.ts.tmp` files that nothing
 * ever swept up.
 */
function writeAtomicSync(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, filePath);
  } catch (e) {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (cleanupErr) { /* nothing more to do */ }
    throw e;
  }
}

/**
 * Sweep temp files this process orphaned in `dir` (crash recovery). Only removes
 * files matching our own naming scheme, and only those older than `maxAgeMs`, so
 * a concurrent write in flight is never disturbed.
 */
function sweepOrphanedTemps(dir, maxAgeMs = 60_000) {
  let removed = 0;
  try {
    if (!fs.existsSync(dir)) return 0;
    const cutoff = Date.now() - maxAgeMs;
    for (const name of fs.readdirSync(dir)) {
      if (!/^\..+\.\d+\.\d+\.tmp$/.test(name)) continue;
      const full = path.join(dir, name);
      try {
        if (fs.statSync(full).mtimeMs < cutoff) { fs.unlinkSync(full); removed++; }
      } catch (e) { /* raced with another sweeper or already gone */ }
    }
  } catch (e) { /* sweeping is best-effort */ }
  return removed;
}

/** Read the file under the lock (no write). */
function read(filePath, fallbackValue) {
  return withLock(filePath, () => readSyncUnlocked(filePath, fallbackValue));
}

/**
 * Read-modify-write under the lock.
 * @param {Function} mutator receives the parsed contents; returns either the
 *        value to persist, or `{ value, result }` to persist `value` and hand
 *        `result` back to the caller.
 */
function mutate(filePath, fallbackValue, mutator) {
  return withLock(filePath, async () => {
    const current = readSyncUnlocked(filePath, fallbackValue);
    const outcome = await mutator(current);
    const hasResult = outcome && typeof outcome === 'object' && 'value' in outcome && 'result' in outcome;
    const value = hasResult ? outcome.value : outcome;
    if (value !== undefined) writeAtomicSync(filePath, value);
    return hasResult ? outcome.result : value;
  });
}

module.exports = {
  read,
  mutate,
  withLock,
  readSyncUnlocked,
  // Back-compatible alias for existing read-only call sites.
  readSync: readSyncUnlocked,
  writeAtomicSync,
  sweepOrphanedTemps,
  _pendingChains: chains
};
