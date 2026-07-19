/**
 * AiWorXmiths Social Media Scheduler Daemon
 * ==========================================
 * Standalone Node.js process that claims APPROVED posts whose scheduled time
 * has passed and fires publish_headless.js for each. Designed to be called by
 * Windows Task Scheduler every 15 minutes.
 *
 * Posts are claimed through the shared campaign store rather than by rewriting
 * campaign_schedule.json. On the Supabase backend the claim is a single
 * UPDATE ... FOR UPDATE SKIP LOCKED, so this daemon and the in-process
 * scheduler loop in server.js can run at the same time without both publishing
 * the same post — which the previous file-based version allowed, since it
 * re-read and rewrote the whole file on every transition.
 *
 * Usage:
 *   node scheduler_daemon.js
 *   node scheduler_daemon.js --dry-run
 */

require('dotenv').config();
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const { CampaignStore } = require('./lib/stores/campaign_store');

const DRY_RUN = process.argv.includes('--dry-run');

// Paths are relative to aiwx-smb-auditor; resolve sibling agent dirs
const AGENT_DIR     = path.resolve(__dirname, '../aiwx-social-media-agent');
const SCHEDULE_FILE = path.join(AGENT_DIR, 'config', 'campaign_schedule.json');
const PUBLISH_SCRIPT = path.join(AGENT_DIR, 'publish_headless.js');
const LOG_DIR       = path.join(AGENT_DIR, 'logs');
const LOG_FILE      = path.join(LOG_DIR, 'scheduler_daemon.log');
const MAX_LOG_BYTES = 2 * 1024 * 1024; // Rotate log after 2 MB

const campaignStore = new CampaignStore(SCHEDULE_FILE);

// ── Logging ──────────────────────────────────────────────────────────────────

function rotateLogIfNeeded() {
  try {
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > MAX_LOG_BYTES) {
      fs.renameSync(LOG_FILE, LOG_FILE.replace('.log', '_old.log'));
    }
  } catch (e) { /* ignore */ }
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (e) { /* ignore write errors */ }
}

// ── Post Execution ────────────────────────────────────────────────────────────

/** Extract the publisher's `{"success": ...}` result line from its stdout. */
function parsePublisherResult(stdout) {
  let result = { success: false };
  (stdout || '').split('\n').forEach(line => {
    const t = line.trim();
    if (t.startsWith('{') && t.endsWith('}')) {
      try {
        const p = JSON.parse(t);
        if ('success' in p) result = p;
      } catch (e) { /* not the result line */ }
    }
  });
  return result;
}

/**
 * Publish one post this process has already claimed, then write its terminal
 * status. Only this row is touched, so a concurrent edit elsewhere survives.
 */
function executePost(post) {
  return new Promise((resolve) => {
    const args = [PUBLISH_SCRIPT, '--platform', post.platform.toLowerCase(), '--text', post.text];
    if (post.image) args.push('--image', post.image);
    if (DRY_RUN)   args.push('--dry-run');

    log(`  → Spawning: node publish_headless.js --platform ${post.platform} [image=${post.image || 'none'}]`);

    const child = execFile('node', args, { cwd: AGENT_DIR, timeout: 180000 }, async (err, stdout, stderr) => {
      const result = parsePublisherResult(stdout);
      const failed = Boolean(err) || !result.success;

      try {
        if (failed) {
          const message = err ? err.message : (result.error || 'Execution failed.');
          log(`  ✗ FAILED [${post.id}]: ${message}`);
          await campaignStore.completePost(post.id, false, {
            error: message,
            logs: `${stdout || ''}\n${stderr || ''}`,
            screenshot: result.screenshot
          });
        } else {
          log(`  ✓ PUBLISHED [${post.id}]`);
          await campaignStore.completePost(post.id, true, {
            logs: stdout || '',
            screenshot: result.screenshot
          });
        }
      } catch (e) {
        // The post stays PUBLISHING; the server's stale sweep returns it to
        // APPROVED so it is retried rather than silently dropped.
        log(`  ! Failed to record outcome for ${post.id}: ${e.message}`);
      }

      resolve();
    });

    // Stream live output to our log
    if (child.stdout) child.stdout.on('data', d => process.stdout.write(d));
    if (child.stderr) child.stderr.on('data', d => process.stderr.write(d));
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function runScheduler() {
  rotateLogIfNeeded();
  log('════════════════════════════════════════');
  log('AiWorXmiths Scheduler Daemon — Run Start');
  log(campaignStore.usingSupabase
    ? 'Backend: Supabase (row-locked claims)'
    : `Backend: JSON file (local dev) — ${SCHEDULE_FILE}`);
  if (DRY_RUN) log('DRY-RUN MODE: Publish clicks will be skipped.');

  if (!campaignStore.usingSupabase && !fs.existsSync(SCHEDULE_FILE)) {
    log('ERROR: campaign_schedule.json not found. Exiting.');
    process.exit(1);
  }

  if (!(await campaignStore.isSchedulerActive())) {
    log('Scheduler is disabled (schedulerActive=false). Exiting.');
    process.exit(0);
  }

  log(`Current UTC time: ${new Date().toISOString()}`);

  // Claim due posts atomically. Anything returned is exclusively ours; posts
  // another scheduler already took are skipped rather than double-published.
  // No platform is excluded here — unlike server.js, this daemon does publish
  // LinkedIn.
  const duePosts = await campaignStore.claimDuePosts([]);

  if (duePosts.length === 0) {
    log('No due posts found. Nothing to do.');
    log('════════════════════════════════════════\n');
    process.exit(0);
  }

  log(`Claimed ${duePosts.length} due post(s):`);
  duePosts.forEach(p => log(`  • ${p.id} (${p.platform}) — ${p.date} ${p.time}`));

  // Execute sequentially to avoid hammering the OS with multiple headless browsers
  for (const post of duePosts) {
    log(`\nProcessing: ${post.id} (${post.platform})`);
    await executePost(post);
  }

  log('\nScheduler Daemon — Run Complete.');
  log('════════════════════════════════════════\n');
}

runScheduler().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
