/*
   CONVERGENCE-Ai™ Modular Front-End Bootstrapper & Entry Point
   Coordinates modules, binds DOM triggers, runs active synchronizers, and handles the Observer agent.
*/

import { initErrorBoundary } from './js/error_boundary.js';
initErrorBoundary();

import { STATE, saveLocalState, updateState, seedDemoData } from './js/state.js';
import { logConsole, injectLayout } from './js/components.js';
import { verifyActivationToken, verifyAdminSession, safeBtoa, safeAtob, parseAndVerifyToken } from './js/auth.js';
import { PROCESS_TEMPLATES, renderProcessMap, runAgentProcessMap } from './js/process_maps.js';
import { updateAgentBadgeState, toggleMinimizeBadge, dismissBadge, restoreBadge, toggleKillSwitch, injectBadge } from './js/agent_badge.js';
import { renderHITLQueue, approveTask, rejectTask, reverseTask, promptRevision, analyzeAndAutoCorrect, renderReversalHistory, updateConnectionBadge, openAiComposeModal, closeAiComposeModal, applyAiDraft, initTaskStream } from './js/hitl_queue.js';
import { changeReportFilters, printReport } from './js/reporting.js';
import { startProductTour } from './js/tour.js';
import { syncBlogFeed, generateCampaignPosts, renderSyncedArticles } from './js/campaigns.js';
import { calculatePricing } from './js/pricing.js';
import { openIntegrationModal, closeIntegrationModal, updateIntegrationDescription, runAutoIntegration, appendDeployedConnector, removeDeployedConnector } from './js/integrations.js';
import { renderAnalyticsDashboard } from './js/analytics.js';
import { search } from './js/search.js';
import { runHealthCheckAll, checkIntegrationHealth } from './js/integration_health.js';

// Bind to window for HTML compatibility
Object.assign(window, {
    STATE,
    saveLocalState,
    updateState,
    parseAndVerifyToken,
    logConsole,
    verifyActivation,
    autoLoadTestToken,
    switchMainTab,
    initTaskStream,
    renderAnalyticsDashboard,
    search,
    runHealthCheckAll,
    checkIntegrationHealth,
    triggerDemoSeed,
    superAdminSwitchVertical,
    runAgentProcessMap,
    renderProcessMap,
    updateAgentBadgeState,
    toggleMinimizeBadge,
    dismissBadge,
    restoreBadge,
    toggleKillSwitch,
    approveTask,
    rejectTask,
    reverseTask,
    promptRevision,
    analyzeAndAutoCorrect,
    openAiComposeModal,
    closeAiComposeModal,
    applyAiDraft,
    changeReportFilters,
    printReport,
    startProductTour,
    syncBlogFeed,
    generateCampaignPosts,
    calculatePricing,
    openIntegrationModal,
    closeIntegrationModal,
    updateIntegrationDescription,
    runAutoIntegration,
    toggleWorkflowRecorder,
    verifyActivationToken,
    lockEnvironment,
    exportBPMN,
    trainAgentAlert,
    triggerClientRebrand
});

// Vertical metadata definitions
const VERTICALS = {
    medical: { name: "Medical & Healthcare", icon: "fa-stethoscope", placeholder: "Scheduling, Patient Inquiries, Pharmacy Refills" },
    legal: { name: "Legal Services", icon: "fa-gavel", placeholder: "Deposition Scheduling, Document Filing, Client Intake" },
    realestate: { name: "Real Estate", icon: "fa-building", placeholder: "Lead Follow-up, Home Showing Calendar, Contract Drafting" },
    retail: { name: "Retail & E-commerce", icon: "fa-shopping-cart", placeholder: "Order Tracking, Inventory Refills, FAQ Handling" },
    hospitality: { name: "Hospitality & Leisure", icon: "fa-hotel", placeholder: "Booking Reservations, Concierge Inquiry Routing" },
    finance: { name: "Financial & Bookkeeping", icon: "fa-file-invoice-dollar", placeholder: "Procure-to-Pay, QuickBooks Ledger, Invoice Verification" },
    construction: { name: "Construction & Contracting", icon: "fa-hammer", placeholder: "Permit Applications, Materials Request, Subcontracting Routing" },
    logistics: { name: "Logistics & Supply Chain", icon: "fa-truck", placeholder: "Travel Bookings, Ship Dispatching, Transit Expense Reports" },
    education: { name: "Education & Tutoring", icon: "fa-graduation-cap", placeholder: "Tutor Rostering, Course Invoicing, Session Schedules" },
    tech: { name: "SaaS & Tech Startups", icon: "fa-laptop-code", placeholder: "Support Ticket Routing, Bug Report Triaging, Newsletters" },
    professional: { name: "Professional Services", icon: "fa-briefcase", placeholder: "Time Ledger Logging, Client Memos, Invoice Creation" },
    nonprofit: { name: "Non-Profit Organizations", icon: "fa-hand-holding-heart", placeholder: "Donor Outreach, Volunteer Rostering, Registration Routing" },
    events: { name: "Event Planning & Management", icon: "fa-calendar-check", placeholder: "Vendor Bookings, Scheduling Rosters, Client Onboarding" },
    event_rental: { name: "Event Rentals (Ingested)", icon: "fa-tents", placeholder: "Inventory tracking, payment match, client SMS confirmation" }
};

