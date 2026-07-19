/**
 * Shared audit utilities
 * ======================
 * Single source of truth for helpers that both the HTTP gateway and the audit
 * pipeline need. These previously existed as byte-identical copies in
 * server.js and lib/audit_runner.js, which meant a fix to one silently left
 * the other behind.
 */

// Hostname shape accepted for an audit target (labels + a 2+ char TLD).
const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

/**
 * Race a promise against a deadline so a hung external call can never pin a
 * request (or a scheduler tick) open indefinitely.
 */
function withTimeout(promise, ms = 30000) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`External request timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

/**
 * Determine whether an audit target belongs to the Legal Services vertical, so
 * the audit flow can attach Google Scholar case-law / expert-witness citations.
 */
function isLegalVertical(explicitVertical, scrapedVertical, businessName) {
  const haystack = `${explicitVertical || ''} ${scrapedVertical || ''} ${businessName || ''}`.toLowerCase();
  return /\b(legal|law|attorney|counsel|litigation|esq)\b/.test(haystack);
}

module.exports = { DOMAIN_REGEX, withTimeout, isLegalVertical };
