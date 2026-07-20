/**
 * Activity alerts store.
 * ======================
 * Backends: Supabase `activity_alerts` (production) or
 * aiwx-social-media-agent/config/activity_alerts.json (local dev).
 *
 * The race this replaces: resolving an alert or posting a reply loaded the
 * entire array, mutated one element, and wrote the whole array back. Two
 * operators acting on different alerts at the same time would each write a
 * snapshot taken before the other's change, so one reply silently vanished.
 * Each action is now a single-row UPDATE.
 *
 * The 100-alert cap and dated archive that the file backend applies exist to
 * bound file growth; the database backend keeps full history instead and is
 * queried with an explicit limit.
 */

const fs = require('fs');
const path = require('path');
const { isSupabaseConfigured, selectRows, upsertRows, updateRows } = require('../supabase');
const jsonFile = require('./json_file');

const FILE_MAX_ALERTS = 100;

/** Demo alerts seeded on first run so the UI is never empty. */
function seedAlerts() {
  return [
    {
      id: 'alert_01',
      platform: 'linkedin',
      userName: 'Sarah Jenkins',
      userHandle: 'Sarah Jenkins (Operations Director, Apex Legal)',
      avatar: 'african_american_female_lawyer.png',
      postId: 'post_01',
      postTitle: 'The Silent Cost of Disconnected Operations',
      commentText: 'This upskilling approach is exactly what we need. How do we get started with the Operational Capacity Audit?',
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
      status: 'UNRESOLVED',
      aiDraft: 'Hello Sarah! Thanks for reaching out. We would love to map your workflows. You can schedule a Free Scoping Diagnostics call directly at https://aiworxmiths.com/services. We focus on upskilling your existing staff into Growth Coordinators to manage these systems.',
      replyText: null,
      repliedAt: null
    },
    {
      id: 'alert_02',
      platform: 'instagram',
      userName: 'Dr. Keith Miller',
      userHandle: '@miller_dental_nyc',
      avatar: 'african_american_male_advisor.png',
      postId: 'post_03',
      postTitle: 'Stop Copy-Pasting: Connecting Your Billing and CRM',
      commentText: 'Does your CRM to QuickBooks ledger sync support HIPAA compliance for patient intake?',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      status: 'UNRESOLVED',
      aiDraft: 'Hi Dr. Miller! Yes, absolutely. Our containerized integrations run inside your private VPC (AWS/GCP) using Row-Level Security (RLS) and Key Management Service (KMS) encryption to ensure complete HIPAA compliance. Your data never leaves your secure cloud.',
      replyText: null,
      repliedAt: null
    },
    {
      id: 'alert_03',
      platform: 'threads',
      userName: 'Marcus Vance',
      userHandle: '@marcus_vance',
      avatar: 'diverse_male_entrepreneur_1779798785119.png',
      postId: 'post_02',
      postTitle: 'Sustainable AI Scale: Countering Hype',
      commentText: 'I like the idea of flat-fee hosting instead of per-seat licensing. It’s hard to predict SaaS bills as we grow.',
      timestamp: new Date(Date.now() - 900000).toISOString(),
      status: 'UNRESOLVED',
      aiDraft: 'Thanks Marcus! That’s the exact margin drain we resolve. By deploying the Convergence-Ai container natively in your own cloud, we eliminate per-seat SaaS taxes, capping hosting at flat, predictable rates (~$35/month).',
      replyText: null,
      repliedAt: null
    }
  ];
}

function rowToAlert(row) {
  return {
    id: row.id,
    platform: row.platform,
    userName: row.user_name,
    userHandle: row.user_handle,
    avatar: row.avatar,
    postId: row.post_id,
    postTitle: row.post_title,
    commentText: row.comment_text,
    timestamp: row.timestamp,
    status: row.status,
    aiDraft: row.ai_draft,
    replyText: row.reply_text,
    repliedAt: row.replied_at
  };
}

function alertToRow(alert) {
  return {
    id: alert.id,
    platform: alert.platform,
    user_name: alert.userName || null,
    user_handle: alert.userHandle || null,
    avatar: alert.avatar || null,
    post_id: alert.postId || null,
    post_title: alert.postTitle || null,
    comment_text: alert.commentText || null,
    ai_draft: alert.aiDraft || null,
    reply_text: alert.replyText || null,
    status: alert.status || 'UNRESOLVED',
    replied_at: alert.repliedAt || null,
    timestamp: alert.timestamp || new Date().toISOString()
  };
}