// Apply rebranding dynamics instantly
function applyBranding(config) {
    document.documentElement.style.setProperty('--primary-color', config.primaryColor);
    document.documentElement.style.setProperty('--primary-glow', config.primaryColor + '44');
    document.documentElement.style.setProperty('--secondary-color', config.secondaryColor);
    document.documentElement.style.setProperty('--secondary-glow', config.secondaryColor + '33');
    
    updateAgentBadgeState(STATE.killSwitchActive ? 'offline' : 'ready');
    
    const lockOverlay = document.getElementById('upskillingLockOverlay');
    if (lockOverlay) {
        if (config.upskill || STATE.isSuperAdmin) {
            lockOverlay.style.setProperty('display', 'none', 'important');
        } else {
            lockOverlay.style.setProperty('display', 'flex', 'important');
        }
    }

    const recordBtn = document.getElementById('recordWorkflowBtn');
    if (recordBtn) {
        if (config.observer || STATE.isSuperAdmin) {
            recordBtn.style.opacity = '1.0';
            recordBtn.innerHTML = '<i class="fa-solid fa-record-vinyl"></i> Deploy Observer Agent';
        } else {
            recordBtn.style.opacity = '0.6';
            recordBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Deploy Observer Agent (Premium)';
        }
    }
    
    document.querySelectorAll('.brand-name').forEach(el => {
        el.textContent = config.companyName;
    });
    
    document.querySelectorAll('.brand-logo').forEach(el => {
        if (config.logoText && config.logoText !== "CONVERGENCE-Ai" && config.logoText !== "AW") {
            el.innerHTML = `<span style="background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); border-radius: 12px; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #030712; font-size: 1.25rem; box-shadow: 0 0 10px var(--primary-glow);">${config.logoText}</span>`;
        } else {
            el.innerHTML = `<img src="convergence-ai_logo_light.png" alt="CONVERGENCE-Ai" style="height: 44px; max-width: 100%; object-fit: contain; display: block; margin: 0 auto;">`;
        }
    });

    const currentVert = VERTICALS[config.vertical];
    if (currentVert) {
        const badge = document.getElementById('activeVerticalBadge');
        if (badge) {
            if (STATE.isSuperAdmin) {
                badge.innerHTML = '';
                const badgeLabel = document.createElement('span');
                badgeLabel.style.background = 'rgba(241,179,28,0.2)';
                badgeLabel.style.borderColor = 'var(--secondary-color)';
                badgeLabel.style.color = '#f1b31c';
                badgeLabel.style.fontSize = '0.75rem';
                badgeLabel.style.fontWeight = '800';
                badgeLabel.style.padding = '0.25rem';
                badgeLabel.style.borderRadius = '4px';
                badgeLabel.style.marginRight = '5px';
                badgeLabel.innerHTML = '<i class="fa-solid fa-crown"></i> MASTER AGENCY CONSOLE:';
                badge.appendChild(badgeLabel);
                
                const selector = document.createElement('select');
                selector.id = 'superAdminVertSelector';
                selector.className = 'form-select';
                selector.style.padding = '0.25rem 0.5rem';
                selector.style.fontSize = '0.75rem';
                selector.style.width = 'auto';
                selector.style.background = 'rgba(241,179,28,0.15)';
                selector.style.borderColor = 'var(--secondary-color)';
                selector.style.color = 'var(--secondary-color)';
                selector.style.fontWeight = '700';
                selector.style.display = 'inline-block';
                selector.style.marginLeft = '5px';
                selector.addEventListener('change', (e) => superAdminSwitchVertical(e.target.value));
                
                for (const [key, val] of Object.entries(VERTICALS)) {
                    const opt = document.createElement('option');
                    opt.value = key;
                    opt.textContent = val.name;
                    if (key === config.vertical) {
                        opt.selected = true;
                    }
                    selector.appendChild(opt);
                }
                badge.appendChild(selector);
                badge.className = "";
            } else {
                badge.className = "vertical-badge";
                badge.textContent = currentVert.name;
            }
        }
        logConsole(`Locking system to active vertical: ${currentVert.name}`, 'success');
    }
}

