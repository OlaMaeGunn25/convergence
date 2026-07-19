/**
 * Automated audit queue store.
 * ============================
 * Backends: Supabase `audit_queue_jobs` / `audit_queue_state` (production) or
 * config/audit_queue.json (local dev when Supabase is unconfigured).
 *
 * The race this replaces: server.js read audit_queue.json, picked the first
 * job with status 'queued', flipped it to 'running', and wrote the whole file
 * back. Two ticks — or two server instances — could read the same snapshot and
 * both claim the same job, running one audit twice. The `claim()` call below is
 * a single UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1),
 * so exactly one caller can ever win a given job.
 */

const { isSupabaseConfigured, selectRows, insertRow, upsertRows, rpc } = require('../supabase');
const jsonFile = require('./json_file');

const EMPTY = { active: false, jobs: [] };

/** Map a DB row onto the JSON shape the existing API responses and UI expect. */
function rowToJob(row) {
  return {
    id: row.id,
    domain: row.domain,
    vertical: row.vertical,
    status: row.status,
    error: row.error || undefined,
    queuedAt: row.queued_at,
    startedAt: row.started_at || undefined,
    completedAt: row.completed_at || undefined
  };
}

function newJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

class AuditQueueStore {
  /** @param {string} queueFile absolute path used by the JSON fallback */
  constructor(queueFile) {
    this.queueFile = queueFile;
  }

  get usingSupabase() {
    return isSupabaseConfigured();
  }

  /** Full queue snapshot: `{ active, jobs }`. */
  async getQueue() {
    if (!this.usingSupabase) {
      return jsonFile.read(this.queueFile, EMPTY);
    }
    const [state, jobs] = await Promise.all([
      selectRows('audit_queue_state', 'id=eq.true&select=active&limit=1'),
      selectRows('audit_queue_jobs', 'select=*&order=queued_at.asc')
    ]);
    return {
      active: Boolean(state && state[0] && state[0].active),
      jobs: (jobs || []).map(rowToJob)
    };
  }

  /**
   * Enqueue domains and/or toggle the loop.
   * @returns {{active: boolean, queued: number}}
   */
  async enqueue(domains, active, vertical) {
    if (!this.usingSupabase) {
      return jsonFile.mutate(this.queueFile, EMPTY, (queue) => {
        const next = { active: queue.active, jobs: Array.isArray(queue.jobs) ? queue.jobs : [] };
        for (const domain of domains || []) {
          if (next.jobs.some(j => j.domain === domain && j.status === 'queued')) continue;
          next.jobs.push({
            id: newJobId(),
            domain,
            vertical: vertical || null,
            status: 'queued',
            queuedAt: new Date().toISOString()
          });
        }
        if (active !== undefined) next.active = Boolean(active);
        return {
          value: next,
          result: { active: next.active, queued: next.jobs.filter(j => j.status === 'queued').length }
        };
      });
    }

    // The partial unique index on (domain) WHERE status='queued' is what makes
    // the "already queued?" check atomic — the JSON version tested membership
    // and appended as two separate steps, so concurrent POSTs could both pass
    // the test and enqueue the same domain twice. A duplicate-key rejection here
    // means another caller already queued it, which is the desired end state, so
    // it is swallowed. Rows go in one at a time because a batch INSERT aborts
    // wholesale on a single conflict.
    for (const domain of domains || []) {
      try {
        await insertRow('audit_queue_jobs', {
          id: newJobId(),
          domain,
          vertical: vertical || null,
          status: 'queued',
          queued_at: new Date().toISOString()
        });
      } catch (err) {
        const isDuplicate = err.statusCode === 409 || /duplicate key/i.test(err.message || '');
        if (!isDuplicate) throw err;
      }
    }

    if (active !== undefined) {
      await upsertRows('audit_queue_state', { id: true, active: Boolean(active), updated_at: new Date().toISOString() });
    }

    const queue = await this.getQueue();
    return { active: queue.active, queued: queue.jobs.filter(j => j.status === 'queued').length };
  }

  /**
   * Atomically claim the next queued job, or null when the queue is paused or
   * empty. On the Supabase backend this is the FOR UPDATE SKIP LOCKED path.
   */
  async claimNextJob() {
    if (!this.usingSupabase) {
      return jsonFile.mutate(this.queueFile, EMPTY, (queue) => {
        if (!queue.active) return { value: undefined, result: null };
        const job = (queue.jobs || []).find(j => j.status === 'queued');
        if (!job) return { value: undefined, result: null };
        job.status = 'running';
        job.startedAt = new Date().toISOString();
        return { value: queue, result: { ...job } };
      });
    }
    const rows = await rpc('claim_next_audit_job');
    return rows && rows.length ? rowToJob(rows[0]) : null;
  }

  /** Record the terminal outcome for a claimed job. */
  async completeJob(jobId, success, errorMessage) {
    if (!this.usingSupabase) {
      return jsonFile.mutate(this.queueFile, EMPTY, (queue) => {
        const job = (queue.jobs || []).find(j => j.id === jobId);
        if (!job) return { value: undefined, result: null };
        job.status = success ? 'completed' : 'failed';
        job.completedAt = new Date().toISOString();
        if (success) delete job.error; else job.error = errorMessage;
        return { value: queue, result: { ...job } };
      });
    }
    const rows = await rpc('complete_audit_job', {
      p_id: jobId,
      p_success: Boolean(success),
      p_error: success ? null : (errorMessage || null)
    });
    return rows && rows.length ? rowToJob(rows[0]) : null;
  }

  /**
   * Return jobs stranded in 'running' by a worker that died back to 'queued'.
   * No-op on the file backend, where a single process owns the queue anyway.
   */
  async requeueStale(staleAfterMinutes = 30) {
    if (!this.usingSupabase) return [];
    const rows = await rpc('requeue_stale_audit_jobs', { p_stale_after: `${staleAfterMinutes} minutes` });
    return (rows || []).map(rowToJob);
  }
}

module.exports = { AuditQueueStore };
