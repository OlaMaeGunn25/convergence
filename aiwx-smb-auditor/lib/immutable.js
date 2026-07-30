/**
 * Shared-state protection
 * =======================
 * Several modules expose module-level constants (the connector catalog, the agent
 * roster, the vertical registry, simulated fallback datasets). Returning those
 * BY REFERENCE lets any caller mutate the source of truth for the whole process —
 * the same defect class that caused the JSON-store state bleed
 * (see lib/stores/json_file.js cloneFallback).
 *
 * Two of these are security-relevant, not merely hygienic:
 *   - agent roster `tools`: pushing to a returned array would permanently grant a
 *     role a tool it is not entitled to (least-privilege bypass).
 *   - connector catalog: mutating a connector could change auth/env expectations
 *     for every tenant in the process.
 *
 * `copy()` hands every caller its own detached copy, so accessors are safe to use
 * without callers needing to know they hold shared state.
 */

/** Detached deep copy of plain JSON-shaped data (no functions/dates expected). */
function copy(value) {
  if (value === null || typeof value !== 'object') return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (e) {
    return value;
  }
}

module.exports = { copy };
