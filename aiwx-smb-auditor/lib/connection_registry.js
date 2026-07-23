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

const STATES = ['not_connected', 'configuring', 'connected', 'error', 'disconnected'];
const VALID_TRANSITIONS = {
  not_connected: ['configuring'],
  configuring: ['connected', 'error', 'disconnected'],
  connected: ['disconnected', 'error', 'configuring'],
  error: ['configuring', 'disconnected'],
  disconnected: ['configuring']
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
  async build(connectorId, { tenantId = null, actor = null, config = {} } = {}) {
    const connector = catalog.get(connectorId);
    if (!connector) throw new Error(`Unknown connector "${connectorId}".`);

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
