/**
 * Automated Unit Test Suite for SMB External Audit Engine
 */
process.env.NODE_ENV = 'test';

const { cleanDomain, scrapeDomain, extractNamesFromText } = require('../lib/scraper');
const { analyzeFootprint } = require('../lib/analyzer');
const { analyzeWorkforce } = require('../lib/workforce');
const { scourBusiness, isOlderThanOneYear, filterRecentMentions } = require('../lib/scourer');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`\x1b[32m✔ PASS:\x1b[0m ${message}`);
    passedTests++;
  } else {
    console.error(`\x1b[31m✘ FAIL:\x1b[0m ${message}`);
    failedTests++;
  }
}

async function runTests() {
  console.log(`================================================================`);
  console.log(`🧪 Running SMB Audit Engine Test Suite...`);
  console.log(`================================================================`);

  // --- Test Set 1: Domain Cleaner Normalization ---
  try {
    assert(cleanDomain('https://www.vintage-brew.com/shop?id=12') === 'vintage-brew.com', 'Should clean https and query paths');
    assert(cleanDomain('http://smiles-dental.net/') === 'smiles-dental.net', 'Should clean http and trailing slash');
    assert(cleanDomain('   apex-consulting.org   ') === 'apex-consulting.org', 'Should trim whitespace');
  } catch (e) {
    assert(false, `Domain cleaning crashed: ${e.message}`);
  }

  // --- Mock Scraper Data Package for Mock Tests ---
  const sampleScrapedData = {
    domain: 'test-vintage.com',
    businessName: 'Test Vintage',
    vertical: 'E-Commerce & Retail',
    technologies: [
      { name: 'Shopify', category: 'CMS & E-Commerce', confidence: 0.99, description: 'E-commerce platform.' },
      { name: 'Google Analytics 4', category: 'Analytics', confidence: 0.99, description: 'User traffic tracking.' },
      { name: 'Cloudflare', category: 'Hosting & CDN', confidence: 0.95, description: 'Edge speed and proxy shield.' }
    ],
    subdomains: ['www', 'mail', 'checkout'],
    metaData: {
      title: 'Test Vintage Store',
      description: 'Artisan boutique shopping experience.',
      socialLinks: { linkedin: 'link', twitter: 'twit', facebook: 'fb' }
    },
    scrapedPages: ['/', '/about', '/contact'],
    rawTeamData: [
      { name: 'Alice', role: 'Store Owner', bio: 'Directs logistics.' },
      { name: 'Bob', role: 'Customer Support Representative', bio: 'Answers customer chats.' }
    ],
    rawJobPostings: [
      { title: 'Inventory Clerk', description: 'Manually uploading listings and descriptions.' }
    ],
    firewallAudit: {
      wafDetected: 'Cloudflare Edge WAF',
      wafConfidence: 0.99,
      securityHeaders: { hsts: true, csp: false, xFrameOptions: true, cors: true },
      sslStatus: 'Active & Valid (Cloudflare SNI SSL)',
      dnsSecActive: true
    }
  };

  // --- Test Set 2: SWOT & Analyzer Module ---
  try {
    const analysis = analyzeFootprint(sampleScrapedData);
    
    assert(analysis.domain === 'test-vintage.com', 'Analyzer maps domain correctly');
    assert(analysis.metrics.techModernization >= 0 && analysis.metrics.techModernization <= 100, 'Tech score bounds between 0-100');
    assert(analysis.metrics.securityPosture >= 0 && analysis.metrics.securityPosture <= 100, 'Security score bounds between 0-100');
    assert(analysis.metrics.marketingIntegrations >= 0 && analysis.metrics.marketingIntegrations <= 100, 'Marketing score bounds between 0-100');
    assert(analysis.metrics.overallHealth === Math.round((analysis.metrics.techModernization + analysis.metrics.securityPosture + analysis.metrics.marketingIntegrations)/3), 'Overall score is average of subscores');
    
    assert(analysis.swot.strengths.length > 0, 'Strengths array generated');
    assert(analysis.swot.weaknesses.length > 0, 'Weaknesses array generated');
    assert(analysis.swot.opportunities.length > 0, 'Opportunities array generated');
    assert(analysis.swot.threats.length > 0, 'Threats array generated');
  } catch (e) {
    assert(false, `SWOT Analyzer crashed: ${e.message}`);
  }

  // --- Test Set 3: Workforce AI Transition Module ---
  try {
    const workforce = analyzeWorkforce(sampleScrapedData);

    assert(workforce.summary.totalStaffAudited === 2, 'Infers team sizes correctly');
    assert(workforce.summary.jobReadinessScore >= 0 && workforce.summary.jobReadinessScore <= 100, 'Readiness score bounds between 0-100');
    assert(['AI Advantage', 'Transition Ready', 'Vulnerable'].includes(workforce.summary.status), 'Valid status mapped');
    
    const alice = workforce.roles.find(r => r.employeeName === 'Alice');
    const bob = workforce.roles.find(r => r.employeeName === 'Bob');

    assert(bob.automationRiskScore > alice.automationRiskScore, 'Support representatives have higher automation exposure than store owners');
    assert(bob.hitlRole === 'AI Helpdesk Trainer & Live Escalator', 'Support Representative maps to correct HITL title');
    assert(bob.coreSkillsToAcquire.length > 0, 'Skills are populated for upskilled support reps');
    assert(bob.transitionBlueprint.length > 0, 'Transition milestones are generated');
    
    assert(workforce.hiringStrategy.length === 1, 'Hiring adjustments generated correctly');
    assert(workforce.departments.length > 0, 'Department summary statistics rendered');
    assert(workforce.timeframeMilestones.immediate.actions.length > 0, 'Timeline outlines immediate actions');
  } catch (e) {
    assert(false, `Workforce analyzer crashed: ${e.message}`);
  }

  // --- Test Set 4: WAF / Firewall & Deep Scouring Engines ---
  try {
    // A. Validate Scourer simulated outputs
    const scoured = await scourBusiness('test-vintage.com', 'Test Vintage', 'E-Commerce & Retail', null);
    assert(scoured.revenueEstimate === '$1,850,000', 'Scourer infers vertical-correct estimated revenue');
    assert(scoured.headcountEstimate === '12 employees', 'Scourer infers vertical-correct headcount');
    assert(scoured.filings.state.agency === 'California Secretary of State', 'Scourer maps correct state filing agency');
    assert(scoured.filings.state.status === 'Active / Good Standing', 'Scourer maps good filing standing');
    assert(scoured.filings.federal.samGovStatus === 'Not Registered (B2C direct retail)', 'Scourer maps correct federal SAM status');
    assert(scoured.publicMentions.length === 2, 'Scourer maps correct number of news mentions');

    // B. Validate live scraper wrapper additions
    const crawled = await scrapeDomain('apex-tech.com', null);
    assert(crawled.firewallAudit !== undefined, 'Crawler return object includes firewallAudit block');
    assert(crawled.firewallAudit.wafDetected === 'AWS WAF Shield', 'Crawler correctly detects mock vertical WAF');
    assert(crawled.firewallAudit.securityHeaders.csp === true, 'Crawler detects mock vertical security headers');
    // C. Validate specialized Smart Optimal Solutions (Green Tech / Infrastructure) taxonomy
    const greentechData = await scrapeDomain('smartoptimalsolutions.com', null);
    assert(greentechData.vertical === 'Sustainable Infrastructure & Green Tech', 'Smart Optimal Solutions domain maps to Sustainable Infrastructure & Green Tech vertical');
    assert(greentechData.businessName === 'Smart Optimal Solutions', 'Business name derived as Smart Optimal Solutions');

    const greentechScoured = await scourBusiness(greentechData.domain, greentechData.businessName, greentechData.vertical, null);
    assert(greentechScoured.filings.state.agency.includes('Washington') && greentechScoured.filings.state.status.includes('MBE Certified'), 'Scourer dynamically infers MBE certified Washington state filings');
    assert(greentechScoured.filings.federal.samGovStatus === 'Active Registration (CAGE Code: 9ZG28)', 'Scourer resolves active federal CAGE registration');

    const greentechAnalysis = analyzeFootprint(greentechData);
    const iotPitch = greentechAnalysis.pitchOpportunities.find(p => p.gapTitle.includes('Lack of Interactive Clean Energy ROI'));
    assert(iotPitch !== undefined, 'SWOT analyzer produces custom Interactive ROI payback configurator sales pitches');
    assert(iotPitch.pricingProposal.includes('$4,500'), 'Interactive payback configurator pricing proposal is correctly structured');

    // D. Validate Date-filtering helpers
    assert(isOlderThanOneYear('August 2024') === true, 'isOlderThanOneYear flags date from August 2024 as old');
    assert(isOlderThanOneYear('February 2026') === false, 'isOlderThanOneYear flags date from February 2026 as recent');
    assert(isOlderThanOneYear('Recent Scrape') === false, 'isOlderThanOneYear flags Recent Scrape as recent');

    const testMentions = [
      { title: 'Recent news', date: 'February 2026' },
      { title: 'Old news', date: 'August 2024' }
    ];
    const filtered = filterRecentMentions(testMentions);
    assert(filtered.length === 1 && filtered[0].title === 'Recent news', 'filterRecentMentions filters out outdated mentions when recent ones are present');

    const onlyOldMentions = [
      { title: 'Old news 1', date: 'August 2024' },
      { title: 'Old news 2', date: 'December 2024' }
    ];
    const kept = filterRecentMentions(onlyOldMentions);
    assert(kept.length === 0, 'filterRecentMentions strictly filters out all outdated mentions and returns an empty list');

    // E. Validate Name Extraction and Cross-Referencing
    const sampleWebsiteHtml = `
      <html>
        <body>
          <h1>Lobo Law Office</h1>
          <p>Meet Adrian Lobo, the founder and lead counsel at Lobo Law. Adrian Lobo, Esq. has years of trial defense experience.</p>
          <p>Attorney Sarah Jenkins is also a partner at our firm.</p>
          <p>CEO John Doe and Founder Jane Smith are leading our executive committee.</p>
        </body>
      </html>
    `;
    const extracted = extractNamesFromText(sampleWebsiteHtml);
    assert(extracted.includes('Adrian Lobo'), 'extractNamesFromText should detect Adrian Lobo from Esq. pattern');
    assert(extracted.includes('Sarah Jenkins'), 'extractNamesFromText should detect Sarah Jenkins from Attorney pattern');
    assert(extracted.includes('John Doe'), 'extractNamesFromText should detect John Doe from CEO role pattern');
    assert(extracted.includes('Jane Smith'), 'extractNamesFromText should detect Jane Smith from Founder role pattern');

    // Test that scourBusiness builds correct query using team names
    const scouredWithNames = await scourBusiness('lobolaw.com', 'Lobo Law', 'Professional Services', null, ['Adrian Lobo', 'Sarah Jenkins']);
    assert(scouredWithNames.publicMentions !== undefined, 'scourBusiness returns public mentions with team names');

  } catch (e) {
    assert(false, `Scouring, Green Tech, WAF & Name cross-reference tests crashed: ${e.message}`);
  }

  // --- Final Results Report ---
  console.log(`================================================================`);
  console.log(`📊 Test Results: ${passedTests} passed, ${failedTests} failed.`);
  console.log(`================================================================`);

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
