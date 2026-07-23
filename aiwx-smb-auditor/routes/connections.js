/**
 * Connections routes — connector catalog, the connection builder + status board,
 * and the Clio webhook → task bridge.
 *
 * Governance:
 *   - GET  /api/connectors        discover the catalog (no secret values leak).
 *   - GET  /api/connections       live connection status board (floating UI).
 *   - POST /api/connections       BUILD a connection — approval-gated (202 unless
 *                                 approved:true). Credentials never accepted here.
 *   - POST /api/connections/disconnect
 *   - POST /api/clio/webhook      external; HMAC-verified when CLIO_WEBHOOK_SECRET
 *                                 is set; maps the event to a governed task.
 */

const crypto = require('crypto');
const express = require('express');

const logger = require('../lib/logger');
const { sendError, asyncHandler } = require('../lib/http');
const catalog = require('../lib/connectors/catalog');
const { ConnectionRegistry } = require('../lib/connection_registry');
const clio = require('../lib/connectors/clio');
const { TaskModel } = require('../lib/task_model');

const router = express.Router();
const connections = new ConnectionRegistry();
const taskModel = new TaskModel();

router.get('/api/connectors', (req, res) => {
  const items = req.query.vertical ? catalog.byVertical(req.query.vertical) : catalog.list();
  res.json({ success: true, connectors: items.map(catalog.publicView) });
});

router.get('/api/connections', asyncHandler('[Connections]', 'Failed to load connections.', async (req, res) => {
  const systems = await connections.statusBoard({ tenantId: req.query.tenantId || null });
  res.json({ success: true, systems, generatedAt: new Date().toISOString() });
}));

router.post('/api/connections', asyncHandler('[Connections]', 'Failed to build connection.', async (req, res) => {
  const { connectorId, tenantId, config, approved } = req.body || {};
  if (!connectorId || !catalog.has(connectorId)) {
    return sendError(res, 400, 'A valid connectorId is required.', { context: '[Connections]' });
  }
  // Establishing an external integration is approval-gated (AI TRiSM WHO-may-act).
  if (approved !== true) {
    return res.status(202).json({
      success: false, status: 'requires_approval', connectorId,
      message: 'Connecting an external system requires human approval. Re-POST with approved:true.'
    });
  }
  const result = await connections.build(connectorId, {
    tenantId: tenantId || null, actor: req.actor || null, config: config || {}
  });
  res.json({ success: true, ...result });
}));

router.post('/api/connections/disconnect', asyncHandler('[Connections]', 'Failed to disconnect.', async (req, res) => {
  const { connectorId, tenantId } = req.body || {};
  if (!connectorId || !catalog.has(connectorId)) {
    return sendError(res, 400, 'A valid connectorId is required.', { context: '[Connections]' });
  }
  const connection = await connections.disconnect(connectorId, { tenantId: tenantId || null, actor: req.actor || null });
  res.json({ success: true, connection });
}));

/**
 * Clio webhook receiver. Verifies the HMAC-SHA256 signature when
 * CLIO_WEBHOOK_SECRET is configured, then maps the event to a governed task
 * (high-risk events land as pending_approval).
 * NOTE: robust HMAC needs the raw request body; wire an express.raw() capture on
 * this path in production. Here we sign the re-serialized body as a best effort.
 */
router.post('/api/clio/webhook', asyncHandler('[Clio]', 'Webhook processing failed.', async (req, res) => {
  const secret = process.env.CLIO_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.get('X-Hook-Signature') || req.get('X-Clio-Signature') || '';
    const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(req.body || {})).digest('hex');
    const a = Buffer.from(sig); const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return sendError(res, 401, 'Invalid webhook signature.', { context: '[Clio]' });
    }
  }
  const descriptor = clio.mapWebhookToTask(req.body || {});
  const task = await taskModel.create(descriptor);
  logger.info(`[Clio] Webhook ${descriptor.payload.event} -> task ${task.id} (${task.status})`);
  res.json({ success: true, task });
}));

module.exports = router;