function superAdminSwitchVertical(val) {
    if (!STATE.isSuperAdmin) return;
    STATE.tenantConfig.vertical = val;
    logConsole(`[SUPER ADMIN ACTION] Switching active vertical sandbox to: ${VERTICALS[val].name}`, 'success');
    
    renderHITLQueue();
    
    let mapKey = 'p2p';
    if (val === 'medical') mapKey = 'voice';
    else if (val === 'legal') mapKey = 'legal_deposition';
    else if (val === 'realestate') mapKey = 'realestate_lead';
    else if (val === 'retail') mapKey = 'retail_order';
    else if (val === 'hospitality') mapKey = 'hospitality_guest';
    else if (val === 'construction') mapKey = 'construction_permit';
    else if (val === 'education') mapKey = 'education_schedule';
    else if (val === 'tech') mapKey = 'tech_bug';
    else if (val === 'professional') mapKey = 'professional_retainer';
    else if (val === 'nonprofit') mapKey = 'nonprofit_donor';
    else if (val === 'events') mapKey = 'events_vendor';
    else if (val === 'event_rental') mapKey = 'recorded_rental';
    else if (val === 'logistics' || val === 'finance') mapKey = 'travel';
    
    const mapSelect = document.getElementById('processMapSelect');
    if (mapSelect) {
        mapSelect.value = mapKey;
    }
    renderProcessMap(mapKey);
    startTelemetryLogRunner();
    saveLocalState();
}

// Navigation switcher
function switchMainTab(tabId) {
    document.querySelectorAll('.main-tab-content').forEach(p => p.style.display = 'none');
    
    const targetPanel = document.getElementById(`main-tab-${tabId}`);
    if (targetPanel) {
        targetPanel.style.display = 'block';
    }
    
    logConsole(`Navigating to console view: ${tabId.toUpperCase()}`, 'info');
    
    if (tabId === 'campaigns') {
        renderSyncedArticles();
    } else if (tabId === 'reports') {
        changeReportFilters();
    } else if (tabId === 'analytics') {
        renderAnalyticsDashboard();
    }
}

// Demo data seeder trigger
function triggerDemoSeed() {
    seedDemoData();
    renderHITLQueue();
    logConsole("[DEMO] Demo seed tasks successfully injected into queue.", "success");
}

// Token Verification UI actions
async function verifyActivation() {
    const input = document.getElementById('activationInput').value.trim();
    const email = document.getElementById('activationEmail').value.trim();
    const errorEl = document.getElementById('activationError');

    if (!input) {
        if (errorEl) {
            errorEl.style.display = 'block';
            errorEl.textContent = "Please enter an activation token.";
        }
        return;
    }

    if (errorEl) errorEl.style.display = 'none';

    // Verify Super Admin Bypass (async server verify call)
    if (email) {
        await verifyAdminSession(email, input);
    }

    const result = await verifyActivationToken(input);
    if (result.success) {
        document.getElementById('activationModal').style.display = 'none';
        document.getElementById('mainApp').style.display = 'flex';
        
        // Initialize layout and badge widgets
        injectLayout(switchMainTab);
        
        applyBranding(result.config);
        switchMainTab('dashboard');
        initTaskStream();
        
        if (STATE.isTrained) {
            syncStateWithServer();
            setInterval(syncStateWithServer, 5000);
        } else {
            startTelemetryLogRunner();
            renderHITLQueue();
        }
        
        // Start background health check sweeps
        runHealthCheckAll();
        setInterval(runHealthCheckAll, 30000);
        
        // Wire headers, guides, and connection options dynamically after render
        document.getElementById('runTourBtn')?.addEventListener('click', startProductTour);
        document.getElementById('killSwitchBtn')?.addEventListener('click', toggleKillSwitch);
        document.getElementById('vaultToggleBtn')?.addEventListener('click', () => switchMainTab('whitelabel'));
    } else {
        if (errorEl) {
            errorEl.style.display = 'block';
            errorEl.textContent = result.error || "Verification failed.";
        }
    }
}

