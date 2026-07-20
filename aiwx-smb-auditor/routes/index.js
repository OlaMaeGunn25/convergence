/**
 * Router registry
 * ===============
 * Each router declares its own absolute `/api/...` paths, so they all mount at
 * the root and the URL surface is identical to the pre-split monolith. Order is
 * irrelevant between them (no overlapping prefixes), but the SPA catch-all in
 * server.js must stay registered after this.
 */

const express = require('express');

const routers = [
  require('./system'),
  require('./audit'),
  require('./scholar'),
  require('./negotiation'),
  require('./analytics'),
  require('./alerts'),
  require('./social'),
  require('./prospecting'),
  require('./tools')
];

const router = express.Router();
for (const r of routers) {
  router.use(r);
}

module.exports = router;
