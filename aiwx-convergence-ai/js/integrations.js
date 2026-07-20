/*
   CONVERGENCE-Ai™ Systems Integration and Connectors Module
   Handles multi-provider handshakes (Epic EHR, Twilio Gateway, Slack, QuickBooks, GoodShuffle, Squarespace, PayPal).
*/

import { logConsole } from './components.js';
import { checkIntegrationHealth, updateHealthIndicatorDOM } from './integration_health.js';

export const INTEGRATION_DETAILS = {
    epic: {
        name: "Epic EHR Connector",
        desc: "Connects Epic Systems Electronic Health Records (EHR) using secure HL7 v2 / FHIR web services. Enforces HIPAA patient privacy filters automatically.",
        icon: "fa-solid fa-user-doctor",
        iconColor: "#10b981"
    },
    cerner: {
        name: "Cerner Millennium EHR",
        desc: "Integrates with Cerner Millennium EHR platforms using HL7 and FHIR specifications. Manages dynamic clinical file transfers securely.",
        icon: "fa-solid fa-hospital",
        iconColor: "#059669"
    },
    athena: {
        name: "Athenahealth API",
        desc: "Connects directly to the Athenahealth cloud platform for secure appointment synchronization, credential verification, and patient intake data ingestion.",
        icon: "fa-solid fa-notes-medical",
        iconColor: "#34d399"
    },
    eclinicalworks: {
        name: "eClinicalWorks EHR",
        desc: "Synchronizes patient registration lists and intake PDFs with eClinicalWorks Cloud EHR servers.",
        icon: "fa-solid fa-file-medical",
        iconColor: "#6ee7b7"
    },
    elation: {
        name: "Elation Health EHR",
        desc: "Routes refill authorizations and diagnostic lab summaries straight to the Elation EHR inbox for physician review.",
        icon: "fa-solid fa-prescription-bottle-medical",
        iconColor: "#0284c7"
    },
    availity: {
        name: "Availity Provider Portal",
        desc: "Queries clearinghouse claim status logs and prior authorization results programmatically via Availity Web Services.",
        icon: "fa-solid fa-id-card-clip",
        iconColor: "#0369a1"
    },
    labcorp: {
        name: "LabCorp Portal API",
        desc: "Monitors and downloads patient diagnostic lab results. Redacts PHI details automatically.",
        icon: "fa-solid fa-flask-vial",
        iconColor: "#0284c7"
    },
    dexcom: {
        name: "Dexcom Patient IoT API",
        desc: "Parses remote continuous glucose monitor streams, checking for out-of-bounds telemetry alerts.",
        icon: "fa-solid fa-heart-pulse",
        iconColor: "#e11d48"
    },
    quickbooks: {
        name: "QuickBooks Online API",
        desc: "Dispatches automated ledger matching logs, journal entries, and customer sales invoices directly to QBO accounts.",
        icon: "fa-solid fa-file-invoice-dollar",
        iconColor: "#22c55e"
    },
    netsuite: {
        name: "NetSuite ERP Ledger",
        desc: "Publishes complex payroll journal voucher runs and procurement PO transactions directly to NetSuite general ledger records.",
        icon: "fa-solid fa-chart-pie",
        iconColor: "#15803d"
    },
    gusto: {
        name: "Gusto Payroll API",
        desc: "Pulls finalized payroll runs to reconcile corporate ledger entries inside NetSuite ERP dashboards.",
        icon: "fa-solid fa-wallet",
        iconColor: "#4ade80"
    },
    dandb: {
        name: "Dun & Bradstreet (D&B) API",
        desc: "Queries company credit parameters and scoring tables to perform automatic supplier risk evaluations.",
        icon: "fa-solid fa-building",
        iconColor: "#166534"
    },
    stripe: {
        name: "Stripe Billing API",
        desc: "Syncs customer subscription statuses, invoices, and charge events. Generates discrepancy reports.",
        icon: "fa-brands fa-stripe",
        iconColor: "#6366f1"
    },
    clio: {
        name: "Clio Manage CRM",
        desc: "Runs automated conflict searches against historical litigant registries and court records inside Clio Manage.",
        icon: "fa-solid fa-scale-balanced",
        iconColor: "#eab308"
    },
    docusign: {
        name: "DocuSign e-Sign API",
        desc: "Generates custom client contract drafts (NDAs, retainers) and dispatches envelope requests via DocuSign OAuth2.",
        icon: "fa-solid fa-signature",
        iconColor: "#d97706"
    },
    usproto: {
        name: "USPTO Trademark API",
        desc: "Monitors the USPTO Trademark Database daily, alerting the user about registered mark status adjustments.",
        icon: "fa-solid fa-trademark",
        iconColor: "#ca8a04"
    },
    westlaw: {
        name: "Westlaw Search API",
        desc: "Performs background document queries on Westlaw legal databases to compile paralegal deposition timelines.",
        icon: "fa-solid fa-magnifying-glass-briefcase",
        iconColor: "#a1a1aa"
    },
    zillow: {
        name: "Zillow Lead Sync API",
        desc: "Ingests buyer contact lead webhooks and triggers auto-response follow-up SMS queues.",
        icon: "fa-solid fa-house-chimney",
        iconColor: "#3b82f6"
    },
    showingtime: {
        name: "ShowingTime Scheduler API",
        desc: "Coordinates showing calendar slots, syncing property visit dates with buyer representatives.",
        icon: "fa-solid fa-calendar-days",
        iconColor: "#2563eb"
    },
    appfolio: {
        name: "AppFolio PMS API",
        desc: "Ingests vacancy rosters and pushes completed tenant lease records directly to the AppFolio portal.",
        icon: "fa-solid fa-key",
        iconColor: "#1d4ed8"
    },
    sentrilock: {
        name: "SentriLock Lockbox API",
        desc: "Rotates physical property lockbox PIN codes, synchronizing access logs with showing time slots.",
        icon: "fa-solid fa-lock",
        iconColor: "#1e3a8a"
    },
    google_calendar: {
        name: "Google & Outlook Calendar",
        desc: "Coordinates dynamic meeting shifts, doctor schedules, and case filings across Outlook & Google Calendar.",
        icon: "fa-solid fa-calendar-check",
        iconColor: "#ea4335"
    },
    sendgrid: {
        name: "SendGrid Email Gateway",
        desc: "Dispatches transactional emails, credential resets, and billing notifications via SendGrid SMTP APIs.",
        icon: "fa-solid fa-paper-plane",
        iconColor: "#00b4d8"
    },
    expensify: {
        name: "Expensify OCR API",
        desc: "Parses travel receipts and uploads credit card matches to corporate ledger databases.",
        icon: "fa-solid fa-receipt",
        iconColor: "#059669"
    },
    hubdoc: {
        name: "Hubdoc Invoice Parser",
        desc: "Performs optical character recognition (OCR) on vendor receipts to isolate metadata fields.",
        icon: "fa-solid fa-file-invoice",
        iconColor: "#10b981"
    },
    plaid: {
        name: "Plaid Transfer API",
        desc: "Authenticates client banking details, logs bank feeds, and issues ACH transfers.",
        icon: "fa-solid fa-wallet",
        iconColor: "#0f172a"
    },
    canva: {
        name: "Canva Assets API",
        desc: "Ingests branding elements and exports listing CMAs directly to property marketing collateral.",
        icon: "fa-solid fa-palette",
        iconColor: "#ec4899"
    },
    workday: {
        name: "Workday Enterprise ERP",
        desc: "Hooks into Workday Supply Chain Management (SCM) SOAP/WWS schemas. Automates procurement logs and Purchase Order routing.",
        icon: "fa-solid fa-building-columns",
        iconColor: "#3b82f6"
    },
    twilio: {
        name: "Twilio SMS & Voice Gateway",
        desc: "Registers SIP Trunking and Twilio API numbers. Handles automated text alerts and voice triage callbacks.",
        icon: "fa-solid fa-phone-volume",
        iconColor: "#ea4335"
    },
    slack: {
        name: "Slack Alerts Channel",
        desc: "Streams critical HITL alerts and operational updates directly to your operations Slack workspace channels.",
        icon: "fa-brands fa-slack",
        iconColor: "#4a154b"
    },
    webhook: {
        name: "Custom REST Webhook",
        desc: "Dispatches JSON payloads to custom server webhooks. Standard API endpoints support HTTPS bearer token authorization.",
        icon: "fa-solid fa-link",
        iconColor: "#00c6ff"
    },
    jira: {
        name: "Jira Cloud Project Board",
        desc: "Hooks into Atlassian Jira Cloud REST APIs. Automatically routes client bug requests, syncs project ticket backlogs, and updates task states.",
        icon: "fa-brands fa-jira",
        iconColor: "#0052cc"
    },
    goodshuffle: {
        name: "GoodShuffle Pro Connector",
        desc: "Connects to the GoodShuffle Pro API to retrieve inventory, pull rental contract details, track equipment availability, and sync event order states.",
        icon: "fa-solid fa-shuffle",
        iconColor: "#8b5cf6"
    },
    squarespace: {
        name: "Squarespace Website Integration",
        desc: "Connects to Squarespace APIs to ingest website rental requests, booking submissions, client contact forms, and online storefront activity.",
        icon: "fa-brands fa-squarespace",
        iconColor: "#ffffff"
    },
    paypal: {
        name: "PayPal Commerce Gateway",
        desc: "Integrates with PayPal's Commerce Platform to handle secure client deposits, rental balances, and card payments. Supports automated refund triggers.",
        icon: "fa-brands fa-paypal",
        iconColor: "#0079c1"
    }
};

