/**
 * Social publishing subprocess helpers
 * ====================================
 * The publish/outreach/scheduler paths all shell out to the social media
 * agent's publish scripts and then have to fish a JSON envelope back out of
 * stdout. That parsing lived in three near-identical copies; it lives here now.
 */

/**
 * Scan subprocess stdout for the last-written single-line JSON envelope that
 * carries a `success` field. Non-JSON log noise around it is ignored.
 *
 * @param {string} stdout
 * @param {object} fallback Returned (shallow-copied) when no envelope is found.
 * @returns {object} The parsed envelope, or the fallback.
 */
function parsePublishResult(stdout, fallback = { success: false }) {
  const lines = String(stdout || '').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Object.prototype.hasOwnProperty.call(parsed, 'success')) {
          return parsed;
        }
      } catch (e) {
        // Not the envelope — keep scanning.
      }
    }
  }
  return { ...fallback };
}

module.exports = { parsePublishResult };
