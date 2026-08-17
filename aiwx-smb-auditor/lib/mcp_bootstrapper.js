/**
 * MCP Bootstrapper — on-demand MCP server lifecycle (DMC)
 * =======================================================
 * Launches, verifies, drives and tears down MCP servers on demand:
 *
 *   stdio — spawn a local child process (node/python/executable) speaking
 *           newline-delimited JSON-RPC on stdin/stdout. Credentials are injected
 *           as environment variables, resolved BY NAME from this process's own
 *           env/secret store at spawn time. Values never appear in the spec, the
 *           logs, or any return value; a missing ref is reported by NAME only.
 *
 *   sse   — verify a remote endpoint by handshake: the endpoint must answer with
 *           an event-stream within the timeout, with auth headers resolved from
 *           refs the same way. Tool routing over SSE is a declared seam
 *           (`sse_routing_seam`), not a stub that pretends: a caller in `auto`
 *           mode falls back to the API on it honestly.
 *
 * Handshake is bounded (default 10s, DMC requirement) — a bootstrap that can
 * hang is a bootstrap that takes the onboarding flow down with it.
 *
 * Cleanup is not optional: every started server is tracked, `stopAll()` kills
 * the lot, and a process-exit hook runs it so an agent session that dies cannot
 * leak child processes.
 */

const { spawn } = require('child_process');
const crypto = require('crypto');

const DEFAULT_HANDSHAKE_MS = 10_000;
const DEFAULT_CALL_MS = 10_000;

/** Resolve env refs (names) → child env. Missing refs reported by NAME only. */
function resolveEnvRefs(envRefs = [], baseEnv = process.env) {
  const child = {};
  const missing = [];
  for (const name of envRefs) {
    if (baseEnv[name] === undefined) missing.push(name);
    else child[name] = baseEnv[name];
  }
  return { child, missing };
}

class McpBootstrapper {
  constructor(options = {}) {
    this.handshakeTimeoutMs = options.handshakeTimeoutMs || DEFAULT_HANDSHAKE_MS;
    this.callTimeoutMs = options.callTimeoutMs || DEFAULT_CALL_MS;
    this.log = options.logger || (() => {});
    this.env = options.env || process.env;
    this._servers = new Map(); // id -> { transport, child, pending, nextId, spec }
    // A crashed agent session must not leave orphaned MCP children behind.
    this._exitHook = () => this.stopAllSync();
    process.once('exit', this._exitHook);
  }

