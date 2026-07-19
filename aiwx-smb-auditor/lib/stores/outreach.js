/**
 * Prospect outreach registry store.
 */

const fs = require('fs');
const logger = require('../logger');
const { OUTREACH_REGISTRY_FILE } = require('../paths');

function loadOutreachRegistry() {
  if (!fs.existsSync(OUTREACH_REGISTRY_FILE)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(OUTREACH_REGISTRY_FILE, 'utf8'));
  } catch (e) {
    logger.warn(`[Outreach] Could not parse ${OUTREACH_REGISTRY_FILE}; starting from an empty registry.`);
    return [];
  }
}

function saveOutreachRegistry(registry) {
  fs.writeFileSync(OUTREACH_REGISTRY_FILE, JSON.stringify(registry, null, 2));
}

module.exports = { loadOutreachRegistry, saveOutreachRegistry };
