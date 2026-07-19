/**
 * Local analytics store
 * =====================
 * Bounded so unauthenticated /api/track-event traffic can't grow the file
 * without limit (disk-fill DoS). Each array is capped to the most-recent MAX
 * entries; overflow is rotated to a dated JSONL archive.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const { LOCAL_ANALYTICS_FILE, LOGS_DIR } = require('../paths');

const ANALYTICS_MAX_ENTRIES = parseInt(process.env.ANALYTICS_MAX_ENTRIES, 10) || 5000;

function loadLocalAnalytics() {
  if (fs.existsSync(LOCAL_ANALYTICS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(LOCAL_ANALYTICS_FILE, 'utf8'));
    } catch (e) {
      logger.warn(`[Analytics] Could not parse ${LOCAL_ANALYTICS_FILE}; starting from an empty dataset.`);
      return { pageviews: [], events: [] };
    }
  }
  return { pageviews: [], events: [] };
}

function trimWithArchive(arr, kind) {
  if (!Array.isArray(arr) || arr.length <= ANALYTICS_MAX_ENTRIES) return arr || [];
  const overflow = arr.slice(0, arr.length - ANALYTICS_MAX_ENTRIES);
  try {
    if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
    const date = new Date().toISOString().split('T')[0];
    const archivePath = path.join(LOGS_DIR, `analytics-${kind}-${date}.jsonl`);
    fs.appendFileSync(archivePath, overflow.map(e => JSON.stringify(e)).join('\n') + '\n', 'utf8');
  } catch (e) { /* archiving is best-effort */ }
  return arr.slice(arr.length - ANALYTICS_MAX_ENTRIES);
}

function saveLocalAnalytics(data) {
  data.pageviews = trimWithArchive(data.pageviews, 'pageviews');
  data.events = trimWithArchive(data.events, 'events');
  const dir = path.dirname(LOCAL_ANALYTICS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LOCAL_ANALYTICS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = { loadLocalAnalytics, saveLocalAnalytics, ANALYTICS_MAX_ENTRIES };
