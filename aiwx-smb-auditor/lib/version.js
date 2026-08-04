/**
 * Product Version (VER)
 * =====================
 * ONE source of truth for the running version: package.json. Everything that
 * reports a version — the health endpoint, the API, the MCP surface, the hub UI,
 * the published documentation — reads from here or mirrors it.
 *
 * The reason for the single source is not tidiness. A version number written in
 * two places is a version number that will eventually disagree with itself, and
 * a deployment reporting the wrong version is worse than one reporting none: it
 * sends you looking for a bug in code that is not running. `test/run.js` asserts
 * that package.json, the hub package.json and docs/ROADMAP.md all agree, so the
 * drift fails the build rather than reaching production.
 *
 * Build metadata (commit, build time) is injected by the image build and is
 * absent in local development. Absent is reported as null rather than guessed —
 * an unknown commit is a fact worth stating.
 */

const pkg = require('../package.json');

const STARTED_AT = new Date().toISOString();

/** The semantic version string, e.g. "0.9.0". */
function version() {
  return pkg.version;
}

/**
 * Full build/runtime descriptor. Safe to expose publicly: it carries no
 * credentials, no paths and no tenant data — only what is running and since when.
 */
function buildInfo() {
  return {
    product: 'CONVERGENCE-Ai',
    version: pkg.version,
    // Injected at image build (docker build --build-arg / CI). Null locally.
    commit: process.env.AIWX_BUILD_SHA || null,
    builtAt: process.env.AIWX_BUILD_TIME || null,
    node: process.version,
    startedAt: STARTED_AT,
    uptimeSeconds: Math.round(process.uptime())
  };
}

/**
 * Compare a claimed version against what is actually running. Used by deploy
 * verification: after a release, assert the live instance reports the version
 * that was meant to ship rather than trusting that it did.
 */
function matches(expected) {
  const actual = pkg.version;
  return {
    ok: String(expected || '').trim() === actual,
    expected: String(expected || '').trim() || null,
    actual
  };
}

module.exports = { version, buildInfo, matches, STARTED_AT };
