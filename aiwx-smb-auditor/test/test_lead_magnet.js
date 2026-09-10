const assert = require('assert');
const { generateInstantDiagnostic, captureAndAuditInboundLead, loadGhlConfig } = require('../lib/lead_magnet');

async function runTests() {
  console.log('[Test] Running AiWorX Nexus™ Lead Magnet Unit Tests...\n');

  // Test 1: Config loading
  const config = loadGhlConfig();
  assert.ok(config.api_key, 'GHL API key must be present');
  assert.ok(config.required_tags.includes('newsletter-subscriber'), 'Must include newsletter-subscriber tag');
  assert.ok(config.required_tags.includes('nl-monthly'), 'Must include nl-monthly tag');
  console.log('✓ Test 1 Passed: GHL Newsletter configuration loaded with correct Signal tag queries.');

  // Test 2: Instant Diagnostic Calculation
  const diagnostic = generateInstantDiagnostic({
    domain: 'https://www.examplelawfirm.com/about',
    vertical: 'Legal & Law Firms',
    teamSize: 8,
    hoursSpentPerWeek: 20
  });

  assert.strictEqual(diagnostic.success, true);
  assert.strictEqual(diagnostic.domain, 'examplelawfirm.com');
  assert.ok(diagnostic.aiReadinessScore >= 0 && diagnostic.aiReadinessScore <= 100);
  assert.ok(diagnostic.projectedRoiDollars > 0, 'Projected ROI must be calculated');
  assert.strictEqual(diagnostic.vulnerabilityGaps.length, 3, 'Must return top 3 vulnerability gaps');
  console.log('✓ Test 2 Passed: Instant diagnostic calculated accurately (Score: ' + diagnostic.aiReadinessScore + ', ROI: $' + diagnostic.projectedRoiDollars.toLocaleString() + ').');

  // Test 3: Lead Capture & GHL Tag Application
  const captureResult = await captureAndAuditInboundLead({
    fullName: 'Jane Doe',
    email: 'jane.doe@examplelawfirm.com',
    phone: '+1 555-019-2834',
    companyName: 'Example Law Firm',
    domain: 'examplelawfirm.com',
    vertical: 'Legal & Law Firms',
    teamSize: 8,
    leadMagnetSource: 'nexus_ai_scorecard'
  });

  assert.strictEqual(captureResult.success, true);
  assert.ok(captureResult.tagsApplied.includes('newsletter-subscriber'), 'Must apply newsletter-subscriber tag');
  assert.ok(captureResult.tagsApplied.includes('nl-monthly'), 'Must apply nl-monthly tag');
  assert.ok(captureResult.tagsApplied.includes('lm-nexus-diagnostic'), 'Must apply lm-nexus-diagnostic tag');
  console.log('✓ Test 3 Passed: Lead capture successfully applies all newsletter and magnet tags.');

  console.log('\n[All Lead Magnet Tests Passed Successfully!]');
}

runTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
