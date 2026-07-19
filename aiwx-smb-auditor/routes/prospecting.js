/**
 * Prospecting routes — scouting, outreach, and CRM export.
 */

const express = require('express');
const { execFile } = require('child_process');

const logger = require('../lib/logger');
const { sendError, asyncHandler } = require('../lib/http');
const { SOCIAL_AGENT_DIR } = require('../lib/paths');
const { parsePublishResult } = require('../lib/publisher');
const { loadOutreachRegistry, saveOutreachRegistry } = require('../lib/stores/outreach');
const { scoutLocalProspects } = require('../lib/scouting');
const { isSupabaseConfigured, insertRow } = require('../lib/supabase');

const router = express.Router();

/**
 * Manually trigger the prospecting agent.
 */
router.post('/api/run-prospecting', (req, res) => {
  const { platform, vertical, dryRun } = req.body;
  const targetPlatform = platform || 'linkedin';
  const targetVertical = vertical || 'Healthcare';
  const isDryRun = dryRun !== false; // Default to dry-run safety

  logger.info(`[Prospecting] Manual trigger received. Platform: ${targetPlatform}, Vertical: ${targetVertical}, Dry-Run: ${isDryRun}`);

  // execFile with an args array — request values are never interpolated into a shell string
  const prospectArgs = ['prospecting_agent.js', '--platform', String(targetPlatform), '--vertical', String(targetVertical)];
  if (isDryRun) prospectArgs.push('--dry-run');

  execFile('node', prospectArgs, { cwd: SOCIAL_AGENT_DIR }, (error, stdout) => {
    if (error) {
      return sendError(res, 500, 'Prospecting run failed.', { err: error, context: '[Prospecting]' });
    }
    logger.info(`[Prospecting] Manual prospecting completed successfully:\n${stdout}`);
    res.json({ success: true, output: stdout });
  });
});

/**
 * Scout local prospects for a niche + location.
 */
router.post('/api/scout-prospects', asyncHandler('[Scouting]', 'Scouting failed.', async (req, res) => {
  const { niche, location, apiKey } = req.body;
  if (!niche || !location) {
    return sendError(res, 400, 'Niche and Location are required.', { context: '[Scouting]' });
  }

  const activeApiKey = apiKey || process.env.FIRECRAWL_API_KEY;
  if (!activeApiKey) {
    return sendError(res, 400, 'Firecrawl API key is required.', { context: '[Scouting]' });
  }

  logger.info(`[Scouting] Scouting prospects for Niche: "${niche}" in "${location}"`);
  const prospects = await scoutLocalProspects(niche, location, activeApiKey);
  res.json({ success: true, prospects });
}));

/**
 * Record a completed outreach against the local prospect registry.
 */
function registerOutreach(domain, platform, text) {
  const registry = loadOutreachRegistry();
  const existingIdx = registry.findIndex(p => p.domain === domain);
  const newOutreach = {
    platform,
    text,
    timestamp: new Date().toISOString(),
    status: 'SENT'
  };

  if (existingIdx !== -1) {
    if (!registry[existingIdx].outreaches) registry[existingIdx].outreaches = [];
    registry[existingIdx].outreaches.push(newOutreach);
    registry[existingIdx].status = 'SENT';
    registry[existingIdx].lastUpdated = new Date().toISOString();
  } else {
    registry.push({
      domain,
      status: 'SENT',
      lastUpdated: new Date().toISOString(),
      outreaches: [newOutreach]
    });
  }
  saveOutreachRegistry(registry);
}

/**
 * Send an outreach message to a scouted prospect.
 */
router.post('/api/outreach-send', (req, res) => {
  const { domain, platform, text, image } = req.body;
  if (!domain || !platform || !text) {
    return sendError(res, 400, 'Domain, platform, and text are required.', { context: '[Outreach]' });
  }

  logger.info(`[Outreach] Triggering outreach for ${domain} on ${platform}...`);
  const args = ['publish_api.js', '--platform', platform.toLowerCase(), '--text', text];
  if (image) {
    args.push('--image', image);
  }

  execFile('node', args, { cwd: SOCIAL_AGENT_DIR }, (error, stdout, stderr) => {
    logger.info(`[Outreach] publish_api stdout:\n${stdout}`);
    if (stderr) logger.warn(`[Outreach] publish_api stderr:\n${stderr}`);

    const result = { ...parsePublishResult(stdout, { success: false }), log: stdout };

    if (error && !result.success) {
      return sendError(res, 500, 'Outreach campaign execution failed.', {
        err: error,
        context: '[Outreach]',
        extra: { log: stdout }
      });
    }

    registerOutreach(domain, platform, text);
    res.json(result);
  });
});

/**
 * Supabase credentials are configured STRICTLY through environment variables
 * (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). The previous behaviour — accepting
 * a service-role key over HTTP and persisting it to a plaintext JSON file — was
 * removed as a production security hazard.
 */
router.get('/api/supabase-credentials', (req, res) => {
  res.json({
    success: true,
    configured: isSupabaseConfigured(),
    source: 'environment',
    // Never echo the URL or key back to the browser.
    hasKey: isSupabaseConfigured()
  });
});

router.post('/api/supabase-credentials', (req, res) => {
  res.status(410).json({
    success: false,
    error: 'Credential upload via API has been disabled. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as environment variables on the host/container instead.'
  });
});

/**
 * Sync a scouted prospect into the Supabase Sales Command Center.
 */
router.post('/api/export-crm', asyncHandler('[CRM]', 'Supabase write failed.', async (req, res) => {
  const { prospect } = req.body;
  if (!prospect || !prospect.domain) {
    return sendError(res, 400, 'Prospect data is required.', { context: '[CRM]' });
  }

  if (!isSupabaseConfigured()) {
    return sendError(res, 503, 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.', { context: '[CRM]' });
  }

  logger.info(`[CRM] Syncing prospect ${prospect.domain} to Supabase Sales Command Center...`);

  // 1. Insert into inbound_leads (pooled, retry-capable writes via lib/supabase.js)
  const leadPayload = {
    ghl_contact_id: `outreach_${prospect.domain.replace(/\./g, '_')}_${Date.now()}`,
    raw_payload: prospect,
    enrichment: {
      domain: prospect.domain,
      businessName: prospect.businessName,
      vertical: prospect.vertical,
      gaps: prospect.gaps,
      personnel: prospect.personnel,
      scoured: prospect.scoured,
      workforce: prospect.workforce
    },
    status: 'received'
  };

  logger.info('[CRM] Inserting inbound lead...');
  const leadResult = await insertRow('inbound_leads', leadPayload);

  // 2. Insert corresponding discovery record
  const discoveryPayload = {
    consultant_id: '00000000-0000-0000-0000-000000000000', // System default/service placeholder
    consultant_profile_id: 'social_media_agent',
    status: 'qualified',
    data: {
      company: prospect.businessName,
      domain: prospect.domain,
      business_context: {
        lead_name: prospect.personnel?.[0]?.name || 'Owner',
        vertical: prospect.vertical
      },
      research: prospect
    },
    primary_bottleneck: prospect.gaps?.[0]?.title || 'Manual Administrative Process Drag',
    recommended_service: prospect.gaps?.[0]?.service || 'AiWorXmiths Custom Integrations'
  };

  logger.info('[CRM] Inserting discovery report...');
  await insertRow('discoveries', discoveryPayload);

  res.json({ success: true, lead: leadResult });
}));

module.exports = router;
