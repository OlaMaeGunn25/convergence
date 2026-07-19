/**
 * Google Scholar routes (Legal Services vertical).
 */

const express = require('express');
const { sendError, asyncHandler } = require('../lib/http');
const { searchScholar } = require('../lib/scholar');

const router = express.Router();

/**
 * Google Scholar Search Endpoint (Legal Services vertical)
 * Powers case-law search, expert-witness publication vetting, and
 * scientific-precedent checks. Falls back to a simulated dataset when the
 * SerpApi key is not configured.
 *
 * @openapi
 * /api/scholar/search:
 *   get:
 *     summary: Search Google Scholar for case law and expert publications
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: num
 *         schema: { type: integer }
 *       - in: query
 *         name: engine
 *         schema: { type: string, enum: [google_scholar, google_scholar_author] }
 *     responses:
 *       200: { description: Structured scholar results }
 */
router.get('/api/scholar/search', asyncHandler('[Scholar]', 'Scholar search failed.', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const engine = req.query.engine === 'google_scholar_author' ? 'google_scholar_author' : 'google_scholar';

  if (!q && engine !== 'google_scholar_author') {
    return sendError(res, 400, 'Query parameter "q" is required.', { context: '[Scholar]' });
  }

  const data = await searchScholar(q, {
    engine,
    num: req.query.num,
    authorId: req.query.author_id,
    apiKey: req.query.apiKey
  });
  return res.json(data);
}));

module.exports = router;