class AlertsStore {
  /**
   * @param {string} alertsFile absolute path used by the JSON fallback
   * @param {string} logsDir    where the file backend archives overflow
   */
  constructor(alertsFile, logsDir) {
    this.alertsFile = alertsFile;
    this.logsDir = logsDir;
    this._seeded = false;
  }

  get usingSupabase() {
    return isSupabaseConfigured();
  }

  /** Insert the demo alerts once, if the table is empty. */
  async _seedIfEmpty() {
    if (this._seeded) return;
    this._seeded = true;
    const existing = await selectRows('activity_alerts', 'select=id&limit=1');
    if (existing && existing.length) return;
    await upsertRows('activity_alerts', seedAlerts().map(alertToRow), 'id');
  }

  async listAlerts(limit = FILE_MAX_ALERTS) {
    if (!this.usingSupabase) {
      const existing = await jsonFile.read(this.alertsFile, null);
      if (existing === null) {
        const seeded = seedAlerts();
        await jsonFile.mutate(this.alertsFile, [], () => seeded);
        return seeded;
      }
      return Array.isArray(existing) ? existing : [];
    }
    await this._seedIfEmpty();
    const rows = await selectRows('activity_alerts', `select=*&order=timestamp.desc&limit=${limit}`);
    return (rows || []).map(rowToAlert);
  }

  async getAlert(id) {
    if (!this.usingSupabase) {
      const alerts = await this.listAlerts();
      return alerts.find(a => a.id === id) || null;
    }
    const rows = await selectRows('activity_alerts', `id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    return rows && rows.length ? rowToAlert(rows[0]) : null;
  }

  /** Mark one alert resolved. @returns the updated alert, or null if absent. */
  async resolveAlert(id) {
    return this._patch(id, { status: 'RESOLVED' }, (alert) => { alert.status = 'RESOLVED'; });
  }

  /** Attach an operator's reply to one alert. */
  async recordReply(id, replyText) {
    const repliedAt = new Date().toISOString();
    return this._patch(
      id,
      { status: 'REPLIED', reply_text: replyText, replied_at: repliedAt },
      (alert) => {
        alert.status = 'REPLIED';
        alert.replyText = replyText;
        alert.repliedAt = repliedAt;
      }
    );
  }

  async _patch(id, dbPatch, fileMutator) {
    if (!this.usingSupabase) {
      return jsonFile.mutate(this.alertsFile, [], (alerts) => {
        const list = Array.isArray(alerts) ? alerts : [];
        const alert = list.find(a => a.id === id);
        if (!alert) return { value: undefined, result: null };
        fileMutator(alert);
        return { value: this._trimForFile(list), result: { ...alert } };
      });
    }
    const rows = await updateRows('activity_alerts', `id=eq.${encodeURIComponent(id)}`, dbPatch);
    return rows && rows.length ? rowToAlert(rows[0]) : null;
  }

  /** Add a new alert (used by ingestion flows). */
  async addAlert(alert) {
    if (!this.usingSupabase) {
      return jsonFile.mutate(this.alertsFile, [], (alerts) => {
        const list = Array.isArray(alerts) ? alerts : [];
        list.unshift(alert);
        return { value: this._trimForFile(list), result: alert };
      });
    }
    const rows = await upsertRows('activity_alerts', alertToRow(alert), 'id');
    return rows && rows.length ? rowToAlert(rows[0]) : alert;
  }

  /**
   * File backend only: cap the array and archive the overflow to a dated file,
   * preserving the previous behaviour that kept activity_alerts.json bounded.
   */
  _trimForFile(alerts) {
    if (alerts.length <= FILE_MAX_ALERTS) return alerts;
    const kept = alerts.slice(0, FILE_MAX_ALERTS);
    const overflow = alerts.slice(FILE_MAX_ALERTS);
    try {
      if (!fs.existsSync(this.logsDir)) fs.mkdirSync(this.logsDir, { recursive: true });
      const date = new Date().toISOString().split('T')[0];
      fs.appendFileSync(
        path.join(this.logsDir, `alerts-${date}.json`),
        JSON.stringify(overflow, null, 2) + '\n',
        'utf8'
      );
    } catch (e) {
      // Archiving is best-effort; never block the write on it.
    }
    return kept;
  }
}

module.exports = { AlertsStore };
