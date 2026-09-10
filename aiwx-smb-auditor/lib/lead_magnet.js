/**
 * AiWorX Nexus™ - Inbound Lead Magnet & Diagnostic Engine
 * Pairs instant AI readiness assessment with the deep scoutLocalProspects SWOT engine,
 * syncing contacts and tag queries into GoHighLevel (LeadConnector) Newsletter architecture.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { scoutLocalProspects } = require('./scouting');

// Load GHL Newsletter configuration dynamically
const CONFIG_PATH = path.resolve(__dirname, '../config/ghl_credentials.json');

function loadGhlConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (e) {
      console.warn('[LeadMagnet] Failed to parse ghl_credentials.json:', e.message);
    }
  }
  return {
    api_key: process.env.GHL_API_KEY || 'pit-947ddf65-1c55-4aed-bb23-cb2c7abf6771',
    form_id: process.env.GHL_FORM_ID || 'pZe6pBYw4ADPIzANliE0',
    workflow_id: process.env.GHL_WORKFLOW_ID || '532d11d7-9af5-40a3-b2c6-519a1bb4559b',
    required_tags: ['newsletter-subscriber', 'nl-monthly'],
    default_lead_magnet_source: 'nexus_ai_scorecard'
  };
}

/**
 * Generates an instant teaser AI readiness diagnostic and ROI estimate.
 * Fast, non-gated response (<2s) to maximize top-of-funnel engagement.
 */
function generateInstantDiagnostic({ domain = '', vertical = 'Professional Services', teamSize = 5, bottlenecks = [], hoursSpentPerWeek = 15 }) {
  const cleanDomain = domain.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '').split('/')[0].trim();
  
  // Baseline industry multipliers ($ per hour estimated burden cost)
  const hourlyRates = {
    'Legal & Law Firms': 125,
    'Healthcare & Medical': 95,
    'Professional Services': 85,
    'Accounting & Financial': 105,
    'Real Estate & Property': 75,
    'Contracting & Trades': 65,
    'Other / Tech': 80
  };

  const rate = hourlyRates[vertical] || 80;
  const team = Math.max(1, parseInt(teamSize, 10) || 5);
  const hours = Math.max(2, parseInt(hoursSpentPerWeek, 10) || 15);

  // Calculate annual waste vs. AI reclaimed capacity
  const annualWasteHours = team * hours * 50; // 50 work weeks
  const annualWasteCost = annualWasteHours * rate;
  
  // Human-in-the-Loop automation typically reclaims 65% to 80% of repetitive operational tasks
  const reclaimedHours = Math.round(annualWasteHours * 0.72);
  const projectedRoiDollars = Math.round(annualWasteCost * 0.72);

  // Compute Quantum AI Readiness Score (0 - 100)
  let score = 42; // baseline for legacy SMB
  if (cleanDomain.includes('ai') || cleanDomain.includes('tech') || cleanDomain.includes('cloud') || cleanDomain.includes('data')) score += 16;
  if (team >= 10) score += 12;
  else if (team >= 5) score += 6;
  if (bottlenecks.length > 2) score -= 6; // higher friction
  score = Math.min(88, Math.max(34, score)); // keep in realistic 'opportunity zone'

  // Top identified vulnerability gaps based on selected bottlenecks or vertical
  const defaultGaps = [
    {
      title: "Manual Inbound Lead & Booking Latency",
      impact: "Inbound client inquiries experience 2-6 hour response lag, leading to ~35% drop-off.",
      solution: "AiWorX 24/7 Conversational Triage & Instant Calendar Booking Agent"
    },
    {
      title: "Disparate CRM & Billing Data Silos",
      impact: "Staff spends manual hours re-entering client records between intake, QuickBooks, and project tracking.",
      solution: "Secure Cloud-Native Integration Bridge (Zero Third-Party SaaS Taxes)"
    },
    {
      title: "Lack of Human-in-the-Loop Operational Safeguards",
      impact: "Repetitive administrative decisions lack automated anomaly verification, causing ledger friction.",
      solution: "HITL Workforce Transition & Automated Exception Dispatch Queue"
    }
  ];

  return {
    success: true,
    domain: cleanDomain,
    vertical,
    teamSize: team,
    aiReadinessScore: score,
    projectedRoiDollars,
    reclaimedHoursAnnual: reclaimedHours,
    weeklyHoursSavedPerStaff: Math.round(hours * 0.72),
    vulnerabilityGaps: defaultGaps,
    timestamp: new Date().toISOString()
  };
}

/**
 * Captures an inbound lead, tags them with required Newsletter / Signal tags,
 * syncs to GoHighLevel (LeadConnector) API, and triggers background deep scoutLocalProspects audit.
 */
