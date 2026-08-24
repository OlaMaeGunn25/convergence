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
    this.stats = {
      mcpCalls: 0,
      apiCalls: 0,
      // Counts only genuine DEGRADATIONS: MCP was configured for this connector
      // and failed. It deliberately does NOT count connectors that never had an
      // MCP surface — conflating "MCP broke" with "MCP never existed" made the
      // metric meaningless for the majority of the catalogue.
      fallbacks: 0,
      lastTransport: null,
      lastFallbackReason: null
    };
  }

  /**
   * Is an MCP route even configured for this connector? Distinct from
   * `_mcpLive()`: "no MCP was ever wired up" is a different condition from
   * "the MCP server we wired up is down", and only the second is a degradation.
   */
  _mcpConfigured() {
    return !!(this.mcp && this.mcp.bootstrapper && this.mcp.serverId);
  }

  _mcpLive() {
    return this._mcpConfigured() && this.mcp.bootstrapper.isRunning(this.mcp.serverId);
  }

  /** Retained for callers/tests that assert on availability. */
  _mcpAvailable() {
    return this._mcpLive();
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
    if (!this._mcpLive()) throw new Error('MCP server is not running.');
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

    // Short-circuit: with no MCP route configured at all there is nothing to
    // attempt. Previously every call on such a connector threw, logged a
    // fallback line and incremented the counter — for the connectors with no MCP
    // surface that is per-call noise scaling with traffic, describing a
    // degradation that never happened.
    if (!this._mcpConfigured()) {
      if (this.mode === 'mcp') {
        throw new Error(`MCP execution failed for "${capability}" on ${this.connectorId}: no MCP route is configured for this connector.`);
      }
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
      mcpConfigured: this._mcpConfigured(),
      mcpLive: this._mcpLive(),
      ...this.stats
    };
  }
}

module.exports = { DualModeClient };
