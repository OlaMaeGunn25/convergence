/**
 * Multi-agent negotiation routes.
 */

const express = require('express');
const { sendError, asyncHandler } = require('../lib/http');
const { negotiate } = require('../lib/negotiation');

const router = express.Router();

/**
 * Multi-Agent Negotiation Endpoint
 * Runs a Proposer/Critic/Arbiter negotiation to a consensus recommendation,
 * escalating to the HITL queue when consensus fails or the vertical is high-risk.
 *
 * @openapi
 * /api/negotiate:
 *   post:
 *     summary: Run a Proposer/Critic/Arbiter negotiation to consensus
 *     responses:
 *       200: { description: Negotiation transcript and consensus verdict }
 */
router.post('/api/negotiate', asyncHandler('[Negotiation]', 'Negotiation failed.', async (req, res) => {
  const { topic, context, vertical, options } = req.body || {};
  if (!topic || !String(topic).trim()) {
    return sendError(res, 400, 'A negotiation "topic" is required.', { context: '[Negotiation]' });
  }
  const result = await negotiate({ topic, context, vertical, options });
  return res.json(result);
}));

module.exports = router;
