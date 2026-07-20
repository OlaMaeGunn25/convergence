/*
   CONVERGENCE-Ai™ Search Indexing and Auto-Complete Module
   Implements a lightweight client-side TF-IDF keyword search engine across SOPs and help documentation.
*/

import { logConsole } from './components.js';

// Structured search corpus mapping categories and keywords
export const SOP_CORPUS = [
    {
        id: "module-1",
        title: "Module 1: Client Pre-Conditions Check",
        category: "Onboarding Manual",
        content: "Before deploying the container system, walk the client's IT administrator through this technical prerequisite list: Dedicated Virtual Machine or Docker environment (2 vCPU, 4GB RAM minimum). Active SSL termination mapping to a domain (e.g. assistant.client.com). Direct developer API keys for OpenAI/Claude, QuickBooks, and Twilio. Enforce HIPAA audit logs and patient record safeguards.",
        keywords: ["vm", "docker", "ssl", "prerequisite", "api keys", "twilio", "quickbooks", "hipaa", "onboarding"]
    },
    {
        id: "module-2",
        title: "Module 2: The Licensing Activation Key",
        category: "Onboarding Manual",
        content: "To enforce strict single-vertical licensing boundaries for each tenant, configure the credentials on your central Deployment Hub: Select the client's single authorized industry vertical from the menu. Define custom branding colors (primary and secondary accents matching their business logo). Generate the Base64 Activation Token and provide it to the client administrator. This token contains encrypted parameters for KMS key vault decryption.",
        keywords: ["licensing", "activation", "token", "deployment hub", "base64", "kms", "key vault", "rebrand"]
    },
    {
        id: "module-3",
        title: "Module 3: Client Workspace Activation",
        category: "Onboarding Manual",
        content: "Explain how the client accesses their new secure control room: Open their index entrypoint page, which initially displays the Vault Lock Modal. Paste the Activation Token to authorize container services and dynamically lock the vertical. Bypassing activation requires administrative credentials matching the super-admin pattern or using a local test token.",
        keywords: ["vault lock", "modal", "activate", "unlock", "super admin", "token", "test token"]
    },
    {
        id: "module-4",
        title: "Module 4: Interactive Process Mapping Audit",
        category: "Onboarding Manual",
        content: "Leverage the Process Mapping canvas during consultant audit sessions: Map manual steps into a SIPOC or Swimlane cross-functional diagram. Emphasize how the agent intercepts risk at the Human-in-the-Loop check point. Render dynamic nodes showing state transition progress, node types (decision, hitl, standard), and linkages.",
        keywords: ["process mapping", "canvas", "sipoc", "swimlane", "hitl", "oversight", "diagram", "six sigma"]
    },
    {
        id: "module-5",
        title: "Module 5: Scalable Cloud Architecture & Dual-Deployment Models",
        category: "Onboarding Manual",
        content: "For standard SMB clients with zero technical departments, run their container VM securely inside your own Google Cloud Platform (GCP) account: Bind a dedicated subdomain (e.g. clientname.convergence-ai-agents.com). Deliver the login URL and their encrypted KMS activation token. For larger clients, support client-owned cloud deployments on AWS, GCP, Azure, or private servers using pre-packaged Docker compose manifests.",
        keywords: ["cloud", "architecture", "gcp", "subdomain", "docker compose", "aws", "azure", "self-hosted"]
    },
    {
        id: "vertical-medical",
        title: "Medical & Healthcare Business Vertical",
        category: "Vertical SOPs",
        content: "SOP guidelines for Medical clinical automation: Connect Epic Systems EHR using secure HL7 v2 / FHIR APIs. Enable automatic HIPAA privacy filters to mask patient records and PII. Voice routing is handled via Twilio voice gateways and Speech-to-Text transcription. Typical tasks include: Reschedule surgery appointments, dispatch triage alerts, and generate clinical billing checks.",
        keywords: ["medical", "healthcare", "epic", "ehr", "hl7", "fhir", "hipaa", "pii", "triage", "scheduling"]
    },
    {
        id: "vertical-legal",
        title: "Legal Services Business Vertical",
        category: "Vertical SOPs",
        content: "SOP guidelines for Legal automation: Integrate with Salesforce CRM and CLM systems. Automatically execute automated conflict searches across historical litigation files. Draft deposition schedules and coordinate filing documents. Emphasize human attorney review (HITL) before submitting official briefs to the court.",
        keywords: ["legal", "salesforce", "conflict search", "deposition", "filing", "briefs", "attorney", "clm"]
    },
    {
        id: "vertical-finance",
        title: "Financial & Bookkeeping Business Vertical",
        category: "Vertical SOPs",
        content: "SOP guidelines for Financial automation: Connect to QuickBooks Online API using OAuth2 protocol. Ingest purchase orders (PO) and perform double-entry ledger matching. Enforce SOX transaction validation rules. Typical tasks include: Release ACH wire transfers, reconcile bank feeds, and process PayPal payments.",
        keywords: ["finance", "bookkeeping", "quickbooks", "ledger", "sox", "ach", "reconciliation", "paypal"]
    },
    {
        id: "vertical-retail",
        title: "Retail & E-Commerce Business Vertical",
        category: "Vertical SOPs",
        content: "SOP guidelines for Retail automation: Connect Squarespace online storefront and Shopify backends. Listen to checkout webhooks and update inventory databases. Typical tasks include: Sync orders, dispatch tracking emails, flag suspicious transaction sizes, and trigger refunds.",
        keywords: ["retail", "ecommerce", "squarespace", "shopify", "checkout", "webhook", "inventory", "orders"]
    },
    {
        id: "vertical-event-rental",
        title: "Event & Party Rentals Business Vertical",
        category: "Vertical SOPs",
        content: "SOP guidelines for Event Rental automation: Connect GoodShuffle Pro API to query equipment availability. Sync Squarespace customer checkout forms. Typical tasks include: Cross-check tent and chair inventory availability, draft rental agreements, and schedule dispatch crews.",
        keywords: ["event rental", "goodshuffle", "inventory", "availability", "checkout", "agreements", "scheduling"]
    },
    {
        id: "help-killswitch",
        title: "Agent Kill Switch & Safety Shut Off",
        category: "Help Documentation",
        content: "The red Shut Off Agent button in the header serves as the safety Kill Switch. Clicking it immediately halts all active background automation runners, sets the Starburst indicator to RED, and pauses pending API updates. Resume operation by entering administrative bypass tokens.",
        keywords: ["kill switch", "shut off", "pause", "safety", "starburst", "red"]
    },
    {
        id: "help-hitl",
        title: "Human-in-the-Loop (HITL) Queue & Governance",
        category: "Help Documentation",
        content: "The Operations Panel lists tasks requiring human approval. Actions: Approve (releases the task payload to integrations), AI Compose (triggers dynamic LLM-driven draft drafting with utility markup pricing), Reject/Revise (logs directive and alerts the agent to rewrite), Auto-Correct (triggers background script compliance normalization). Approved tasks can be reversed in the Reversal History logs.",
        keywords: ["hitl", "oversight", "approve", "reject", "reverse", "rollback", "auto-correct", "ai compose", "draft"]
    },
    {
        id: "module-6",
        title: "Module 6: Live LLM & AI Compose Gateway",
        category: "Onboarding Manual",
        content: "To unlock cognitive capabilities and automated drafting in the HITL queue, configure the LLM Integration parameters: Select a provider (Gemini, OpenAI, Claude, or local Ollama), map the target model version, and enter secure encrypted API credentials. Specify the reseller invoice markup percent to automatically calculate pass-through token costs for client billing. Administrators can use the 'AI Compose' action inside the HITL queue to invoke model drafts and review calculated costs before applying edits to tasks.",
        keywords: ["llm", "ai compose", "gemini", "openai", "claude", "ollama", "markup", "billing", "token", "draft", "cost"]
    }
];

