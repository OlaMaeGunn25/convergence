/**
 * CRM / integration-candidate routes.
 *
 * The public pre-sales prospecting layer (scouting, outreach) was removed from
 * CONVERGENCE-Ai — those are ASES sales-enablement functions. See
 * docs/AUDITOR_REFRAME.md. What remains here is the Supabase-credentials status
 * surface and a reframed CRM export that records an *integration-readiness
 * candidate* (a company the Auditor evaluated, plus its systems inventory and
 * recommended integrations) rather than a sales prospect.
 */

const express = require('express');

const logger = require('../lib/logger');
const { sendError, asyncHandler } = require('../lib/http');
const { isSupabaseConfigured, insertRow } = require('../lib/supabase');

const router = express.Router();

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
 * Record an integration-readiness CANDIDATE to Supabase. This is NOT sales
 * prospecting — it records a company the Auditor has evaluated, along with its
 * systems inventory and recommended integrations, so a human can decide whether
 * to connect those systems to the governed MCP layer.
 *
 * @openapi
 * /api/export-crm:
 *   post:
 *     summary: Record an integration-readiness candidate to the CRM store
 *     responses:
 *       200: { description: Candidate recorded }
 */
router.post('/api/export-crm', asyncHandler('[CRM]', 'Supabase write failed.', async (req, res) => {
  // `candidate` is preferred; `prospect` is accepted for backward compatibility.
  const candidate = req.body.candidate || req.body.prospect;
  if (!candidate || !candidate.domain) {
    return sendError(res, 400, 'Integration candidate data (with a domain) is required.', { context: '[CRM]' });
  }

  if (!isSupabaseConfigured()) {
    return sendError(res, 503, 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.', { context: '[CRM]' });
  }

  logger.info(`[CRM] Recording integration-readiness candidate ${candidate.domain} to Supabase...`);

  // 1. Insert into inbound_leads (pooled, retry-capable writes via lib/supabase.js)
  const leadPayload = {
    ghl_contact_id: `candidate_${candidate.domain.replace(/\./g, '_')}_${Date.now()}`,
    raw_payload: candidate,
    enrichment: {
      domain: candidate.domain,
      businessName: candidate.businessName,
      vertical: candidate.vertical,
      systemsInventory: candidate.systemsInventory || candidate.technologies,
      integrationReadiness: candidate.integrationReadiness,
      recommendedIntegrations: candidate.recommendedIntegrations,
      personnel: candidate.personnel,
      workforce: candidate.workforce
    },
    status: 'evaluated'
  };

  logger.info('[CRM] Inserting integration-readiness candidate...');
  const leadResult = await insertRow('inbound_leads', leadPayload);

  // 2. Insert corresponding evaluation record.
  const discoveryPayload = {
    consultant_id: '00000000-0000-0000-0000-000000000000', // System default/service placeholder
    consultant_profile_id: 'convergence_auditor',
    status: 'evaluated',
    data: {
      company: candidate.businessName,
      domain: candidate.domain,
      business_context: {
        lead_name: candidate.personnel?.[0]?.name || 'Owner',
        vertical: candidate.vertical
      },
      evaluation: candidate
    },
    primary_bottleneck: candidate.recommendedIntegrations?.[0]?.system || 'Unassessed systems environment',
    recommended_service: candidate.recommendedIntegrations?.[0]?.integration || 'AiWorXmiths MCP Integration'
  };

  logger.info('[CRM] Inserting integration evaluation record...');
  await insertRow('discoveries', discoveryPayload);

  res.json({ success: true, candidate: leadResult });
}));

module.exports = router;
