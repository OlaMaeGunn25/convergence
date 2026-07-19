/**
 * System routes — health, sample data, and the static posts library.
 */

const express = require('express');
const fs = require('fs');
const { sendError } = require('../lib/http');
const { POSTS_LIBRARY_FILE } = require('../lib/paths');

const router = express.Router();

/**
 * Pre-configured sample domains for instant, gorgeous testing.
 */
router.get('/api/sample-domains', (req, res) => {
  res.json({
    success: true,
    samples: [
      { domain: 'vintage-brew.com', label: 'Vintage Brew Co. (E-Commerce & Retail)', vertical: 'E-Commerce & Retail' },
      { domain: 'apex-consulting.org', label: 'Apex Global (Technology & SaaS)', vertical: 'Technology & SaaS' },
      { domain: 'smiles-dental.net', label: 'Smiles Clinic (Healthcare & Wellness)', vertical: 'Healthcare & Wellness' },
      { domain: 'vance-partners.com', label: 'Vance Advisory (Professional Services)', vertical: 'Professional Services' }
    ]
  });
});

/**
 * Social media posts library.
 */
router.get('/api/posts-library', (req, res) => {
  try {
    if (fs.existsSync(POSTS_LIBRARY_FILE)) {
      const data = fs.readFileSync(POSTS_LIBRARY_FILE, 'utf8');
      return res.json({ success: true, posts: JSON.parse(data) });
    }
    return sendError(res, 404, 'Posts library not found.', { context: '[PostsLibrary]' });
  } catch (err) {
    return sendError(res, 500, 'Failed to load the posts library.', { err, context: '[PostsLibrary]' });
  }
});

/**
 * Health check.
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'development',
    firecrawl: !!process.env.FIRECRAWL_API_KEY,
    ga4: !!process.env.GA4_PROPERTY_ID
  });
});

module.exports = router;
