/**
 * Trusted tenant identity.
 *
 * The ONLY supported source of a caller's tenant is a verified signature:
 * a session JWT signed with JWT_SECRET, or the operator API key (which is a
 * trusted service caller and may therefore name a tenant explicitly).
 *
 * A `tenantId` arriving in req.query or req.body is attacker-controlled and is
 * NEVER trusted for scoping. This matters more than the enforcement mechanism
 * downstream: if ctx.tenantId came from the query string, then appending
 * `.eq('tenant_id', ctx.tenantId)` — or injecting JWT claims for RLS — merely
 * asks the database to confirm the caller is whoever they claimed to be. The
 * query succeeds, the policy passes, and tenant A reads tenant B's rows.
 */

const jwt = require('jsonwebtoken');

class TenantContextError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.name = 'TenantContextError';
        this.statusCode = statusCode || 401;
    }
}

/**
 * A resolved, trusted caller identity.
 *
 * `tenantId`  — the tenant whose rows this caller may touch. Null only for
 *               service callers that did not name one.
 * `crossTenant` — true when the caller is authorised to reach across tenants
 *               (operator API key, super-admin). Scoped queries still refuse to
 *               run unscoped unless the call site opts in explicitly.
 */
class TenantContext {
    constructor({ actor, tenantId, crossTenant = false, source }) {
        this.actor = actor;
        this.tenantId = tenantId || null;
        this.crossTenant = Boolean(crossTenant);
        this.source = source;
        Object.freeze(this);
    }

    /**
     * The tenant to scope a query by, or throw. Call sites that need a tenant
     * get one or get an error — never `undefined` silently widening a filter.
     */
    requireTenant() {
        if (!this.tenantId) {
            throw new TenantContextError(
                'No tenant is associated with this caller; refusing to run an unscoped tenant query.',
                403
            );
        }
        return this.tenantId;
    }
}

/**
 * Resolve the caller's tenant from verified credentials only.
 *
 * Order matters: the operator API key is checked first so automation callers
 * (the MCP server, schedulers) keep working, and only they may name a tenant
 * via the request body.
 */
function resolveTenantContext(req, { jwtSecret, gatewayApiKey }) {
    const authz = req.headers['authorization'] || '';
    const bearer = authz.replace(/^Bearer\s+/i, '').trim();
    const looksLikeJwt = bearer.includes('.');
    const apiKey = req.headers['x-api-key'] || (bearer && !looksLikeJwt ? bearer : null);

    // 1) Operator API key — a trusted server-side caller. It holds a secret no
    // browser has, so a tenant named in its body is trusted by delegation.
    if (gatewayApiKey && apiKey && timingSafeEqual(apiKey, gatewayApiKey)) {
        const named = req.body && typeof req.body.tenantId === 'string' ? req.body.tenantId.trim() : null;
        return new TenantContext({
            actor: 'api-client',
            tenantId: named || null,
            crossTenant: true,
            source: 'api-key'
        });
    }

    // 2) Session JWT — the tenant is whatever the signature says, and nothing else.
    if (looksLikeJwt) {
        let decoded;
        try {
            decoded = jwt.verify(bearer, jwtSecret);
        } catch (e) {
            throw new TenantContextError('Invalid or expired session token.', 401);
        }
        const tenantId = decoded.tenant_id || decoded.tenantId || null;
        return new TenantContext({
            actor: decoded.email || decoded.sub || decoded.user || 'session-user',
            tenantId,
            // A super-admin may span tenants, but only via an explicit opt-in at
            // the call site — never as a silent default on a normal read.
            crossTenant: Boolean(decoded.isSuperAdmin),
            source: 'session-jwt'
        });
    }

    throw new TenantContextError(
        'Unauthorized. A session token or operator API key is required.',
        401
    );
}

function timingSafeEqual(a, b) {
    const crypto = require('crypto');
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Express middleware. Attaches req.tenantCtx, and keeps req.actor / req.tenantId
 * populated for the existing audit-log call sites.
 */
function requireTenantContext({ jwtSecret, gatewayApiKey }) {
    return function (req, res, next) {
        try {
            const ctx = resolveTenantContext(req, { jwtSecret, gatewayApiKey });
            req.tenantCtx = ctx;
            req.actor = ctx.actor;
            req.tenantId = ctx.tenantId;
            return next();
        } catch (err) {
            if (err instanceof TenantContextError) {
                return res.status(err.statusCode).json({ error: err.message });
            }
            return next(err);
        }
    };
}

module.exports = {
    TenantContext,
    TenantContextError,
    resolveTenantContext,
    requireTenantContext
};