async function captureAndAuditInboundLead(leadData) {
  const ghlConfig = loadGhlConfig();
  const {
    fullName = '',
    email = '',
    phone = '',
    companyName = '',
    domain = '',
    vertical = 'Professional Services',
    teamSize = 5,
    leadMagnetSource = ghlConfig.default_lead_magnet_source || 'nexus_ai_scorecard',
    utmSource = 'website',
    utmCampaign = 'lm-nexus-diagnostic'
  } = leadData;

  if (!email || !email.includes('@')) {
    throw new Error('A valid email address is required.');
  }

  // Combined tag array ensuring Signal subscription query compliance
  const tags = [
    ...ghlConfig.required_tags, // 'newsletter-subscriber', 'nl-monthly'
    'lm-nexus-diagnostic',
    `source-${leadMagnetSource}`,
    `vertical-${vertical.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
  ];

  console.log(`[LeadMagnet] Processing inbound lead for: ${email} (${companyName || domain || 'Unknown Co'})`);
  console.log(`[LeadMagnet] Attaching Newsletter Audience Tags:`, tags);

  // 1. Sync contact directly to GHL API if API token is present
  let ghlSyncSuccess = false;
  try {
    ghlSyncSuccess = await pushToGhlApi({
      name: fullName,
      email,
      phone,
      companyName,
      tags,
      customFields: {
        lead_magnet_source: leadMagnetSource,
        domain: domain,
        utm_source: utmSource,
        utm_campaign: utmCampaign
      }
    });
  } catch (err) {
    console.warn(`[LeadMagnet] GHL API direct push notice:`, err.message);
  }

  // 2. Persist in local Inbound Leads Registry for Supabase sync & reporting
  const leadsRegistryPath = path.resolve(__dirname, '../audits_cache/inbound_leads_registry.json');
  try {
    let registry = [];
    if (fs.existsSync(leadsRegistryPath)) {
      registry = JSON.parse(fs.readFileSync(leadsRegistryPath, 'utf8'));
    }
    const leadRecord = {
      id: 'lead_' + Date.now(),
      fullName,
      email,
      phone,
      companyName,
      domain,
      vertical,
      teamSize,
      leadMagnetSource,
      tags,
      ghlSyncSuccess,
      capturedAt: new Date().toISOString(),
      deepAuditStatus: domain ? 'QUEUED' : 'SKIPPED_NO_DOMAIN'
    };
    registry.unshift(leadRecord);
    fs.writeFileSync(leadsRegistryPath, JSON.stringify(registry, null, 2), 'utf8');
  } catch (err) {
    console.error('[LeadMagnet] Failed to save lead to local registry:', err.message);
  }

  // 3. If domain is provided, trigger background deep audit via scoutLocalProspects
  if (domain && domain.includes('.')) {
    const cleanDomain = domain.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '').split('/')[0].trim();
    const apiKey = process.env.FIRECRAWL_API_KEY;
    
    // Execute asynchronously in background without blocking lead response
    setImmediate(async () => {
      try {
        console.log(`[LeadMagnet-Background] Initiating deep SWOT audit for lead domain: ${cleanDomain}`);
        const auditResults = await scoutLocalProspects(vertical, cleanDomain, apiKey);
        console.log(`[LeadMagnet-Background] Deep audit completed successfully for ${cleanDomain}.`);
        
        // Cache deep audit result for personalized executive delivery
        const auditCacheFile = path.resolve(__dirname, `../audits_cache/audit_${cleanDomain.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
        fs.writeFileSync(auditCacheFile, JSON.stringify(auditResults, null, 2), 'utf8');
      } catch (auditErr) {
        console.warn(`[LeadMagnet-Background] Deep audit notice for ${cleanDomain}:`, auditErr.message);
      }
    });
  }

  return {
    success: true,
    message: "Lead successfully captured and queued for email-first executive asset delivery.",
    email,
    tagsApplied: tags,
    newsletterSubscribed: true
  };
}

/**
 * Pushes contact payload to GoHighLevel API v2
 */
function pushToGhlApi(payload) {
  return new Promise((resolve) => {
    const ghlConfig = loadGhlConfig();
    const token = ghlConfig.api_key;
    
    if (!token) {
      return resolve(false);
    }

    const postData = JSON.stringify({
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      companyName: payload.companyName,
      tags: payload.tags,
      source: payload.customFields?.lead_magnet_source || 'nexus_ai_scorecard'
    });

    const options = {
      hostname: 'services.leadconnectorhq.com',
      path: '/contacts/upsert',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[LeadMagnet-GHL] Contact upserted successfully in GHL. Code: ${res.statusCode}`);
          resolve(true);
        } else {
          console.warn(`[LeadMagnet-GHL] GHL contact upsert response ${res.statusCode}:`, body.slice(0, 150));
          resolve(false);
        }
      });
    });

    req.on('error', (e) => {
      console.warn(`[LeadMagnet-GHL] Network error connecting to GHL:`, e.message);
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
}

module.exports = {
  generateInstantDiagnostic,
  captureAndAuditInboundLead,
  loadGhlConfig
};
