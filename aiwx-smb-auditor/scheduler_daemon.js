/**
 * AiWorXmiths Social Media Scheduler Daemon
 * ==========================================
 * Standalone Node.js process that reads campaign_schedule.json,
 * identifies APPROVED posts whose scheduled time has passed,
 * and fires publish_headless.js for each. Designed to be called
 * by Windows Task Scheduler every 15 minutes.
 *
 * Usage:
 *   node scheduler_daemon.js
 *   node scheduler_daemon.js --dry-run
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');

// Paths are relative to aiwx-smb-auditor; resolve sibling agent dirs
const AGENT_DIR    = path.resolve(__dirname, '../aiwx-social-media-agent');
const SCHEDULE_FILE = path.join(AGENT_DIR, 'config', 'campaign_schedule.json');
const PUBLISH_SCRIPT = path.join(AGENT_DIR, 'publish_headless.js');
const LOG_DIR       = path.join(AGENT_DIR, 'logs');
const LOG_FILE      = path.join(LOG_DIR, 'scheduler_daemon.log');
const MAX_LOG_BYTES = 2 * 1024 * 1024; // Rotate log after 2 MB

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

// ── Time Parsing ──────────────────────────────────────────────────────────────
// Schedule format: "10:00 AM EST" — treat "EST" as Eastern Time (UTC-5 in winter,
// UTC-4 in summer). We use -4 during DST (May–Nov) and -5 otherwise.

function getEasternOffsetHours() {
  const now = new Date();
  const jan = new Date(now.getFullYear(), 0, 1);
  const jul = new Date(now.getFullYear(), 6, 1);
  const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  const isDST = now.getTimezoneOffset() < stdOffset;
  // Eastern Standard = UTC-5, Eastern Daylight = UTC-4
  return isDST ? -4 : -5;
}

function parseScheduledTime(dateStr, timeStr) {
  try {
    // Strip timezone label; handle "9:00 AM EST" or "10:00 AM EDT"
    const cleaned = timeStr.replace(/ E[SD]T$/i, '').trim();
    const [timePart, meridiem] = cleaned.split(' ');
    let [h, m] = timePart.split(':').map(Number);
    if (meridiem === 'PM' && h !== 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;

    const offset = getEasternOffsetHours();
    const offsetStr = offset < 0 ? `-${String(Math.abs(offset)).padStart(2, '0')}:00`
                                  : `+${String(offset).padStart(2, '0')}:00`;
    const iso = `${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00${offsetStr}`;
    const dt = new Date(iso);
    return isNaN(dt) ? new Date(0) : dt;
  } catch (e) {
    return new Date(0);
  }
}

// ── Post Execution ────────────────────────────────────────────────────────────

function executePost(post, schedule) {
  return new Promise((resolve) => {
    const args = [PUBLISH_SCRIPT, '--platform', post.platform.toLowerCase(), '--text', post.text];
    if (post.image) args.push('--image', post.image);
    if (DRY_RUN)   args.push('--dry-run');

    log(`  → Spawning: node publish_headless.js --platform ${post.platform} [image=${post.image || 'none'}]`);

    const child = execFile('node', args, { cwd: AGENT_DIR, timeout: 180000 }, (err, stdout, stderr) => {
      // Re-read schedule fresh to avoid race conditions if multiple posts run in parallel
      let freshData;
      try {
        freshData = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
      } catch (e) {
        freshData = schedule;
      }
      const freshPost = freshData.posts.find(p => p.id === post.id);
      if (!freshPost) { resolve(); return; }

      // Parse JSON result line from stdout
      let result = { success: false };
      (stdout || '').split('\n').forEach(line => {
        const t = line.trim();
        if (t.startsWith('{') && t.endsWith('}')) {
          try { const p = JSON.parse(t); if ('success' in p) result = p; } catch (e) {}
        }
      });

      if (err || !result.success) {
        log(`  ✗ FAILED [${post.id}]: ${err ? err.message : (result.error || 'Execution failed.')}`);
        freshPost.status = 'FAILED';
        freshPost.error  = err ? err.message : (result.error || 'Execution failed.');
        freshPost.logs   = (stdout || '') + '\n' + (stderr || '');
      } else {
        log(`  ✓ PUBLISHED [${post.id}]`);
        freshPost.status = 'PUBLISHED';
        freshPost.logs   = stdout || '';
        freshPost.publishedAt = new Date().toISOString();
        if (result.screenshot) freshPost.screenshot = result.screenshot;
      }

      try {
        fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(freshData, null, 2));
      } catch (e) {
        log(`  ! Failed to update schedule file: ${e.message}`);
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
  if (DRY_RUN) log('DRY-RUN MODE: Publish clicks will be skipped.');

  if (!fs.existsSync(SCHEDULE_FILE)) {
    log('ERROR: campaign_schedule.json not found. Exiting.');
    process.exit(1);
  }

  let schedule;
  try {
    schedule = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
  } catch (e) {
    log(`ERROR: Failed to parse campaign_schedule.json — ${e.message}`);
    process.exit(1);
  }

  if (!schedule.schedulerActive) {
    log('Scheduler is disabled (schedulerActive=false). Exiting.');
    process.exit(0);
  }

  const now = new Date();
  log(`Current UTC time: ${now.toISOString()}`);

  const duePosts = (schedule.posts || []).filter(post => {
    if (post.status !== 'APPROVED') return false;
    const t = parseScheduledTime(post.date, post.time);
    return now >= t;
  });

  if (duePosts.length === 0) {
    log('No due posts found. Nothing to do.');
    log('════════════════════════════════════════\n');
    process.exit(0);
  }

  log(`Found ${duePosts.length} due post(s):`);
  duePosts.forEach(p => log(`  • ${p.id} (${p.platform}) — ${p.date} ${p.time}`));

  // Mark all due posts as PUBLISHING before we begin (prevents re-runs if daemon overlaps)
  duePosts.forEach(p => {
    const livePost = schedule.posts.find(x => x.id === p.id);
    if (livePost) livePost.status = 'PUBLISHING';
  });
  try {
    fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedule, null, 2));
  } catch (e) {
    log(`WARNING: Could not pre-mark posts as PUBLISHING: ${e.message}`);
  }

  // Execute sequentially to avoid hammering the OS with multiple headless browsers
  for (const post of duePosts) {
    log(`\nProcessing: ${post.id} (${post.platform})`);
    await executePost(post, schedule);
  }

  log('\nScheduler Daemon — Run Complete.');
  log('════════════════════════════════════════\n');
}

runScheduler().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
