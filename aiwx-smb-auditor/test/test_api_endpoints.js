const assert = require('assert');
const http = require('http');

// Start express server in a test instance or test endpoints
const { generateInstantDiagnostic, captureAndAuditInboundLead, loadGhlConfig } = require('../lib/lead_magnet');

async function testEndpointsDirectly() {
  console.log('[Test] Running Lead Magnet API & Data Model Verification...\n');

  // Test 1: Config
  const config = loadGhlConfig();
  console.log('1. Testing GHL Config:', config);
  assert.strictEqual(config.form_id, 'pZe6pBYw4ADPIzANliE0');
  assert.ok(config.required_tags.includes('newsletter-subscriber'));
  assert.ok(config.required_tags.includes('nl-monthly'));

  // Test 2: Instant Diagnostic Heuristics
  const diag1 = generateInstantDiagnostic({
    domain: 'aiworxmiths.com',
    vertical: 'Professional Services',
    teamSize: 10,
    hoursSpentPerWeek: 15
  });
  console.log('2. Diagnostic output for aiworxmiths.com:', {
    score: diag1.aiReadinessScore,
    projectedRoi: '$' + diag1.projectedRoiDollars.toLocaleString(),
    reclaimedHours: diag1.reclaimedHoursAnnual
  });
  assert.ok(diag1.aiReadinessScore > 50);

  // Test 3: Inbound Lead Processing & Signal Tag Sync
  const leadCapture = await captureAndAuditInboundLead({
    fullName: 'Test Executive',
    email: 'executive@aiworxmiths.com',
    phone: '+1 555-123-4567',
    companyName: 'AiWorX Test Firm',
    domain: 'aiworxmiths.com',
    vertical: 'Professional Services',
    teamSize: 10,
    leadMagnetSource: 'nexus_ai_scorecard'
  });
  console.log('3. Lead capture result:', leadCapture);
  assert.strictEqual(leadCapture.success, true);
  assert.strictEqual(leadCapture.newsletterSubscribed, true);

  console.log('\n[✓ All Lead Magnet API & Business Logic Tests Passed Successfully!]');
}

testEndpointsDirectly().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
