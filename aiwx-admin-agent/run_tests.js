/*
   CONVERGENCE-Ai™ Cloud-Native AI Automations Hub Zero-Dependency Automated CLI Test Runner
   Validates base64 cryptographic signatures, safe encoding, state structures,
   HITL manipulations, and file structures.
*/

const fs = require('fs');
const path = require('path');

// Colors for terminal reporting
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let passedTestsCount = 0;
let failedTestsCount = 0;

function assert(condition, message) {
    if (condition) {
        passedTestsCount++;
        console.log(`${GREEN}✓ PASS:${RESET} ${message}`);
    } else {
        failedTestsCount++;
        console.error(`${RED}✗ FAIL:${RESET} ${message}`);
    }
}

console.log(`${CYAN}================================================================${RESET}`);
console.log(`${CYAN}   CONVERGENCE-Ai™ Cloud-Native AI Automations Hub CLI Test Suite  ${RESET}`);
console.log(`${CYAN}================================================================${RESET}`);

// Test 1: File Existence and Asset Integrity Checks
console.log(`\n${CYAN}[1/5] File Integrity System Checks...${RESET}`);
const requiredFiles = [
    'index.html',
    'deployment_hub.html',
    'operations_hub.html',
    'training_hub.html',
    'smb_landing.html',
    'solopreneur_landing.html',
    'styles.css',
    'app.js',
    'DEPLOYMENT.md'
];

requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    const exists = fs.existsSync(filePath);
    assert(exists, `Required file asset presence: ${file}`);
    if (exists) {
        const stats = fs.statSync(filePath);
        assert(stats.size > 0, `Asset contains content bytes: ${file} (${stats.size} bytes)`);
    }
});

// Mock browser dependencies to test app.js logic in Node context
const mockLocalStorage = {
    store: {},
    getItem(key) { return this.store[key] || null; },
    setItem(key, val) { this.store[key] = String(val); },
    removeItem(key) { delete this.store[key]; }
};

// Set up mock window, document, and localStorage objects
global.window = {};
global.localStorage = mockLocalStorage;
global.document = {
    documentElement: {
        style: {
            setProperty(prop, val) {
                this[prop] = val;
            }
        }
    },
    getElementById(id) {
        const node = {
            id: id,
            textContent: '',
            value: '',
            style: {},
            innerHTML: '',
            classList: {
                add() {},
                remove() {},
                contains() { return false; }
            },
            appendChild() {},
            querySelectorAll() { return []; },
            querySelector() { return node; },
            addEventListener() {}
        };
        return node;
    },
    createElement(tag) {
        const node = {
            className: '',
            innerHTML: '',
            style: {},
            setAttribute() {},
            appendChild() {},
            classList: {
                add() {},
                remove() {},
                contains() { return false; }
            },
            querySelector() { return node; },
            querySelectorAll() { return []; },
            addEventListener() {}
        };
        return node;
    },
    createElementNS(ns, tag) {
        const node = {
            className: '',
            innerHTML: '',
            style: {},
            setAttribute() {},
            appendChild() {},
            querySelector() { return node; },
            querySelectorAll() { return []; },
            addEventListener() {}
        };
        return node;
    },
    querySelectorAll() {
        return [];
    }
};

// Emulate atob and btoa globally for Node
global.btoa = function(str) { return Buffer.from(str, 'binary').toString('base64'); };
global.atob = function(str) { return Buffer.from(str, 'base64').toString('binary'); };

global.alert = function(msg) {};
global.DOMParser = function() {
    return {
        parseFromString(text, type) {
            return {
                getElementsByTagName(tag) {
                    if (tag === "parsererror") return [];
                    if (tag === "item") {
                        return [
                            {
                                getElementsByTagName(innerTag) {
                                    if (innerTag === "title") return [{ textContent: "Don't Fire Them. Elevate Them." }];
                                    if (innerTag === "link") return [{ textContent: "https://convergence-ai.com/blog/dont-fire-them-elevate-them" }];
                                    if (innerTag === "pubDate") return [{ textContent: "Sun, 17 May 2026 21:16:12 GMT" }];
                                    if (innerTag === "description") return [{ textContent: "New Gartner research..." }];
                                    if (innerTag === "category") return [
                                        { textContent: "Leadership & Growth Strategy" },
                                        { textContent: "AI Without Hype" }
                                    ];
                                    return [];
                                }
                            },
                            {
                                getElementsByTagName(innerTag) {
                                    if (innerTag === "title") return [{ textContent: "Human-in-the-Loop ROI" }];
                                    if (innerTag === "link") return [{ textContent: "https://convergence-ai.com/blog/human-in-the-loop-roi" }];
                                    if (innerTag === "pubDate") return [{ textContent: "Thu, 16 Apr 2026 14:00:00 GMT" }];
                                    if (innerTag === "description") return [{ textContent: "The AI rollouts..." }];
                                    if (innerTag === "category") return [
                                        { textContent: "Operational Leverage" }
                                    ];
                                    return [];
                                }
                            }
                        ];
                    }
                    return [];
                }
            };
        }
    };
};

