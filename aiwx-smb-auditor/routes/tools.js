/**
 * Tool registry routes (Phase 2)
 * ==============================
 * Exposes the internal tool registry over HTTP — the same registry the MCP
 * server draws from — so capability discovery and invocation have one governed
 * surface. POST /api/tools/:name is a mutating endpoint (auth-gated in
 * middleware via PROTECTED_MUTATIONS).
 */

const express = require('express');
const { sendError, asyncHandler } = require('../lib/http');
const registry = require('../lib/tool_registry');

const router = express.Router();

// Discovery — metadata (name, description, annotations, provenance, input shape).
router.get('/api/tools', (req, res) => {
  res.json({ success: true, tools: registry.list() });
});

// Invoke a tool by name. Approval for destructive tools comes from the request
// (approved:true) — the registry rejects destructive calls without it.
router.post('/api/tools/:name', asyncHandler('[Tools]', 'Tool invocation failed.', async (req, res) => {
  const { name } = req.params;
  if (!registry.has(name)) {
    return sendError(res, 404, `Unknown tool "${name}".`, { context: '[Tools]' });
  }
  const input = (req.body && req.body.input) || {};
  const approved = req.body && req.body.approved === true;
  const result = await registry.invoke(name, input, { actor: req.actor, role: req.role, approved });

  if (result.ok === false && result.status === 'requires_approval') {
    return res.status(202).json({ success: false, ...result });
  }
  if (result.ok === false) {
    return res.status(400).json({ success: false, ...result });
  }
  return res.json({ success: true, tool: name, result: result.result });
}));

module.exports = router;
