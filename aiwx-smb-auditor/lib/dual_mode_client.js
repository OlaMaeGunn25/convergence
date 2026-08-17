/**
 * DualModeClient — unified execution over MCP with native-API fallback (DMC)
 * ==========================================================================
 * One interface for "run this capability against the connected system",
 * regardless of transport:
 *
 *   mode 'api'  — straight to the native adapter. MCP is never touched.
 *   mode 'mcp'  — MCP only. A failure SURFACES; it does not silently degrade,
 *                 because the operator chose strictness on purpose.
 *   mode 'auto' — MCP first; on timeout, error, seam, or a dead server, the
 *                 failure is logged and the SAME call is routed to the native
 *                 adapter. The result says which transport actually served it
 *                 and why, because "it worked" and "it worked over the path you
 *                 chose" are different facts.
 *
 * The api adapter is a plain map of capability name → async function — which is
 * exactly the shape the existing connector modules already export, so wiring a
 * vertical in is an object literal, not an integration project.
 *
 * Governance note, load-bearing: this client runs INSIDE connector
 * implementations, underneath the tool registry. Approval gates, the compliance
 * floor, autonomy grants and preconditions have all already run by the time a
 * call reaches here. Transport is plumbing, not permission — an MCP route could
 * never be a way around a HITL gate.
 */

class DualModeClient {
  /**
   * @param connectorId    catalog id, for logs and results
   * @param mode           'mcp' | 'api' | 'auto'
   * @param mcp            { bootstrapper, serverId } — a running MCP server handle
   * @param apiAdapter     { [capability]: async (input) => result }
   * @param logger         optional; receives fallback/debug lines (never secrets)
   */
  constructor({ connectorId, mode = 'auto', mcp = null, apiAdapter = {}, logger = null } = {}) {
    if (!['mcp', 'api', 'auto'].includes(mode)) throw new Error(`Invalid mode "${mode}".`);
    this.connectorId = connectorId;
    this.mode = mode;
    this.mcp = mcp;
    this.apiAdapter = apiAdapter || {};
    this.log = logger || (() => {});
    this.stats = { mcpCalls: 0, apiCalls: 0, fallbacks: 0, lastTransport: null, lastFallbackReason: null };
  }

  _mcpAvailable() {
    return !!(this.mcp && this.mcp.bootstrapper && this.mcp.serverId &&
      this.mcp.bootstrapper.isRunning(this.mcp.serverId));
  }

  async _viaApi(capability, input) {
    const fn = this.apiAdapter[capability];
    if (typeof fn !== 'function') {
      throw new Error(`No native API implementation for "${capability}" on ${this.connectorId}.`);
    }
    this.stats.apiCalls++;
    this.stats.lastTransport = 'api';
    return fn(input);
  }

  async _viaMcp(capability, input) {
    if (!this._mcpAvailable()) throw new Error('MCP server is not running.');
    const res = await this.mcp.bootstrapper.callTool(this.mcp.serverId, capability, input);
    this.stats.mcpCalls++;
    this.stats.lastTransport = 'mcp';
    return res;
  }

  /**
   * Execute one capability. Returns { transport, result, fallback?, reason? } so
   * the caller — and the audit trail — always knows which path actually served.
   */
  async execute(capability, input = {}) {
    if (this.mode === 'api') {
      return { transport: 'api', result: await this._viaApi(capability, input) };
    }

    try {
      const result = await this._viaMcp(capability, input);
      return { transport: 'mcp', result };
    } catch (err) {
      if (this.mode === 'mcp') {
        // Strict mode: chosen on purpose, so the failure is the answer.
        throw new Error(`MCP execution failed for "${capability}" on ${this.connectorId}: ${err.message}`);
      }
      // auto: log and fall back — seamlessly for the workflow, loudly for the log.
      this.stats.fallbacks++;
      this.stats.lastFallbackReason = err.message;
      this.log(`[DualMode] ${this.connectorId}: MCP failed for "${capability}" (${err.message}) — falling back to native API`);
      const result = await this._viaApi(capability, input);
      return { transport: 'api', fallback: true, reason: err.message, result };
    }
  }

  /** Capabilities reachable on the API path (the guaranteed floor). */
  listCapabilities() {
    return Object.keys(this.apiAdapter);
  }

  /** Snapshot for telemetry / the floating status component. */
  status() {
    return {
      connectorId: this.connectorId,
      mode: this.mode,
      mcpLive: this._mcpAvailable(),
      ...this.stats
    };
  }
}

module.exports = { DualModeClient };
