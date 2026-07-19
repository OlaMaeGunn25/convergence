/**
 * Background schedulers
 * =====================
 * Three independent loops, all crash-safe: an error inside a tick is caught and
 * counted, and after repeated consecutive failures the loop backs off (skipping
 * ticks) instead of hammering a broken filesystem/API, then recovers on the
 * next success.
 *
 *  - Audit queue loop   : one queued automated audit per tick.
 *  - Campaign scheduler : publishes approved posts as they come due.
 *  - Prospecting loop   : one outbound prospecting run per weekday at noon ET.
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const logger = require('./logger');
const { AUDITS_CACHE_DIR, SOCIAL_AGENT_DIR } = require('./paths');
const { loadAuditQueue, saveAuditQueue } = require('./stores/audit_queue');
const { scheduleExists, readSchedule, writeSchedule, parseScheduledTime } = require('./stores/schedule');
const { parsePublishResult } = require('./publisher');
const { sendNotification } = require('./notify');
const { recordAudit } = require('./audit');
const { runAuditPipeline } = require('./audit_runner');

const MAX_BACKOFF_MS = 15 * 60 * 1000;

/** Exponential backoff capped at 15 minutes. */
function backoffFor(consecutiveFailures) {
  return Math.min(60000 * Math.pow(2, consecutiveFailures - 1), MAX_BACKOFF_MS);
}

// --- Automated audit queue --------------------------------------------------

let auditLoopFailures = 0;
let auditLoopSkipUntil = 0;
let auditLoopBusy = false;

async function processAuditQueueTick() {
  if (Date.now() < auditLoopSkipUntil || auditLoopBusy) return;
  const queue = loadAuditQueue();
  if (!queue.active) return;
  const job = queue.jobs.find(j => j.status === 'queued');
  if (!job) return;

  auditLoopBusy = true;
  job.status = 'running';
  job.startedAt = new Date().toISOString();
  saveAuditQueue(queue);

  try {
    const pkg = await runAuditPipeline(job.domain, { vertical: job.vertical });
    try {
      if (!fs.existsSync(AUDITS_CACHE_DIR)) fs.mkdirSync(AUDITS_CACHE_DIR, { recursive: true });
      const safe = job.domain.replace(/[^a-zA-Z0-9.-]/g, '_') + '.json';
      fs.writeFileSync(path.join(AUDITS_CACHE_DIR, safe), JSON.stringify(pkg, null, 2), 'utf-8');
    } catch (e) { /* cache write is best-effort */ }

    const fresh = loadAuditQueue();
    const fj = fresh.jobs.find(j => j.id === job.id);
    if (fj) { fj.status = 'completed'; fj.completedAt = new Date().toISOString(); }
    saveAuditQueue(fresh);
    auditLoopFailures = 0;
    recordAudit({ actor: 'audit-scheduler', role: 'operator', action: 'audit.auto', resource: job.domain, outcome: 'success' });
    logger.info(`[AuditScheduler] Completed automated audit for ${job.domain}`);
  } catch (err) {
    auditLoopFailures++;
    const backoff = backoffFor(auditLoopFailures);
    auditLoopSkipUntil = Date.now() + backoff;
    const fresh = loadAuditQueue();
    const fj = fresh.jobs.find(j => j.id === job.id);
    if (fj) { fj.status = 'failed'; fj.error = err.message; }
    saveAuditQueue(fresh);
    recordAudit({ actor: 'audit-scheduler', role: 'operator', action: 'audit.auto', resource: job.domain, outcome: 'failure', metadata: { error: err.message } });
    logger.error(`[AuditScheduler] Automated audit for ${job.domain} failed: ${err.message}. Backing off ${Math.round(backoff / 1000)}s.`);
  } finally {
    auditLoopBusy = false;
  }
}

// --- Campaign publishing scheduler ------------------------------------------

let schedulerConsecutiveFailures = 0;
let schedulerSkipUntil = 0;

function schedulerTick() {
  if (Date.now() < schedulerSkipUntil) return;
  try {
    runSchedulerScan();
    schedulerConsecutiveFailures = 0;
  } catch (e) {
    schedulerConsecutiveFailures++;
    const backoffMs = backoffFor(schedulerConsecutiveFailures);
    schedulerSkipUntil = Date.now() + backoffMs;
    logger.error(`[Scheduler] Tick failed (${schedulerConsecutiveFailures} consecutive): ${e.message}. Backing off ${Math.round(backoffMs / 1000)}s.`);
  }
}

/**
 * Handle the completion of one scheduled publish subprocess: re-read the
 * schedule (it may have changed while the browser ran), then mark the post
 * PUBLISHED or FAILED and notify the operator.
 */
