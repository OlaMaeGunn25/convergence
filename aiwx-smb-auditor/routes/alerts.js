/**
 * Activity alert routes — inbound social engagement triage and replies.
 */

const express = require('express');
const logger = require('../lib/logger');
const { sendError } = require('../lib/http');
const { loadAlerts, saveAlerts } = require('../lib/stores/alerts');
const { sendNotification } = require('../lib/notify');

const router = express.Router();

router.get('/api/activity-alerts', (req, res) => {
  try {
    const alerts = loadAlerts();
    res.json({ success: true, alerts });
  } catch (err) {
    sendError(res, 500, 'Failed to load alerts.', { err, context: '[Alerts]' });
  }
});

router.post('/api/activity-alerts/resolve', (req, res) => {
  const { id } = req.body;
  if (!id) return sendError(res, 400, 'Alert ID is required.', { context: '[Alerts]' });

  try {
    const alerts = loadAlerts();
    const alert = alerts.find(a => a.id === id);
    if (!alert) {
      return sendError(res, 404, 'Alert not found.', { context: '[Alerts]' });
    }
    alert.status = 'RESOLVED';
    saveAlerts(alerts);
    res.json({ success: true });
  } catch (err) {
    sendError(res, 500, 'Failed to update alert status.', { err, context: '[Alerts]' });
  }
});

router.post('/api/generate-reply', (req, res) => {
  const { commentId } = req.body;
  if (!commentId) return sendError(res, 400, 'Comment ID is required.', { context: '[Alerts]' });

  try {
    const alerts = loadAlerts();
    const alert = alerts.find(a => a.id === commentId);
    if (!alert) {
      return sendError(res, 404, 'Comment alert not found.', { context: '[Alerts]' });
    }
    res.json({ success: true, replyDraft: alert.aiDraft });
  } catch (err) {
    sendError(res, 500, 'Failed to generate reply.', { err, context: '[Alerts]' });
  }
});

router.post('/api/post-reply', (req, res) => {
  const { commentId, replyText } = req.body;
  if (!commentId || !replyText) {
    return sendError(res, 400, 'Comment ID and reply copy are required.', { context: '[Alerts]' });
  }

  try {
    const alerts = loadAlerts();
    const alert = alerts.find(a => a.id === commentId);
    if (!alert) {
      return sendError(res, 404, 'Comment alert not found.', { context: '[Alerts]' });
    }

    alert.status = 'REPLIED';
    alert.replyText = replyText;
    alert.repliedAt = new Date().toISOString();
    saveAlerts(alerts);

    logger.info(`[Alerts] Response mock-posted back to ${alert.platform} for ${alert.userName}.`);
    sendNotification('AiWorXmiths Campaign Manager', `✓ Successfully posted response to ${alert.userName} on ${alert.platform}!`);

    res.json({ success: true });
  } catch (err) {
    sendError(res, 500, 'Failed to post reply on server.', { err, context: '[Alerts]' });
  }
});

module.exports = router;
