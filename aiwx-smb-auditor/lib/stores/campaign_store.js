/**
 * Campaign scheduler store.
 * =========================
 * Backends: Supabase `campaign_posts` / `campaign_schedule_state` (production)
 * or aiwx-social-media-agent/config/campaign_schedule.json (local dev when
 * Supabase is unconfigured).
 *
 * The race this replaces: three writers — the 60s scheduler loop in server.js,
 * the standalone scheduler_daemon.js, and the campaign REST endpoints — each
 * did read-whole-file → mutate → write-whole-file on campaign_schedule.json.
 * Two consequences, both observed in the shape of the old code:
 *
 *   1. Double publishing. The loop marked a due post PUBLISHING and wrote the
 *      file "immediately to prevent duplicate runs", but the read and the write
 *      were separate operations — a daemon run interleaving between them saw the
 *      post still APPROVED and published it a second time.
 *   2. Lost updates. A publish callback re-read the file and wrote the *entire*
 *      structure back, clobbering any edit (text, status, new post) another
 *      handler had committed while the publish was in flight.
 *
 * `claimDuePosts()` collapses (1) into one atomic UPDATE ... FOR UPDATE SKIP
 * LOCKED, and every mutation below touches only its own row, which removes (2).
 */

const { isSupabaseConfigured, selectRows, upsertRows, updateRows, deleteRows, insertRow, rpc } = require('../supabase');
const { toScheduledAt, parseScheduledTime } = require('../schedule_time');
const jsonFile = require('./json_file');

const EMPTY = { schedulerActive: false, posts: [] };

/** DB row → the post shape the REST responses, UI, and publisher scripts expect. */
function rowToPost(row) {
  const post = {
    id: row.id,
    platform: row.platform,
    date: row.scheduled_date,
    time: row.scheduled_time,
    text: row.text,
    status: row.status
  };
  if (row.image) post.image = row.image;
  if (row.error) post.error = row.error;
  if (row.logs) post.logs = row.logs;
  if (row.screenshot) post.screenshot = row.screenshot;
  if (row.published_at) post.publishedAt = row.published_at;
  if (row.hitl_task_id) post.hitlTaskId = row.hitl_task_id;
  return post;
}

/** Post shape → DB row, resolving the authored wall-clock time to an instant. */
function postToRow(post) {
  return {
    id: post.id,
    platform: post.platform,
    scheduled_date: post.date || null,
    scheduled_time: post.time || null,
    scheduled_at: post.date && post.time ? toScheduledAt(post.date, post.time) : null,
    text: post.text || null,
    image: post.image || null,
    status: post.status || 'APPROVED',
    updated_at: new Date().toISOString()
  };
}

class CampaignStore {
  /** @param {string} scheduleFile absolute path used by the JSON fallback */
  constructor(scheduleFile) {
    this.scheduleFile = scheduleFile;
  }

  get usingSupabase() {
    return isSupabaseConfigured();
  }

  /**
   * Should a PENDING post be held for human release in the shared hitl_queue
   * instead of being auto-promoted to APPROVED?
   *
   * Defaults to OFF so this migration does not silently change publishing
   * behaviour. Turning it on routes campaign approvals through the same queue
   * the admin console already renders, and the DB trigger
   * `sync_hitl_decision_to_campaign_post` releases the post when an admin
   * approves the task. Requires Supabase.
   */
  get hitlApprovalEnabled() {
    return this.usingSupabase && String(process.env.CAMPAIGN_HITL_APPROVAL || '').toLowerCase() === 'true';
  }

  /** Full snapshot: `{ schedulerActive, posts }`. */
  async getSchedule() {
    if (!this.usingSupabase) {
      return jsonFile.read(this.scheduleFile, EMPTY);
    }
    const [state, posts] = await Promise.all([
      selectRows('campaign_schedule_state', 'id=eq.true&select=scheduler_active&limit=1'),
      selectRows('campaign_posts', 'select=*&order=scheduled_at.asc.nullslast')
    ]);
    return {
      schedulerActive: Boolean(state && state[0] && state[0].scheduler_active),
      posts: (posts || []).map(rowToPost)
    };
  }

  async isSchedulerActive() {
    const { schedulerActive } = await this.getSchedule();
    return schedulerActive;
  }

