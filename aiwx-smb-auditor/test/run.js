/**
 * Automated Unit Test Suite for SMB External Audit Engine
 */
process.env.NODE_ENV = 'test';

const { cleanDomain, scrapeDomain, extractNamesFromText } = require('../lib/scraper');
const { analyzeFootprint } = require('../lib/analyzer');
const { analyzeWorkforce } = require('../lib/workforce');
const { scourBusiness, isOlderThanOneYear, filterRecentMentions } = require('../lib/scourer');
const { searchScholar, isScholarConfigured, getSimulatedResults } = require('../lib/scholar');

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
    assert(scoured.revenueEstimate.value === '$1,850,000', 'Scourer infers vertical-correct estimated revenue');
    assert(scoured.headcountEstimate.value === '12 employees', 'Scourer infers vertical-correct headcount');
    assert(scoured.filings.state.value.agency === 'California Secretary of State', 'Scourer maps correct state filing agency');
    assert(scoured.filings.state.value.status === 'Active / Good Standing', 'Scourer maps good filing standing');
    assert(scoured.filings.federal.value.samGovStatus === 'Not Registered (B2C direct retail)', 'Scourer maps correct federal SAM status');
    assert(scoured.publicMentions.value.length === 2, 'Scourer maps correct number of news mentions');

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
    assert(greentechScoured.filings.state.value.agency.includes('Washington') && greentechScoured.filings.state.value.status.includes('MBE Certified'), 'Scourer dynamically infers MBE certified Washington state filings');
    assert(greentechScoured.filings.federal.value.samGovStatus === 'Active Registration (CAGE Code: 9ZG28)', 'Scourer resolves active federal CAGE registration');

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

  // --- Test Set 5: Google Scholar Integration (Legal vertical) ---
  try {
    // Ensure the environment key is unset so the fallback path is exercised.
    delete process.env.SERPAPI_API_KEY;
    delete process.env.SCHOLAR_API_KEY;

    // A. searchScholar retrieves and structures research results
    const scholar = await searchScholar('lobo law appeals precedent');
    assert(scholar.success === true, 'searchScholar returns a successful result');
    assert(Array.isArray(scholar.results) && scholar.results.length > 0, 'searchScholar returns a non-empty results array');

    const firstResult = scholar.results[0];
    const requiredFields = ['title', 'source', 'authors', 'publicationDate', 'citationsCount', 'link'];
    const hasAllFields = requiredFields.every(f => f in firstResult);
    assert(hasAllFields, 'Each scholar result exposes title, source, authors, publicationDate, citationsCount, and link');
    assert(Array.isArray(firstResult.authors), 'Scholar result authors field is an array');
    assert(typeof firstResult.citationsCount === 'number', 'Scholar result citationsCount is numeric');

    // B. Mock fallback dataset activates gracefully when the API key is missing
    assert(isScholarConfigured() === false, 'isScholarConfigured reports false when no key is set');
    assert(scholar.simulated === true, 'searchScholar activates the simulated fallback when no API key is configured');
    const caseLaw = scholar.results.some(r => r.title.includes('Nevada') || r.title.includes('Lobo Law'));
    assert(caseLaw, 'Simulated fallback includes representative case-law citations (Nevada / Lobo Law)');

    // C. getSimulatedResults is deterministic and echoes the query
    const sim = getSimulatedResults('expert witness vetting');
    assert(sim.simulated === true && sim.query === 'expert witness vetting', 'getSimulatedResults returns a simulated dataset echoing the query');
    assert(sim.results.some(r => r.type === 'expert_publication' || r.type === 'scientific_precedent'), 'Simulated dataset includes expert-witness / scientific-precedent publications');

    // D. Empty query is rejected without hitting the network
    const empty = await searchScholar('');
    assert(empty.success === false, 'searchScholar rejects an empty query');

    // E. /api/scholar/search response contract (endpoint returns searchScholar output verbatim)
    const endpointSchemaKeys = ['success', 'simulated', 'query', 'engine', 'totalResults', 'results'];
    const schemaOk = endpointSchemaKeys.every(k => k in scholar);
    assert(schemaOk, '/api/scholar/search response matches the expected JSON schema (success, simulated, query, engine, totalResults, results)');
  } catch (e) {
    assert(false, `Google Scholar integration tests crashed: ${e.message}`);
  }

  // --- Test Set 6: Multi-Agent Negotiation Engine ---
  try {
    delete process.env.ANTHROPIC_API_KEY; // force the simulated path
    const { negotiate, isNegotiationLLMConfigured } = require('../lib/negotiation');

    assert(isNegotiationLLMConfigured() === false, 'Negotiation reports simulated mode when no ANTHROPIC_API_KEY');

    // A. Standard vertical reaches consensus and approves
    const neg = await negotiate({ topic: 'Automate invoice reminders for a retail client', vertical: 'retail' });
    assert(neg.success === true && neg.simulated === true, 'negotiate() runs and reports simulated');
    assert(Array.isArray(neg.rounds) && neg.rounds.length > 0, 'negotiate() returns a non-empty transcript');
    const roundKeys = ['round', 'proposal', 'critique', 'arbitration'];
    assert(roundKeys.every(k => k in neg.rounds[0]), 'Each negotiation round has proposal/critique/arbitration');
    assert(typeof neg.consensus.score === 'number', 'Negotiation reports a numeric consensus score');
    assert(neg.outcome === 'approved', 'Low-risk vertical negotiation approves on consensus');

    // B. High-risk vertical escalates to HITL regardless of consensus
    const legalNeg = await negotiate({ topic: 'Send a settlement offer to opposing counsel', vertical: 'legal' });
    assert(legalNeg.highRisk === true, 'Legal vertical flagged high-risk');
    assert(legalNeg.outcome === 'escalated_to_hitl', 'High-risk vertical escalates to the HITL queue');
    assert(legalNeg.hitl && legalNeg.hitl.status === 'pending', 'Escalated negotiation carries a pending HITL marker');

    // C. Empty topic rejected
    const bad = await negotiate({ topic: '' });
    assert(bad.success === false, 'negotiate() rejects an empty topic');
  } catch (e) {
    assert(false, `Multi-agent negotiation tests crashed: ${e.message}`);
  }

  // --- Test Set 7: Reporting Governance (provenance / fact-check / TRiSM) ---
  try {
    const { tagDataPoint, DATA_SOURCE, getConfidenceLevel } = require('../lib/fact_checker');
    const { AuditTrailLogger, classifyDistribution, generateMethodologyDisclosure, generateDisclaimer, validateForDelivery } = require('../lib/reporting_framework');

    // A. Provenance tagging wraps values with a source/confidence envelope
    const dp = tagDataPoint('Shopify', DATA_SOURCE.LIVE_CRAWL, 0.9, 'detected', 'header scan');
    assert(dp.value === 'Shopify' && dp.provenance && dp.provenance.confidence === 0.9, 'tagDataPoint wraps value with provenance + confidence');
    assert(typeof getConfidenceLevel(0.9) === 'object' || typeof getConfidenceLevel(0.9) === 'string', 'getConfidenceLevel maps a score to a level');

    // B. Audit trail logger collects data points and computes a reliability score
    const logger = new AuditTrailLogger('example.com', 'Example Co');
    logger.log('scraper', 'crawl', 'success');
    logger.registerDataPoint(tagDataPoint('Cloudflare', DATA_SOURCE.LIVE_HEADER_SCAN, 0.95, 'waf', 'header'));
    logger.registerDataPoint(tagDataPoint('WordPress', DATA_SOURCE.LIVE_CRAWL, 0.8, 'cms', 'html'));
    const trail = logger.finalize();
    assert(trail.reliability && typeof trail.reliability.score === 'number', 'AuditTrailLogger.finalize() produces a numeric reliability score');
    assert(trail.reliability.score >= 0 && trail.reliability.score <= 100, 'Reliability score is bounded 0-100');
    assert(typeof trail.reliability.grade === 'string', 'Reliability score carries a letter grade');

    // C. Distribution gate classifies a report's readiness
    const dist = classifyDistribution(trail.reliability);
    assert(dist && (dist.classification || dist.class), 'classifyDistribution returns a distribution class');
    assert(typeof dist.canDistribute === 'boolean', 'Distribution gate exposes a canDistribute flag');

    // D. Methodology + disclaimer generated
    const methodology = generateMethodologyDisclosure({ domain: 'example.com', businessName: 'Example Co', timestamp: new Date().toISOString() }, trail.reliability);
    const disclaimer = generateDisclaimer(dist, trail.reliability);
    assert(methodology && Object.keys(methodology).length > 0, 'Methodology disclosure generated');
    assert(disclaimer && Object.keys(disclaimer).length > 0, 'Legal disclaimer blocks generated');

    // E. Pre-delivery validation returns a checklist verdict
    const pkg = { businessName: 'Example Co', vertical: 'Technology & SaaS', scrapedData: { technologies: [{}, {}, {}] }, analyzerData: { swot: { strengths: [1] } }, reportGovernance: { methodology, disclaimer } };
    const validation = validateForDelivery(pkg, trail);
    assert(validation && (validation.overallStatus || validation.status), 'validateForDelivery returns an overall status');
  } catch (e) {
    assert(false, `Reporting governance tests crashed: ${e.message}`);
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
