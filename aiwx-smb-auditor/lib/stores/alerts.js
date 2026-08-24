/**
 * Activity alerts store
 * =====================
 * Persisted social-engagement alerts. Seeds a demo dataset on first run so the
 * dashboard is never empty, and rotates anything past the 100-alert cap into a
 * dated archive under logs/.
 *
 * Writes go through json_file's atomic replace + per-path mutex. This store did
 * bare readFileSync/writeFileSync long after that hardening landed beside it,
 * so two handlers replying to alerts concurrently could lose one another's
 * writes or truncate the file.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const jsonFile = require('./json_file');
const { ALERTS_FILE, LOGS_DIR } = require('../paths');

const SEED_ALERTS = [
  {
    id: "alert_01",
    platform: "linkedin",
    userName: "Sarah Jenkins",
    userHandle: "Sarah Jenkins (Operations Director, Apex Legal)",
    avatar: "african_american_female_lawyer.png",
    postId: "post_01",
    postTitle: "The Silent Cost of Disconnected Operations",
    commentText: "This upskilling approach is exactly what we need. How do we get started with the Operational Capacity Audit?",
    timestampOffsetMs: 3600000 * 2, // 2 hours ago
    status: "UNRESOLVED",
    aiDraft: "Hello Sarah! Thanks for reaching out. We would love to map your workflows. You can schedule a Free Scoping Diagnostics call directly at https://aiworxmiths.com/services. We focus on upskilling your existing staff into Growth Coordinators to manage these systems.",
    replyText: null,
    repliedAt: null
  },
  {
    id: "alert_02",
    platform: "instagram",
    userName: "Dr. Keith Miller",
    userHandle: "@miller_dental_nyc",
    avatar: "african_american_male_advisor.png",
    postId: "post_03",
    postTitle: "Stop Copy-Pasting: Connecting Your Billing and CRM",
    commentText: "Does your CRM to QuickBooks ledger sync support HIPAA compliance for patient intake?",
    timestampOffsetMs: 1800000, // 30 mins ago
    status: "UNRESOLVED",
    aiDraft: "Hi Dr. Miller! Yes, absolutely. Our containerized integrations run inside your private VPC (AWS/GCP) using Row-Level Security (RLS) and Key Management Service (KMS) encryption to ensure complete HIPAA compliance. Your data never leaves your secure cloud.",
    replyText: null,
    repliedAt: null
  },
  {
    id: "alert_03",
    platform: "threads",
    userName: "Marcus Vance",
    userHandle: "@marcus_vance",
    avatar: "diverse_male_entrepreneur_1779798785119.png",
    postId: "post_02",
    postTitle: "Sustainable AI Scale: Countering Hype",
    commentText: "I like the idea of flat-fee hosting instead of per-seat licensing. It’s hard to predict SaaS bills as we grow.",
    timestampOffsetMs: 900000, // 15 mins ago
    status: "UNRESOLVED",
    aiDraft: "Thanks Marcus! That’s the exact margin drain we resolve. By deploying the Convergence-Ai container natively in your own cloud, we eliminate per-seat SaaS taxes, capping hosting at flat, predictable rates (~$35/month).",
    replyText: null,
    repliedAt: null
  }
];

function buildSeedAlerts() {
  const now = Date.now();
  return SEED_ALERTS.map(({ timestampOffsetMs, ...alert }) => ({
    ...alert,
    timestamp: new Date(now - timestampOffsetMs).toISOString()
  }));
}

function loadAlerts() {
  if (!fs.existsSync(ALERTS_FILE)) {
    const initialAlerts = buildSeedAlerts();
    // Atomic seed: a reader can never observe a partially-written seed file.
    jsonFile.writeAtomicSync(ALERTS_FILE, initialAlerts);
    return initialAlerts;
  }
  try {
    const raw = fs.readFileSync(ALERTS_FILE, 'utf8');
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    logger.warn(`[Alerts] Could not parse ${ALERTS_FILE}; starting from an empty alert list.`);
    return [];
  }
}

function saveAlerts(alerts) {
  if (alerts.length > 100) {
    const overflow = alerts.splice(100);
    try {
      if (!fs.existsSync(LOGS_DIR)) {
        fs.mkdirSync(LOGS_DIR, { recursive: true });
      }
      const date = new Date().toISOString().split('T')[0];
      const archivePath = path.join(LOGS_DIR, `alerts-${date}.json`);
      fs.appendFileSync(archivePath, JSON.stringify(overflow, null, 2) + '\n', 'utf8');
      logger.info(`[Alerts] Archived ${overflow.length} overflow alert(s) to: ${archivePath}`);
    } catch (archiveErr) {
      logger.error(`[Alerts] Failed to archive overflow alerts :: ${archiveErr.stack || archiveErr.message}`);
    }
  }
  const promise = jsonFile.mutate(ALERTS_FILE, [], () => ({ value: alerts, result: alerts }));
  // Preserve the original synchronous-looking contract for existing callers,
  // which neither await nor inspect the return value.
  if (promise && typeof promise.catch === 'function') {
    promise.catch(e => logger.error(`[Alerts] Failed to persist alerts :: ${e.message}`));
  }
  return alerts;
}

/**
 * Read-modify-write under the lock. Preferred over load→mutate→save when the
 * new value depends on the current one — that pair is a lost-update race if two
 * reply handlers interleave.
 */
function updateAlerts(mutator) {
  return jsonFile.mutate(ALERTS_FILE, [], (store) => {
    const current = Array.isArray(store) ? store : [];
    const next = mutator(current) || current;
    return { value: next, result: next };
  });
}

module.exports = { loadAlerts, saveAlerts, updateAlerts };