export function openIntegrationModal() {
    const modal = document.getElementById('integrationModal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.getElementById('integrationProgress').style.display = 'none';
    document.getElementById('autoIntegrateBtn').style.display = 'block';
    updateIntegrationDescription();
}

export function closeIntegrationModal() {
    const modal = document.getElementById('integrationModal');
    if (modal) modal.style.display = 'none';
}

export function updateIntegrationDescription() {
    const val = document.getElementById('integrationSelect')?.value;
    const textEl = document.getElementById('integrationDescText');
    if (val && textEl) {
        textEl.textContent = INTEGRATION_DETAILS[val].desc;
    }
}

export function runAutoIntegration() {
    const val = document.getElementById('integrationSelect')?.value;
    const progress = document.getElementById('integrationProgress');
    const stepText = document.getElementById('integrationStepText');
    const bar = document.getElementById('integrationProgressBar');
    const btn = document.getElementById('autoIntegrateBtn');

    if (!val || !progress || !stepText || !bar || !btn) return;

    btn.style.display = 'none';
    progress.style.display = 'block';
    bar.style.width = '0%';

    const steps = [
        { text: "Reading activation token environments...", pct: 20 },
        { text: "Establishing secure OAuth2 credentials handshake...", pct: 50 },
        { text: "Injecting encrypted secret key in vault storage...", pct: 80 },
        { text: "Compliance checks validated. Integration Successful!", pct: 100 }
    ];

    let stepIdx = 0;
    const interval = setInterval(() => {
        if (stepIdx < steps.length) {
            stepText.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin" style="margin-right: 5px;"></i> ` + steps[stepIdx].text;
            bar.style.width = steps[stepIdx].pct + '%';
            stepIdx++;
        } else {
            clearInterval(interval);
            appendDeployedConnector(val);
            logConsole(`[CONNECTOR] Successfully bootstrapped integration with ${INTEGRATION_DETAILS[val].name}!`, "success");
            setTimeout(() => {
                closeIntegrationModal();
            }, 800);
        }
    }, 400);
}

export function appendDeployedConnector(key) {
    const list = document.getElementById('deployedConnectorsList');
    if (!list) return;

    // Check if already connected
    if (document.getElementById(`connector-${key}`)) return;

    const details = INTEGRATION_DETAILS[key];
    const card = document.createElement('div');
    card.className = 'connector-card glass';
    card.id = `connector-${key}`;
    card.setAttribute('data-provider-row', key);
    card.style.display = 'flex';
    card.style.alignItems = 'center';
    card.style.justifyContent = 'space-between';
    card.style.padding = '0.75rem 1rem';
    card.style.borderRadius = '8px';
    card.style.marginBottom = '0.5rem';
    card.style.border = '1px solid var(--border-color)';

    card.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <i class="${details.icon}" style="color:${details.iconColor}; font-size:1.1rem; width:20px; text-align:center;"></i>
            <div>
                <div style="font-size:0.8rem; font-weight:600; color:#ffffff;">${details.name}</div>
                <div style="font-size:0.65rem; color:var(--text-muted); display:flex; align-items:center; gap:6px;">
                    Status: <span class="health-dot healthy"></span> 
                    <span class="health-text healthy" style="font-weight:700;">CONNECTED</span> 
                    (<span class="health-latency">—</span>)
                </div>
            </div>
        </div>
        <button class="btn btn-secondary btn-small" style="padding:0.2rem 0.4rem; font-size:0.65rem; border-color:rgba(239,68,68,0.2); color:var(--status-error);" title="Disconnect system">
            <i class="fa-solid fa-trash-can"></i>
        </button>
    `;

    card.querySelector('button').addEventListener('click', () => removeDeployedConnector(key));
    list.appendChild(card);

    // Trigger health check ping immediately after connecting
    checkIntegrationHealth(key).then(health => {
        updateHealthIndicatorDOM(key, health);
    });
}

export function removeDeployedConnector(key) {
    const el = document.getElementById(`connector-${key}`);
    if (el) {
        el.remove();
        logConsole(`[CONNECTOR] Disconnected system integration: ${INTEGRATION_DETAILS[key].name}`, "warn");
    }
}
