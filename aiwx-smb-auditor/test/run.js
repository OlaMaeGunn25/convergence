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

  // --- Test Set 8: Task Model (orchestration spine) ---
  try {
    const os = require('os');
    const fsx = require('fs');
    const pth = require('path');
    const { TaskModel, canTransition } = require('../lib/task_model');
    const tmpFile = pth.join(os.tmpdir(), `aiwx_tasks_test_${Date.now()}.json`);
    const tm = new TaskModel({ file: tmpFile });

    // A. Create defaults to 'proposed'
    const t1 = await tm.create({ type: 'audit', payload: { domain: 'x.com' }, actor: 'tester' });
    assert(t1.id && t1.status === 'proposed', 'create() returns a task in the proposed state');
    assert((await tm.get(t1.id)).status === 'proposed', 'get() round-trips the created task');

    // B. Valid transitions along the happy path
    await tm.transition(t1.id, 'pending_approval', { actor: 'tester' });
    await tm.transition(t1.id, 'approved', { actor: 'approver' });
    assert((await tm.get(t1.id)).status === 'approved', 'Valid transitions proposed→pending_approval→approved apply');

    // C. Illegal transition is rejected by the state machine
    assert(canTransition('proposed', 'done') === false, 'State machine forbids proposed→done');
    let threw = false;
    try { await tm.transition(t1.id, 'done', {}); } catch (e) { threw = true; }
    assert(threw, 'transition() throws on an illegal move (approved→done)');

    // D. Dependency gating: a task blocked by an unfinished dependency is not claimed
    const dep = await tm.create({ type: 'audit', actor: 'tester' });
    const child = await tm.create({ type: 'publish', actor: 'tester', dependsOn: [dep.id] });
    await tm.transition(child.id, 'pending_approval', {});
    await tm.transition(child.id, 'approved', {});
    // dep is still 'proposed' → child must not be claimable
    let claimed = await tm.claimNext({ types: ['publish'] });
    assert(claimed === null, 'claimNext() skips a task whose dependency is not done');

    // E. Once the dependency completes, the child becomes claimable and goes executing
    await tm.transition(dep.id, 'pending_approval', {});
    await tm.transition(dep.id, 'approved', {});
    await tm.transition(dep.id, 'executing', {});
    await tm.transition(dep.id, 'done', { result: { ok: true } });
    claimed = await tm.claimNext({ types: ['publish'] });
    assert(claimed && claimed.id === child.id && claimed.status === 'executing', 'claimNext() claims a ready task and moves it to executing');

    // F. Cancel is reachable from a non-terminal state
    const t2 = await tm.create({ type: 'audit' });
    const cancelled = await tm.transition(t2.id, 'cancelled', {});
    assert(cancelled.status === 'cancelled', 'A non-terminal task can be cancelled');

    try { fsx.unlinkSync(tmpFile); } catch (e) {}
  } catch (e) {
    assert(false, `Task model tests crashed: ${e.message}`);
  }

  // --- Test Set 9: Internal Tool Registry ---
  try {
    const reg = require('../lib/tool_registry');

    // A. Discovery lists tools with governance metadata
    const tools = reg.list();
    assert(Array.isArray(tools) && tools.length >= 6, 'Registry lists the registered tools');
    const audit = tools.find(t => t.name === 'run_audit');
    assert(audit && audit.provenance && audit.provenance.returnsProvenance === true, 'run_audit declares it returns provenance-tagged data');
    const pub = tools.find(t => t.name === 'publish_post');
    assert(pub && pub.annotations.destructive === true && pub.annotations.requiresApproval === true, 'publish_post is annotated destructive + requiresApproval');

    // B. Input validation via the typed schema
    const bad = await reg.invoke('run_audit', {});
    assert(bad.ok === false && Array.isArray(bad.issues), 'invoke() rejects input that fails the schema (missing domain)');

    // C. Read tool executes (scholar simulated fallback)
    const sch = await reg.invoke('search_scholar', { q: 'lobo law precedent' });
    assert(sch.ok === true && sch.result && Array.isArray(sch.result.results), 'invoke(search_scholar) returns results');

    // D. Governance gate: destructive tool blocked without approval
    const blocked = await reg.invoke('publish_post', { platform: 'linkedin', text: 'hi' });
    assert(blocked.ok === false && blocked.status === 'requires_approval', 'Destructive tool is blocked without approval');
    const approved = await reg.invoke('publish_post', { platform: 'linkedin', text: 'hi' }, { approved: true, actor: 'operator' });
    assert(approved.ok === true && approved.result.staged === true, 'Destructive tool proceeds when approved');

    // E. Task tools flow through the registry onto the spine
    const created = await reg.invoke('create_task', { type: 'audit', payload: { domain: 'x.com' } }, { actor: 'reg-tester' });
    assert(created.ok === true && created.result.id, 'create_task via registry creates a task');
    const got = await reg.invoke('get_task', { id: created.result.id });
    assert(got.ok === true && got.result.status === 'proposed', 'get_task via registry round-trips');

    // F. Unknown tool is reported cleanly
    const unknown = await reg.invoke('does_not_exist', {});
    assert(unknown.ok === false && /Unknown tool/.test(unknown.error), 'Unknown tool returns a clean error');
  } catch (e) {
    assert(false, `Tool registry tests crashed: ${e.message}`);
  }

  // --- Test Set 10: Route-parity guard (Phase 2.5 cutover safety) ---
  // The modular routes/ tree is a mirror of the live inline server.js routes but
  // is not yet mounted. This guard asserts routes/ actually covers the critical
  // API surface, so the eventual cutover (mount routes/, delete inline) cannot
  // silently drop an endpoint. If you add an inline route, add it to routes/ too.
  try {
    const combined = require('../routes');
    // Recursively collect "METHOD /path" from an Express router stack.
    const collect = (stack, acc) => {
      for (const layer of stack || []) {
        if (layer.route && layer.route.path) {
          for (const m of Object.keys(layer.route.methods)) acc.add(`${m.toUpperCase()} ${layer.route.path}`);
        } else if (layer.handle && layer.handle.stack) {
          collect(layer.handle.stack, acc);
        }
      }
      return acc;
    };
    const paths = collect(combined.stack, new Set());
    assert(paths.size >= 25, `routes/ exposes the full API surface (found ${paths.size})`);
    const mustHave = [
      'POST /api/audit', 'GET /api/tools', 'POST /api/tools/:name', 'POST /api/negotiate',
      'GET /api/scholar/search', 'POST /api/export-crm', 'POST /api/audit-queue', 'GET /health'
    ];
    const missing = mustHave.filter(r => !paths.has(r));
    assert(missing.length === 0, `routes/ covers every critical endpoint (missing: ${missing.join(', ') || 'none'})`);
  } catch (e) {
    assert(false, `Route-parity guard crashed: ${e.message}`);
  }

  // --- Test Set 11: Orchestrator (task model + tool registry driver) ---
  try {
    const os = require('os');
    const fsx = require('fs');
    const pth = require('path');
    const { TaskModel } = require('../lib/task_model');
    const { Orchestrator } = require('../lib/orchestrator');
    const tmpFile = pth.join(os.tmpdir(), `aiwx_orch_test_${Date.now()}.json`);
    const orch = new Orchestrator({ taskModel: new TaskModel({ file: tmpFile }) });

    // A. Non-destructive work auto-approves and executes to done
    const s1 = await orch.submit({ type: 'scholar', payload: { q: 'lobo law precedent' }, actor: 'op' });
    assert(s1.status === 'approved', 'submit() auto-approves a non-destructive (scholar) task');
    const done1 = await orch.drain();
    assert(done1.length === 1 && done1[0].status === 'done', 'Orchestrator executes the ready task to done');
    assert(done1[0].result && Array.isArray(done1[0].result.results), 'Executed task carries the tool result');

    // B. Destructive work waits for human approval (HITL enforced structurally)
    const s2 = await orch.submit({ type: 'publish', payload: { platform: 'linkedin', text: 'hi' }, actor: 'op' });
    assert(s2.status === 'pending_approval', 'submit() holds a destructive (publish) task in pending_approval');
    let none = await orch.drain();
    assert(none.length === 0, 'Orchestrator will not execute an unapproved destructive task');
    await orch.taskModel.transition(s2.id, 'approved', { actor: 'human-approver' });
    const done2 = await orch.drain();
    assert(done2.length === 1 && done2[0].status === 'done' && done2[0].result.staged === true, 'After human approval the destructive task executes');

    // C. Dependencies: a child runs only after its parent is done
    const parent = await orch.submit({ type: 'scholar', payload: { q: 'parent' }, actor: 'op' });
    const child = await orch.submit({ type: 'scholar', payload: { q: 'child' }, actor: 'op', dependsOn: [parent.id] });
    const processed = await orch.drain();
    const pIdx = processed.findIndex(t => t.id === parent.id);
    const cIdx = processed.findIndex(t => t.id === child.id);
    assert(pIdx !== -1 && cIdx !== -1 && pIdx < cIdx, 'Parent task is processed before its dependent child');
    assert(processed[cIdx].status === 'done', 'Dependent child executes once its dependency is done');

    // D. Tool failure marks the task failed (audit with no Firecrawl key throws)
    delete process.env.FIRECRAWL_API_KEY;
    const s4 = await orch.submit({ type: 'audit', payload: { domain: 'x.com' }, actor: 'op' });
    const done4 = await orch.drain();
    assert(done4.length === 1 && done4[0].status === 'failed', 'A throwing tool transitions its task to failed');
    assert(done4[0].result && /Firecrawl/i.test(done4[0].result.error || ''), 'Failed task records the error');

    // E. Negotiation strategy gates approval by consensus
    const s5 = await orch.submit({ type: 'scholar', payload: { q: 'x', vertical: 'retail', topic: 'auto-approve?' }, actor: 'op', strategy: 'negotiate' });
    assert(['approved', 'pending_approval'].includes(s5.status), 'Negotiation-strategy submit resolves to approved or pending_approval');
    const s6 = await orch.submit({ type: 'scholar', payload: { q: 'x', vertical: 'legal', topic: 'send settlement?' }, actor: 'op', strategy: 'negotiate' });
    assert(s6.status === 'pending_approval', 'High-risk (legal) negotiation leaves the task pending human approval');

    try { fsx.unlinkSync(tmpFile); } catch (e) {}
  } catch (e) {
    assert(false, `Orchestrator tests crashed: ${e.message}`);
  }

  // --- Test Set 12: MCP bridge (in-process registry surface + identity) ---
  try {
    const bridge = require('../lib/mcp_bridge');
    const mcpHttp = require('../lib/mcp_http');

    // A. MCP tools are built from the ONE registry with real JSON schemas + hints
    const tools = bridge.listMcpTools();
    assert(Array.isArray(tools) && tools.length >= 6, 'MCP bridge lists tools from the registry');
    const runAudit = tools.find(t => t.name === 'run_audit');
    assert(runAudit && runAudit.inputSchema && runAudit.inputSchema.type === 'object', 'MCP tool carries a JSON Schema derived from the Zod schema');
    const pub = tools.find(t => t.name === 'publish_post');
    assert(pub && pub.annotations.destructiveHint === true, 'MCP annotations reflect the registry (publish_post destructiveHint)');

    // B. callMcpTool routes through the registry in-process and returns MCP content
    const sch = await bridge.callMcpTool('search_scholar', { q: 'lobo law' }, { actor: 'agent-1' });
    assert(sch.content && sch.content[0].type === 'text' && sch.structuredContent, 'callMcpTool returns MCP content + structuredContent');

    // C. Governance gate applies to MCP callers: destructive tool needs approval
    const blocked = await bridge.callMcpTool('publish_post', { platform: 'linkedin', text: 'hi' }, { actor: 'agent-1' });
    assert(blocked._meta && blocked._meta.requiresApproval === true, 'MCP destructive call without approval is gated (requiresApproval)');
    const ok = await bridge.callMcpTool('publish_post', { platform: 'linkedin', text: 'hi' }, { actor: 'agent-1', approved: true });
    assert(ok.structuredContent && ok.structuredContent.staged === true, 'MCP destructive call proceeds once approved (identity threaded)');

    // D. Unknown tool is a clean MCP error
    const unknown = await bridge.callMcpTool('nope', {});
    assert(unknown.isError === true, 'MCP bridge returns a clean error for an unknown tool');

    // E. HTTP transport module loads cleanly even without the SDK installed
    assert(typeof mcpHttp.createMcpHttpHandler === 'function', 'mcp_http exposes createMcpHttpHandler');
    assert(typeof mcpHttp.isMcpTransportAvailable() === 'boolean', 'mcp_http reports SDK availability without throwing at import');
  } catch (e) {
    assert(false, `MCP bridge tests crashed: ${e.message}`);
  }

  // --- Test Set 13: Governance report (unified AI TRiSM surface) ---
  try {
    const os = require('os');
    const fsx = require('fs');
    const pth = require('path');
    const { buildGovernanceReport } = require('../lib/governance_report');
    const { TaskModel } = require('../lib/task_model');
    const reg = require('../lib/tool_registry');

    // Temp audits_cache with two governance-scored packages (one healthy, one poor)
    const auditsDir = pth.join(os.tmpdir(), `aiwx_audits_${Date.now()}`);
    fsx.mkdirSync(auditsDir, { recursive: true });
    fsx.writeFileSync(pth.join(auditsDir, 'a.json'), JSON.stringify({ reportGovernance: { reliability: { score: 90, grade: 'A' }, distribution: { classification: 'Client-Ready Benchmark Report' }, validation: { overallStatus: 'PASS' } } }));
    fsx.writeFileSync(pth.join(auditsDir, 'b.json'), JSON.stringify({ reportGovernance: { reliability: { score: 40, grade: 'F' }, distribution: { classification: 'Quarantined' }, validation: { overallStatus: 'FAIL' } } }));

    // Temp task store with a pending approval and a failure
    const tmFile = pth.join(os.tmpdir(), `aiwx_gov_tasks_${Date.now()}.json`);
    const tm = new TaskModel({ file: tmFile });
    const p = await tm.create({ type: 'publish' }); await tm.transition(p.id, 'pending_approval', {});
    const f = await tm.create({ type: 'audit' }); await tm.transition(f.id, 'pending_approval', {}); await tm.transition(f.id, 'approved', {}); await tm.transition(f.id, 'executing', {}); await tm.transition(f.id, 'failed', {});

    const rep = await buildGovernanceReport({ auditsDir, taskModel: tm });
    assert(rep.data.totalAudits === 2 && rep.data.avgReliability === 65, 'Report aggregates audit reliability (avg of 90 & 40 = 65)');
    assert(rep.data.gradeBreakdown.A === 1 && rep.data.gradeBreakdown.F === 1, 'Report breaks down reliability grades');
    assert(rep.data.validationPassRate === 50, 'Report computes the validation pass rate (1 of 2)');
    assert(rep.orchestration.pendingApproval === 1 && rep.orchestration.failed === 1, 'Report counts orchestration state (pending approval + failed)');
    assert(rep.trism && rep.trism.status === 'attention', 'TRiSM headline flags attention when a task has failed');
    assert(rep.access && typeof rep.access.available === 'boolean', 'Report includes the access (WHO) dimension, degrading gracefully without Supabase');

    // Exposed as a registry tool (reachable via /api/tools and the MCP bridge)
    assert(reg.has('get_governance_report'), 'get_governance_report is registered as a tool');
    const viaTool = await reg.invoke('get_governance_report', {});
    assert(viaTool.ok === true && viaTool.result.trism, 'Governance report is invocable through the tool registry');

    try { fsx.unlinkSync(pth.join(auditsDir, 'a.json')); fsx.unlinkSync(pth.join(auditsDir, 'b.json')); fsx.rmdirSync(auditsDir); fsx.unlinkSync(tmFile); } catch (e) {}
  } catch (e) {
    assert(false, `Governance report tests crashed: ${e.message}`);
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
