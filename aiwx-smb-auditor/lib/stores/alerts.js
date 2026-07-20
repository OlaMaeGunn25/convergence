/**
 * Activity alerts store
 * =====================
 * Persisted social-engagement alerts. Seeds a demo dataset on first run so the
 * dashboard is never empty, and rotates anything past the 100-alert cap into a
 * dated archive under logs/.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../logger');
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
    const configDir = path.dirname(ALERTS_FILE);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(ALERTS_FILE, JSON.stringify(initialAlerts, null, 2));
    return initialAlerts;
  }
  try {
    return JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8'));
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
  fs.writeFileSync(ALERTS_FILE, JSON.stringify(alerts, null, 2));
}

module.exports = { loadAlerts, saveAlerts };
