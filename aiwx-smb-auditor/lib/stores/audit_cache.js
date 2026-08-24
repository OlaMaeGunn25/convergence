/**
 * Audit package cache
 * ===================
 * One implementation of "persist a completed audit package under a
 * domain-derived filename". This logic existed three times — twice inline in
 * server.js and once in lib/schedulers.js — with the copies drifting: two logged
 * through the logger module and one through console.log/console.error.
 *
 * Filename derivation is unchanged: every character outside [A-Za-z0-9.-] is
 * replaced with an underscore. That strips both slash characters, so a hostile
 * `domain` cannot escape the cache directory; the dots that survive can only
 * produce an oddly-named file inside it, never a traversal.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const jsonFile = require('./json_file');
const { AUDITS_CACHE_DIR } = require('../paths');

/** Domain → safe cache filename. Exported so callers can log/report the target. */
function cacheFilenameFor(domain) {
  return String(domain || 'unknown').replace(/[^a-zA-Z0-9.-]/g, '_') + '.json';
}

/**
 * Write an audit package to the cache. Best-effort by design — a cache miss must
 * never fail the audit that produced it — but the failure is now LOGGED rather
 * than swallowed silently, so a permanently-failing cache is visible.
 *
 * @returns {string|null} the path written, or null if the write failed.
 */
function writeAuditCache(domain, pkg, { dir = AUDITS_CACHE_DIR } = {}) {
  const filename = cacheFilenameFor(domain);
  const target = path.join(dir, filename);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // Atomic replace: a concurrent reader never observes a half-written package.
    jsonFile.writeAtomicSync(target, pkg);
    logger.info(`[AuditCache] Saved audit package: ${filename}`);
    return target;
  } catch (e) {
    logger.warn(`[AuditCache] Failed to write ${filename} :: ${e.message}`);
    return null;
  }
}

/** Read a cached audit package back, or null when absent/unparseable. */
function readAuditCache(domain, { dir = AUDITS_CACHE_DIR } = {}) {
  const target = path.join(dir, cacheFilenameFor(domain));
  try {
    if (!fs.existsSync(target)) return null;
    const raw = fs.readFileSync(target, 'utf8');
    return raw.trim() ? JSON.parse(raw) : null;
  } catch (e) {
    logger.warn(`[AuditCache] Could not read cache for ${domain} :: ${e.message}`);
    return null;
  }
}

module.exports = { writeAuditCache, readAuditCache, cacheFilenameFor };
