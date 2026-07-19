/**
 * Automated audit queue store (crash-safe JSON on disk).
 */

const fs = require('fs');
const path = require('path');
const { AUDIT_QUEUE_FILE } = require('../paths');

function loadAuditQueue() {
  try {
    if (fs.existsSync(AUDIT_QUEUE_FILE)) return JSON.parse(fs.readFileSync(AUDIT_QUEUE_FILE, 'utf8'));
  } catch (e) { /* fall through to an empty queue */ }
  return { active: false, jobs: [] };
}

function saveAuditQueue(data) {
  const dir = path.dirname(AUDIT_QUEUE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(AUDIT_QUEUE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = { loadAuditQueue, saveAuditQueue };