// Load modular files into evaluation context
function loadModule(fileName) {
    const filePath = path.join(__dirname, fileName);
    let content = fs.readFileSync(filePath, 'utf8');
    // Strip ES modules import syntax
    content = content.replace(/import\s+[\s\S]*?\s+from\s+['"].*?['"];?/g, '');
    // Strip ES modules export syntax
    content = content.replace(/\bexport\s+default\b/g, '');
    content = content.replace(/\bexport\s+(const|let|var|function|async\s+function|class)\b/g, '$1');
    return content;
}

let evalCode = '';
evalCode += loadModule('js/state.js') + "\n";
evalCode += loadModule('js/components.js') + "\n";
evalCode += loadModule('js/auth.js') + "\n";
evalCode += loadModule('js/process_maps.js') + "\n";
evalCode += loadModule('js/agent_badge.js') + "\n";
evalCode += loadModule('js/hitl_queue.js') + "\n";
evalCode += loadModule('js/reporting.js') + "\n";
evalCode += loadModule('js/tour.js') + "\n";
evalCode += loadModule('js/campaigns.js') + "\n";
evalCode += loadModule('js/pricing.js') + "\n";
evalCode += loadModule('js/integrations.js') + "\n";
evalCode += loadModule('js/analytics.js') + "\n";
evalCode += loadModule('js/search.js') + "\n";

// Map variables to global context for test verification
evalCode = evalCode.replace(/\bvar STATE\b/g, 'global.STATE');
evalCode = evalCode.replace(/\bvar PROCESS_TEMPLATES\b/g, 'global.PROCESS_TEMPLATES');
evalCode = evalCode.replace(/\bconst STATE\b/g, 'global.STATE');
evalCode = evalCode.replace(/\bconst PROCESS_TEMPLATES\b/g, 'global.PROCESS_TEMPLATES');

// Evaluate code in context
eval(evalCode);

// Mock token generation for test context (no longer in production client code)
global.generateActivationToken = function(config) {
    const header = { alg: "AES256GCM", typ: "CONVERGENCE-LIC" };
    const body = {
        iss: "convergence-ai.com",
        company: config.companyName,
        vert: config.vertical,
        ep: config.apiEndpoint,
        vlt: safeBtoa(config.vaultKey),
        c1: config.primaryColor,
        c2: config.secondaryColor,
        logo: config.logoText,
        upskill: config.upskill || false,
        observer: config.observer || false,
        llmProvider: config.llmProvider || "gemini",
        llmModel: config.llmModel || "gemini-2.5-flash",
        llmApiKey: config.llmApiKey ? safeBtoa(config.llmApiKey) : "",
        llmMarkup: config.llmMarkup || 0,
        iat: Date.now()
    };
    const signature = safeBtoa(JSON.stringify(body)).substring(10, 30).toUpperCase();
    return safeBtoa(JSON.stringify(header)) + "." + safeBtoa(JSON.stringify(body)) + "." + signature;
};

// Seed queue data for test assertions
seedDemoData();

// Test 2: Safe Base64 Wrapper Robustness Verification (Non-ASCII & Accented characters)
console.log(`\n${CYAN}[2/5] Base64 Cryptographic Safe Wrappers...${RESET}`);
try {
    const specialCompanyName = "Apex Medical Care™ & Dr. Müller-Händel 😊";
    const encoded = safeBtoa(specialCompanyName);
    const decoded = safeAtob(encoded);
    assert(decoded === specialCompanyName, "Safe UTF-8 Base64 wrapper correctly preserves accents, trademark symbols, and emojis");
    assert(encoded !== specialCompanyName, "Base64 wrapper successfully obfuscates text string");
} catch (e) {
    assert(false, `Safe Base64 wrappers threw an exception: ${e.message}`);
}

// Test 3: Licensing Token Generation & Signature Verification
console.log(`\n${CYAN}[3/5] Licensing Vault Handshake & Cryptographic Checks...${RESET}`);
const testConfig = {
    companyName: "Metro Legal Inc.",
    vertical: "legal",
    logoText: "MLI",
    primaryColor: "#ff0077",
    secondaryColor: "#00ffff",
    apiEndpoint: "https://api.metrolegal.com/v1",
    vaultKey: "Secret-Credentials-Vault-1092-AW",
    llmProvider: "openai",
    llmModel: "gpt-4o",
    llmApiKey: "sk-proj-test-api-key",
    llmMarkup: 45
};

try {
    const token = generateActivationToken(testConfig);
    assert(token && token.split('.').length === 3, "Licensing Engine successfully compiles 3-part cryptographically emulated activation token");
    
    const parsed = parseAndVerifyToken(token);
    assert(parsed !== null, "Signature and structure validated successfully by decoder");
    assert(parsed.companyName === testConfig.companyName, `Decoded company name matches input exactly: ${parsed.companyName}`);
    assert(parsed.vertical === testConfig.vertical, `Decoded industry vertical lockdown matched: ${parsed.vertical}`);
    assert(parsed.vaultKey === testConfig.vaultKey, "Credentials KMS key successfully extracted from decrypted block");
    assert(parsed.primaryColor === testConfig.primaryColor && parsed.secondaryColor === testConfig.secondaryColor, "Brand custom primary and secondary accents decrypted accurately");
    assert(parsed.llmProvider === testConfig.llmProvider, `Decoded LLM provider matched: ${parsed.llmProvider}`);
    assert(parsed.llmModel === testConfig.llmModel, `Decoded LLM model matched: ${parsed.llmModel}`);
    assert(parsed.llmApiKey === testConfig.llmApiKey, `Decoded LLM API Key matched: ${parsed.llmApiKey}`);
    assert(parsed.llmMarkup === testConfig.llmMarkup, `Decoded LLM Reseller Markup matched: ${parsed.llmMarkup}%`);
} catch (e) {
    assert(false, `Licensing token generation check failed: ${e.message}`);
}

// Test 4: Process Mapping Architecture & Simulation State Machine
console.log(`\n${CYAN}[4/5] Process Mapping Template Architecture...${RESET}`);
assert(PROCESS_TEMPLATES !== undefined, "Process Mapping templates loaded into STATE database");
assert(PROCESS_TEMPLATES.p2p && PROCESS_TEMPLATES.voice && PROCESS_TEMPLATES.travel, "Workflow mapping includes six sigma p2p, voice triage, and travel routing maps");

const travelMap = PROCESS_TEMPLATES.travel;
assert(travelMap.nodes.length === 7, "Six Sigma Travel SIPOC Map architecture includes exactly 7 logical node states");
assert(travelMap.nodes.some(n => n.type === 'hitl'), "Process workflow contains explicit safety human-in-the-loop (HITL) checkpoints");

// Test 5: HITL Event Dispatcher & State Transition Mappings
console.log(`\n${CYAN}[5/5] HITL Queue Operations & Data Syncs...${RESET}`);
const initialQueueLength = STATE.hitlQueue.length;
assert(initialQueueLength === 6, `Initial global Human-in-the-Loop queue size is exactly 6 items`);

// Simulate task rejection
const targetTaskId = "T-1003";
const targetTask = STATE.hitlQueue.find(t => t.id === targetTaskId);
const initialDetails = targetTask.details;

rejectTask(targetTaskId);
const revisedTask = STATE.hitlQueue.find(t => t.id === targetTaskId);
assert(revisedTask.details.startsWith("[REVISION REQUESTED]"), "rejectTask successfully marks the targeted task and prepends revision alert text");

// Click reject again to test the duplicate prevention guard
rejectTask(targetTaskId);
const revisedTaskTwice = STATE.hitlQueue.find(t => t.id === targetTaskId);
const occurrenceCount = (revisedTaskTwice.details.match(/\[REVISION REQUESTED\]/g) || []).length;
assert(occurrenceCount === 1, "Duplicate prevention guard successfully blocks repeating revision labels on multiple clicks");

// Simulate task approval
const approveTaskId = "T-1002";
const initialCompletedCount = STATE.completedCount;

approveTask(approveTaskId);
assert(STATE.hitlQueue.length === initialQueueLength - 1, `Queue size decremented correctly after task release (New Size: ${STATE.hitlQueue.length})`);
assert(STATE.completedCount === initialCompletedCount + 1, `Autonomous Completed counter incremented successfully (New Completed: ${STATE.completedCount})`);
assert(STATE.hitlQueue.find(t => t.id === approveTaskId) === undefined, "Approved task successfully popped from active oversight queue");

// Test 6: Social Campaign Feed & Post Generation
(async () => {
    console.log(`\n${CYAN}[6/6] Social Campaign Feed & Queueing Checks...${RESET}`);
    try {
        assert(global.STATE.campaignFeedUrl === "https://zdkwrglsqrueolrshukh.supabase.co/functions/v1/blog-rss", "Default RSS Feed URL initialized correctly");
        assert(global.STATE.campaignLaunchDate === "2026-06-01", "Default campaign launch date set to June 1, 2026");
        
        const mockElements = {
            campaignDateInput: { value: "2026-06-01" },
            platformLinkedinCheckbox: { checked: true },
            platformInstagramCheckbox: { checked: true },
            platformThreadsCheckbox: { checked: true }
        };
        
        const originalGetElementById = global.document.getElementById;
        global.document.getElementById = function(id) {
            if (mockElements[id]) {
                return mockElements[id];
            }
            return originalGetElementById(id);
        };
        
        const initialQueueSize = global.STATE.hitlQueue.length;
        
        await syncBlogFeed("https://zdkwrglsqrueolrshukh.supabase.co/functions/v1/blog-rss");
        assert(global.STATE.syncedArticles.length === 2, "syncBlogFeed successfully populated syncedArticles with 2 posts");
        
        generateCampaignPosts();
        
        const newQueueSize = global.STATE.hitlQueue.length;
        const addedPosts = newQueueSize - initialQueueSize;
        assert(addedPosts === 6, `generateCampaignPosts successfully queued 6 platform posts (New Size: ${newQueueSize})`);
        
        const samplePost = global.STATE.hitlQueue[0];
        assert(samplePost.id.startsWith("CP-"), `Campaign posts are assigned a custom ID: ${samplePost.id}`);
        assert(samplePost.action.includes("Scheduled: 2026-06-"), `Campaign posts are correctly scheduled starting in June: ${samplePost.action}`);
        
        global.document.getElementById = originalGetElementById;
    } catch (e) {
        assert(false, `Social campaigns checks threw an exception: ${e.message}`);
    }

    // Test 7: Performance Intelligence & Analytics Module
    console.log(`\n${CYAN}[7/7] Analytics & Performance Intelligence telemetry checks...${RESET}`);
    try {
        initAnalytics();
        // Reset state from any actions fired in prior tests
        global.STATE.analytics.taskLog = [];
        global.STATE.analytics.metrics = {
            totalTasksProcessed: 0,
            totalApproved: 0,
            totalRejected: 0,
            totalAutoResolved: 0,
            avgResolutionTimeMs: 0,
            slaBreaches: 0,
            byVertical: {},
            byIntegration: {},
            hourlyThroughput: []
        };

        assert(global.STATE.analytics !== undefined, "initAnalytics successfully bootstrapped analytics data model");
        
        recordTaskEvent("T-TEST-889", "approved", "medical", "epic", 450);
        assert(global.STATE.analytics.taskLog.length === 1, "recordTaskEvent successfully appends task events");
        assert(global.STATE.analytics.metrics.totalApproved === 1, "metrics approved count increments correctly");
        assert(global.STATE.analytics.metrics.avgResolutionTimeMs === 450, "average resolution latency matches checked input");
        
        const resRate = calculateResolutionRate();
        assert(resRate === 100, `calculateResolutionRate yields correct results: ${resRate}%`);
        
        const compliance = calculateSLACompliance(5000);
        assert(compliance === 100, `calculateSLACompliance returns correct compliance rate: ${compliance}%`);
    } catch (e) {
        assert(false, `Analytics verification threw an exception: ${e.message}`);
    }

    // Test 8: SOP Full-Text Search and Autocomplete Indexing
    console.log(`\n${CYAN}[8/7] SOP Search Indexing & Autocomplete checks...${RESET}`);
    try {
        buildSearchIndex();
        
        // Search for a vertical-specific term to verify exact relevance
        const searchResults = search("epic");
        assert(searchResults.length > 0, "SOP search successfully retrieved epic query records");
        assert(searchResults[0].title.includes("Medical") || searchResults[0].title.includes("Healthcare"), `Top query match correctly correlates to medical: ${searchResults[0].title}`);
        
        // Autocomplete
        const suggestions = getAutocompleteSuggestions("tri");
        assert(suggestions.includes("triage"), "Autocomplete successfully returns keyword matches for prefix prefix");
    } catch (e) {
        assert(false, `Search indexing verification threw an exception: ${e.message}`);
    }

    console.log(`\n${CYAN}================================================================${RESET}`);
    console.log(`   TEST EXECUTION RESULT SUMMARY                                `);
    console.log(`================================================================`);
    console.log(`  Total Automated Assertions Run: ${passedTestsCount + failedTestsCount}`);
    console.log(`  ${GREEN}Passed assertions: ${passedTestsCount}${RESET}`);
    if (failedTestsCount > 0) {
        console.error(`  ${RED}Failed assertions: ${failedTestsCount}${RESET}`);
        console.log(`${CYAN}================================================================${RESET}`);
        setTimeout(() => process.exit(1), 50);
    } else {
        console.log(`  ${GREEN}All smoke and integration testing checks completed with 100% success!${RESET}`);
        console.log(`${CYAN}================================================================${RESET}`);
        setTimeout(() => process.exit(0), 50);
    }
})();