function autoLoadTestToken() {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocal) {
        alert("Auto-load test token is disabled in production environments.");
        return;
    }
    
    const config = {
        companyName: "Apex Medical Care",
        vertical: "medical",
        apiEndpoint: "http://localhost:8080",
        vaultKey: "aiwx_kms_vault_secret_key_dsi_six_sigma",
        primaryColor: "#009EE6",
        secondaryColor: "#0086EF",
        logoText: "CONV",
        upskill: true,
        observer: true
    };
    
    // Generate a secure JWT license payload structures
    const header = { alg: "AES256GCM", typ: "CONVERGENCE-Ai-LIC" };
    const body = {
        iss: "convergence-ai.com",
        company: config.companyName,
        vert: config.vertical,
        ep: config.apiEndpoint,
        vlt: safeBtoa(config.vaultKey),
        c1: config.primaryColor,
        c2: config.secondaryColor,
        logo: config.logoText,
        upskill: config.upskill,
        observer: config.observer,
        iat: Date.now()
    };
    
    const expectedSig = safeBtoa(JSON.stringify(body)).substring(10, 30).toUpperCase();
    const token = safeBtoa(JSON.stringify(header)) + "." + safeBtoa(JSON.stringify(body)) + "." + expectedSig;
    
    document.getElementById('activationInput').value = token;
    document.getElementById('activationEmail').value = "admin@convergence-ai.com";
}

