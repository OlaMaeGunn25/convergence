/*
   CONVERGENCE-Ai™ — Product version (hub)

   The hub is served as static ES modules with no build step on this path, so it
   cannot read package.json at runtime. This constant is therefore a SECOND place
   the version appears, which is exactly the kind of duplication that drifts.

   It is held honest by the gateway test suite (test/run.js, Test Set 45), which
   asserts this file, aiwx-convergence-ai/package.json, aiwx-smb-auditor/package.json
   and docs/ROADMAP.md all agree. Bumping one without the others fails the build.

   Source of truth is docs/ROADMAP.md; bump all four together.
*/

export const PRODUCT_VERSION = '0.11.0';

/** Short label for the UI, e.g. "v0.10.0". */
export function versionLabel() {
    return `v${PRODUCT_VERSION}`;
}

/**
 * Ask the connected gateway what version IT is running.
 *
 * The hub and the gateway are deployed separately and can be different versions;
 * showing only the hub's own number would hide that. Returns null when no gateway
 * is reachable, so the caller can show the hub version alone rather than a stale
 * or invented one.
 */
export async function fetchGatewayVersion(endpoint) {
    if (!endpoint) return null;
    try {
        const res = await fetch(`${endpoint}/api/version`);
        if (!res.ok) return null;
        const data = await res.json();
        return data && data.version ? data : null;
    } catch (e) {
        return null;
    }
}