let searchIndex = {};

export function buildSearchIndex() {
    searchIndex = {};
    SOP_CORPUS.forEach(doc => {
        const text = `${doc.title} ${doc.category} ${doc.content} ${doc.keywords.join(' ')}`.toLowerCase();
        const tokens = text.match(/\b\w+\b/g) || [];
        
        tokens.forEach(token => {
            if (token.length < 3) return; // skip very short words
            if (!searchIndex[token]) {
                searchIndex[token] = [];
            }
            if (!searchIndex[token].includes(doc.id)) {
                searchIndex[token].push(doc.id);
            }
        });
    });
}

export function search(query) {
    if (!query) return [];
    
    const tokens = query.toLowerCase().match(/\b\w+\b/g) || [];
    const scores = {};
    
    tokens.forEach(token => {
        if (token.length < 3) return;
        
        // Find matching tokens in index
        const matchedDocs = searchIndex[token] || [];
        matchedDocs.forEach(docId => {
            scores[docId] = (scores[docId] || 0) + 1;
        });
        
        // Boost scores if token matches keywords directly
        SOP_CORPUS.forEach(doc => {
            if (doc.keywords.includes(token)) {
                scores[doc.id] = (scores[doc.id] || 0) + 3;
            }
            if (doc.title.toLowerCase().includes(token)) {
                scores[doc.id] = (scores[doc.id] || 0) + 2;
            }
        });
    });
    
    // Sort and return full doc objects
    const results = Object.keys(scores)
        .map(id => {
            const doc = SOP_CORPUS.find(d => d.id === id);
            return {
                ...doc,
                score: scores[id]
            };
        })
        .sort((a, b) => b.score - a.score);
        
    return results;
}

export function getAutocompleteSuggestions(partial) {
    if (!partial || partial.length < 2) return [];
    
    const cleanPartial = partial.toLowerCase().trim();
    const suggestions = new Set();
    
    // Check keywords and titles
    SOP_CORPUS.forEach(doc => {
        doc.keywords.forEach(keyword => {
            if (keyword.startsWith(cleanPartial)) {
                suggestions.add(keyword);
            }
        });
        
        // Check document title words
        const titleWords = doc.title.toLowerCase().match(/\b\w+\b/g) || [];
        titleWords.forEach(word => {
            if (word.startsWith(cleanPartial) && word.length > 3) {
                suggestions.add(word);
            }
        });
    });
    
    return Array.from(suggestions).slice(0, 5);
}

export function highlightKeywords(text, query) {
    if (!query) return text;
    const tokens = query.toLowerCase().match(/\b\w+\b/g) || [];
    let highlighted = text;
    
    tokens.forEach(token => {
        if (token.length < 3) return;
        const regex = new RegExp(`\\b(${token})\\b`, 'gi');
        highlighted = highlighted.replace(regex, `<mark class="search-highlight">$1</mark>`);
    });
    
    return highlighted;
}

// Build index immediately on load
buildSearchIndex();