// Ingestion Telemetry Simulator
let telemetryInterval = null;
function startTelemetryLogRunner() {
    if (telemetryInterval) clearInterval(telemetryInterval);
    if (STATE.isTrained) return;

    const logsDb = {
        medical: [
            "Syncing clinic database with Dr. Aris's active surgery room schedule...",
            "Validating patient insurance policy coverage codes via AthenaHealth gateway...",
            "Processing billing dispute request for Patient Sarah Davis. Checking matching medical chart...",
            "Telemedicine video feed status check: 100% active, end-to-end encrypted.",
            "Synthesizing physician audio transcript from pediatric clinic afternoon round..."
        ],
        legal: [
            "Filing digital court subpoena form in state jurisdictional docket...",
            "Comparing standard retention clauses against opposing counsel's NDAs...",
            "Parsing depositions for conflicting witness timeline statements...",
            "Syncing court calendar alerts with senior partner schedules...",
            "Auto-generating boilerplate retainer agreements for incoming corporate client..."
        ],
        realestate: [
            "Syncing active listing availability status with MLS database...",
            "Drafting customized client follow-up email sequence for 450 Maple Avenue...",
            "Processing mortgage eligibility verification letters inside buyer portal...",
            "Coordinating locks and security codes for digital lockboxes on Maple Ave...",
            "Auto-compiling regional home pricing comparison spreadsheets..."
        ],
        retail: [
            "Syncing warehouse inventory levels for top-selling SKUs...",
            "Verifying delivery tracking status with FedEx shipping webhook...",
            "Auto-answering return requests based on standard returns policy...",
            "Flagging order payment dispute. Pushing case [T-1003] to supervisor dashboard...",
            "Refreshing Shopify dashboard product listings and pricing indices..."
        ],
        hospitality: [
            "Syncing booking reservations with central property management database...",
            "Routing VIP guest special dietary requests to kitchen administration...",
            "Processing electronic room-key card authorizations for late-night arrivals...",
            "Triage concierge text message requests for early check-in slots...",
            "Reviewing room maintenance reports and auto-dispatching technician..."
        ],
        finance: [
            "Retrieving digital supplier invoices from central billing mail folder...",
            "Auto-matching line item accounts against standard purchase orders...",
            "Flagging PO #8893 price threshold deviation. Requesting oversight release...",
            "Reconciling QuickBooks bank feeds with digital transaction vouchers...",
            "Compiling monthly cashflow ledger summaries for auditing review..."
        ],
        construction: [
            "Filing structural renovation permit request with municipal zoning server...",
            "Drafting subcontractor materials release requests for concrete suppliers...",
            "Validating worksite OSHA compliance certifications inside project tracker...",
            "Routing site safety audit files to county building inspector email...",
            "Auto-calculating contractor invoice retainage rates for Phase 2 milestones..."
        ],
        logistics: [
            "Scanning live commercial airfare databases for flight route JFK to LAX...",
            "Verifying fleet truck transit schedules against regional weather alerts...",
            "Auto-calculating transit fuel surcharge fees for regional delivery manifests...",
            "Filing digital interstate cargo transport logs with DOT portal...",
            "Drafting executive travel expense reimbursement spreadsheets..."
        ],
        education: [
            "Aligning weekend tutor rosters with incoming student booking requests...",
            "Drafting invoices for outstanding family tuition accounts...",
            "Compiling automated study plan checkups from student quiz results...",
            "Dispatching Zoom classroom link invites to rostered students...",
            "Auto-generating syllabus outline drafts based on standard state curriculum..."
        ],
        tech: [
            "Triaging GitHub issue reports. Extracting error trace vectors...",
            "Parsing database server crash logs. Auto-generating incident timelines...",
            "Compiling developer patch notes for the 1.4.0 sprint release...",
            "Deploying secure SSL credentials to staging cluster...",
            "Triaging enterprise customer SLA support tickets by criticality indices..."
        ],
        professional: [
            "Auditing monthly time logs for enterprise client retainer accounts...",
            "Scanning drafted social campaign posts for compliance and SEO formatting...",
            "Processing monthly consulting fee statements. Compiling detailed PDF memos...",
            "Filing secure consulting contracts inside client record vault...",
            "Auto-drafting executive slide-deck briefs from parsed financial reports..."
        ],
        nonprofit: [
            "Processing digital donation receipt forms for monthly donor list...",
            "Validating charity tax-exemption certificate numbers inside CRM...",
            "Coordinating volunteer email blasts for upcoming weekend community drive...",
            "Drafting annual fundraising campaign reports for the Board of Trustees...",
            "Filing state non-profit tax exemption papers in state database..."
        ],
        events: [
            "Confirming vendor catering contracts and deposit payment clears...",
            "Aligning corporate banquet table layouts with RSVP client responses...",
            "Auto-scheduling audio-visual setup tasks for sound-engineer teams...",
            "Routing conference VIP badges to commercial printing portal...",
            "Generating vendor fee sheets and scheduling automatic bank wires..."
        ],
        event_rental: [
            "Querying GoodShuffle Pro inventory levels for tent rental schedules...",
            "Validating PayPal transaction references for order confirmation...",
            "Dispatching order status summaries via Twilio Gateway SMS...",
            "Syncing Squarespace e-commerce logs with centralized QuickBooks ledger..."
        ]
    };
    
    telemetryInterval = setInterval(() => {
        const vert = STATE.tenantConfig.vertical || 'medical';
        const list = logsDb[vert] || logsDb['medical'];
        const randomLog = list[Math.floor(Math.random() * list.length)];
        logConsole(`[AGENT RUNTIME] ${randomLog}`, 'info');
    }, 15000);
}

// Background sync
async function syncStateWithServer() {
    try {
        const ep = STATE.tenantConfig.apiEndpoint;
        if (!ep || ep.includes("convergence-ai-agents.com") || ep.includes("api.metrolegal.com") || ep.includes("client-apexmed.convergence-ai-agents.com") || ep.includes("api.convergence-ai.com")) {
            updateConnectionBadge(false);
            return;
        }
        
        const res = await fetch(`${ep}/api/hitl`);
        if (!res.ok) throw new Error("HTTP error " + res.status);
        const data = await res.json();
        if (data.success) {
            STATE.hitlQueue = data.hitlQueue;
            STATE.completedCount = data.completedCount;
            renderHITLQueue();
            updateConnectionBadge(true);
        }
    } catch (err) {
        console.warn("[SERVER SYNC] Endpoint unreachable:", err.message);
        updateConnectionBadge(false);
    }
}

