/**
 * Agent Telemetry Stream (Phase 4, MON-01)
 * ========================================
 * A capped, append-only stream of agent + task events (provisioned, deployed,
 * paused, shutdown, task started/progress/completed/failed/blocked, onboarding
 * updates). The Monitoring agent emits here and the floating agent monitor polls
 * it (short-interval polling per the locked decision — no SSE/WS).
 *
 * Ring-buffered (default 1000 events) so the dev JSON store never grows
 * unbounded; production uses the Supabase table `agent_telemetry`.
 */

const crypto = require('crypto');
const path = require('path');
const { isSupabaseConfigured, insertRow, selectRows } = require('./supabase');
const jsonFile = require('./stores/json_file');

const DEFAULT_MAX = 1000;
const EMPTY = { events: [] };

class TelemetryStream {
  constructor(options = {}) {
    this.usingSupabase = isSupabaseConfigured();
    this.file = options.file || path.join(__dirname, '..', 'config', 'agent_telemetry.json');
    this.max = options.max || DEFAULT_MAX;
  }

  async emit({ tenantId = null, agentId = null, taskId = null, event, status = 'info', detail = null }) {
    if (!event) throw new Error('A telemetry "event" is required.');
    const now = new Date().toISOString();
    const rec = { id: `tel_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, tenantId, agentId, taskId, event, status, detail, at: now };
    if (this.usingSupabase) {
      await insertRow('agent_telemetry', { id: rec.id, tenant_id: tenantId, agent_id: agentId, task_id: taskId, event, status, detail, at: now });
      return rec;
    }
    return jsonFile.mutate(this.file, EMPTY, (store) => {
      let arr = Array.isArray(store.events) ? store.events : [];
      arr.push(rec);
      if (arr.length > this.max) arr = arr.slice(arr.length - this.max); // ring-buffer cap
      return { value: { events: arr }, result: rec };
    });
  }

  /** Newest-first list, optionally filtered by tenant/task/since. */
  async list({ tenantId, taskId, since, limit = 100 } = {}) {
    if (this.usingSupabase) {
      const f = ['select=*', 'order=at.desc', `limit=${limit}`];
      if (tenantId) f.push(`tenant_id=eq.${encodeURIComponent(tenantId)}`);
      if (taskId) f.push(`task_id=eq.${encodeURIComponent(taskId)}`);
      return (await selectRows('agent_telemetry', f.join('&'))) || [];
    }
    const store = jsonFile.readSync(this.file, EMPTY);
    let arr = (store.events || []).filter(e =>
      (tenantId === undefined || e.tenantId === tenantId) &&
      (taskId === undefined || e.taskId === taskId));
    if (since) arr = arr.filter(e => e.at > since);
    return arr.slice(-limit).reverse();
  }
}

module.exports = { TelemetryStream };
