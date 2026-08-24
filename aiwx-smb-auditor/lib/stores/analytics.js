/**
 * Local analytics store
 * =====================
 * Bounded so unauthenticated /api/track-event traffic can't grow the file
 * without limit (disk-fill DoS). Each array is capped to the most-recent MAX
 * entries; overflow is rotated to a dated JSONL archive.
 *
 * This module is the ONLY writer of LOCAL_ANALYTICS_FILE. server.js used to
 * declare its own path constant and carry a duplicate read/write pair pointing
 * at the same file, so two uncoordinated writers shared one file inside a single
 * process. server.js now delegates here.
 *
 * Writes go through json_file's atomic replace + per-path mutex, so a burst of
 * concurrent track-event requests cannot lose entries or truncate the file.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const jsonFile = require('./json_file');
const { LOCAL_ANALYTICS_FILE, LOGS_DIR } = require('../paths');

const ANALYTICS_MAX_ENTRIES = parseInt(process.env.ANALYTICS_MAX_ENTRIES, 10) || 5000;

const EMPTY = { pageviews: [], events: [] };

function normalize(data) {
  return {
    pageviews: Array.isArray(data && data.pageviews) ? data.pageviews : [],
    events: Array.isArray(data && data.events) ? data.events : []
  };
}

function loadLocalAnalytics() {
  if (!fs.existsSync(LOCAL_ANALYTICS_FILE)) return normalize(EMPTY);
  try {
    const raw = fs.readFileSync(LOCAL_ANALYTICS_FILE, 'utf8');
    if (!raw.trim()) return normalize(EMPTY);
    return normalize(JSON.parse(raw));
  } catch (e) {
    logger.warn(`[Analytics] Could not parse ${LOCAL_ANALYTICS_FILE}; starting from an empty dataset.`);
    return normalize(EMPTY);
  }
}

function trimWithArchive(arr, kind) {
  if (!Array.isArray(arr) || arr.length <= ANALYTICS_MAX_ENTRIES) return arr || [];
  const overflow = arr.slice(0, arr.length - ANALYTICS_MAX_ENTRIES);
  try {
    if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
    const date = new Date().toISOString().split('T')[0];
    const archivePath = path.join(LOGS_DIR, `analytics-${kind}-${date}.jsonl`);
    fs.appendFileSync(archivePath, overflow.map(e => JSON.stringify(e)).join('\n') + '\n', 'utf8');
  } catch (e) {
    // Archiving is best-effort, but a silent failure here means overflow is
    // dropped rather than rotated — say so at debug level instead of vanishing.
    logger.warn(`[Analytics] Could not archive ${kind} overflow :: ${e.message}`);
  }
  return arr.slice(arr.length - ANALYTICS_MAX_ENTRIES);
}

function saveLocalAnalytics(data) {
  const next = normalize(data);
  next.pageviews = trimWithArchive(next.pageviews, 'pageviews');
  next.events = trimWithArchive(next.events, 'events');
  // Mutate under the lock so concurrent saves serialise; the value written is
  // the caller's (already-trimmed) dataset, matching the previous contract.
  const promise = jsonFile.mutate(LOCAL_ANALYTICS_FILE, EMPTY, () => ({ value: next, result: next }));
  // Preserve the original synchronous-looking contract for existing callers,
  // which neither await nor inspect the return value.
  if (promise && typeof promise.catch === 'function') {
    promise.catch(e => logger.error(`[Analytics] Failed to persist analytics :: ${e.message}`));
  }
  return next;
}

/**
 * Read-modify-write under the lock. Preferred over load→mutate→save for
 * increments: the load/save pair loses entries when two requests interleave.
 */
function updateLocalAnalytics(mutator) {
  return jsonFile.mutate(LOCAL_ANALYTICS_FILE, EMPTY, (store) => {
    const current = normalize(store);
    const next = normalize(mutator(current) || current);
    next.pageviews = trimWithArchive(next.pageviews, 'pageviews');
    next.events = trimWithArchive(next.events, 'events');
    return { value: next, result: next };
  });
}

module.exports = {
  loadLocalAnalytics,
  saveLocalAnalytics,
  updateLocalAnalytics,
  ANALYTICS_MAX_ENTRIES
};