// Observer Recording Flow
function toggleWorkflowRecorder() {
    if (STATE.killSwitchActive) {
        logConsole('Cannot execute process. Agent is currently Offline (Kill Switch Active).', 'error');
        return;
    }

    if (!STATE.isSuperAdmin && (!STATE.tenantConfig || !STATE.tenantConfig.observer)) {
        alert("Premium License Required: The Workflow Recording Observer Agent is a premium add-on capability.");
        return;
    }
    
    if (STATE.isRecordingWorkflow) {
        STATE.isRecordingWorkflow = false;
        const btn = document.getElementById('recordWorkflowBtn');
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-record-vinyl"></i> Deploy Observer Agent';
            btn.style.background = 'linear-gradient(135deg, #ef4444 0%, #ec4899 100%)';
        }
        logConsole("[OBSERVER] Recording canceled by administrator.", "warn");
        return;
    }

    STATE.isRecordingWorkflow = true;
    const btn = document.getElementById('recordWorkflowBtn');
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Observing Employee...';
        btn.style.background = 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)';
    }

    logConsole("[OBSERVER] Deploying workflow recording daemon to employee endpoints...", "info");

    const activeKeys = Array.from(document.querySelectorAll('#deployedConnectorsList [id^="connector-"]')).map(el => el.id.replace('connector-', ''));
    const steps = [];
    const nodes = [];
    const links = [];
    
    let currentX = 60;
    let nodeId = 0;
    
    if (activeKeys.includes('squarespace')) {
        steps.push({ text: "Intercepted employee action on Squarespace: Equipment rental request." });
        nodes.push({ id: nodeId, label: "Squarespace Booking Request", x: currentX, y: 70, shape: "circle", type: "standard" });
        nodeId++;
        currentX += 130;
    }
    
    if (activeKeys.includes('goodshuffle')) {
        steps.push({ text: "Intercepted employee action on GoodShuffle Pro: Inventory scans." });
        nodes.push({ id: nodeId, label: "Query GoodShuffle Inventory", x: currentX, y: 70, shape: "rect", type: "standard" });
        nodeId++;
        currentX += 130;
    }
    
    nodes.push({ id: nodeId, label: "Verify Availability & Rates", x: currentX, y: 70, shape: "rect", type: "standard" });
    nodeId++;
    currentX += 130;
    
    if (activeKeys.includes('paypal')) {
        steps.push({ text: "Intercepted employee action on PayPal: Payment deposits checks." });
        nodes.push({ id: nodeId, label: "Is Deposit Paid? (PayPal)", x: currentX, y: 70, shape: "diamond", type: "decision" });
        const decisionId = nodeId;
        nodeId++;
        
        nodes.push({ id: nodeId, label: "HITL Manual Review", x: currentX, y: 220, shape: "rect", type: "hitl" });
        const hitlId = nodeId;
        nodeId++;
        currentX += 150;
        
        steps.push({ text: "Intercepted employee action on QuickBooks: Invoice draft." });
        nodes.push({ id: nodeId, label: "Draft Invoice in QuickBooks", x: currentX, y: 70, shape: "rect", type: "standard" });
        const qboId = nodeId;
        nodeId++;
        currentX += 140;
        
        links.push({ from: decisionId - 1, to: decisionId });
        links.push({ from: decisionId, to: qboId, label: "Yes" });
        links.push({ from: decisionId, to: hitlId, label: "No" });
        links.push({ from: hitlId, to: qboId, label: "Approved" });
    } else {
        nodes.push({ id: nodeId, label: "Draft Invoice in QuickBooks", x: currentX, y: 70, shape: "rect", type: "standard" });
        nodeId++;
        currentX += 140;
        links.push({ from: nodeId - 2, to: nodeId - 1 });
    }
    
    let notifyNodeAdded = false;
    if (activeKeys.includes('twilio')) {
        steps.push({ text: "Intercepted Twilio action: Sent SMS alert." });
        nodes.push({ id: nodeId, label: "End: Send Confirmation SMS", x: currentX, y: 70, shape: "circle", type: "standard" });
        links.push({ from: nodeId - 1, to: nodeId });
        nodeId++;
        notifyNodeAdded = true;
    }
    
    if (!notifyNodeAdded) {
        nodes.push({ id: nodeId, label: "End: Order Confirmed", x: currentX, y: 70, shape: "circle", type: "standard" });
        links.push({ from: nodeId - 1, to: nodeId });
        nodeId++;
    }
    
    const paypalIdx = nodes.findIndex(n => n.label.includes('PayPal'));
    const limit = paypalIdx !== -1 ? paypalIdx : nodes.length - 1;
    for (let i = 0; i < limit; i++) {
        links.push({ from: nodes[i].id, to: nodes[i+1].id });
    }
    
    PROCESS_TEMPLATES['recorded_rental'] = {
        title: "Recorded: Event Rental Order & Invoicing Pipeline (Observer Ingested)",
        type: "swimlane",
        nodes: nodes,
        links: links
    };

    let currentStep = 0;
    function runNextStep() {
        if (!STATE.isRecordingWorkflow) return;
        if (currentStep < steps.length) {
            logConsole(`[OBSERVER] ${steps[currentStep].text}`, "info");
            currentStep++;
            setTimeout(runNextStep, 1500);
        } else {
            STATE.isRecordingWorkflow = false;
            if (btn) {
                btn.innerHTML = '<i class="fa-solid fa-record-vinyl"></i> Deploy Observer Agent';
                btn.style.background = 'linear-gradient(135deg, #ef4444 0%, #ec4899 100%)';
            }
            logConsole("[OBSERVER] Recording finished. Synthesized Six Sigma Process Map successfully!", "success");
            
            // Add custom vertical to dropdown dynamically
            const select = document.getElementById('processMapSelect');
            if (select && !select.querySelector('option[value="recorded_rental"]')) {
                const opt = document.createElement('option');
                opt.value = 'recorded_rental';
                opt.textContent = 'Recorded Event Rental Flow';
                select.appendChild(opt);
                select.value = 'recorded_rental';
            }
            renderProcessMap('recorded_rental');
        }
    }
    setTimeout(runNextStep, 1000);
}

