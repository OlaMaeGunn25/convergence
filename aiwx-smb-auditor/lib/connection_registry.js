/**
 * Connection Registry + Builder
 * =============================
 * Tracks the live connection state of each external system CONVERGENCE-Ai has
 * been asked to wire into the governed MCP layer, and is the "builder" that
 * establishes a connection for a catalog connector.
 *
 * State machine:
 *   not_connected → configuring → connected
 *                        ↘ error ↗          ↘ disconnected
 * (error → configuring | disconnected; disconnected → configuring)
 *
 * SECURITY: the builder NEVER accepts credentials over its API. A connector's
 * secrets live only in env / Secret Manager (the connector's `envKeys`). The
 * builder checks whether those keys are populated and reports readiness — it
 * does not receive, store, or echo secret values. This mirrors the
 * /api/supabase-credentials env-only rule.
 *
 * Backing: Supabase table `system_connections` (production) or a process-locked
 * JSON file (dev/CI), matching the lib/task_model.js + lib/stores/* pattern.
 */

const crypto = require('crypto');
const path = require('path');
const { isSupabaseConfigured, insertRow, selectRows, updateRows } = require('./supabase');
const jsonFile = require('./stores/json_file');
const catalog = require('./connectors/catalog');
const preconditions = require('./preconditions');
const connectionModes = require('./connection_modes');

// `preconditions_pending` is a first-class state, not a flavour of not_connected.
// Some systems — Epic most obviously — cannot be connected on demand: the tenant
// must clear out-of-band steps (agreements, vendor registration, per-organisation
// enablement) that no amount of correct code satisfies. Making that visible means
// an operator sees "waiting on the health system" rather than a connection that
// merely appears never to succeed.
const STATES = ['not_connected', 'preconditions_pending', 'configuring', 'connected', 'error', 'disconnected'];
const VALID_TRANSITIONS = {
  not_connected: ['preconditions_pending', 'configuring'],
  // Forward once preconditions clear; back to not_connected if the tenant abandons it.
  preconditions_pending: ['configuring', 'not_connected'],
  configuring: ['connected', 'error', 'disconnected'],
  connected: ['disconnected', 'error', 'configuring'],
  error: ['configuring', 'disconnected'],
  disconnected: ['configuring', 'preconditions_pending']
};

function canTransition(from, to) {
  if (!STATES.includes(to)) return false;
  if (from === to) return true; // idempotent re-assert
  return (VALID_TRANSITIONS[from] || []).includes(to);
}

