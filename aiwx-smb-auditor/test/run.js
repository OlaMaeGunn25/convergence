/**
 * Automated Unit Test Suite for SMB External Audit Engine
 */
process.env.NODE_ENV = 'test';

const { cleanDomain, scrapeDomain, extractNamesFromText } = require('../lib/scraper');
const { analyzeFootprint } = require('../lib/analyzer');
const { analyzeWorkforce } = require('../lib/workforce');
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

  // --- Test Set 4: WAF / Firewall, Scraper Taxonomy & Name Extraction ---
  // NOTE: The public pre-sales scourer (public-records revenue/filings/mentions)
  // and sales-pitch generation were removed — ASES sales functions, not systems
  // evaluation. See docs/AUDITOR_REFRAME.md. The systems-inventory (scraper/WAF),
  // vertical taxonomy, and personnel cross-reference tests remain.
  try {
    // B. Validate live scraper wrapper additions (systems + WAF inventory)
    const crawled = await scrapeDomain('apex-tech.com', null);
    assert(crawled.firewallAudit !== undefined, 'Crawler return object includes firewallAudit block');
    assert(crawled.firewallAudit.wafDetected === 'AWS WAF Shield', 'Crawler correctly detects mock vertical WAF');
    assert(crawled.firewallAudit.securityHeaders.csp === true, 'Crawler detects mock vertical security headers');
    // C. Validate specialized Smart Optimal Solutions (Green Tech / Infrastructure) taxonomy
    const greentechData = await scrapeDomain('smartoptimalsolutions.com', null);
    assert(greentechData.vertical === 'Sustainable Infrastructure & Green Tech', 'Smart Optimal Solutions domain maps to Sustainable Infrastructure & Green Tech vertical');
    assert(greentechData.businessName === 'Smart Optimal Solutions', 'Business name derived as Smart Optimal Solutions');

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

  } catch (e) {
    assert(false, `Green Tech, WAF & Name cross-reference tests crashed: ${e.message}`);
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
      'GET /api/scholar/search', 'POST /api/export-crm', 'POST /api/audit-queue', 'GET /health',
      'GET /api/connectors', 'GET /api/connections', 'POST /api/connections',
      'GET /api/orchestrator/capabilities', 'GET /api/onboarding/status',
      'POST /api/install', 'GET /api/install/status',
      'GET /api/agents', 'GET /api/agents/telemetry', 'GET /api/tasks/:id/trace',
      'POST /api/tasks/:id/correct', 'POST /api/tasks/:id/cancel', 'POST /api/task-request',
      'POST /api/chat', 'POST /api/chat/confirm', 'POST /api/knowledge/ingest',
      'POST /api/clio/webhook', 'POST /api/gusto/webhook'
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

  // --- Test Set 14: Systems evaluation — connectors, matcher, connections, Clio ---
  try {
    const os = require('os');
    const fsx = require('fs');
    const pth = require('path');
    const catalog = require('../lib/connectors/catalog');
    const { matchIntegrations } = require('../lib/integration_matcher');
    const { ConnectionRegistry } = require('../lib/connection_registry');
    const clio = require('../lib/connectors/clio');
    const reg = require('../lib/tool_registry');

    // A. Catalog integrity + no-secret-leak contract
    assert(catalog.get('clio') && /Legal/.test(catalog.get('clio').category), 'Catalog contains the Clio connector');
    const pv = catalog.publicView(catalog.get('stripe'));
    assert(!('STRIPE_SECRET_KEY' in pv) && Array.isArray(pv.requiredEnvKeys) && pv.requiredEnvKeys.includes('STRIPE_SECRET_KEY'),
      'publicView never leaks secret values — only the expected env keys');
    assert(catalog.byVertical('Legal Services').some(c => c.id === 'clio'), 'byVertical surfaces Clio for Legal Services');

    // B. Matcher: detected tech => ready; vertical => likely; universal => exploratory
    const match = matchIntegrations({ technologies: [{ name: 'Shopify', category: 'E-Commerce' }, { name: 'Stripe', category: 'Payments' }], vertical: 'E-Commerce & Retail', domain: 'shop.com', businessName: 'Shop' });
    assert(match.recommendedIntegrations.find(r => r.connectorId === 'shopify')?.readiness === 'ready', 'Matcher marks a detected system (Shopify) as ready');
    assert(match.recommendedIntegrations.some(r => r.connectorId === 'stripe' && r.readiness === 'ready'), 'Matcher marks detected Stripe as ready');
    assert(match.roadmap[0].phase === 1, 'Roadmap orders ready integrations into phase 1');
    assert(match.summary.ready >= 2, 'Matcher summary counts the readiness tiers');
    const legalMatch = matchIntegrations({ technologies: [], vertical: 'Legal Services', businessName: 'Lobo Law', domain: 'lobolaw.com' });
    assert(legalMatch.recommendedIntegrations.some(r => r.connectorId === 'clio' && r.readiness === 'likely'), 'Matcher surfaces Clio as likely for a legal firm with no detected tech');
    assert(legalMatch.recommendedIntegrations.some(r => r.readiness === 'exploratory'), 'Matcher includes universal baseline (exploratory) integrations');

    // C. Connection registry (JSON fallback, temp file) — builder + status board
    const connFile = pth.join(os.tmpdir(), `aiwx_conn_${Date.now()}.json`);
    const conns = new ConnectionRegistry({ file: connFile });
    const built = await conns.build('clio', { tenantId: 't1', actor: 'op' });
    assert(built.connection.status === 'configuring' && built.connection.health === 'pending_credentials', 'Builder puts a credential-less connector into configuring/pending');
    assert(built.authAction && built.authAction.type === 'oauth2', 'Builder returns the oauth2 auth action needed');
    const board = await conns.statusBoard({ tenantId: 't1' });
    assert(board.length === catalog.list().length, 'Status board covers every catalog connector');
    assert(board.find(b => b.connectorId === 'clio').status === 'configuring', 'Status board reflects the built connection state');
    assert(board.find(b => b.connectorId === 'hubspot').status === 'not_connected', 'Unbuilt connectors report not_connected');
    assert((await conns.disconnect('clio', { tenantId: 't1' })).status === 'disconnected', 'Disconnect transitions to disconnected');
    let refused = false;
    try { await conns.build('stripe', { tenantId: 't1', config: { STRIPE_SECRET_KEY: 'sk_live_x' } }); } catch (e) { refused = /Refusing credential/.test(e.message); }
    assert(refused, 'Builder refuses secret-looking config over the API');
    try { fsx.unlinkSync(connFile); } catch (e) {}

    // D. Clio connector: graceful degradation + trust-account HITL
    const matters = await clio.listMatters({ limit: 5 });
    assert(matters.simulated === true && Array.isArray(matters.data), 'Clio listMatters degrades to a labeled simulated dataset without a token');
    const trustBlocked = await clio.recordTrustTransaction({ matterId: 101, amount: 500, kind: 'deposit', memo: 'retainer' });
    assert(trustBlocked.requiresApproval === true && trustBlocked.success === false, 'Clio trust transaction refuses without explicit approval (IOLTA)');
    assert((await clio.recordTrustTransaction({ matterId: 101, amount: 500, kind: 'deposit', memo: 'retainer', approved: true })).success === true, 'Clio trust transaction proceeds once approved');
    assert(clio.mapWebhookToTask({ event: 'trust.transaction.created', data: {} }).status === 'pending_approval', 'Clio webhook maps a trust event to a pending_approval task');
    assert(clio.mapWebhookToTask({ event: 'contact.created', data: {} }).status === 'proposed', 'Clio webhook maps a low-risk event to a proposed task');

    // E. Registry tools — discovery, gating, status
    assert(reg.has('list_connectors') && reg.has('match_integrations') && reg.has('connect_system') && reg.has('get_connection_status'), 'Integration tools are registered');
    const lc = await reg.invoke('list_connectors', { vertical: 'Legal Services' });
    assert(lc.ok === true && lc.result.connectors.some(c => c.id === 'clio'), 'list_connectors tool returns the catalog filtered by vertical');
    const gatedConnect = await reg.invoke('connect_system', { connectorId: 'clio' }, { actor: 'op' });
    assert(gatedConnect.ok === false && gatedConnect.status === 'requires_approval', 'connect_system is approval-gated by the registry');
    const approvedConnect = await reg.invoke('connect_system', { connectorId: 'clio' }, { actor: 'op', approved: true });
    assert(approvedConnect.ok === true && approvedConnect.result.connection, 'connect_system proceeds once approved');
    const trustGated = await reg.invoke('clio_record_trust_transaction', { matterId: 101, amount: 100, kind: 'deposit', memo: 'x' }, { actor: 'op' });
    assert(trustGated.ok === false && trustGated.status === 'requires_approval', 'clio_record_trust_transaction is approval-gated');
  } catch (e) {
    assert(false, `Systems-evaluation / connections tests crashed: ${e.message}`);
  }

  // --- Test Set 15: Agentic Operations Layer — roster + agent model (Phase 0) ---
  try {
    const os = require('os'); const fsx = require('fs'); const pth = require('path');
    const roster = require('../lib/agent_roster');
    const { AgentRegistry, canTransition } = require('../lib/agent_model');
    const reg = require('../lib/tool_registry');

    // A. Roster: 13 roles across the business + human-care planes
    const roles = roster.listRoles();
    assert(roles.length === 13, 'Roster defines the 13 agent roles');
    const rids = roles.map(r => r.id);
    ['orchestrator', 'configurator', 'onboarding', 'systems_configurator', 'knowledge_compilation',
      'compliance', 'operations', 'admin_support', 'delivery', 'qa', 'monitoring', 'reporting', 'human_companion']
      .forEach(r => assert(rids.includes(r), `Roster includes the ${r} role`));
    assert(roster.ROLES.human_companion.plane === 'human', 'Human Companion agent is on the human-care plane');
    assert(roster.roleAllowsTool('orchestrator', 'anything') === true, 'Orchestrator may invoke any tool (wildcard)');
    assert(roster.roleAllowsTool('operations', 'clio_list_matters') === true, 'Operations role is bound to its system tools');
    assert(roster.roleAllowsTool('operations', 'get_governance_report') === false, 'Least privilege: Operations cannot invoke an out-of-scope tool');

    // B. Agent model state machine (temp file)
    const af = pth.join(os.tmpdir(), `aiwx_agents_${Date.now()}.json`);
    const agents = new AgentRegistry({ file: af });
    const a = await agents.provision({ role: 'operations', tenantId: 't1', vertical: 'legal' });
    assert(a.status === 'provisioned' && a.plane === 'business', 'Provisioned agent starts in provisioned (business plane)');
    assert(canTransition('provisioned', 'configuring') && !canTransition('provisioned', 'active'), 'State machine blocks skipping provisioned→active');
    await agents.transition(a.id, 'configuring'); await agents.transition(a.id, 'training');
    assert((await agents.transition(a.id, 'ready')).status === 'ready', 'Agent walks provisioned→configuring→training→ready');

    // C. mayInvoke gate: live status + least privilege + kill-switch
    assert((await agents.mayInvoke(a.id, 'clio_list_matters')).ok === true, 'A live (ready) Operations agent may invoke its bound tool');
    assert((await agents.mayInvoke(a.id, 'get_governance_report')).ok === false, 'mayInvoke denies an out-of-role tool');
    await agents.transition(a.id, 'active'); await agents.transition(a.id, 'paused');
    assert((await agents.mayInvoke(a.id, 'clio_list_matters')).ok === false, 'A paused agent is refused at the gate (kill-switch)');

    // D. provisionRoster = isolated team per instance/vertical (idempotent)
    await agents.provisionRoster({ tenantId: 't2', vertical: 'medical' });
    assert((await agents.list({ tenantId: 't2' })).length === 13, 'provisionRoster creates the full 13-agent team for a tenant');
    await agents.provisionRoster({ tenantId: 't2', vertical: 'medical' });
    assert((await agents.list({ tenantId: 't2' })).length === 13, 'provisionRoster is idempotent per (tenant, role)');
    try { fsx.unlinkSync(af); } catch (e) {}

    // E. Registry tools + invoke() gate integration (module store, unique tenant)
    assert(reg.has('list_agent_roles') && reg.has('provision_roster') && reg.has('deploy_agent') && reg.has('control_agent'), 'Phase 0 agent tools are registered');
    const rolesTool = await reg.invoke('list_agent_roles', {});
    assert(rolesTool.ok && rolesTool.result.roles.length === 13, 'list_agent_roles tool returns the 13 roles');
    const deployGated = await reg.invoke('deploy_agent', { id: 'nope' }, { actor: 'op' });
    assert(deployGated.ok === false && deployGated.status === 'requires_approval', 'deploy_agent (go-live) is HITL-approval-gated');
    const tp = 'test-p0-' + Date.now();
    await reg.invoke('provision_roster', { tenantId: tp, vertical: 'legal' }, { actor: 'op' });
    const mod = new AgentRegistry(); // default config/agents.json, shared with the module registry
    const ops = (await mod.list({ tenantId: tp, role: 'operations' }))[0];
    for (const s of ['configuring', 'training', 'ready', 'active']) await mod.transition(ops.id, s);
    const forbidden = await reg.invoke('get_governance_report', {}, { agentId: ops.id });
    assert(forbidden.ok === false && forbidden.status === 'agent_forbidden', 'invoke() enforces the agent gate: an out-of-role tool is forbidden');
    const allowed = await reg.invoke('clio_list_matters', { limit: 1 }, { agentId: ops.id });
    assert(allowed.ok === true, 'invoke() allows an active agent to call its bound tool');
    await mod.transition(ops.id, 'shutdown');
  } catch (e) {
    assert(false, `Agentic operations (Phase 0) tests crashed: ${e.message}`);
  }

  // --- Test Set 16: HITL identity, lifecycle & attribution (Phase 0.5) ---
  try {
    const os = require('os'); const fsx = require('fs'); const pth = require('path');
    const { HitlRegistry, validateDomainEmail } = require('../lib/hitl_identity');
    const { AttributionLog } = require('../lib/attribution');
    const reg = require('../lib/tool_registry');

    // A. Domain-email rule (IDN-02)
    assert(validateDomainEmail('jane@acme-corp.com').ok === true, 'Corporate email is accepted as a HITL identity');
    assert(validateDomainEmail('jane@gmail.com').ok === false, 'Consumer email domain is rejected');
    assert(validateDomainEmail('jane@other.com', 'acme-corp.com').ok === false, 'Email domain must match the tenant domain when set');
    assert(validateDomainEmail('jane@acme-corp.com', 'acme-corp.com').ok === true, 'Matching tenant-domain email is accepted');

    // B. HITL lifecycle (HLC) + authorization (IDN-03)
    const hf = pth.join(os.tmpdir(), `aiwx_hitl_${Date.now()}.json`);
    const hitl = new HitlRegistry({ file: hf });
    const u = await hitl.onboard({ email: 'lead@acme-corp.com', tenantId: 't1', authorityLevel: 'lead' });
    assert(u.status === 'onboarding' && u.domain === 'acme-corp.com', 'Onboarded HITL starts in onboarding with a resolved domain');
    let rejected = false; try { await hitl.onboard({ email: 'x@gmail.com' }); } catch (e) { rejected = /Consumer/.test(e.message); }
    assert(rejected, 'onboard rejects a consumer email');
    assert((await hitl.isAuthorized(u.id)).ok === false, 'A HITL in onboarding is not yet authorized');
    await hitl.setStatus(u.id, 'trained'); await hitl.setStatus(u.id, 'active');
    assert((await hitl.isAuthorized(u.id)).ok === true, 'An active HITL is authorized');
    await hitl.setStatus(u.id, 'suspended');
    assert((await hitl.isAuthorized(u.id)).ok === false, 'A suspended HITL is not authorized');
    await hitl.offboard(u.id);
    let illegal = false; try { await hitl.setStatus(u.id, 'active'); } catch (e) { illegal = /Illegal/.test(e.message); }
    assert(illegal, 'Offboarding is terminal (cannot reactivate)');
    try { fsx.unlinkSync(hf); } catch (e) {}

    // C. Attribution log (ATR) — append-only, attribution required
    const attrF = pth.join(os.tmpdir(), `aiwx_attr_${Date.now()}.json`);
    const attr = new AttributionLog({ file: attrF });
    let noAttr = false; try { await attr.record({ type: 'prompt', content: 'x' }); } catch (e) { noAttr = /attributable HITL/.test(e.message); }
    assert(noAttr, 'Attribution rejects an unattributable record (no hitlId)');
    await attr.recordPrompt({ hitlId: 'h1', taskId: 'tk1', content: 'reengineered ToT prompt' });
    await attr.recordOutput({ hitlId: 'h1', agentId: 'a1', taskId: 'tk1', content: { result: 'done' } });
    const tr = await attr.trace('tk1');
    assert(tr.count === 2 && tr.records[0].type === 'prompt' && tr.records[1].type === 'output', 'Attribution trace returns the ordered prompt+output chain for a task');
    assert(typeof tr.records[0].digest === 'string' && tr.records[0].digest.length === 64, 'Attribution records a sha256 content digest');
    try { fsx.unlinkSync(attrF); } catch (e) {}

    // D. Registry tools + invoke() HITL gate
    assert(reg.has('onboard_hitl') && reg.has('set_hitl_status') && reg.has('authorize_hitl') && reg.has('record_attribution') && reg.has('get_attribution_trace'), 'Phase 0.5 identity/attribution tools are registered');
    const email = `hitl-${Date.now()}@acme-corp.com`;
    const onb = await reg.invoke('onboard_hitl', { email, tenantId: 'p05' }, { actor: 'op' });
    assert(onb.ok && onb.result.hitl.status === 'onboarding', 'onboard_hitl tool onboards a corporate HITL');
    const hid = onb.result.hitl.id;
    await reg.invoke('set_hitl_status', { id: hid, status: 'trained' });
    await reg.invoke('set_hitl_status', { id: hid, status: 'active' });
    assert((await reg.invoke('list_agent_roles', {}, { hitlId: hid })).ok === true, 'invoke() allows an authorized (active) HITL identity');
    await reg.invoke('set_hitl_status', { id: hid, status: 'suspended' });
    const blocked = await reg.invoke('list_agent_roles', {}, { hitlId: hid });
    assert(blocked.ok === false && blocked.status === 'hitl_unauthorized', 'invoke() refuses a non-authorized HITL identity');
    await reg.invoke('set_hitl_status', { id: hid, status: 'offboarded' });
  } catch (e) {
    assert(false, `HITL identity/attribution (Phase 0.5) tests crashed: ${e.message}`);
  }

  // --- Test Set 17: System comprehension — capabilities + processes (Phase 1) ---
  try {
    const os = require('os'); const fsx = require('fs'); const pth = require('path');
    const evalr = require('../lib/system_evaluator');
    const { ConnectionRegistry } = require('../lib/connection_registry');
    const reg = require('../lib/tool_registry');

    // A. Manifest: capabilities (read/write) + operational processes
    const m = evalr.buildManifest('clio');
    assert(m && m.capabilities.length > 0, 'buildManifest returns a capability manifest for a connector');
    assert(m.capabilities.some(c => c.type === 'read') && m.capabilities.some(c => c.type === 'write'), 'Manifest classifies actions as read vs write');
    assert(m.processes.length >= 1 && m.processes.some(p => p.destructive === true), 'Manifest includes operational processes with destructive-step detection');
    const ev = evalr.evaluateSystem('clio');
    assert(ev.reads > 0 && ev.writes > 0 && ev.processes > 0, 'evaluateSystem reports read/write/process counts');

    // B. Unified capability model + canDo (temp connection registry, creds set)
    const cf = pth.join(os.tmpdir(), `aiwx_conn_e_${Date.now()}.json`);
    const conns = new ConnectionRegistry({ file: cf });
    process.env.CLIO_CLIENT_ID = 'x'; process.env.CLIO_CLIENT_SECRET = 'y'; process.env.CLIO_ACCESS_TOKEN = 'z';
    await conns.build('clio', { tenantId: 'tc' });
    const model = await evalr.buildTenantCapabilityModel({ tenantId: 'tc', connectionRegistry: conns });
    assert(model.systems.some(s => s.connectorId === 'clio'), 'Unified capability model includes the connected system');
    assert(evalr.canDo(model, 'clio', 'list_matters').ok === true, 'canDo confirms a connected system exposes a capability');
    assert(evalr.canDo(model, 'clio', 'nope').ok === false, 'canDo denies an unsupported capability');
    assert(evalr.canDo(model, 'hubspot', 'x').ok === false, 'canDo denies an unconnected system');

    // C. Onboarding readiness
    const status = await evalr.onboardingStatus({ tenantId: 'tc', connectionRegistry: conns });
    assert(status.systems.find(s => s.connectorId === 'clio').readiness === 'ready', 'A connected + credentialed system is ready');
    assert(status.overall.agentReady === true, 'agentReady is true when every attempted system is ready');
    delete process.env.CLIO_CLIENT_ID; delete process.env.CLIO_CLIENT_SECRET; delete process.env.CLIO_ACCESS_TOKEN;
    try { fsx.unlinkSync(cf); } catch (e) {}

    // D. Registry tools
    assert(reg.has('evaluate_system') && reg.has('get_orchestrator_capabilities') && reg.has('get_onboarding_status'), 'Phase 1 comprehension tools are registered');
    const evTool = await reg.invoke('evaluate_system', { connectorId: 'clio' });
    assert(evTool.ok && evTool.result.manifest.processes.length >= 1, 'evaluate_system tool returns a manifest with processes');
    const capTool = await reg.invoke('get_orchestrator_capabilities', { tenantId: 'none' });
    assert(capTool.ok && Array.isArray(capTool.result.systems), 'get_orchestrator_capabilities tool returns the unified model');
    const onbTool = await reg.invoke('get_onboarding_status', { tenantId: 'none' });
    assert(onbTool.ok && onbTool.result.overall, 'get_onboarding_status tool returns the readiness board');
  } catch (e) {
    assert(false, `System comprehension (Phase 1) tests crashed: ${e.message}`);
  }

  // --- Test Set 18: Knowledge ingestion + industry-practice correlation (Phase 2) ---
  try {
    const os = require('os'); const fsx = require('fs'); const pth = require('path');
    const { KnowledgeBase } = require('../lib/knowledge_ingest');
    const industry = require('../lib/industry_practices');
    const roster = require('../lib/agent_roster');
    const reg = require('../lib/tool_registry');

    // A. Ingestion contract (ING-04): scope-approved, read-only, on-prem roadmap
    const kf = pth.join(os.tmpdir(), `aiwx_kb_${Date.now()}.json`);
    const kb = new KnowledgeBase({ file: kf });
    let scopeReq = false; try { await kb.ingest({ source: 'upload', docs: [{ text: 'x' }] }); } catch (e) { scopeReq = /HITL-approved/.test(e.message); }
    assert(scopeReq, 'Ingestion refuses to run without HITL scope approval (ING-04)');
    let roadmap = false; try { await kb.ingest({ source: 'on_prem_crawl', docs: [{ text: 'x' }], approvedScope: true }); } catch (e) { roadmap = /roadmap/.test(e.message); }
    assert(roadmap, 'on_prem_crawl adapter is refused (roadmap)');
    const ing = await kb.ingest({ tenantId: 'kbt', source: 'upload', approvedScope: true, docs: [
      { ref: 'sop-intake.pdf', text: 'Standard operating procedure: Before opening a new client matter, always run a conflict of interest check against existing parties. Record an engagement letter.' },
      { ref: 'sop-trust.pdf', text: 'Client trust funds must be held in a segregated IOLTA account and never commingled with operating funds.' }
    ] });
    assert(ing.ingested >= 2, 'Ingestion chunks and stores documents with provenance');

    // B. Hybrid search + compile
    const found = await kb.search({ tenantId: 'kbt', query: 'conflict of interest check before matter', k: 3 });
    assert(found.results.length > 0 && found.results[0].provenance && found.results[0].provenance.ref, 'Hybrid search returns provenance-tagged hits');
    const comp = await kb.compile({ tenantId: 'kbt' });
    assert(comp.ready === true && comp.documents >= 2, 'compile summarizes the company KB (ready)');
    try { fsx.unlinkSync(kf); } catch (e) {}

    // C. Industry practices + correlation (KNW-01/02/03)
    assert(industry.getPractices('legal').some(p => p.id === 'legal-trust-segregation'), 'Legal vertical carries industry-standard practices');
    const corr = await industry.correlate({ vertical: 'legal', capability: 'record_trust_transaction' });
    assert(corr.industryPractices.some(p => p.id === 'legal-trust-segregation') && corr.sopGoverns === true, 'correlate maps a capability to its industry practice; company SOP governs');
    assert(typeof corr.plan === 'string' && corr.plan.includes('record_trust_transaction'), 'correlate produces a grounded plan');

    // D. Roster binding + registry tools
    assert(roster.roleAllowsTool('knowledge_compilation', 'ingest_source') === true, 'Knowledge Compilation agent is now bound to ingest_source');
    assert(reg.has('ingest_source') && reg.has('search_knowledge_base') && reg.has('compile_knowledge_base') && reg.has('get_industry_practices') && reg.has('correlate_task'), 'Phase 2 knowledge tools are registered');
    const t = 'kbtool-' + Date.now();
    const ingTool = await reg.invoke('ingest_source', { tenantId: t, source: 'upload', approvedScope: true, docs: [{ ref: 'p.pdf', text: 'Refund policy: never store raw card numbers; use the tokenized processor.' }] }, { actor: 'op' });
    assert(ingTool.ok && ingTool.result.ingested >= 1, 'ingest_source tool ingests with scope approval');
    const searchTool = await reg.invoke('search_knowledge_base', { tenantId: t, query: 'refund card processor' });
    assert(searchTool.ok && searchTool.result.results.length > 0, 'search_knowledge_base tool returns hits');
    const practicesTool = await reg.invoke('get_industry_practices', { vertical: 'finance' });
    assert(practicesTool.ok && practicesTool.result.practices.length > 0, 'get_industry_practices tool returns a vertical corpus');
    const corrTool = await reg.invoke('correlate_task', { vertical: 'finance', capability: 'record_payment', tenantId: t });
    assert(corrTool.ok && corrTool.result.plan, 'correlate_task tool returns a grounded plan');
  } catch (e) {
    assert(false, `Knowledge ingestion (Phase 2) tests crashed: ${e.message}`);
  }

  // --- Test Set 19: Installation orchestration + Delivery/Q-A gate (Phase 3) ---
  try {
    const os = require('os'); const fsx = require('fs'); const pth = require('path');
    const { Installation } = require('../lib/installation');
    const { AttestationLog } = require('../lib/attestation');
    const { AgentRegistry } = require('../lib/agent_model');
    const { ConnectionRegistry } = require('../lib/connection_registry');
    const reg = require('../lib/tool_registry');

    // A. Install provisions the roster + records selection; INS-03 gate
    const inf = pth.join(os.tmpdir(), `aiwx_inst_${Date.now()}.json`);
    const agf = pth.join(os.tmpdir(), `aiwx_iagents_${Date.now()}.json`);
    const cnf = pth.join(os.tmpdir(), `aiwx_iconn_${Date.now()}.json`);
    const conns = new ConnectionRegistry({ file: cnf });
    const { KnowledgeBase: KB3 } = require('../lib/knowledge_ingest');
    const kbf3 = pth.join(os.tmpdir(), `aiwx_ikb_${Date.now()}.json`);
    const inst = new Installation({ file: inf, agentRegistry: new AgentRegistry({ file: agf }), connectionRegistry: conns, knowledgeBase: new KB3({ file: kbf3 }) });
    const res = await inst.install({ tenantId: 'i1', vertical: 'legal', selectedConnectors: ['clio'], businessName: 'Lobo Law', businessProfile: { purpose: 'trial defense' } });
    assert(res.roster === 13, 'Install provisions the full 13-agent roster');
    assert(res.knowledge && res.knowledge.ingested >= 1, 'Install AUTO-CREATES the company knowledge base on onboarding (ONB-KB-01)');
    let st = await inst.status({ tenantId: 'i1' });
    assert(st.installed === true && st.complete === false, 'Install is not complete while a selected system is not agent_ready');
    process.env.CLIO_CLIENT_ID = 'x'; process.env.CLIO_CLIENT_SECRET = 'y'; process.env.CLIO_ACCESS_TOKEN = 'z';
    await conns.build('clio', { tenantId: 'i1' });
    st = await inst.status({ tenantId: 'i1' });
    assert(st.systemsReady === true && st.complete === true, 'Install completes when every selected system is agent_ready + roster deployed');
    delete process.env.CLIO_CLIENT_ID; delete process.env.CLIO_CLIENT_SECRET; delete process.env.CLIO_ACCESS_TOKEN;
    try { fsx.unlinkSync(inf); fsx.unlinkSync(agf); fsx.unlinkSync(cnf); fsx.unlinkSync(kbf3); } catch (e) {}

    // B. Delivery + Q/A completion gate (AGT-05/06)
    const atf = pth.join(os.tmpdir(), `aiwx_att_${Date.now()}.json`);
    const att = new AttestationLog({ file: atf });
    assert((await att.canComplete('tk')).ok === false, 'A task cannot complete without a Delivery attestation');
    await att.attestDelivery({ taskId: 'tk', actor: 'delivery-agent' });
    assert((await att.canComplete('tk')).ok === true, 'A Delivery attestation permits completion');
    await att.recordQa({ taskId: 'tk', verdict: 'flag', actor: 'qa-agent' });
    assert((await att.canComplete('tk')).ok === false, 'A Q/A flag blocks completion (routes to HITL)');
    let qaBad = false; try { await att.recordQa({ taskId: 'tk2', verdict: 'nope' }); } catch (e) { qaBad = /verdict/.test(e.message); }
    assert(qaBad, 'Q/A attestation requires a pass|flag verdict');
    try { fsx.unlinkSync(atf); } catch (e) {}

    // C. Registry tools + end-to-end completion gate via the task model
    assert(reg.has('install_convergence') && reg.has('get_install_status') && reg.has('attest_delivery') && reg.has('record_qa_verdict') && reg.has('complete_task'), 'Phase 3 tools are registered');
    const created = await reg.invoke('create_task', { type: 'ops.demo', payload: {} }, { actor: 'op' });
    const tid = created.result.id;
    await reg.invoke('transition_task', { id: tid, toStatus: 'pending_approval' }, { actor: 'op' });
    await reg.invoke('transition_task', { id: tid, toStatus: 'approved' }, { actor: 'op' });
    await reg.invoke('transition_task', { id: tid, toStatus: 'executing' }, { actor: 'op' });
    const blocked = await reg.invoke('complete_task', { taskId: tid }, { actor: 'op' });
    assert(blocked.result.ok === false && blocked.result.status === 'completion_blocked', 'complete_task is blocked without a Delivery attestation');
    await reg.invoke('attest_delivery', { taskId: tid, note: 'delivered' }, { actor: 'op' });
    const done = await reg.invoke('complete_task', { taskId: tid }, { actor: 'op' });
    assert(done.result.ok === true && done.result.task.status === 'done', 'complete_task transitions the task to done once attested');
  } catch (e) {
    assert(false, `Installation / attestation (Phase 3) tests crashed: ${e.message}`);
  }

  // --- Test Set 20: Telemetry + floating monitor + task trace (Phase 4) ---
  try {
    const os = require('os'); const fsx = require('fs'); const pth = require('path');
    const { TelemetryStream } = require('../lib/agent_telemetry');
    const roster = require('../lib/agent_roster');
    const reg = require('../lib/tool_registry');

    // A. Telemetry stream: emit, list newest-first, ring-buffer cap
    const tf = pth.join(os.tmpdir(), `aiwx_tel_${Date.now()}.json`);
    const tel = new TelemetryStream({ file: tf, max: 5 });
    await tel.emit({ tenantId: 'tt', taskId: 'k1', event: 'task.started', status: 'info' });
    await tel.emit({ tenantId: 'tt', taskId: 'k1', event: 'task.completed', status: 'completed' });
    const evs = await tel.list({ tenantId: 'tt' });
    assert(evs.length === 2 && evs[0].event === 'task.completed', 'Telemetry lists events newest-first');
    for (let i = 0; i < 10; i++) await tel.emit({ tenantId: 'tt', event: 'info' });
    assert((await tel.list({ tenantId: 'tt', limit: 100 })).length <= 5, 'Telemetry ring-buffer caps stored events');
    let evReq = false; try { await tel.emit({ tenantId: 'tt' }); } catch (e) { evReq = /event/.test(e.message); }
    assert(evReq, 'Telemetry requires an event name');
    try { fsx.unlinkSync(tf); } catch (e) {}

    // B. Monitoring role bound to telemetry tools
    assert(roster.roleAllowsTool('monitoring', 'emit_telemetry') && roster.roleAllowsTool('monitoring', 'get_agent_telemetry'), 'Monitoring agent is bound to the telemetry tools');

    // C. Registry tools + task trace (attribution + telemetry)
    assert(reg.has('emit_telemetry') && reg.has('get_agent_telemetry') && reg.has('get_task_trace'), 'Phase 4 telemetry/trace tools are registered');
    const t = 'trace-' + Date.now();
    await reg.invoke('emit_telemetry', { tenantId: t, taskId: 'kt', event: 'task.started' }, { actor: 'op' });
    const emitted = await reg.invoke('get_agent_telemetry', { tenantId: t });
    assert(emitted.ok && emitted.result.events.length >= 1, 'get_agent_telemetry returns emitted events');
    // Attribution + telemetry both surface in the task trace
    const email = `mon-${Date.now()}@acme-corp.com`;
    const onb = await reg.invoke('onboard_hitl', { email, tenantId: t }, { actor: 'op' });
    await reg.invoke('record_attribution', { type: 'prompt', hitlId: onb.result.hitl.id, taskId: 'kt', content: 'do the thing' }, { actor: 'op' });
    const trace = await reg.invoke('get_task_trace', { taskId: 'kt' });
    assert(trace.ok && trace.result.telemetry.length >= 1 && trace.result.attribution.length >= 1, 'get_task_trace reconstructs the chain-of-custody (attribution + telemetry)');
  } catch (e) {
    assert(false, `Telemetry / trace (Phase 4) tests crashed: ${e.message}`);
  }

  // --- Test Set 21: HITL control + autonomy grants (Phase 5/5b) ---
  try {
    const os = require('os'); const fsx = require('fs'); const pth = require('path');
    const { AutonomyGrants, isComplianceFloor } = require('../lib/autonomy');
    const { TaskModel } = require('../lib/task_model');
    const reg = require('../lib/tool_registry');

    // A. Course-correct + cancel on the task model
    const tmf = pth.join(os.tmpdir(), `aiwx_ctl_${Date.now()}.json`);
    const tm = new TaskModel({ file: tmf });
    const tk = await tm.create({ type: 'ops.demo', payload: { a: 1 } });
    const revised = await tm.revise(tk.id, { instructions: 'tighten scope', payload: { b: 2 } });
    assert(revised.payload.a === 1 && revised.payload.b === 2 && revised.revisions.length === 1, 'Course-correct merges payload and records the revision');
    const cancelled = await tm.transition(tk.id, 'cancelled');
    assert(cancelled.status === 'cancelled', 'A task can be cancelled (kill-switch)');
    let noRevise = false; try { await tm.revise(tk.id, { payload: { c: 3 } }); } catch (e) { noRevise = /Cannot course-correct/.test(e.message); }
    assert(noRevise, 'Course-correct is refused on a terminal (cancelled) task');
    try { fsx.unlinkSync(tmf); } catch (e) {}

    // B. Autonomy grants + compliance floor
    assert(isComplianceFloor('clio_record_trust_transaction') === true && isComplianceFloor('list_agent_roles') === false, 'Compliance floor flags trust/financial actions');
    const gf = pth.join(os.tmpdir(), `aiwx_grant_${Date.now()}.json`);
    const grants = new AutonomyGrants({ file: gf });
    let needsHitl = false; try { await grants.grant({ scope: {} }); } catch (e) { needsHitl = /HITL/.test(e.message); }
    assert(needsHitl, 'An autonomy grant must be authorized by a HITL');
    const g = await grants.grant({ tenantId: 'ga', hitlId: 'h1', scope: { toolName: 'publish_post' } });
    assert((await grants.covers({ tenantId: 'ga', toolName: 'publish_post' })).ok === true, 'A standard grant delegates approval for its scoped tool');
    assert((await grants.covers({ tenantId: 'ga', toolName: 'clio_record_trust_transaction' })).floor === true, 'Compliance-floor action is NOT delegated by a standard grant (AUT-04)');
    await grants.revoke(g.id);
    assert((await grants.covers({ tenantId: 'ga', toolName: 'publish_post' })).ok === false, 'Revoking a grant immediately reinstates per-action approval');
    try { fsx.unlinkSync(gf); } catch (e) {}

    // C. Registry: CTL-01 self-approval guard + autonomy delegation in invoke()
    assert(reg.has('course_correct_task') && reg.has('cancel_task') && reg.has('grant_autonomy') && reg.has('revoke_autonomy') && reg.has('list_autonomy_grants'), 'Phase 5/5b tools are registered');
    const selfApprove = await reg.invoke('publish_post', { platform: 'linkedin', text: 'hi' }, { agentId: 'agent_x', approved: true });
    assert(selfApprove.ok === false && selfApprove.status === 'self_approval_forbidden', 'CTL-01: an agent cannot self-approve a destructive tool');
    // Onboard+activate a HITL, grant scoped autonomy, then the destructive tool proceeds unattended
    const email = `ctl-${Date.now()}@acme-corp.com`;
    const tnt = 'ctl-' + Date.now();
    const onb = await reg.invoke('onboard_hitl', { email, tenantId: tnt }, { actor: 'op' });
    await reg.invoke('set_hitl_status', { id: onb.result.hitl.id, status: 'trained' });
    await reg.invoke('set_hitl_status', { id: onb.result.hitl.id, status: 'active' });
    const gated = await reg.invoke('publish_post', { platform: 'linkedin', text: 'hi' }, { tenantId: tnt });
    assert(gated.status === 'requires_approval', 'Without a grant, a destructive tool requires approval');
    await reg.invoke('grant_autonomy', { hitlId: onb.result.hitl.id, tenantId: tnt, scope: { toolName: 'publish_post' } }, { actor: 'op' });
    const auto = await reg.invoke('publish_post', { platform: 'linkedin', text: 'hi' }, { tenantId: tnt });
    assert(auto.ok === true, 'An autonomy grant delegates approval so the tool proceeds unattended (AUT-01)');
    const floorGrant = await reg.invoke('publish_post', { platform: 'linkedin', text: 'hi' }, { tenantId: tnt, approved: false });
    assert(floorGrant.ok === true, 'The autonomy grant remains in effect for its scope');
  } catch (e) {
    assert(false, `HITL control / autonomy (Phase 5/5b) tests crashed: ${e.message}`);
  }

  // --- Test Set 22: Task request interface — capability-populated + intent (Phase 7) ---
  try {
    const os = require('os'); const fsx = require('fs'); const pth = require('path');
    const taskReq = require('../lib/task_request');
    const { ConnectionRegistry } = require('../lib/connection_registry');
    const reg = require('../lib/tool_registry');

    // Connect Clio (creds set) so its capabilities populate the catalog
    const cf = pth.join(os.tmpdir(), `aiwx_trq_${Date.now()}.json`);
    const conns = new ConnectionRegistry({ file: cf });
    process.env.CLIO_CLIENT_ID = 'x'; process.env.CLIO_CLIENT_SECRET = 'y'; process.env.CLIO_ACCESS_TOKEN = 'z';
    await conns.build('clio', { tenantId: 'trq' });

    // A. Capability-populated catalog (TRQ-02: only connected systems)
    const sug = await taskReq.suggestTasks({ tenantId: 'trq', connectionRegistry: conns });
    assert(sug.count > 0 && sug.tasks.every(t => t.connectorId === 'clio'), 'Task catalog is populated only from connected systems');
    assert(sug.tasks.some(t => t.capability === 'record_trust_transaction'), 'Catalog offers a connected capability');

    // B. Intent → capability match with confidence (TRQ-03)
    const trust = await taskReq.interpretRequest({ query: 'record a client trust deposit', tenantId: 'trq', connectionRegistry: conns });
    assert(trust.candidates.length > 0 && trust.top.connectorId === 'clio', 'A request maps to a connected-system candidate');
    assert(trust.candidates.some(c => c.capability === 'record_trust_transaction'), 'The trust request surfaces the trust capability');

    // C. Low-confidence request is flagged for disambiguation, not guessed (TRQ-04)
    const vague = await taskReq.interpretRequest({ query: 'zxqwv flibbertigibbet', tenantId: 'trq', connectionRegistry: conns });
    assert(vague.needsDisambiguation === true, 'An unmatched request is flagged for human disambiguation, not guessed');

    delete process.env.CLIO_CLIENT_ID; delete process.env.CLIO_CLIENT_SECRET; delete process.env.CLIO_ACCESS_TOKEN;
    try { fsx.unlinkSync(cf); } catch (e) {}

    // D. Registry tools
    assert(reg.has('suggest_tasks') && reg.has('interpret_task_request'), 'Phase 7 task-request tools are registered');
    const it = await reg.invoke('interpret_task_request', { query: 'anything', tenantId: 'none' });
    assert(it.ok && typeof it.result.needsDisambiguation === 'boolean', 'interpret_task_request tool returns an interpretation');
  } catch (e) {
    assert(false, `Task request interface (Phase 7) tests crashed: ${e.message}`);
  }

  // --- Test Set 23: HITL primary chat — ToT + preview + confirm (Phase 8) ---
  try {
    const os = require('os'); const fsx = require('fs'); const pth = require('path');
    const { ChatSession } = require('../lib/hitl_chat');
    const { ConnectionRegistry } = require('../lib/connection_registry');
    const { TaskModel } = require('../lib/task_model');
    const { AttributionLog } = require('../lib/attribution');
    const reg = require('../lib/tool_registry');

    const cf = pth.join(os.tmpdir(), `aiwx_chatconn_${Date.now()}.json`);
    const pf = pth.join(os.tmpdir(), `aiwx_chatplan_${Date.now()}.json`);
    const tmf = pth.join(os.tmpdir(), `aiwx_chattask_${Date.now()}.json`);
    const af = pth.join(os.tmpdir(), `aiwx_chatattr_${Date.now()}.json`);
    const conns = new ConnectionRegistry({ file: cf });
    process.env.CLIO_CLIENT_ID = 'x'; process.env.CLIO_CLIENT_SECRET = 'y'; process.env.CLIO_ACCESS_TOKEN = 'z';
    await conns.build('clio', { tenantId: 'ch' });
    const chat = new ChatSession({ file: pf, connectionRegistry: conns, taskModel: new TaskModel({ file: tmf }), attributionLog: new AttributionLog({ file: af }) });

    // A. Interpret: ToT + understanding + projected outcomes, awaiting confirmation
    const plan = await chat.interpret({ query: 'create a time activity on the matter', tenantId: 'ch', hitlId: 'h1', vertical: 'legal' });
    assert(plan.plan.treeOfThought.branches.length === 6 && plan.plan.treeOfThought.branches.some(b => /knowledge base/i.test(b.thought)), 'Every prompt is re-engineered into a tree-of-thought incl. a company-KB cross-reference branch (CHT-02/XREF-02)');
    assert(plan.plan.understanding.interpretedIntent && plan.plan.understanding.capability.connectorId === 'clio', 'The system echoes what it understood — the interpreted action (CHT-03)');
    assert(plan.plan.projectedOutcomes.length === 1 && plan.status === 'awaiting_confirmation', 'Projected outcomes are shown and the plan awaits confirmation (CHT-04)');

    // B. Confirm-before-act: nothing runs until confirm; confirm creates a task + attribution
    const before = await chat.getPlan(plan.planId);
    assert(before.status === 'awaiting_confirmation', 'Before confirmation the plan has not executed');
    const confirmed = await chat.confirm({ planId: plan.planId, hitlId: 'h1' });
    assert(confirmed.confirmed === true && confirmed.task && confirmed.task.status === 'proposed', 'Confirm creates a governed task (proposed) — confirm-before-act (CHT-05)');
    let already = false; try { await chat.confirm({ planId: plan.planId, hitlId: 'h1' }); } catch (e) { already = /already confirmed/.test(e.message); }
    assert(already, 'A plan cannot be confirmed twice');

    // C. A disambiguation-needed request cannot be confirmed
    const vague = await chat.interpret({ query: 'zxqv flibbertigibbet', tenantId: 'ch', hitlId: 'h1' });
    assert(vague.status === 'needs_disambiguation', 'An unclear prompt is held for disambiguation');
    let noConfirm = false; try { await chat.confirm({ planId: vague.planId }); } catch (e) { noConfirm = /disambiguation/.test(e.message); }
    assert(noConfirm, 'A disambiguation-needed plan cannot be confirmed');

    delete process.env.CLIO_CLIENT_ID; delete process.env.CLIO_CLIENT_SECRET; delete process.env.CLIO_ACCESS_TOKEN;
    try { [cf, pf, tmf, af].forEach(f => fsx.unlinkSync(f)); } catch (e) {}

    // D. Registry tools
    assert(reg.has('chat_interpret') && reg.has('chat_confirm') && reg.has('get_chat_plan'), 'Phase 8 chat tools are registered');
    const ci = await reg.invoke('chat_interpret', { query: 'hello', tenantId: 'none' });
    assert(ci.ok && ci.result.plan.treeOfThought, 'chat_interpret tool returns a tree-of-thought plan');
  } catch (e) {
    assert(false, `HITL chat (Phase 8) tests crashed: ${e.message}`);
  }

  // --- Test Set 24: Pre-commit checks-and-balances (NEG-02/03) ---
  try {
    const os = require('os'); const fsx = require('fs'); const pth = require('path');
    const precommit = require('../lib/precommit');
    const { ConnectionRegistry } = require('../lib/connection_registry');
    const { KnowledgeBase } = require('../lib/knowledge_ingest');
    const { ChatSession } = require('../lib/hitl_chat');
    const { TaskModel } = require('../lib/task_model');
    const reg = require('../lib/tool_registry');

    const cf = pth.join(os.tmpdir(), `aiwx_pc_conn_${Date.now()}.json`);
    const conns = new ConnectionRegistry({ file: cf });
    process.env.CLIO_CLIENT_ID = 'x'; process.env.CLIO_CLIENT_SECRET = 'y'; process.env.CLIO_ACCESS_TOKEN = 'z';
    await conns.build('clio', { tenantId: 'pc' });

    // A. A valid, connected, non-floor action passes
    const okReview = await precommit.review({ tenantId: 'pc', vertical: 'legal', connectorId: 'clio', capability: 'create_activity', connectionRegistry: conns });
    assert(okReview.ok === true && okReview.checks.some(c => c.name === 'capability' && c.pass), 'Pre-commit passes a valid, connected, non-floor action');

    // B. A compliance-floor action without approval is blocked -> HITL
    const floorReview = await precommit.review({ tenantId: 'pc', vertical: 'legal', connectorId: 'clio', capability: 'record_trust_transaction', connectionRegistry: conns });
    assert(floorReview.ok === false && floorReview.blockers.includes('compliance_floor') && floorReview.routeToHitl === true, 'Pre-commit blocks a compliance-floor action and routes to HITL (NEG-03/AUT-04)');
    const floorApproved = await precommit.review({ tenantId: 'pc', vertical: 'legal', connectorId: 'clio', capability: 'record_trust_transaction', connectionRegistry: conns, approved: true });
    assert(floorApproved.ok === true, 'An explicitly approved compliance-floor action passes');

    // C. An unconnected capability is blocked
    const unconn = await precommit.review({ tenantId: 'pc', connectorId: 'hubspot', capability: 'list_deals', connectionRegistry: conns });
    assert(unconn.ok === false && unconn.blockers.includes('capability'), 'Pre-commit blocks an action on an unconnected system');

    // D. A company SOP that forbids the action wins (SOP governs -> HITL)
    const kbf = pth.join(os.tmpdir(), `aiwx_pc_kb_${Date.now()}.json`);
    const kb = new KnowledgeBase({ file: kbf });
    await kb.ingest({ tenantId: 'pc', source: 'upload', approvedScope: true, docs: [{ ref: 'sop.pdf', text: 'Never create_activity on a closed matter without partner approval.' }] });
    const sopReview = await precommit.review({ tenantId: 'pc', vertical: 'legal', connectorId: 'clio', capability: 'create_activity', connectionRegistry: conns, knowledgeBase: kb });
    assert(sopReview.blockers.includes('sop_conflict'), 'A company SOP forbidding the action blocks the commit (SOP governs, KNW-03)');
    try { fsx.unlinkSync(kbf); } catch (e) {}

    // E. The chat commit boundary is gated by pre-commit (floor -> routeToHitl, no task)
    const pf = pth.join(os.tmpdir(), `aiwx_pc_plan_${Date.now()}.json`);
    const chat = new ChatSession({ file: pf, connectionRegistry: conns, taskModel: new TaskModel({ file: pth.join(os.tmpdir(), `aiwx_pc_tm_${Date.now()}.json`) }) });
    const plan = await chat.interpret({ query: 'record a client trust deposit', tenantId: 'pc', hitlId: 'h1', vertical: 'legal' });
    const confirm = await chat.confirm({ planId: plan.planId, hitlId: 'h1' });
    assert(confirm.confirmed === false && confirm.routeToHitl === true && !confirm.task, 'chat confirm is blocked at the commit boundary for a compliance-floor action (NEG-02)');
    try { fsx.unlinkSync(pf); fsx.unlinkSync(cf); } catch (e) {}
    delete process.env.CLIO_CLIENT_ID; delete process.env.CLIO_CLIENT_SECRET; delete process.env.CLIO_ACCESS_TOKEN;

    // F. Registry tool
    assert(reg.has('precommit_review'), 'precommit_review tool is registered');
    const pr = await reg.invoke('precommit_review', { capability: 'wire_transfer', toolName: 'wire_transfer' });
    assert(pr.ok === true && pr.result.blockers.includes('compliance_floor'), 'precommit_review tool flags a compliance-floor action');
  } catch (e) {
    assert(false, `Pre-commit checks-and-balances (NEG) tests crashed: ${e.message}`);
  }

  // --- Test Set 25: Compliance agent + Reporting evidence (Phase 9, CMP/RPT) ---
  try {
    const os = require('os'); const fsx = require('fs'); const pth = require('path');
    const compliance = require('../lib/compliance');
    const { ComplianceReporting } = require('../lib/compliance_reporting');
    const roster = require('../lib/agent_roster');
    const reg = require('../lib/tool_registry');

    // A. Regulatory search (industry/domain/vertical, local/state/federal)
    const search = compliance.regulatorySearch({ vertical: 'medical' });
    assert(search.levels.join(',') === 'local,state,federal' && search.rules.some(r => /HIPAA/.test(r.code)), 'Regulatory search returns local/state/federal rules for the vertical');
    assert(search.simulated === true && search.provenance === 'simulated', 'Regulatory search is labeled simulated without a search key');

    // B. Validate + I/O screening
    const passDet = compliance.validate({ vertical: 'legal', capability: 'list_matters' });
    assert(passDet.verdict === 'pass', 'A non-sensitive action validates as pass');
    const flagDet = compliance.validate({ vertical: 'legal', capability: 'record_trust_transaction' });
    assert(flagDet.verdict === 'flag' && flagDet.citations.some(c => c.code === 'IOLTA'), 'A trust action is flagged with regulatory citations');
    const blockDet = compliance.validate({ vertical: 'medical', capability: 'create_event', io: { note: 'SSN 123-45-6789' } });
    assert(blockDet.verdict === 'block' && blockDet.ioFlags.includes('SSN-like'), 'Sensitive data in I/O is screened and blocks (CMP-03)');

    // C. Reporting: immutable evidence + visual report + exports
    const ef = pth.join(os.tmpdir(), `aiwx_cmp_ev_${Date.now()}.json`);
    const rpt = new ComplianceReporting({ file: ef });
    await rpt.record(flagDet); await rpt.record(blockDet);
    const report = await rpt.report({ tenantId: null });
    assert(report.total === 2 && report.byVerdict.flag === 1 && report.byVerdict.block === 1 && report.headline === 'blocked', 'Reporting compiles a visual report from evidence');
    const csv = await rpt.export({ format: 'csv' });
    assert(csv.format === 'csv' && /verdict/.test(csv.content) && csv.count === 2, 'Evidence exports as CSV');
    const html = await rpt.export({ format: 'html' });
    assert(html.format === 'html' && /Compliance Evidence/.test(html.content), 'Evidence exports as an HTML summary');
    try { fsx.unlinkSync(ef); } catch (e) {}

    // D. Roster bindings + registry tools + Compliance->Reporting handoff
    assert(roster.roleAllowsTool('compliance', 'validate_compliance') && roster.roleAllowsTool('reporting', 'export_compliance_evidence'), 'Compliance + Reporting roles are bound to their tools');
    assert(reg.has('regulatory_search') && reg.has('validate_compliance') && reg.has('compliance_report') && reg.has('export_compliance_evidence'), 'Phase 9 tools are registered');
    const t = 'cmp-' + Date.now();
    const vc = await reg.invoke('validate_compliance', { vertical: 'legal', capability: 'record_trust_transaction', tenantId: t }, { actor: 'op' });
    assert(vc.ok && vc.result.verdict === 'flag', 'validate_compliance validates + hands evidence to Reporting');
    const cr = await reg.invoke('compliance_report', { tenantId: t });
    assert(cr.ok && cr.result.total >= 1, 'compliance_report reflects the recorded evidence (handoff worked)');

    // E. Pre-commit now includes a compliance screen that blocks leaked PII/PHI
    const precommit = require('../lib/precommit');
    const leaked = await precommit.review({ vertical: 'medical', capability: 'create_event', io: { patient: 'card 4111 1111 1111 1111' } });
    assert(leaked.ok === false && leaked.blockers.includes('compliance'), 'Pre-commit blocks a commit that would leak sensitive I/O (CMP-03)');
  } catch (e) {
    assert(false, `Compliance / reporting (Phase 9) tests crashed: ${e.message}`);
  }

  // --- Test Set 26: Human Companion / HR agent (Phase 10, HRC) ---
  try {
    const os = require('os'); const fsx = require('fs'); const pth = require('path');
    const { HumanCompanion } = require('../lib/human_companion');
    const roster = require('../lib/agent_roster');
    const reg = require('../lib/tool_registry');

    const hf = pth.join(os.tmpdir(), `aiwx_hr_${Date.now()}.json`);
    const hc = new HumanCompanion({ file: hf });

    // A. Submit — complaints are confidential by default
    const pto = await hc.submit({ employeeId: 'e1', type: 'pto', detail: 'Aug 4-8 vacation' });
    assert(pto.confidential === false && pto.status === 'submitted', 'A PTO request is non-confidential');
    const complaint = await hc.submit({ employeeId: 'e1', type: 'complaint', detail: 'Concern about manager conduct' });
    assert(complaint.confidential === true, 'A complaint is confidential by default (HRC-03)');

    // B. Confidentiality partition — manager view redacts confidential detail
    const mgrComplaint = await hc.managerView(complaint.id);
    assert(mgrComplaint.detail === '[redacted — confidential HR matter]' && !/(conduct)/.test(JSON.stringify(mgrComplaint)), 'Manager view REDACTS a confidential complaint (never the private detail)');
    const mgrPto = await hc.managerView(pto.id);
    assert(mgrPto.detail === 'Aug 4-8 vacation', 'Manager view shows non-confidential requests in full');

    // C. Routing — approvals go to a manager; complaints do NOT
    const routed = await hc.routeApproval({ id: pto.id, managerHitlId: 'mgr1' });
    assert(routed.assignedManager === 'mgr1' && routed.status === 'in_review', 'A PTO approval routes to a manager');
    let refused = false; try { await hc.routeApproval({ id: complaint.id, managerHitlId: 'mgr1' }); } catch (e) { refused = /confidential HR channel/.test(e.message); }
    assert(refused, 'A confidential complaint is NOT routed to a manager (HRC-04)');

    // D. Wellbeing — the Companion advocates for the employee
    const wb = await hc.wellbeing({ employeeId: 'e1' });
    assert(wb.mandate === 'protect the employee' && typeof wb.message === 'string', 'The Companion returns a wellbeing signal mandated to protect the employee');
    try { fsx.unlinkSync(hf); } catch (e) {}

    // E. Plane isolation — business roles cannot touch HR tools; Companion can
    assert(roster.ROLES.human_companion.plane === 'human', 'Human Companion is on the human-care plane');
    assert(roster.roleAllowsTool('human_companion', 'hr_submit_request') === true, 'The Companion is bound to the HR tools');
    assert(roster.roleAllowsTool('operations', 'hr_submit_request') === false, 'Business-plane roles cannot invoke HR tools (confidentiality partition)');

    // F. Registry tools
    assert(reg.has('hr_submit_request') && reg.has('hr_manager_view') && reg.has('hr_wellbeing_check'), 'Phase 10 HR tools are registered');
    const sub = await reg.invoke('hr_submit_request', { employeeId: 'e9', type: 'complaint', detail: 'secret' }, { actor: 'companion' });
    assert(sub.ok && sub.result.request.confidential === true, 'hr_submit_request tool submits a confidential complaint');
    const mv = await reg.invoke('hr_manager_view', { id: sub.result.request.id });
    assert(mv.ok && mv.result.request.detail === '[redacted — confidential HR matter]', 'hr_manager_view tool redacts confidential detail');
  } catch (e) {
    assert(false, `Human Companion (Phase 10) tests crashed: ${e.message}`);
  }

  // --- Test Set 27: Deployment mode — cloud | on-prem (DEP) ---
  try {
    const fsx = require('fs'); const pth = require('path');
    const { deploymentInfo } = require('../lib/deployment');
    const reg = require('../lib/tool_registry');

    // A. Default (no Supabase, no override) is on-prem with a local state backend
    const prev = process.env.DEPLOYMENT_MODE; delete process.env.DEPLOYMENT_MODE;
    const info = deploymentInfo();
    assert(info.mode === 'onprem' && info.stateBackend === 'json-file' && info.cloudDependencies.length === 0, 'Default deployment is on-prem with a local state backend and no cloud dependency');
    process.env.DEPLOYMENT_MODE = 'cloud';
    assert(deploymentInfo().mode === 'cloud' && deploymentInfo().selfHosted === false, 'DEPLOYMENT_MODE=cloud reports cloud-native');
    if (prev === undefined) delete process.env.DEPLOYMENT_MODE; else process.env.DEPLOYMENT_MODE = prev;

    // B. Registry tool
    assert(reg.has('get_deployment_info'), 'get_deployment_info tool is registered');
    const t = await reg.invoke('get_deployment_info', {});
    assert(t.ok && typeof t.result.mode === 'string', 'get_deployment_info tool returns the active mode');

    // C. On-prem Compose stack + env template + docs are present
    const root = pth.join(__dirname, '..', '..');
    assert(fsx.existsSync(pth.join(root, 'docker-compose.onprem.yml')), 'On-prem Docker Compose file exists');
    assert(fsx.existsSync(pth.join(root, '.env.onprem.example')), 'On-prem env template exists');
    assert(fsx.existsSync(pth.join(root, 'docs', 'DEPLOYMENT_ONPREM.md')), 'On-prem deployment doc exists');
  } catch (e) {
    assert(false, `Deployment mode (DEP) tests crashed: ${e.message}`);
  }

  // --- Test Set 28: Per-vertical instantiation matrix (Phase 6, VRT) ---
  try {
    const os = require('os'); const fsx = require('fs'); const pth = require('path');
    const verticals = require('../lib/verticals');
    const { AgentRegistry } = require('../lib/agent_model');
    const reg = require('../lib/tool_registry');

    // A. The canonical 14 verticals + compliance overlays
    assert(verticals.list().length === 14 && verticals.has('event_rental'), 'The 14 business verticals are defined (incl. Event Rental)');
    assert(verticals.complianceOverlay('legal').includes('IOLTA') && verticals.complianceOverlay('medical').includes('HIPAA'), 'Verticals carry compliance overlays (VRT-02)');

    // B. The full roster instantiates per vertical for ALL 14 (VRT-01)
    const af = pth.join(os.tmpdir(), `aiwx_vrt_${Date.now()}.json`);
    const agents = new AgentRegistry({ file: af });
    let allProvisioned = true;
    for (const v of verticals.list()) {
      const team = await agents.provisionRoster({ tenantId: `vrt-${v.id}`, vertical: v.id });
      if (team.length !== 13 || !team.every(a => a.vertical === v.id)) allProvisioned = false;
    }
    assert(allProvisioned, 'The 13-agent roster instantiates, scoped to the vertical, for all 14 verticals');
    try { fsx.unlinkSync(af); } catch (e) {}

    // C. Registry tool
    assert(reg.has('list_verticals'), 'list_verticals tool is registered');
    const lv = await reg.invoke('list_verticals', {});
    assert(lv.ok && lv.result.verticals.length === 14, 'list_verticals returns the 14 verticals');
  } catch (e) {
    assert(false, `Per-vertical matrix (Phase 6) tests crashed: ${e.message}`);
  }

  // --- Test Set 29: Auto-KB on onboarding + cross-reference every command (ONB-KB/XREF) ---
  try {
    const os = require('os'); const fsx = require('fs'); const pth = require('path');
    const businessOnboarding = require('../lib/business_onboarding');
    const { KnowledgeBase } = require('../lib/knowledge_ingest');
    const { Installation } = require('../lib/installation');
    const { AgentRegistry } = require('../lib/agent_model');
    const { ConnectionRegistry } = require('../lib/connection_registry');
    const { ChatSession } = require('../lib/hitl_chat');
    const taskReq = require('../lib/task_request');

    // A. Onboarding auto-creates the company KB from business intelligence
    const kbf = pth.join(os.tmpdir(), `aiwx_onb_kb_${Date.now()}.json`);
    const kb = new KnowledgeBase({ file: kbf });
    const onb = await businessOnboarding.onboard({
      tenantId: 'biz1', vertical: 'legal', businessName: 'Lobo Law',
      profile: { purpose: 'trial defense', customers: 'accident victims', databases: 'Clio' },
      seedDocs: [{ ref: 'intake-sop.pdf', text: 'Always run a conflict of interest check before opening a matter.' }],
      systems: ['clio'], knowledgeBase: kb
    });
    assert(onb.ingested >= 2 && onb.compiled.ready === true, 'Onboarding auto-ingests business intelligence + seed docs into the company KB (ONB-KB-01/02)');
    const profileHit = await kb.search({ tenantId: 'biz1', query: 'company purpose trial defense' });
    assert(profileHit.results.length > 0, 'The synthesized business-intelligence profile is searchable in the KB');

    // B. install() auto-creates the KB and reports knowledgeReady
    const inf = pth.join(os.tmpdir(), `aiwx_onb_inst_${Date.now()}.json`);
    const agf = pth.join(os.tmpdir(), `aiwx_onb_ag_${Date.now()}.json`);
    const cnf = pth.join(os.tmpdir(), `aiwx_onb_cn_${Date.now()}.json`);
    const kf2 = pth.join(os.tmpdir(), `aiwx_onb_kb2_${Date.now()}.json`);
    const conns = new ConnectionRegistry({ file: cnf });
    const inst = new Installation({ file: inf, agentRegistry: new AgentRegistry({ file: agf }), connectionRegistry: conns, knowledgeBase: new KnowledgeBase({ file: kf2 }) });
    const res = await inst.install({ tenantId: 'biz2', vertical: 'legal', selectedConnectors: [], businessName: 'Acme Legal' });
    assert(res.knowledge && res.knowledge.compiled.ready === true, 'install() auto-creates the KB during onboarding');
    const st = await inst.status({ tenantId: 'biz2' });
    assert(st.knowledgeReady === true && st.knowledgeChunks >= 1, 'Install status reports the KB as ready (ONB-KB-03)');
    try { [inf, agf, cnf, kf2].forEach(f => fsx.unlinkSync(f)); } catch (e) {}

    // C. Every command is cross-referenced against the company KB (XREF-01)
    process.env.CLIO_CLIENT_ID = 'x'; process.env.CLIO_CLIENT_SECRET = 'y'; process.env.CLIO_ACCESS_TOKEN = 'z';
    await conns.build('clio', { tenantId: 'biz1' });
    const interp = await taskReq.interpretRequest({ query: 'conflict of interest check before a matter', tenantId: 'biz1', connectionRegistry: conns, knowledgeBase: kb });
    assert(Array.isArray(interp.knowledgeRefs) && interp.knowledgeRefs.length > 0, 'Task-request interpretation cross-references the company KB (XREF-01)');

    // D. Chat ToT shows the KB cross-reference branch grounded in company knowledge
    const pf = pth.join(os.tmpdir(), `aiwx_onb_plan_${Date.now()}.json`);
    const chat = new ChatSession({ file: pf, connectionRegistry: conns, knowledgeBase: kb });
    const plan = await chat.interpret({ query: 'conflict of interest check before a matter', tenantId: 'biz1', vertical: 'legal' });
    const xrefBranch = plan.plan.treeOfThought.branches.find(b => /knowledge base/i.test(b.thought));
    assert(xrefBranch && /company KB reference/.test(xrefBranch.detail), 'The chat tree-of-thought grounds the request in company KB references (XREF-02)');
    assert(plan.plan.understanding.knowledgeRefs.length > 0, 'The understanding attaches the grounding knowledge references');
    delete process.env.CLIO_CLIENT_ID; delete process.env.CLIO_CLIENT_SECRET; delete process.env.CLIO_ACCESS_TOKEN;
    try { fsx.unlinkSync(kbf); fsx.unlinkSync(cnf); fsx.unlinkSync(pf); } catch (e) {}
  } catch (e) {
    assert(false, `Auto-KB onboarding / cross-reference (ONB-KB/XREF) tests crashed: ${e.message}`);
  }

  // --- Test Set 30: Unified ingestion adapters + embedder hook (RAG/scour/upload) ---
  try {
    const os = require('os'); const fsx = require('fs'); const pth = require('path');
    const adapters = require('../lib/ingestion_adapters');
    const { KnowledgeBase } = require('../lib/knowledge_ingest');
    const reg = require('../lib/tool_registry');

    const kbf = pth.join(os.tmpdir(), `aiwx_ing_${Date.now()}.json`);
    const kb = new KnowledgeBase({ file: kbf });

    // A. Upload adapter — parses text + base64 files into the KB
    const up = await adapters.ingestAll({ tenantId: 'ig', source: 'upload', approvedScope: true, knowledgeBase: kb, files: [
      { name: 'policy.txt', content: 'Data handling policy: encrypt customer records at rest.' },
      { name: 'b64.txt', content: Buffer.from('Escalation SOP: notify the on-call manager within 15 minutes.').toString('base64'), encoding: 'base64' }
    ] });
    assert(up.ingested >= 2, 'Upload adapter parses text + base64 documents into the KB');

    // B. Connector-read adapter — live fetcher, and simulated fallback (scour)
    const fetched = await adapters.ingestAll({ tenantId: 'ig', source: 'connector_read', connectorId: 'google_workspace', approvedScope: true, knowledgeBase: kb, fetcher: async () => ([{ ref: 'Drive/Onboarding.gdoc', text: 'Client onboarding steps: verify identity, collect documents, assign owner.' }]) });
    assert(fetched.simulated === false && fetched.ingested >= 1, 'Connector-read adapter pulls docs via a live fetcher');
    const scoured = await adapters.ingestAll({ tenantId: 'ig', source: 'connector_read', connectorId: 'zendesk', approvedScope: true, knowledgeBase: kb });
    assert(scoured.simulated === true && scoured.ingested >= 1, 'Connector-read adapter falls back to a labeled simulated scour');

    // C. Audit-scour adapter — systems-evaluation intelligence -> KB
    const auditPkg = { businessName: 'Acme', vertical: 'retail', scrapedData: { technologies: [{ name: 'Shopify' }, { name: 'Stripe' }] }, integrationReadiness: { recommendedIntegrations: [{ name: 'Shopify' }] } };
    const au = await adapters.ingestAll({ tenantId: 'ig', source: 'audit_scour', auditPackage: auditPkg, approvedScope: true, knowledgeBase: kb });
    assert(au.ingested >= 1, 'Audit-scour adapter ingests systems-evaluation intelligence into the KB');

    // D. All sources built out ONE KB; it is searchable across them
    const hit = await kb.search({ tenantId: 'ig', query: 'escalation manager on-call' });
    assert(hit.results.length > 0, 'All ingested sources build out one searchable company KB');
    const compiled = await kb.compile({ tenantId: 'ig' });
    assert(compiled.bySource.upload && compiled.bySource.connector_read && compiled.bySource.audit_scour, 'The KB records ingestion from upload + connector_read + audit_scour');
    try { fsx.unlinkSync(kbf); } catch (e) {}

    // E. Embedder hook — a vector backend, when present, is used for upsert + query
    const ef = pth.join(os.tmpdir(), `aiwx_emb_${Date.now()}.json`);
    let upserted = 0; let queried = 0;
    const stubEmbedder = { async upsert(chunks) { upserted += chunks.length; }, async query() { queried++; return { query: 'x', results: [{ text: 'from-vector-index', sourceRef: 'vec', source: 'vector', provenance: {}, score: 1 }] }; } };
    const ekb = new KnowledgeBase({ file: ef, embedder: stubEmbedder });
    await ekb.ingest({ tenantId: 'ig', source: 'upload', docs: [{ ref: 'd', text: 'hello world' }], approvedScope: true });
    const vres = await ekb.search({ tenantId: 'ig', query: 'anything' });
    assert(upserted >= 1 && queried >= 1 && vres.results[0].source === 'vector', 'The embedder hook routes ingest upsert + search through the vector backend when configured');
    try { fsx.unlinkSync(ef); } catch (e) {}

    // F. Registry tool + KB source enum
    assert(reg.has('ingest_documents'), 'ingest_documents tool is registered');
    const it = await reg.invoke('ingest_documents', { tenantId: 'igt-' + Date.now(), source: 'upload', approvedScope: true, files: [{ name: 'x.txt', content: 'onboarding checklist step one' }] });
    assert(it.ok && it.result.ingested >= 1, 'ingest_documents tool ingests via the unified pipeline');
  } catch (e) {
    assert(false, `Unified ingestion adapters (RAG/scour/upload) tests crashed: ${e.message}`);
  }

  // --- Test Set 31: Reranker (RRK) + model-cascade router (MCR) — cost levers ---
  try {
    const os = require('os'); const fsx = require('fs'); const pth = require('path');
    const { localReranker, createReranker } = require('../lib/reranker');
    const modelRouter = require('../lib/model_router');
    const { KnowledgeBase } = require('../lib/knowledge_ingest');
    const reg = require('../lib/tool_registry');

    // A. Local reranker reorders candidates toward exact-phrase / high-coverage
    const rr = localReranker();
    const reranked = await rr.rerank({
      query: 'refund policy window',
      candidates: [
        { text: 'General company overview and history.', score: 0.4 },
        { text: 'The refund policy window is 30 days for all products.', score: 0.35 },
        { text: 'Shipping and delivery timelines.', score: 0.3 }
      ], k: 2
    });
    assert(reranked.length === 2 && /refund policy window/.test(reranked[0].text) && reranked[0].rerankScore != null, 'Reranker promotes the exact-match candidate and trims to top-k (RRK-01/02)');

    // B. Two-stage KB search: recall wide, rerank to a small top-k (context reduction)
    const kf = pth.join(os.tmpdir(), `aiwx_rrk_${Date.now()}.json`);
    const kb = new KnowledgeBase({ file: kf, reranker: createReranker() });
    await kb.ingest({ tenantId: 'rk', source: 'upload', approvedScope: true, docs: [
      { ref: 'a', text: 'Our refund policy allows returns within 30 days of purchase.' },
      { ref: 'b', text: 'Employee vacation policy and accrual rules.' },
      { ref: 'c', text: 'Refunds require the original receipt and manager approval.' },
      { ref: 'd', text: 'Office opening hours and holiday schedule.' }
    ] });
    const hits = await kb.search({ tenantId: 'rk', query: 'refund returns receipt', k: 2 });
    assert(hits.results.length === 2 && hits.results.every(r => /refund/i.test(r.text)) && hits.results[0].rerankScore != null, 'Two-stage KB search returns a small, reranked, relevant top-k');
    try { fsx.unlinkSync(kf); } catch (e) {}

    // C. Backward compatible: a KB with no reranker behaves as before
    const kf2 = pth.join(os.tmpdir(), `aiwx_rrk2_${Date.now()}.json`);
    const kb2 = new KnowledgeBase({ file: kf2 });
    await kb2.ingest({ tenantId: 'rk2', source: 'upload', approvedScope: true, docs: [{ ref: 'x', text: 'refund policy returns 30 days' }] });
    const h2 = await kb2.search({ tenantId: 'rk2', query: 'refund policy', k: 3 });
    assert(h2.results.length > 0 && h2.results[0].rerankScore === undefined, 'KB with no reranker keeps the original behavior (RRK-03)');
    try { fsx.unlinkSync(kf2); } catch (e) {}

    // D. Model-cascade router: cheap for easy, premium for risky/low-confidence
    assert(modelRouter.route({ confidence: 0.95, risk: 'low', provider: 'gemini' }).tier === 'cheap', 'High-confidence low-risk routes to the cheap tier (cost saving, MCR-02)');
    assert(modelRouter.route({ confidence: 0.95, risk: 'low', localPreferred: true, provider: 'ollama' }).tier === 'local', 'High-confidence low-risk with localPreferred routes to a local model');
    assert(modelRouter.route({ destructive: true, provider: 'claude' }).tier === 'premium', 'A destructive/high-risk action escalates to the premium tier');
    const low = modelRouter.route({ confidence: 0.3, provider: 'openai' });
    assert(low.tier === 'premium' && low.routeToHitl === true, 'Low confidence escalates to premium AND flags for human review');
    assert(modelRouter.route({ confidence: 0.95, risk: 'low', provider: 'openai' }).model === 'gpt-4o-mini', 'Router honors the provider (OpenAI cheap tier = gpt-4o-mini)');

    // E. Registry tool
    assert(reg.has('route_model'), 'route_model tool is registered');
    const rt = await reg.invoke('route_model', { confidence: 0.9, risk: 'low', provider: 'gemini' });
    assert(rt.ok && rt.result.tier === 'cheap', 'route_model tool recommends the cost-saving tier');
  } catch (e) {
    assert(false, `Reranker / model router (RRK/MCR) tests crashed: ${e.message}`);
  }

  // --- Test Set 32: Integration seams — live-backend readiness (pre-cloud) ---
  try {
    const fsx = require('fs'); const pth = require('path');
    const seamsLib = require('../lib/integration_seams');
    const { deploymentInfo } = require('../lib/deployment');
    const reg = require('../lib/tool_registry');

    // A. Seams report every optional backend with fallback + activation
    const s = seamsLib.seams();
    assert(s.seams.length >= 7 && s.summary.total === s.seams.length, 'Seams report every optional backend');
    ['vector_embeddings', 'reranker', 'connector_fetchers', 'regulatory_search', 'state_backend'].forEach(id =>
      assert(s.seams.some(x => x.id === id), `Seams include the ${id} backend`));
    assert(s.seams.every(x => Array.isArray(x.env) && x.fallback && x.activation), 'Each seam documents its env, fallback, and activation');

    // B. In this (pre-cloud) environment the seams run on fallbacks
    const emb = s.seams.find(x => x.id === 'vector_embeddings');
    assert(emb.configured === false, 'Vector embeddings run on the local fallback until configured');

    // C. deploymentInfo surfaces the optional-backend summary
    const info = deploymentInfo();
    assert(info.optionalBackends && typeof info.optionalBackends.live === 'number' && typeof info.optionalBackends.fallback === 'number', 'deploymentInfo surfaces the optional-backend readiness summary');

    // D. Registry tool + seams doc present
    assert(reg.has('get_integration_seams'), 'get_integration_seams tool is registered');
    const t = await reg.invoke('get_integration_seams', {});
    assert(t.ok && t.result.summary.total >= 7, 'get_integration_seams tool returns the readiness map');
    assert(fsx.existsSync(pth.join(__dirname, '..', '..', 'docs', 'INTEGRATION_SEAMS.md')), 'The integration-seams reference doc exists');
  } catch (e) {
    assert(false, `Integration seams (pre-cloud readiness) tests crashed: ${e.message}`);
  }

  // --- Test Set 33: Regional data sources — real-estate MLS + region detection (REG) ---
  try {
    const regional = require('../lib/regional_sources');
    const catalog = require('../lib/connectors/catalog');
    const verticals = require('../lib/verticals');
    const reg = require('../lib/tool_registry');

    // A. Real-estate MLS connectors exist in the catalog (RESO + aggregators)
    assert(catalog.get('reso_web_api') && /MLS/.test(catalog.get('reso_web_api').category), 'The RESO Web API (MLS) connector is in the catalog');
    assert(catalog.byVertical('Real Estate').some(c => c.id === 'reso_web_api'), 'byVertical surfaces MLS connectors for Real Estate');
    assert(['reso_web_api', 'trestle', 'mls_grid', 'bridge'].every(id => catalog.has(id)), 'RESO + Trestle + MLS Grid + Bridge MLS connectors are registered');

    // B. Region detection: GPS, address, explicit
    assert(regional.detectRegion({ gps: { lat: 34.05, lng: -118.24 } }).region === 'CA', 'GPS coordinates resolve to a region (LA -> CA)');
    assert(regional.detectRegion({ address: '123 Main St, Austin, TX 78701' }).region === 'TX', 'A postal address resolves to a region (TX)');
    assert(regional.detectRegion({ region: 'ny' }).region === 'NY', 'An explicit region is honored');
    assert(regional.detectRegion({}).region === null, 'An unresolvable region returns null');

    // C. Recommend regional sources for real estate (HITL-approval-gated)
    const rec = regional.recommendSources({ vertical: 'realestate', gps: { lat: 34.05, lng: -118.24 } });
    assert(rec.regional === true && rec.detectedRegion === 'CA' && rec.sources[0].connectorId === 'reso_web_api' && rec.sources[0].requiresApprovalToConnect === true, 'Real-estate MLS is recommended for the detected region, gated on HITL approval (REG-01/03)');
    assert(rec.standard === 'RESO Web API' && /CRMLS/.test(rec.sources[0].name), 'The recommended source names the local MLS via the RESO Web API standard');
    const legalReg = regional.recommendSources({ vertical: 'legal' });
    assert(legalReg.regional === false, 'A vertical with no regional dependency reports none');

    // D. Vertical is flagged region-dependent + tools registered
    assert(verticals.get('realestate').regionalSources, 'The Real Estate vertical is flagged as region-dependent');
    assert(reg.has('detect_region') && reg.has('recommend_regional_sources'), 'REG tools are registered');
    const rt = await reg.invoke('recommend_regional_sources', { vertical: 'realestate', region: 'FL' });
    assert(rt.ok && rt.result.detectedRegion === 'FL' && /Stellar/.test(rt.result.sources[0].name), 'recommend_regional_sources tool returns the region-local MLS');
  } catch (e) {
    assert(false, `Regional sources / MLS (REG) tests crashed: ${e.message}`);
  }

  // --- Test Set 34: Gusto HR connector + Human Companion integration ---
  try {
    const os = require('os'); const fsx = require('fs'); const pth = require('path');
    const gusto = require('../lib/connectors/gusto');
    const { HumanCompanion } = require('../lib/human_companion');
    const { isComplianceFloor } = require('../lib/autonomy');
    const catalog = require('../lib/connectors/catalog');
    const roster = require('../lib/agent_roster');
    const reg = require('../lib/tool_registry');

    // A. Catalog: Gusto is registered on the human-care plane
    const g = catalog.get('gusto');
    assert(g && /HR/.test(g.category) && g.plane === 'human', 'Gusto is in the catalog on the human-care plane');
    assert(g.destructiveCapabilities.includes('run_payroll'), 'Gusto marks run_payroll as destructive');

    // B. Reads degrade to a labeled simulated dataset
    const emps = await gusto.listEmployees({ limit: 5 });
    assert(emps.simulated === true && Array.isArray(emps.data) && emps.data.length > 0, 'Gusto listEmployees degrades to a labeled simulated dataset');
    const to = await gusto.listTimeOffRequests({ status: 'pending' });
    assert(to.simulated === true && to.data.every(r => r.status === 'pending'), 'Gusto time-off requests filter by status');

    // C. Compensation is REDACTED at the boundary (confidential HR data)
    const red = gusto.redactCompensation({ name: 'Dana', compensation: { rate: '85000' }, nested: { salary: '90000', dept: 'Ops' } });
    assert(/redacted/.test(red.compensation) && /redacted/.test(red.nested.salary) && red.nested.dept === 'Ops', 'Compensation/salary fields are redacted, non-sensitive fields preserved');
    const payrolls = await gusto.listPayrolls({});
    assert(payrolls.simulated === true, 'Gusto payrolls degrade to simulated');

    // D. Payroll is on the COMPLIANCE FLOOR + double-gated in the connector
    assert(isComplianceFloor('gusto_run_payroll') === true, 'Running payroll is a compliance-floor action (money movement)');
    assert(isComplianceFloor('gusto_terminate_employee') === true, 'Termination is a compliance-floor action');
    const blockedPay = await gusto.runPayroll({ payrollId: 'pay_9001' });
    assert(blockedPay.success === false && blockedPay.requiresApproval === true, 'runPayroll refuses without explicit approval (connector-level gate)');
    assert((await gusto.runPayroll({ payrollId: 'pay_9001', approved: true })).success === true, 'runPayroll proceeds once approved');

    // E. Webhooks map to governed tasks; payroll/termination land pending_approval
    assert(gusto.mapWebhookToTask({ event_type: 'time_off_request.created' }).status === 'proposed', 'A time-off webhook maps to a proposed task');
    const payHook = gusto.mapWebhookToTask({ event_type: 'payroll.submitted', payload: { net_pay: '5000', id: 'p1' } });
    assert(payHook.status === 'pending_approval' && payHook.payload.plane === 'human', 'A payroll webhook lands pending_approval on the human-care plane');
    assert(/redacted/.test(payHook.payload.data.net_pay), 'Webhook payloads redact compensation before landing on a task');
    assert(gusto.mapWebhookToTask({ event_type: 'employee.terminated' }).status === 'pending_approval', 'A termination webhook requires approval');

    // F. Human Companion files PTO into the HR system — approval-gated, complaints never
    const hf = pth.join(os.tmpdir(), `aiwx_gusto_hr_${Date.now()}.json`);
    const hc = new HumanCompanion({ file: hf, hrSystem: gusto });
    const pto = await hc.submit({ employeeId: 'emp_1001', type: 'pto', detail: 'Aug 4-8 vacation' });
    const notApproved = await hc.fileWithHrSystem({ id: pto.id });
    assert(notApproved.ok === false && notApproved.requiresApproval === true, 'Filing into the HR system requires explicit approval');
    const filed = await hc.fileWithHrSystem({ id: pto.id, approved: true, startDate: '2026-08-04', endDate: '2026-08-08' });
    assert(filed.ok === true && filed.filed.simulated === true, 'An approved PTO request files into the HR system (simulated without a token)');
    assert((await hc.get(pto.id)).status === 'filed', 'The companion records that the request was filed');
    const complaint = await hc.submit({ employeeId: 'emp_1001', type: 'complaint', detail: 'sensitive' });
    let refused = false; try { await hc.fileWithHrSystem({ id: complaint.id, approved: true }); } catch (e) { refused = /never filed/.test(e.message); }
    assert(refused, 'A confidential complaint is NEVER filed into the HR system (HRC-03/04)');
    try { fsx.unlinkSync(hf); } catch (e) {}

    // G. Plane isolation + tools registered + registry approval gate
    assert(roster.roleAllowsTool('human_companion', 'gusto_run_payroll') === true, 'The Human Companion is bound to the Gusto tools');
    assert(roster.roleAllowsTool('operations', 'gusto_list_employees') === false, 'Business-plane agents cannot read Gusto employee data (confidentiality partition)');
    assert(roster.roleAllowsTool('admin_support', 'gusto_list_payrolls') === false, 'Admin-Support cannot read payroll data');
    ['gusto_list_employees', 'gusto_list_time_off_requests', 'gusto_list_payrolls', 'gusto_submit_time_off_request', 'gusto_decide_time_off_request', 'gusto_run_payroll', 'hr_file_with_hr_system']
      .forEach(t => assert(reg.has(t), `Tool ${t} is registered`));
    const gated = await reg.invoke('gusto_run_payroll', { payrollId: 'pay_9001' }, { actor: 'op' });
    assert(gated.ok === false && gated.status === 'requires_approval', 'gusto_run_payroll is approval-gated by the registry');
    const okRead = await reg.invoke('gusto_list_employees', { limit: 2 });
    assert(okRead.ok === true && okRead.result.simulated === true, 'gusto_list_employees reads through the registry');
  } catch (e) {
    assert(false, `Gusto HR connector tests crashed: ${e.message}`);
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