  /**
   * Start a server and complete the MCP initialize handshake within the timeout.
   * @returns { id, transport, serverInfo } — never credential material.
   */
  async start(spec = {}) {
    const id = spec.id || `mcp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const transport = spec.transport;
    if (transport === 'stdio') return this._startStdio(id, spec);
    if (transport === 'sse') return this._startSse(id, spec);
    throw new Error(`Unsupported MCP transport "${transport}".`);
  }

  async _startStdio(id, spec) {
    if (!spec.command) throw new Error('stdio transport requires a command.');
    const { child: envInject, missing } = resolveEnvRefs(spec.envRefs || [], this.env);
    if (missing.length) {
      throw new Error(`Missing credential refs for MCP server: ${missing.join(', ')} (set them in env / Secret Manager).`);
    }

    const child = spawn(spec.command, spec.args || [], {
      env: Object.assign({}, this.env, envInject),
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });

    const entry = { transport: 'stdio', child, pending: new Map(), nextId: 1, spec: { command: spec.command, args: spec.args || [] }, buffer: '' };
    this._servers.set(id, entry);

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => this._onStdout(entry, chunk));
    child.on('exit', () => {
      // Reject every in-flight call so nothing waits on a dead server.
      for (const [, p] of entry.pending) p.reject(new Error('MCP server process exited.'));
      entry.pending.clear();
      entry.dead = true;
    });

    this.log(`[McpBootstrapper] starting stdio MCP server "${id}" (${spec.command})`);
    try {
      const init = await this._rpc(entry, 'initialize', {
        protocolVersion: '2025-06-18',
        clientInfo: { name: 'convergence-gateway' },
        capabilities: {}
      }, spec.handshakeTimeoutMs || this.handshakeTimeoutMs);
      this.log(`[McpBootstrapper] "${id}" handshake ok`);
      return { id, transport: 'stdio', serverInfo: (init && init.serverInfo) || null };
    } catch (e) {
      await this.stop(id);
      throw new Error(`MCP handshake failed: ${e.message}`);
    }
  }

  async _startSse(id, spec) {
    if (!spec.url) throw new Error('sse transport requires a url.');
    if (typeof fetch !== 'function') throw new Error('global fetch unavailable in this runtime.');
    const headers = {};
    const refs = spec.headerRefs || {};
    const missing = [];
    for (const [header, refName] of Object.entries(refs)) {
      if (this.env[refName] === undefined) missing.push(refName);
      else headers[header] = this.env[refName];
    }
    if (missing.length) {
      throw new Error(`Missing credential refs for MCP server: ${missing.join(', ')} (set them in env / Secret Manager).`);
    }

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), spec.handshakeTimeoutMs || this.handshakeTimeoutMs);
    this.log(`[McpBootstrapper] verifying sse MCP endpoint "${id}"`);
    try {
      const res = await fetch(spec.url, { headers: Object.assign({ Accept: 'text/event-stream' }, headers), signal: ac.signal });
      if (!res.ok) throw new Error(`endpoint answered ${res.status}`);
      const ctype = String(res.headers.get('content-type') || '');
      if (!ctype.includes('text/event-stream')) throw new Error(`endpoint is not an event stream (${ctype || 'no content-type'})`);
      // Handshake verified; we do not hold the stream open here.
      ac.abort();
      this._servers.set(id, { transport: 'sse', spec: { url: spec.url }, dead: false });
      return { id, transport: 'sse', serverInfo: null };
    } catch (e) {
      throw new Error(`MCP handshake failed: ${e.name === 'AbortError' ? 'timeout' : e.message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  _onStdout(entry, chunk) {
    entry.buffer += chunk;
    let idx;
    while ((idx = entry.buffer.indexOf('\n')) >= 0) {
      const line = entry.buffer.slice(0, idx).trim();
      entry.buffer = entry.buffer.slice(idx + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch (e) { continue; } // non-protocol noise
      const p = msg && entry.pending.get(msg.id);
      if (!p) continue;
      entry.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message || 'MCP server error'));
      else p.resolve(msg.result);
    }
  }

  _rpc(entry, method, params, timeoutMs) {
    return new Promise((resolve, reject) => {
      if (entry.dead) return reject(new Error('MCP server process exited.'));
      const id = entry.nextId++;
      const timer = setTimeout(() => {
        entry.pending.delete(id);
        reject(new Error(`timeout after ${timeoutMs}ms (${method})`));
      }, timeoutMs);
      if (timer.unref) timer.unref();
      entry.pending.set(id, {
        resolve: v => { clearTimeout(timer); resolve(v); },
        reject: e => { clearTimeout(timer); reject(e); }
      });
      try {
        entry.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      } catch (e) {
        entry.pending.delete(id);
        clearTimeout(timer);
        reject(e);
      }
    });
  }

  /** Execute a tool on a running MCP server. */
  async callTool(id, name, args = {}, { timeoutMs = null } = {}) {
    const entry = this._servers.get(id);
    if (!entry) throw new Error(`No running MCP server "${id}".`);
    if (entry.transport === 'sse') {
      // Declared seam, not a pretend implementation — auto-mode callers fall
      // back to the API on this, which is the honest behaviour until the live
      // SSE session layer lands.
      throw new Error('sse_routing_seam: SSE tool routing is a configured seam; use api fallback.');
    }
    return this._rpc(entry, 'tools/call', { name, arguments: args }, timeoutMs || this.callTimeoutMs);
  }

  isRunning(id) {
    const e = this._servers.get(id);
    return !!(e && !e.dead);
  }

  listRunning() {
    return [...this._servers.entries()].map(([id, e]) => ({ id, transport: e.transport, dead: !!e.dead }));
  }

  /** Stop one server and release its entry. */
  async stop(id) {
    const e = this._servers.get(id);
    if (!e) return false;
    this._servers.delete(id);
    if (e.child && !e.child.killed) {
      try { e.child.kill(); } catch (err) { /* already gone */ }
    }
    this.log(`[McpBootstrapper] stopped "${id}"`);
    return true;
  }

  /** Session end / reset: stop everything. */
  async stopAll() {
    for (const id of [...this._servers.keys()]) await this.stop(id);
  }

  /** Synchronous variant for the process-exit hook. */
  stopAllSync() {
    for (const [id, e] of this._servers) {
      if (e.child && !e.child.killed) { try { e.child.kill(); } catch (err) { /* noop */ } }
      this._servers.delete(id);
    }
  }

  /** Detach the exit hook (used by tests to avoid cross-suite leakage). */
  dispose() {
    this.stopAllSync();
    process.removeListener('exit', this._exitHook);
  }
}

module.exports = { McpBootstrapper, resolveEnvRefs, DEFAULT_HANDSHAKE_MS };
