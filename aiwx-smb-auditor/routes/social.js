/**
 * Social campaign routes — direct publishing, the campaign schedule, and
 * monthly post generation.
 */

const express = require('express');
const { execFile } = require('child_process');

const logger = require('../lib/logger');
const { sendError } = require('../lib/http');
const { SOCIAL_AGENT_DIR } = require('../lib/paths');
const { scheduleExists, readSchedule, writeSchedule } = require('../lib/stores/schedule');
const { parsePublishResult } = require('../lib/publisher');
const { sendNotification } = require('../lib/notify');
const { generateMonthlyPosts } = require('../lib/post_generator');

const router = express.Router();

/**
 * Headless Browser Direct Publish Endpoint
 */
router.post('/api/publish-post', (req, res) => {
  const { platform, text, image, dryRun } = req.body;

  if (!platform || !text) {
    return sendError(res, 400, 'Platform and text content are required.', { context: '[Publish]' });
  }

  logger.info(`[Publish] Social media publish request: platform=${platform}, dryRun=${dryRun || false}`);

  // execFile with an args array handles multiline text and quotes safely.
  const scriptToRun = platform.toLowerCase() === 'linkedin' ? 'publish_headless.js' : 'publish_api.js';
  const args = [scriptToRun, '--platform', platform, '--text', text];
  if (image) {
    args.push('--image', image);
  }
  if (dryRun) {
    args.push('--dry-run');
  }

  execFile('node', args, { cwd: SOCIAL_AGENT_DIR }, (error, stdout, stderr) => {
    logger.info(`[Publish] publish_api stdout:\n${stdout}`);
    if (stderr) logger.warn(`[Publish] publish_api stderr:\n${stderr}`);

    const result = { ...parsePublishResult(stdout, { success: false }), log: stdout };

    if (error || !result.success) {
      // The subprocess log is the operator's only window into a headless
      // browser failure, so it stays in the response body; the raw Node error
      // message does not.
      return sendError(res, 500, 'Direct posting execution failed.', {
        err: error,
        context: '[Publish]',
        extra: { log: stdout, stderr }
      });
    }

    res.json(result);
  });
});

/**
 * Schedule the entire campaign.
 */
router.post('/api/schedule-campaign', (req, res) => {
  const { posts } = req.body;
  if (!posts || !Array.isArray(posts)) {
    return sendError(res, 400, 'Valid posts array is required.', { context: '[Schedule]' });
  }

  // Preserve existing schedulerActive state if present
  let active = false;
  if (scheduleExists()) {
    try {
      active = readSchedule().schedulerActive || false;
    } catch (e) {
      logger.warn('[Schedule] Existing schedule file was unreadable; defaulting schedulerActive to false.');
    }
  }

  const scheduleData = {
    schedulerActive: active,
    posts: posts.map(p => ({
      ...p,
      status: (p.status || 'APPROVED') === 'PENDING' ? 'APPROVED' : (p.status || 'APPROVED')
    }))
  };

  try {
    writeSchedule(scheduleData);
    res.json({ success: true, schedulerActive: active });
  } catch (err) {
    sendError(res, 500, 'Failed to write schedule file.', { err, context: '[Schedule]' });
  }
});

/**
 * Scheduler status and queue.
 */
router.get('/api/scheduler-status', (req, res) => {
  if (!scheduleExists()) {
    return res.json({ success: true, schedulerActive: false, posts: [] });
  }

  try {
    const data = readSchedule();
    res.json({ success: true, schedulerActive: data.schedulerActive || false, posts: data.posts || [] });
  } catch (err) {
    sendError(res, 500, 'Failed to read schedule file.', { err, context: '[Schedule]' });
  }
});

/**
 * Toggle the auto-scheduler on or off.
 */
router.post('/api/toggle-scheduler', (req, res) => {
  const { active } = req.body;
  if (active === undefined) {
    return sendError(res, 400, 'Active toggle state is required.', { context: '[Schedule]' });
  }

  if (!scheduleExists()) {
    return sendError(res, 400, 'Campaign schedule has not been set yet. Please schedule posts first.', { context: '[Schedule]' });
  }

  try {
    const data = readSchedule();
    data.schedulerActive = active;
    writeSchedule(data);

    sendNotification('AiWorXmiths Campaign Scheduler', `Campaign Auto-Scheduler has been turned ${active ? 'ON' : 'OFF'}.`);

    res.json({ success: true, schedulerActive: active });
  } catch (err) {
    sendError(res, 500, 'Failed to update schedule status.', { err, context: '[Schedule]' });
  }
});

/**
 * Apply a mutation to every schedule entry matching an id (bare or suffixed),
 * then persist. Returns true when at least one post was touched.
 */
function updateMatchingPosts(data, id, mutate) {
  let updated = false;
  if (data.posts && Array.isArray(data.posts)) {
    data.posts.forEach(post => {
      const baseId = post.id.split('_').slice(0, 2).join('_');
      if (baseId === id || post.id === id) {
        mutate(post);
        updated = true;
      }
    });
  }
  return updated;
}

/**
 * Update a single post's status in the schedule.
 */
router.post('/api/update-post-status', (req, res) => {
  const { id, status } = req.body;
  if (!id || !status) {
    return sendError(res, 400, 'Post ID and status are required.', { context: '[Schedule]' });
  }

  if (!scheduleExists()) {
    return sendError(res, 400, 'Campaign schedule has not been set yet.', { context: '[Schedule]' });
  }

  try {
    const data = readSchedule();
    const updated = updateMatchingPosts(data, id, (post) => { post.status = status; });

    if (!updated) {
      return sendError(res, 404, 'Post not found in schedule.', { context: '[Schedule]' });
    }
    writeSchedule(data);
    res.json({ success: true });
  } catch (err) {
    sendError(res, 500, 'Failed to update post status on server.', { err, context: '[Schedule]' });
  }
});

/**
 * Update a single post's text and/or image in the schedule (real-time sync).
 */
router.post('/api/update-post', (req, res) => {
  const { id, text, image } = req.body;
  if (!id || text === undefined) {
    return sendError(res, 400, 'Post ID and text content are required.', { context: '[Schedule]' });
  }

  if (!scheduleExists()) {
    return sendError(res, 400, 'Campaign schedule has not been set yet.', { context: '[Schedule]' });
  }

  try {
    const data = readSchedule();
    const updated = updateMatchingPosts(data, id, (post) => {
      post.text = text;
      if (image !== undefined) post.image = image;
    });

    if (!updated) {
      return sendError(res, 404, 'Post not found in schedule.', { context: '[Schedule]' });
    }
    writeSchedule(data);
    res.json({ success: true });
  } catch (err) {
    sendError(res, 500, 'Failed to update the post.', { err, context: '[Schedule]' });
  }
});

/**
 * Dynamically generate monthly posts from a user's prompt brief.
 */
router.post('/api/generate-monthly-posts', (req, res) => {
  const { month, brief } = req.body;
  if (!month || !brief) {
    return sendError(res, 400, 'Please provide both target month and campaign brief.', { context: '[PostGen]' });
  }

  try {
    logger.info(`[PostGen] Generating posts for ${month} based on brief: ${brief.substring(0, 80)}...`);
    res.json({ success: true, posts: generateMonthlyPosts(month, brief) });
  } catch (err) {
    sendError(res, 500, 'Generation failed.', { err, context: '[PostGen]' });
  }
});

module.exports = router;