  /** Has a schedule ever been created? Gates the endpoints that 400 without one. */
  async hasSchedule() {
    if (!this.usingSupabase) {
      const data = await jsonFile.read(this.scheduleFile, null);
      return data !== null;
    }
    const rows = await selectRows('campaign_posts', 'select=id&limit=1');
    return Boolean(rows && rows.length);
  }

  /**
   * Replace the campaign with `posts`, preserving the scheduler on/off switch.
   * @returns {{schedulerActive: boolean, pendingHitl: number}}
   */
  async replaceSchedule(posts) {
    const holdForHitl = this.hitlApprovalEnabled;

    // A PENDING post is either auto-promoted (legacy behaviour) or held for a
    // human decision in hitl_queue.
    const normalized = posts.map(p => {
      const status = p.status || 'APPROVED';
      if (status === 'PENDING') {
        return { ...p, status: holdForHitl ? 'PENDING' : 'APPROVED' };
      }
      return { ...p, status };
    });

    if (!this.usingSupabase) {
      return jsonFile.mutate(this.scheduleFile, EMPTY, (current) => {
        const value = { schedulerActive: Boolean(current.schedulerActive), posts: normalized };
        return { value, result: { schedulerActive: value.schedulerActive, pendingHitl: 0 } };
      });
    }

    const existing = await selectRows('campaign_posts', 'select=id');
    const keepIds = new Set(normalized.map(p => p.id));
    const staleIds = (existing || []).map(r => r.id).filter(id => !keepIds.has(id));

    if (normalized.length) {
      await upsertRows('campaign_posts', normalized.map(postToRow), 'id');
    }
    if (staleIds.length) {
      const list = staleIds.map(id => `"${String(id).replace(/"/g, '')}"`).join(',');
      await deleteRows('campaign_posts', `id=in.(${list})`);
    }

    let pendingHitl = 0;
    if (holdForHitl) {
      for (const post of normalized.filter(p => p.status === 'PENDING')) {
        // eslint-disable-next-line no-await-in-loop
        const linked = await this._ensureHitlTask(post);
        if (linked) pendingHitl++;
      }
    }

    const state = await selectRows('campaign_schedule_state', 'id=eq.true&select=scheduler_active&limit=1');
    return {
      schedulerActive: Boolean(state && state[0] && state[0].scheduler_active),
      pendingHitl
    };
  }

  /**
   * Create the hitl_queue task representing "this post is awaiting release" and
   * link it to the post. Idempotent: a post that already has a task is skipped.
   */
  async _ensureHitlTask(post) {
    const rows = await selectRows('campaign_posts', `id=eq.${encodeURIComponent(post.id)}&select=hitl_task_id`);
    if (rows && rows[0] && rows[0].hitl_task_id) return false;

    const taskId = `CP-${String(post.id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40)}`;
    try {
      await insertRow('hitl_queue', {
        id: taskId,
        tenant_id: process.env.CAMPAIGN_TENANT_ID || null,
        vertical: 'professional',
        task_type: 'Social Post Release Audit',
        details: `Scheduled ${post.platform} post for ${post.date} ${post.time}. Copy: ${String(post.text || '').slice(0, 500)}`,
        status: 'pending',
        action_code: `Release to ${post.platform}`
      });
    } catch (err) {
      // Task already exists from a previous submission of the same post id.
      if (err.statusCode !== 409 && !/duplicate key/i.test(err.message || '')) throw err;
    }
    await updateRows('campaign_posts', `id=eq.${encodeURIComponent(post.id)}`, { hitl_task_id: taskId });
    return true;
  }

  /** Flip the global scheduler switch. */
  async setSchedulerActive(active) {
    if (!this.usingSupabase) {
      return jsonFile.mutate(this.scheduleFile, EMPTY, (current) => {
        current.schedulerActive = Boolean(active);
        return { value: current, result: Boolean(active) };
      });
    }
    await upsertRows('campaign_schedule_state', {
      id: true,
      scheduler_active: Boolean(active),
      updated_at: new Date().toISOString()
    });
    return Boolean(active);
  }