function newConnId() {
  return `conn_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

const EMPTY = { connections: [] };

function rowToConn(row) {
  if (!row) return null;
  return {
    id: row.id,
    connectorId: row.connector_id,
    tenantId: row.tenant_id || null,
    status: row.status,
    health: row.health || null,
    config: row.config || {},
    lastError: row.last_error || null,
    actor: row.actor || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

class ConnectionRegistry {
  constructor(options = {}) {
    this.usingSupabase = isSupabaseConfigured();
    this.file = options.file || path.join(__dirname, '..', 'config', 'connections.json');
    // DMC: optional MCP runtime. Absent (tests, minimal deployments) means MCP
    // is treated as unavailable — 'auto' falls back to the API and says why,
    // 'mcp' errors. Never a silent pretend-success.
    this.mcpBootstrapper = options.mcpBootstrapper || null;
  }

  async list({ tenantId } = {}) {
    if (this.usingSupabase) {
      const filters = ['select=*', 'order=updated_at.desc'];
      if (tenantId) filters.push(`tenant_id=eq.${encodeURIComponent(tenantId)}`);
      const rows = await selectRows('system_connections', filters.join('&'));
      return (rows || []).map(rowToConn);
    }
    const store = jsonFile.readSync(this.file, EMPTY);
    return (store.connections || []).filter(c => tenantId === undefined || c.tenantId === tenantId);
  }

  async get(connectorId, tenantId = null) {
    const all = await this.list({ tenantId: tenantId || undefined });
    return all.find(c => c.connectorId === connectorId && (tenantId == null || c.tenantId === tenantId)) || null;
  }

  /**
   * Merge the live connection state onto every catalog connector, so the UI /
   * status endpoint always shows the full surface (systems with no connection
   * yet appear as `not_connected`).
   */
  async statusBoard({ tenantId = null } = {}) {
    const conns = await this.list({ tenantId: tenantId || undefined });
    const byConnector = new Map(conns.map(c => [c.connectorId, c]));
    return catalog.list().map(c => {
      const conn = byConnector.get(c.id);
      return {
        connectorId: c.id, name: c.name, category: c.category, kind: c.kind, auth: c.auth,
        status: conn ? conn.status : 'not_connected',
        health: conn ? conn.health : null,
        credentialsConfigured: (c.envKeys || []).every(k => !!process.env[k]),
        lastError: conn ? conn.lastError : null,
        updatedAt: conn ? conn.updatedAt : null
      };
    });
  }

  async _persist(conn) {
    if (this.usingSupabase) {
      const patch = {
        status: conn.status, health: conn.health, config: conn.config,
        last_error: conn.lastError, actor: conn.actor, updated_at: conn.updatedAt
      };
      const existing = await selectRows('system_connections',
        `connector_id=eq.${encodeURIComponent(conn.connectorId)}&tenant_id=eq.${encodeURIComponent(conn.tenantId || '')}&limit=1`);
      if (existing && existing[0]) {
        const rows = await updateRows('system_connections', `id=eq.${encodeURIComponent(existing[0].id)}`, patch);
        return rowToConn(Array.isArray(rows) ? rows[0] : rows);
      }
      const rows = await insertRow('system_connections', {
        id: conn.id, connector_id: conn.connectorId, tenant_id: conn.tenantId,
        status: conn.status, health: conn.health, config: conn.config,
        last_error: conn.lastError, actor: conn.actor,
        created_at: conn.createdAt, updated_at: conn.updatedAt
      });
      return rowToConn(Array.isArray(rows) ? rows[0] : rows);
    }
    return jsonFile.mutate(this.file, EMPTY, (store) => {
      const connections = Array.isArray(store.connections) ? store.connections : [];
      const idx = connections.findIndex(c => c.connectorId === conn.connectorId && c.tenantId === conn.tenantId);
      if (idx >= 0) connections[idx] = conn; else connections.push(conn);
      return { value: { connections }, result: conn };
    });
  }

  /**
   * Build (establish) a connection for a catalog connector.
   * @returns { connection, authAction } — authAction describes what a human must
   *          do out-of-band when credentials are not yet present. Secrets are
   *          NEVER accepted here.
   */
  async build(connectorId, { tenantId = null, actor = null, config = {}, tenant = {}, attestations = [], connectionMode = 'api' } = {}) {
    const connector = catalog.get(connectorId);
    if (!connector) throw new Error(`Unknown connector "${connectorId}".`);

    // DMC: validate the requested mode against what the connector can honestly
    // offer, BEFORE any state moves. Strict 'mcp' against a connector with no
    // MCP surface is a refusal, not a quiet downgrade — the operator chose
    // strictness on purpose.
    const availableModes = connectionModes.modesFor(connectorId);
    if (!connectionModes.MODES.includes(connectionMode)) {
      throw new Error(`connectionMode must be one of ${connectionModes.MODES.join('|')}.`);
    }
    if (connectionMode === 'mcp' && !availableModes.includes('mcp')) {
      const existing0 = await this.get(connectorId, tenantId);
      return {
        connection: existing0 || null,
        authAction: null,
        modeError: {
          status: 'mcp_unsupported',
          reason: `"${connector.name}" has no MCP surface. Available modes: ${availableModes.join(', ')}. Use 'api', or 'auto' if an MCP surface is added later.`
        }
      };
    }

    // Reject any attempt to pass secret-looking values through the builder.
    const suspect = Object.keys(config || {}).find(k => /secret|token|password|api[_-]?key/i.test(k));
    if (suspect) {
      throw new Error(`Refusing credential "${suspect}" over the API. Set it in env / Secret Manager (${(connector.envKeys || []).join(', ')}).`);
    }

    const now = new Date().toISOString();
    const existing = await this.get(connectorId, tenantId);
    const credsReady = (connector.envKeys || []).every(k => !!process.env[k]);

    const conn = existing || {
      id: newConnId(), connectorId, tenantId, status: 'not_connected',
      health: null, config: {}, lastError: null, actor, createdAt: now, updatedAt: now
    };
    // Non-secret config (region, subdomain, etc.) may be recorded.
    conn.config = Object.assign({}, conn.config, config);
    conn.actor = actor || conn.actor;
    conn.updatedAt = now;

    // PRE: a connector with declared preconditions cannot proceed toward
    // `connected` until the blocking ones are satisfied. Without this the
    // preconditions would be documentation rather than a control — the builder
    // would happily mark Epic connected the moment env vars appeared, skipping
    // the agreement, the vendor registration and the per-organisation
    // enablement that actually grant the access.
    if (Array.isArray(connector.preconditions) && connector.preconditions.length) {
      const evaluation = preconditions.evaluate({
        connectorId, preconditions: connector.preconditions, tenant, attestations
      });
      const gated = preconditions.gate(evaluation);
      if (!gated.ok) {
        conn.status = canTransition(conn.status, 'preconditions_pending') ? 'preconditions_pending' : conn.status;
        conn.health = 'preconditions_unmet';
        conn.lastError = gated.reason;
        const saved = await this._persist(conn);
        return {
          connection: saved || conn,
          authAction: null,
          preconditions: evaluation,
          blocked: gated
        };
      }
    }

    if (!canTransition(conn.status, 'configuring')) {
      // Already connected/configuring — treat build as an idempotent re-check.
    } else {
      conn.status = 'configuring';
    }

    let authAction = null;
    if (credsReady) {
      conn.status = 'connected';
      conn.health = 'ok';
      conn.lastError = null;
    } else {
      conn.status = conn.status === 'connected' ? 'configuring' : conn.status;
      conn.health = 'pending_credentials';
      authAction = connector.auth === 'oauth2'
        ? { type: 'oauth2', message: `Complete the ${connector.name} OAuth grant in its developer console; store the resulting token in Secret Manager as ${connector.envKeys.join(' / ')}. The builder never handles the token.` }
        : connector.auth === 'api_key'
          ? { type: 'api_key', message: `Set ${connector.name} credentials as env vars: ${connector.envKeys.join(', ')}. Do not send them to this API.` }
          : { type: 'none', message: `${connector.name} needs no credentials.` };
    }

    // DMC: resolve which transport actually serves this connection, and say so.
    // "It connected" and "it connected over the path you chose" are different
    // facts, and the onboarding feedback names the real one.
    conn.connectionMode = connectionMode;
    if (conn.status === 'connected') {
      let transport = 'api';
      let message = `Connected to ${connector.name} via native API.`;

      if ((connectionMode === 'mcp' || connectionMode === 'auto') && availableModes.includes('mcp')) {
        // DMC priority ladder: the system's own MCP server first, the spun-up
        // API→MCP wrapper second, and only then — auto mode only — the raw
        // native API as the floor. Each rung's failure is carried into the
        // feedback so the operator can see how far down the ladder they landed.
        const ladder = connectionModes.mcpLadderFor(connectorId);
        if (this.mcpBootstrapper && ladder.length) {
          const failures = [];
          for (const rung of ladder) {
            try {
              const started = await this.mcpBootstrapper.start(
                Object.assign({ id: `${connectorId}_${tenantId || 'default'}_${rung.tier}` }, rung)
              );
              transport = 'mcp';
              conn.mcpServerId = started.id;
              conn.mcpTier = rung.tier;
              message = rung.tier === 'vendor_mcp'
                ? `Successfully connected via the system's MCP server '${started.id}'.`
                : failures.length
                  ? `System MCP server unavailable (${failures[0]}); connected via spun-up API→MCP wrapper '${started.id}'.`
                  : `Successfully connected via spun-up API→MCP wrapper '${started.id}'.`;
              break;
            } catch (e) {
              failures.push(`${rung.tier}: ${e.message}`);
            }
          }
          if (transport !== 'mcp') {
            if (connectionMode === 'mcp') {
              conn.status = 'error';
              conn.health = 'mcp_handshake_failed';
              conn.lastError = failures.join(' | ');
              conn.transport = null;
              const savedErr = await this._persist(conn);
              return {
                connection: savedErr || conn, authAction,
                message: `MCP connection failed on every rung (${failures.join(' | ')}). Mode 'mcp' does not fall back — retry, or reconnect with 'auto'.`
              };
            }
            message = `MCP connection failed (${failures.join(' | ')}); fell back to ${connector.name} native API.`;
          }
        } else if (connectionMode === 'mcp') {
          conn.status = 'error';
          conn.health = 'mcp_unavailable';
          conn.lastError = 'No MCP bootstrapper or server descriptor is configured.';
          const savedErr = await this._persist(conn);
          return {
            connection: savedErr || conn, authAction,
            message: 'MCP connection failed: no MCP runtime is configured. Mode \'mcp\' does not fall back.'
          };
        } else {
          message = `MCP runtime not configured; fell back to ${connector.name} native API.`;
        }
      }
      conn.transport = transport;
      const saved = await this._persist(conn);
      return { connection: saved || conn, authAction, message };
    }

    const saved = await this._persist(conn);
    return { connection: saved || conn, authAction };
  }

  /** Explicit state transition (health checks, disconnects, error reporting). */
  async setStatus(connectorId, toStatus, { tenantId = null, health = undefined, error = undefined, actor = null } = {}) {
    const conn = await this.get(connectorId, tenantId);
    if (!conn) throw new Error(`No connection for "${connectorId}".`);
    if (!canTransition(conn.status, toStatus)) {
      throw new Error(`Illegal connection transition ${conn.status} → ${toStatus} for ${connectorId}.`);
    }
    conn.status = toStatus;
    if (health !== undefined) conn.health = health;
    if (error !== undefined) conn.lastError = error;
    if (actor) conn.actor = actor;
    conn.updatedAt = new Date().toISOString();
    return this._persist(conn);
  }

  async disconnect(connectorId, { tenantId = null, actor = null } = {}) {
    return this.setStatus(connectorId, 'disconnected', { tenantId, health: null, error: null, actor });
  }
}

module.exports = { ConnectionRegistry, STATES, VALID_TRANSITIONS, canTransition };
