/**
 * Gateway Governance — Authentication & Authorization
 * ===================================================
 * Adds an identity/authorization gate to the CONVERGENCE-Ai gateway, which
 * previously exposed all mutating endpoints unauthenticated.
 *
 * Configuration (environment-only):
 *   GATEWAY_API_KEY        Single shared key. Presenting it grants the
 *                          "operator" role as actor "api-client".
 *   GATEWAY_API_KEYS       Optional JSON map of key -> "actor:role", e.g.
 *                          {"k_live_abc":"cockpit:operator","k_ro_xyz":"reporting:viewer"}
 *                          Takes precedence over GATEWAY_API_KEY when set.
 *
 * Enforcement model (fail-closed once configured, non-breaking until then):
 *   - If any key is configured, protected routes REQUIRE a valid key
 *     (Authorization: Bearer <key>  or  x-api-key: <key>) and 401 otherwise.
 *   - If NO key is configured, protected routes are allowed but every request
 *     is stamped with the "unauthenticated" actor and a loud one-time warning
 *     is logged, so existing dev/deployments keep working while signalling that
 *     production must set a key.
 *
 * Roles: "operator" (read + mutate) and "viewer" (read-only). Viewer keys are
 * rejected on mutating (POST/PUT/PATCH/DELETE) requests.
 */

let warnedNoKey = false;

function loadKeyMap() {
  // Explicit multi-key map wins.
  if (process.env.GATEWAY_API_KEYS) {
    try {
      const raw = JSON.parse(process.env.GATEWAY_API_KEYS);
      const map = {};
      for (const [key, val] of Object.entries(raw)) {
        const [actor, role] = String(val).split(':');
        map[key] = { actor: actor || 'api-client', role: (role || 'operator').toLowerCase() };
      }
      return map;
    } catch (e) {
      // Fall through to single-key handling; surfaced by isAuthConfigured warning.
      return {};
    }
  }
  if (process.env.GATEWAY_API_KEY) {
    return { [process.env.GATEWAY_API_KEY]: { actor: 'api-client', role: 'operator' } };
  }
  return {};
}

function isAuthConfigured() {
  return Boolean(process.env.GATEWAY_API_KEY || process.env.GATEWAY_API_KEYS);
}

function extractPresentedKey(req) {
  const authz = req.headers['authorization'];
  if (authz && /^Bearer\s+/i.test(authz)) {
    return authz.replace(/^Bearer\s+/i, '').trim();
  }
  if (req.headers['x-api-key']) {
    return String(req.headers['x-api-key']).trim();
  }
  return null;
}

/**
 * Express middleware: authenticate the caller and attach req.actor / req.role.
 * Returns 401/403 when a key is configured and the request is not authorized.
 */
function authenticate(req, res, next) {
  const keyMap = loadKeyMap();
  const configured = Object.keys(keyMap).length > 0;

  if (!configured) {
    if (!warnedNoKey) {
      warnedNoKey = true;
      // eslint-disable-next-line no-console
      console.warn('[Governance] No GATEWAY_API_KEY configured — mutating endpoints are UNAUTHENTICATED. Set GATEWAY_API_KEY (or GATEWAY_API_KEYS) before production.');
    }
    req.actor = 'unauthenticated';
    req.role = 'operator';
    return next();
  }

  const presented = extractPresentedKey(req);
  if (!presented || !keyMap[presented]) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized. Provide a valid API key via "Authorization: Bearer <key>" or the "x-api-key" header.'
    });
  }

  const identity = keyMap[presented];
  req.actor = identity.actor;
  req.role = identity.role;

  // Role gate: viewers may not perform mutating requests.
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (mutating && identity.role !== 'operator') {
    return res.status(403).json({
      success: false,
      error: `Forbidden. Role "${identity.role}" is read-only and cannot perform ${req.method} requests.`
    });
  }

  return next();
}

module.exports = { authenticate, isAuthConfigured };
