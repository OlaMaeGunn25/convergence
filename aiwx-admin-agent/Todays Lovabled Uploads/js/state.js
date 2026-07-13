/*
   CONVERGENCE-Ai™ State Management Module
   Provides standalone reactive state persistence and change notifications.
*/

export const STATE = {
    isSuperAdmin: false,
    isActivated: false,
    isTrained: false,
    tenantConfig: {
        companyName: "CONVERGENCE-Ai Cloud-Native AI Automations Hub",
        vertical: "medical",
        licenseKey: "",
        apiEndpoint: "https://api.convergence-ai.com/v1",
        vaultKey: "",
        primaryColor: "#009EE6",
        secondaryColor: "#0086EF",
        logoText: "CONVERGENCE",
        hitlMode: true,
        upskill: false,
        observer: false
    },
    hitlQueue: [],
    completedCount: 0,
    activeProcessKey: "p2p",
    activeProcessNode: 0,
    processTimer: null,
    campaignFeedUrl: "https://zdkwrglsqrueolrshukh.supabase.co/functions/v1/blog-rss",
    campaignLaunchDate: "2026-06-01",
    syncedArticles: [],
    approvedHistory: [],
    isRecordingWorkflow: false,
    killSwitchActive: false,
    analytics: {
        taskLog: [],
        sessionStart: new Date().toISOString(),
        metrics: {
            totalTasksProcessed: 0,
            totalApproved: 0,
            totalRejected: 0,
            totalAutoResolved: 0,
            avgResolutionTimeMs: 0,
            slaBreaches: 0,
            byVertical: {},
            byIntegration: {},
            hourlyThroughput: []
        }
    }
};

const listeners = new Set();

export function subscribe(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
}

export function updateState(property, value) {
    if (STATE[property] !== value) {
        STATE[property] = value;
        listeners.forEach(cb => cb(property, value));
        saveLocalState();
    }
}

export function saveLocalState() {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('aiwx_agent_trained', STATE.isTrained ? 'true' : 'false');
    localStorage.setItem('aiwx_completed_count', STATE.completedCount.toString());
    localStorage.setItem('aiwx_hitl_queue', JSON.stringify(STATE.hitlQueue));
    
    // Sanitize tenantConfig: remove sensitive keys before saving to local storage
    const sanitizedConfig = { ...STATE.tenantConfig };
    delete sanitizedConfig.llmApiKey;
    delete sanitizedConfig.vaultKey;
    localStorage.setItem('aiwx_tenant_config', JSON.stringify(sanitizedConfig));
    
    localStorage.setItem('aiwx_approved_history', JSON.stringify(STATE.approvedHistory));
    localStorage.setItem('aiwx_kill_switch', STATE.killSwitchActive ? 'true' : 'false');
    if (STATE.analytics) {
        localStorage.setItem('aiwx_analytics', JSON.stringify(STATE.analytics));
    }
}

export function loadLocalState() {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem('aiwx_agent_trained') === 'true') {
        STATE.isTrained = true;
    }
    const savedCount = localStorage.getItem('aiwx_completed_count');
    if (savedCount !== null) {
        STATE.completedCount = parseInt(savedCount, 10);
    }
    const savedQueue = localStorage.getItem('aiwx_hitl_queue');
    if (savedQueue !== null) {
        try {
            STATE.hitlQueue = JSON.parse(savedQueue);
        } catch (e) {
            console.error("Failed to parse hitl queue from localStorage", e);
        }
    }
    const savedConfig = localStorage.getItem('aiwx_tenant_config');
    if (savedConfig !== null) {
        try {
            STATE.tenantConfig = JSON.parse(savedConfig);
        } catch (e) {
            console.error("Failed to parse tenant config from localStorage", e);
        }
    }
    const savedHistory = localStorage.getItem('aiwx_approved_history');
    if (savedHistory !== null) {
        try {
            STATE.approvedHistory = JSON.parse(savedHistory);
        } catch (e) {
            console.error("Failed to parse approved history from localStorage", e);
        }
    }
    if (localStorage.getItem('aiwx_kill_switch') === 'true') {
        STATE.killSwitchActive = true;
    }
    const savedAnalytics = localStorage.getItem('aiwx_analytics');
    if (savedAnalytics !== null) {
        try {
            STATE.analytics = JSON.parse(savedAnalytics);
        } catch (e) {
            console.error("Failed to parse analytics from localStorage", e);
        }
    }
}

// Initial boot load
loadLocalState();

export const DEMO_SEED_TASKS = [
    { id: "T-1002", vertical: "medical", type: "Patient Scheduling Dispute", details: "Fielded patient dispute call. Automatically reschedule Dr. Aris's 3:00 PM surgery appointment with Patient Sarah Davis to Tuesday at 10:00 AM.", status: "pending", time: "Just Now", action: "Reschedule Calendar & Email Confirmation", progress: 45 },
    { id: "T-1003", vertical: "finance", type: "Procure-to-Pay Invoice", details: "Supplier invoice received from Acmax Corp. Amount: $4,850.00. Match status: PO #8893 matched. Ready for ledger posting and ACH release.", status: "pending", time: "2 mins ago", action: "Release ACH Payment & Post to QuickBooks", progress: 85 },
    { id: "T-1004", vertical: "logistics", type: "Travel Flight Routing", details: "Booking flight route JFK to LAX for Exec John Miller. Carrier: Delta Flight DL42. Price: $620.00. Expense report draft prepared.", status: "pending", time: "15 mins ago", action: "Purchase Flight Ticket & Send Invoice", progress: 30 },
    { id: "T-1005", vertical: "realestate", type: "Lead Follow-up Draft", details: "Drafted follow-up contract and appointment confirmation email for buyer of 450 Maple Avenue.", status: "pending", time: "45 mins ago", action: "Send Email & Schedule Home Showing", progress: 50 },
    { id: "T-1006", vertical: "professional", type: "Social Post Release Audit", details: "Drafted LinkedIn educational post for Tier 1 AI Starter Sprint. Verified SEO keywords ('AI for small business', 'business automation') and platform spacing. Ready for publish.", status: "pending", time: "1 min ago", action: "Release to LinkedIn, Instagram, and Threads", progress: 75 },
    { id: "T-1007", vertical: "event_rental", type: "Squarespace Checkout Sync", details: "Squarespace order #4592 received for '30x40 Tent Rental'. Cross-checking availability in GoodShuffle Pro. Client payment verified via PayPal.", status: "pending", time: "Just Now", action: "Sync Squarespace Order to GoodShuffle & Log PayPal Transaction", progress: 65 }
];

export function seedDemoData() {
    STATE.hitlQueue = JSON.parse(JSON.stringify(DEMO_SEED_TASKS));
    saveLocalState();
}