function finalizeScheduledPost(post, fallbackData, err, stdout, stderr) {
  logger.info(`[Scheduler] publish_api output for ${post.id}:\n${stdout}`);

  let freshData;
  try {
    freshData = readSchedule();
  } catch (e) {
    freshData = fallbackData;
  }

  const freshPost = freshData.posts.find(p => p.id === post.id);
  if (!freshPost) return;

  const result = parsePublishResult(stdout, { success: false });
  const shortId = freshPost.id.replace('post_', '');

  if (err || !result.success) {
    logger.error(`[Scheduler] Post ${freshPost.id} failed :: ${err ? (err.stack || err.message) : (result.error || 'Browser execution failed.')}`);
    freshPost.status = 'FAILED';
    freshPost.error = err ? err.message : (result.error || 'Browser execution failed.');
    freshPost.logs = stdout + '\n' + stderr;
    if (result.screenshot) freshPost.screenshot = result.screenshot;

    sendNotification('AiWorXmiths Campaign Scheduler', `❌ Failed to publish Post ${shortId} to ${freshPost.platform}!`);
  } else {
    logger.info(`[Scheduler] Post ${freshPost.id} published successfully!`);
    freshPost.status = 'PUBLISHED';
    freshPost.logs = stdout;
    if (result.screenshot) freshPost.screenshot = result.screenshot;

    sendNotification('AiWorXmiths Campaign Scheduler', `✓ Post ${shortId} published successfully to ${freshPost.platform}!`);
  }

  writeSchedule(freshData);
}

function runSchedulerScan() {
  if (!scheduleExists()) return;

  let data;
  try {
    data = readSchedule();
  } catch (e) {
    logger.error(`[Scheduler] Failed to parse schedule file in loop :: ${e.stack || e.message}`);
    return;
  }

  if (!data.schedulerActive) return;
  logger.info(`[Scheduler] Scanning campaign queue of ${data.posts ? data.posts.length : 0} posts...`);

  const now = new Date();
  let updated = false;

  for (const post of data.posts) {
    if (post.status !== 'APPROVED') continue;
    if (post.platform.toLowerCase() === 'linkedin') continue;

    if (parseScheduledTime(post.date, post.time) > now) continue;

    logger.info(`[Scheduler] Post ${post.id} is due. Starting direct publish...`);
    post.status = 'PUBLISHING';
    updated = true;

    // Save immediately to prevent duplicate runs
    writeSchedule(data);

    sendNotification('AiWorXmiths Campaign Scheduler', `Posting Post ${post.id.replace('post_', '')} to ${post.platform}...`);

    const args = ['publish_api.js', '--platform', post.platform.toLowerCase(), '--text', post.text];
    if (post.image) {
      args.push('--image', post.image);
    }

    execFile('node', args, { cwd: SOCIAL_AGENT_DIR }, (err, stdout, stderr) => {
      finalizeScheduledPost(post, data, err, stdout, stderr);
    });
  }

  if (updated) {
    writeSchedule(data);
  }
}

// --- Daily prospecting run --------------------------------------------------

let lastProspectRunDate = null;
const prospectingSchedulerEnabled = false; // Paused per user request

const PROSPECTING_VERTICALS = ['Healthcare', 'Law', 'SaaS', 'Retail', 'Contractors', 'Dentists'];

function prospectingTick() {
  if (!prospectingSchedulerEnabled) return;
  const now = new Date();

  // Convert current time to Eastern Time (EST/EDT)
  const estDate = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const estHour = estDate.getHours();
  const estMinute = estDate.getMinutes();
  const todayDateStr = estDate.toISOString().split('T')[0];

  // Check if we are inside the 12:00 PM - 12:30 PM EST window
  const isTimeWindow = (estHour === 12 && estMinute >= 0 && estMinute <= 30);
  if (!isTimeWindow || lastProspectRunDate === todayDateStr) return;

  logger.info(`[Prospecting Scheduler] Starting daily outbound prospecting run at ${estHour}:${estMinute} EST...`);

  // Rotate target verticals daily
  const dayOfYear = Math.floor((estDate - new Date(estDate.getFullYear(), 0, 0)) / 86400000);
  const targetVertical = PROSPECTING_VERTICALS[dayOfYear % PROSPECTING_VERTICALS.length];

  logger.info(`[Prospecting Scheduler] Selected Vertical: ${targetVertical}`);

  execFile('node', ['prospecting_agent.js', '--platform', 'linkedin', '--vertical', targetVertical], { cwd: SOCIAL_AGENT_DIR }, (error, stdout) => {
    if (error) {
      logger.error(`[Prospecting Scheduler] Prospecting run failed :: ${error.stack || error.message}`);
      return;
    }
    logger.info(`[Prospecting Scheduler] Prospecting run completed successfully:\n${stdout}`);
    lastProspectRunDate = todayDateStr; // Set lock for today
  });
}

/**
 * Start every background loop. Returns the timer handles so a test harness (or
 * a graceful shutdown) can clear them.
 */
function startSchedulers() {
  const auditTimer = setInterval(() => {
    processAuditQueueTick().catch(e => logger.error(`[AuditScheduler] tick error: ${e.message}`));
  }, 90 * 1000);

  const campaignTimer = setInterval(schedulerTick, 60 * 1000);
  const prospectingTimer = setInterval(prospectingTick, 5 * 60 * 1000);

  return { auditTimer, campaignTimer, prospectingTimer };
}

module.exports = { startSchedulers, processAuditQueueTick, schedulerTick, prospectingTick };