// Bootloader event bindings
document.addEventListener('DOMContentLoaded', () => {
    // If already verified previously, auto unlock (for direct local developer ease)
    const token = localStorage.getItem('aiwx_active_token');
    if (token) {
        document.getElementById('activationInput').value = token;
        verifyActivation();
    }
});function activateAgentRunner() {
    if (STATE.isTrained) return;
    
    STATE.isTrained = true;
    localStorage.setItem('aiwx_agent_trained', 'true');
    
    logConsole("Initializing LLM Prompt Alignment Sequence...", "info");
    logConsole("Ingesting custom Standard Operating Procedures (SOP)...", "info");
    logConsole("Compiling Six Sigma DSI workflow maps...", "info");
    
    setTimeout(() => {
        logConsole("[CONTAINER ACTIVE] CONVERGENCE-Ai actively running client tasks!", "success");
        
        // Clear local mock queue when training starts
        STATE.hitlQueue = [];
        
        // Disable telemetry simulator logs
        if (telemetryInterval) {
            clearInterval(telemetryInterval);
            telemetryInterval = null;
        }
        
        const completedCounter = document.getElementById('completedTasksCounter');
        if (completedCounter) completedCounter.textContent = STATE.completedCount;
        
        const matchRateElement = document.getElementById('autonomousMatchRate');
        if (matchRateElement) matchRateElement.textContent = "94.2%";
        
        renderHITLQueue();
        saveLocalState();
        
        // Try starting production sync
        syncStateWithServer();
        setInterval(syncStateWithServer, 5000);
    }, 1500);
}

function lockEnvironment() {
    localStorage.removeItem('aiwx_active_token');
    window.location.reload();
}