  /**
   * Atomically claim every due, APPROVED post, flipping it to PUBLISHING and
   * returning only the posts this caller now owns. Concurrent schedulers get
   * disjoint sets — this is the double-publish fix.
   *
   * @param {string[]} excludePlatforms platforms handled by another flow
   */
  async claimDuePosts(excludePlatforms = [], limit = 10) {
    if (!this.usingSupabase) {
      return jsonFile.mutate(this.scheduleFile, EMPTY, (data) => {
        if (!data.schedulerActive) return { value: undefined, result: [] };
        const excluded = excludePlatforms.map(p => p.toLowerCase());
        const now = Date.now();
        const claimed = [];
        for (const post of data.posts || []) {
          if (claimed.length >= limit) break;
          if (post.status !== 'APPROVED') continue;
          if (excluded.includes(String(post.platform).toLowerCase())) continue;
          if (parseScheduledTime(post.date, post.time).getTime() > now) continue;
          post.status = 'PUBLISHING';
          claimed.push({ ...post });
        }
        if (!claimed.length) return { value: undefined, result: [] };
        return { value: data, result: claimed };
      });
    }

    const rows = await rpc('claim_due_campaign_posts', {
      p_limit: limit,
      p_exclude_platforms: excludePlatforms
    });
    return (rows || []).map(rowToPost);
  }

  /** Record the terminal outcome of a claimed post. Touches only that row. */
  async completePost(postId, success, { error, logs, screenshot } = {}) {
    if (!this.usingSupabase) {
      return jsonFile.mutate(this.scheduleFile, EMPTY, (data) => {
        const post = (data.posts || []).find(p => p.id === postId);
        if (!post) return { value: undefined, result: null };
        post.status = success ? 'PUBLISHED' : 'FAILED';
        if (success) {
          delete post.error;
          post.publishedAt = new Date().toISOString();
        } else {
          post.error = error;
        }
        if (logs !== undefined) post.logs = logs;
        if (screenshot) post.screenshot = screenshot;
        return { value: data, result: { ...post } };
      });
    }
    const rows = await rpc('complete_campaign_post', {
      p_id: postId,
      p_success: Boolean(success),
      p_error: success ? null : (error || null),
      p_logs: logs === undefined ? null : logs,
      p_screenshot: screenshot || null
    });
    return rows && rows.length ? rowToPost(rows[0]) : null;
  }

  /**
   * Update a single post's status. `id` may be a full post id or the
   * `post_NN` base prefix, matching the previous endpoint semantics.
   * @returns {number} rows updated
   */
  async updatePostStatus(id, status) {
    return this._updateMatching(id, { status }, (post) => { post.status = status; });
  }

  /** Update a single post's copy and optionally its image. */
  async updatePostContent(id, text, image) {
    const patch = { text };
    if (image !== undefined) patch.image = image;
    return this._updateMatching(id, patch, (post) => {
      post.text = text;
      if (image !== undefined) post.image = image;
    });
  }

  /**
   * Shared matcher for the two single-post endpoints. Ids are matched exactly
   * or by their `post_NN` base prefix.
   */
  async _updateMatching(id, dbPatch, fileMutator) {
    if (!this.usingSupabase) {
      return jsonFile.mutate(this.scheduleFile, EMPTY, (data) => {
        let updated = 0;
        for (const post of data.posts || []) {
          const baseId = String(post.id).split('_').slice(0, 2).join('_');
          if (baseId === id || post.id === id) {
            fileMutator(post);
            updated++;
          }
        }
        if (!updated) return { value: undefined, result: 0 };
        return { value: data, result: updated };
      });
    }

    // The old matcher compared `id` against each post's first two underscore
    // segments, so `post_01` also matched `post_01_variantB`. That is not a
    // PostgREST `like` pattern (`_` is a single-char SQL wildcard and there is no
    // clean way to escape it through the query string), so the ids are resolved
    // with the same JS rule and then updated by exact id.
    const all = await selectRows('campaign_posts', 'select=id');
    const targets = (all || [])
      .map(r => r.id)
      .filter(rowId => rowId === id || String(rowId).split('_').slice(0, 2).join('_') === id);

    if (!targets.length) return 0;

    const list = targets.map(t => `"${String(t).replace(/"/g, '')}"`).join(',');
    const rows = await updateRows('campaign_posts', `id=in.(${list})`, {
      ...dbPatch,
      updated_at: new Date().toISOString()
    });
    return Array.isArray(rows) ? rows.length : targets.length;
  }

  /** Recover posts stranded in PUBLISHING by a crashed worker. */
  async requeueStale(staleAfterMinutes = 30) {
    if (!this.usingSupabase) return [];
    const rows = await rpc('requeue_stale_campaign_posts', { p_stale_after: `${staleAfterMinutes} minutes` });
    return (rows || []).map(rowToPost);
  }
}

module.exports = { CampaignStore };
