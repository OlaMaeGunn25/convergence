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
const systemEvaluator = require('../lib/system_evaluator');
const { ConnectionRegistry } = require('../lib/connection_registry');
const { Installation } = require('../lib/installation');
const { AgentRegistry } = require('../lib/agent_model');
const { AttributionLog } = require('../lib/attribution');
const { TelemetryStream } = require('../lib/agent_telemetry');
const clio = require('../lib/connectors/clio');
const { TaskModel } = require('../lib/task_model');

const router = express.Router();
const connections = new ConnectionRegistry();
const installationSvc = new Installation({ connectionRegistry: connections });
const agentRegistrySvc = new AgentRegistry();
const attributionLogSvc = new AttributionLog();
const telemetrySvc = new TelemetryStream();
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

// Orchestrator unified capability model (COMP-02).
router.get('/api/orchestrator/capabilities', asyncHandler('[Orchestrator]', 'Failed to build capability model.', async (req, res) => {
  const model = await systemEvaluator.buildTenantCapabilityModel({ tenantId: req.query.tenantId || null, connectionRegistry: connections });
  res.json({ success: true, ...model });
}));

// Agent-company onboarding readiness board (ONB-02).
router.get('/api/onboarding/status', asyncHandler('[Onboarding]', 'Failed to load onboarding status.', async (req, res) => {
  const status = await systemEvaluator.onboardingStatus({ tenantId: req.query.tenantId || null, connectionRegistry: connections });
  res.json({ success: true, ...status });
}));

// Install CONVERGENCE-Ai for a tenant/vertical (INS-01/02).
router.post('/api/install', asyncHandler('[Install]', 'Install failed.', async (req, res) => {
  const { tenantId, vertical, selectedConnectors } = req.body || {};
  if (!tenantId || !vertical) return sendError(res, 400, 'tenantId and vertical are required.', { context: '[Install]' });
  const result = await installationSvc.install({ tenantId, vertical, selectedConnectors: selectedConnectors || [], actor: req.actor || null });
  res.json({ success: true, ...result });
}));

// Installation completeness (INS-03).
router.get('/api/install/status', asyncHandler('[Install]', 'Failed to load install status.', async (req, res) => {
  if (!req.query.tenantId) return sendError(res, 400, 'tenantId is required.', { context: '[Install]' });
  const status = await installationSvc.status({ tenantId: req.query.tenantId });
  res.json({ success: true, ...status });
}));

// Provisioned agents (floating monitor: agent tiles + states).
router.get('/api/agents', asyncHandler('[Agents]', 'Failed to list agents.', async (req, res) => {
  const agents = await agentRegistrySvc.list({ tenantId: req.query.tenantId || undefined, role: req.query.role, vertical: req.query.vertical });
  res.json({ success: true, agents });
}));

// Live agent/task telemetry stream (MON-01).
router.get('/api/agents/telemetry', asyncHandler('[Telemetry]', 'Failed to load telemetry.', async (req, res) => {
  const events = await telemetrySvc.list({ tenantId: req.query.tenantId || undefined, taskId: req.query.taskId, since: req.query.since, limit: parseInt(req.query.limit, 10) || 100 });
  res.json({ success: true, events, generatedAt: new Date().toISOString() });
}));

// Task chain-of-custody: attributable prompts/outputs + telemetry (TRC-03).
router.get('/api/tasks/:id/trace', asyncHandler('[Trace]', 'Failed to load task trace.', async (req, res) => {
  const attribution = await attributionLogSvc.trace(req.params.id);
  const events = await telemetrySvc.list({ taskId: req.params.id, limit: 500 });
  res.json({ success: true, taskId: req.params.id, attribution: attribution.records, telemetry: events });
}));

// HITL control: course-correct a running task (CTL-03).
router.post('/api/tasks/:id/correct', asyncHandler('[Control]', 'Course-correct failed.', async (req, res) => {
  const { instructions, payload } = req.body || {};
  const task = await taskModel.revise(req.params.id, { instructions: instructions || null, payload: payload || {}, actor: req.actor || null });
  res.json({ success: true, task });
}));

// HITL control: cancel a task (kill-switch, CTL-04).
router.post('/api/tasks/:id/cancel', asyncHandler('[Control]', 'Cancel failed.', async (req, res) => {
  const task = await taskModel.transition(req.params.id, 'cancelled', { actor: req.actor || null });
  res.json({ success: true, task });
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