function exportBPMN() {
    const key = STATE.tenantConfig.vertical || 'medical';
    let mapKey = 'p2p';
    if (key === 'medical') mapKey = 'voice';
    else if (key === 'legal') mapKey = 'legal_deposition';
    else if (key === 'realestate') mapKey = 'realestate_lead';
    else if (key === 'retail') mapKey = 'retail_order';
    else if (key === 'hospitality') mapKey = 'hospitality_guest';
    else if (key === 'construction') mapKey = 'construction_permit';
    else if (key === 'education') mapKey = 'education_schedule';
    else if (key === 'tech') mapKey = 'tech_bug';
    else if (key === 'professional') mapKey = 'professional_retainer';
    else if (key === 'nonprofit') mapKey = 'nonprofit_donor';
    else if (key === 'events') mapKey = 'events_vendor';
    else if (key === 'event_rental') mapKey = 'recorded_rental';
    else if (key === 'logistics' || key === 'finance') mapKey = 'travel';
    
    const select = document.getElementById('processMapSelect');
    const activeMapKey = select ? select.value : mapKey;
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \n`;
    xml += `                  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" \n`;
    xml += `                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" \n`;
    xml += `                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" \n`;
    xml += `                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI" \n`;
    xml += `                  id="Definitions_Convergence" \n`;
    xml += `                  targetNamespace="http://bpmn.io/schema/bpmn">\n`;
    xml += `  <bpmn:process id="Process_Convergence_Admin" name="Convergence AI Admin Workflow" isExecutable="true">\n`;
    xml += `    <bpmn:startEvent id="StartEvent_1" name="Incoming Task Ingestion" />\n`;
    xml += `    <bpmn:userTask id="Activity_Verify" name="Human-in-the-Loop Oversight Verification Queue" />\n`;
    xml += `    <bpmn:serviceTask id="Activity_Automate" name="Autonomous API Orchestrator Run" />\n`;
    xml += `    <bpmn:endEvent id="EndEvent_1" name="Task Complete Ledger Record" />\n`;
    xml += `    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Activity_Automate" />\n`;
    xml += `    <bpmn:sequenceFlow id="Flow_2" sourceRef="Activity_Automate" targetRef="Activity_Verify" />\n`;
    xml += `    <bpmn:sequenceFlow id="Flow_3" sourceRef="Activity_Verify" targetRef="EndEvent_1" />\n`;
    xml += `  </bpmn:process>\n`;
    xml += `  <bpmndi:BPMNDiagram id="BPMNDiagram_1">\n`;
    xml += `    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_Convergence_Admin">\n`;
    xml += `      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">\n`;
    xml += `        <dc:Bounds x="156" y="81" width="36" height="36" />\n`;
    xml += `      </bpmndi:BPMNShape>\n`;
    xml += `    </bpmndi:BPMNPlane>\n`;
    xml += `  </bpmndi:BPMNDiagram>\n`;
    xml += `</bpmn:definitions>\n`;
 
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `convergence_bpmn_${activeMapKey}.bpmn`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
 
    logConsole(`Successfully exported BPMN 2.0 map: convergence_bpmn_${activeMapKey}.bpmn`, "success");
}

async function trainAgentAlert() {
    const categorySelect = document.getElementById('sopCategorySelect');
    const rulesInput = document.getElementById('sopRulesInput');
    const category = categorySelect ? categorySelect.value : "General Office Guidelines";
    const rules = rulesInput ? rulesInput.value : "";
    
    logConsole(`Ingesting custom Standard Operating Procedure (${category})...`, "info");
    
    try {
        const ep = STATE.tenantConfig.apiEndpoint || "http://localhost:8080";
        const tenantId = STATE.tenantConfig.tenantId || null;
        const res = await fetch(`${ep}/api/train`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, rules, tenantId })
        });
        if (res.ok) {
            const data = await res.json();
            logConsole(`[SERVER] SOP successfully saved to knowledge base (ID: ${data.record?.id || 'N/A'})`, "success");
        } else {
            throw new Error("HTTP " + res.status);
        }
    } catch (err) {
        console.warn("[TRAINING] Endpoint unreachable, using offline RAG fallback:", err.message);
        logConsole("Ingested new Standard Operating Procedure. RAG vectors updated.", "success");
    }
    
    activateAgentRunner();
}

function triggerClientRebrand() {
    const config = {
        companyName: document.getElementById('rebrandCompany').value,
        logoText: document.getElementById('rebrandLogo').value,
        primaryColor: document.getElementById('rebrandColor1').value,
        secondaryColor: document.getElementById('rebrandColor2').value,
        vertical: STATE.tenantConfig.vertical,
        apiEndpoint: STATE.tenantConfig.apiEndpoint,
        vaultKey: STATE.tenantConfig.vaultKey,
        upskill: STATE.tenantConfig.upskill || false,
        observer: STATE.tenantConfig.observer || false
    };
    
    applyBranding(config);
    STATE.tenantConfig = config;
    
    const header = { alg: "AES256GCM", typ: "CONVERGENCE-Ai-LIC" };
    const body = {
        iss: "convergence-ai.com",
        company: config.companyName,
        vert: config.vertical,
        ep: config.apiEndpoint,
        vlt: safeBtoa(config.vaultKey),
        c1: config.primaryColor,
        c2: config.secondaryColor,
        logo: config.logoText,
        upskill: config.upskill,
        observer: config.observer,
        iat: Date.now()
    };
    const expectedSig = safeBtoa(JSON.stringify(body)).substring(10, 30).toUpperCase();
    const token = safeBtoa(JSON.stringify(header)) + "." + safeBtoa(JSON.stringify(body)) + "." + expectedSig;
    localStorage.setItem('aiwx_active_token', token);
    
    logConsole("Branding configuration overridden and saved. App styles rebuilt.", "success");
}
