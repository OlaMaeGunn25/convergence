/*
   CONVERGENCE-Ai™ Search Indexing and Auto-Complete Module
   Implements a lightweight client-side TF-IDF keyword search engine across SOPs and help documentation.
*/

import { logConsole } from './components.js';

// Structured search corpus mapping categories and keywords
export const SOP_CORPUS = [
    {
        "id": "module-1",
        "title": "Module 1: Client Pre-Conditions Check",
        "category": "Onboarding Manual",
        "content": "Before deploying, walk the client IT administrator through the prerequisites: a dedicated VM or Docker environment (2 vCPU, 4GB RAM minimum) and SSL termination mapped to a domain. CREDENTIALS ARE NEVER ENTERED INTO CONVERGENCE. The platform refuses credential values over its API by design; you supply the NAMES of secrets held in environment configuration or a secret manager, and the gateway resolves them at call time. The client business address is mandatory and installation refuses without it, because region-bound capabilities resolve from it. Device location (GPS, IP) is optional, asked per method, and defaults to denied.",
        "keywords": [
            "vm",
            "docker",
            "ssl",
            "prerequisite",
            "credentials",
            "secret manager",
            "business address",
            "location",
            "onboarding",
            "preconditions"
        ]
    },
    {
        "id": "module-2",
        "title": "Module 2: The Licensing Activation Key",
        "category": "Onboarding Manual",
        "content": "Configure the tenant on the Deployment Hub: select the single authorized vertical, define branding colors, and generate the Base64 activation token for the client administrator. The vertical is LOCKED at install and cannot be changed afterwards. It carries the compliance profile that screens every later action, so confirm it against the actual client obligations before generating the token.",
        "keywords": [
            "licensing",
            "activation",
            "token",
            "deployment hub",
            "base64",
            "vertical lock",
            "rebrand",
            "compliance profile"
        ]
    },
    {
        "id": "module-3",
        "title": "Module 3: Client Workspace Activation",
        "category": "Onboarding Manual",
        "content": "Explain how the client reaches their control room: open the entrypoint page, which shows the Vault Lock Modal, and paste the activation token to authorize container services and lock the vertical. Bypassing activation requires super-admin credentials or a local test token.",
        "keywords": [
            "vault lock",
            "modal",
            "activate",
            "unlock",
            "super admin",
            "token",
            "test token"
        ]
    },
    {
        "id": "module-4",
        "title": "Module 4: Interactive Process Mapping Audit",
        "category": "Onboarding Manual",
        "content": "Use the Process Mapping canvas during audit sessions to map manual steps into SIPOC or swimlane diagrams. Note the difference between the two buttons on that panel: Simulate Live Agent Workflow animates the map for demonstration, while Run as Governed Tasks commits it, so every step becomes a real task and every human checkpoint an actual approval gate that blocks everything downstream. Maps with no governed definition are grouped separately and the run button says so rather than failing after the click.",
        "keywords": [
            "process mapping",
            "canvas",
            "sipoc",
            "swimlane",
            "hitl",
            "six sigma",
            "governed tasks",
            "simulate",
            "approval gate"
        ]
    },
    {
        "id": "module-5",
        "title": "Module 5: Deployment Models",
        "category": "Onboarding Manual",
        "content": "For SMB clients with no technical staff, run the container in your own cloud account and bind a dedicated subdomain. For larger or regulated clients, support client-owned deployment using the packaged Docker Compose manifests. The target cloud is AWS (container registry, managed container service, secrets manager) and the on-premise path stays supported, because deployment mode is configuration rather than a code fork. After deploying, verify rather than assume: call the version endpoint with the expected version and it answers 200 on a match and 409 on a mismatch.",
        "keywords": [
            "cloud",
            "architecture",
            "aws",
            "subdomain",
            "docker compose",
            "on-premise",
            "self-hosted",
            "deployment",
            "version",
            "verify"
        ]
    },
    {
        "id": "module-6",
        "title": "Module 6: LLM Provider Selection & Cost Routing",
        "category": "Onboarding Manual",
        "content": "Select the model provider for the tenant: Gemini, OpenAI, Claude, or self-hosted. The self-hosted option is sovereign, meaning inference never leaves infrastructure the client controls, and the hosted providers are sub-processors that must be disclosed to the client before their data reaches one. API credentials are referenced by name, never entered into the platform. A cascade router then picks the cost tier per call by confidence and risk: routine high-confidence work runs on a cheap model, and destructive or high-risk actions escalate to the premium tier regardless of cost preference. Set the reseller markup percent to calculate pass-through token costs for client billing.",
        "keywords": [
            "llm",
            "provider",
            "gemini",
            "openai",
            "claude",
            "ollama",
            "sovereign",
            "sub-processor",
            "markup",
            "billing",
            "cost",
            "routing",
            "model"
        ]
    },
    {
        "id": "howto-connection-modes",
        "title": "How To: Choose a Connection Mode (API, MCP, Auto)",
        "category": "How-To Guides",
        "content": "Every connection declares how it is made. API uses the native client of the system. MCP is strict: it demands the Model Context Protocol and fails rather than degrading. Auto attempts MCP first and falls back to the native API, logging the fallback and naming which transport actually served. Recommend Auto unless the client requires protocol strictness. Transport never changes governance, because both paths pass the same approval, compliance-floor and autonomy gates.",
        "keywords": [
            "connection mode",
            "mcp",
            "api",
            "auto",
            "transport",
            "fallback",
            "strict",
            "interview"
        ]
    },
    {
        "id": "howto-mcp-ladder",
        "title": "How To: Read the MCP Priority Ladder",
        "category": "How-To Guides",
        "content": "When a connection is made in MCP or Auto mode the builder walks a ladder in order. Tier 1 is the OWN MCP server of the connected system, which is that system speaking its native protocol contract, so it outranks anything stood up locally. Tier 2 is a spun-up API-to-MCP wrapper around the system API. Beneath the ladder, and only in Auto mode, sits the raw native API adapter as the fallback floor, deliberately not a rung. The connection feedback names how far down it landed, so connected via the system MCP server and system MCP server unavailable so connected via the wrapper are distinguishable statements.",
        "keywords": [
            "mcp ladder",
            "vendor mcp",
            "wrapper",
            "tier",
            "priority",
            "transport",
            "fallback",
            "floor"
        ]
    },
    {
        "id": "howto-api-to-mcp",
        "title": "How To: Ingest an API and Serve It Over MCP",
        "category": "How-To Guides",
        "content": "Any documented REST API can be ingested from its own description, either an OpenAPI 3 document or a minimal operation list, and served over MCP by the generic wrapper. This is how you connect a system nobody has hand-built a connector for. Operations are classified by HTTP method: GET and HEAD are reads, and everything else is destructive and approval-gated. The base URL must be https and is refused if it points at loopback, private, link-local or internal addresses, so an ingested description cannot direct requests at internal services. Operation descriptions are neutralised through the injection guard before they become tool descriptions, and you are told which flag fired. Ingestion produces a proposal and connects nothing.",
        "keywords": [
            "api ingestion",
            "openapi",
            "mcp",
            "wrapper",
            "ingest",
            "spec",
            "ssrf",
            "injection",
            "destructive",
            "proposal"
        ]
    },
    {
        "id": "howto-preloaded-mcp",
        "title": "How To: Select a Pre-Loaded MCP Connection",
        "category": "How-To Guides",
        "content": "Every vertical can browse selectable MCP connections from three sources: vendor, where the system publishes its own MCP server; wrapper, where a catalog connector is served over MCP by the spun-up wrapper; and ingested, where an API was ingested from its description. Vertical-scoped vendor servers only appear for the verticals they serve. A pre-loaded entry is an OFFER and never a connection, because selecting one still runs the connection builder, its preconditions and its approval gate.",
        "keywords": [
            "mcp catalog",
            "pre-loaded",
            "select",
            "vendor",
            "wrapper",
            "ingested",
            "vertical",
            "offer"
        ]
    },
    {
        "id": "howto-preconditions",
        "title": "How To: Clear Connection Preconditions",
        "category": "How-To Guides",
        "content": "Some systems cannot be connected on demand because access is granted out-of-band by agreements, vendor registration or per-organisation enablement. Those prerequisites are declared per connector and scoped as tenant, vertical, compliance, vendor or technical. Automatic checks are verified by the system, and out-of-band steps are attested by a named human with a company-domain identity, a reference and a timestamp. The connection builder REFUSES while any blocking precondition is unmet, and the connection sits in a pending state naming what is outstanding. Attestations alone do not unblock, because technical preconditions are checked against the real environment, so signed everything and configured nothing is still correctly blocked.",
        "keywords": [
            "preconditions",
            "attest",
            "blocked",
            "pending",
            "agreement",
            "vendor",
            "enablement",
            "epic",
            "baa"
        ]
    },
    {
        "id": "howto-compliance-screen",
        "title": "How To: Read a Compliance Determination",
        "category": "How-To Guides",
        "content": "Every action is screened against the regulations of the vertical plus a universal corpus that attaches regardless of industry: telephone consumer protection and state do-not-call on any outbound call or text, commercial email rules on any bulk email, US state privacy, and accessibility on customer-facing output. Verdicts are pass, flag or block, each carrying rule citations, confidence and provenance. A flag is information rather than an obstacle, meaning a human should look. Actions constituting consequential decisions about a person, covering employment, credit, housing, education access and healthcare, are recognised as a class and never pass silently even where no sector rule matched.",
        "keywords": [
            "compliance",
            "screening",
            "verdict",
            "flag",
            "block",
            "citations",
            "tcpa",
            "can-spam",
            "consequential decision",
            "privacy"
        ]
    },
    {
        "id": "howto-location-consent",
        "title": "How To: Handle Location and Consent at Onboarding",
        "category": "How-To Guides",
        "content": "The business address is required and installation refuses without it, because region-bound capabilities resolve from it. Device-derived location is separate and optional: GPS and IP are asked per method and default to DENIED, because GPS is the position of a person and an IP address is personal data. A named company-domain identity must grant consent, absent means denied, and revocation takes effect on the next correlation. Precedence is address, then GPS, then IP, and every correlation reports which method was used and at what confidence, because a region read from company letterhead is not the same claim as one guessed from an IP address.",
        "keywords": [
            "location",
            "consent",
            "gps",
            "ip",
            "business address",
            "region",
            "privacy",
            "revoke",
            "onboarding"
        ]
    },
    {
        "id": "howto-task-recording",
        "title": "How To: Use Task Recording and the Playbook Library",
        "category": "How-To Guides",
        "content": "These are licensable add-ons and are off until enabled for the tenant. With Task Recording on, a governed run opens a record automatically, each step is captured as it executes, and the run is auto-named and auto-categorised on completion. Failed runs are kept, because a failure is evidence. With the Playbook Library also on, a successful run is promoted to a versioned playbook keyed to that task type, and later runs revise it rather than duplicating it. Recording is strictly additive and best-effort, so a broken recorder never changes the outcome of a task.",
        "keywords": [
            "task recording",
            "playbook",
            "add-on",
            "licence",
            "module",
            "capture",
            "procedure",
            "reusable"
        ]
    },
    {
        "id": "howto-guidance",
        "title": "How To: Get Guidance Mid-Engagement",
        "category": "How-To Guides",
        "content": "Ask for guidance and you get the relevant deployment runbook step, the related skills and the matching prompt frameworks back immediately. Escalate only if that is not enough. Escalation produces a governed request addressed to a human and requires a company-domain identity, and the self-serve answer is returned alongside it so you are never blocked waiting on a reply you may not need. If nothing matches, the system says so rather than inventing an answer, so re-ask naming the step number or the tool involved.",
        "keywords": [
            "guidance",
            "help",
            "stuck",
            "escalate",
            "runbook",
            "support",
            "ask",
            "skills"
        ]
    },
    {
        "id": "howto-managed-service",
        "title": "How To: Run a Managed-Service Engagement",
        "category": "How-To Guides",
        "content": "The standard runbook requires client employees as approvers, because approving on behalf of a client transfers their accountability to you. Under a managed service the client has deliberately bought that transfer, so the managed-service runbook variant permits it with constraints: the term is time-boxed, the arrangement is disclosed in writing naming the consultancy approvers, the client retains a named approver with override, every autonomy grant carries an expiry no later than the term end, and the exit is planned at the start. Compliance-floor actions, covering trust transactions, payroll, termination, owner contact resolution and writing to a health record, are NEVER transferred regardless of the agreement.",
        "keywords": [
            "managed service",
            "approver",
            "variant",
            "term",
            "autonomy",
            "expiry",
            "exit",
            "handover",
            "accountability"
        ]
    },
    {
        "id": "vertical-medical",
        "title": "Medical & Healthcare Business Vertical",
        "category": "Vertical SOPs",
        "content": "SOP guidelines for Medical & Healthcare automation: Epic is the system of record and ships as PRE-CONNECTION rather than directly connectable, because access is granted by each health organisation individually. A signed BAA, an Epic Vendor Services account, a registered application, a passed security review and per-organisation enablement must all clear first. Note that App Orchard is retired: the programme is Vendor Services and the marketplace is Showroom. Every Epic read is protected health information, so a stated purpose is mandatory and recorded, direct identifiers are minimised by default, and writing to the record of care is compliance-floor work requiring explicit approval. Typical governed work covers appointment reminders and no-show recovery, referral routing, intake packet dispatch and insurance-verification tracking.",
        "keywords": [
            "medical",
            "healthcare",
            "epic",
            "ehr",
            "fhir",
            "hipaa",
            "baa",
            "phi",
            "preconditions",
            "appointments",
            "purpose"
        ]
    },
    {
        "id": "vertical-legal",
        "title": "Legal Services Business Vertical",
        "category": "Vertical SOPs",
        "content": "SOP guidelines for Legal Services automation: Clio is the practice-management connector. Trust and IOLTA transactions sit on the compliance floor: always human-approved, double-gated, and never delegable by a standard autonomy grant. The governed client-intake map runs conflict checking before a matter opens. Typical work covers intake to matter opening, deposition and hearing scheduling, time capture and billing narratives, retainer replenishment and filing-deadline docketing. Attorney review precedes anything filed.",
        "keywords": [
            "legal",
            "law",
            "clio",
            "iolta",
            "trust",
            "matter",
            "conflict",
            "deposition",
            "docketing",
            "hitl"
        ]
    },
    {
        "id": "vertical-finance",
        "title": "Financial & Bookkeeping Business Vertical",
        "category": "Vertical SOPs",
        "content": "SOP guidelines for Financial & Bookkeeping automation: Connect QuickBooks Online or Xero over OAuth2 and Stripe for payments. The compliance profile is the financial-data safeguards rule plus payment-card protection, and SOX applies only where the client serves public companies. The governed procure-to-pay map matches invoices to purchase orders with a human checkpoint before payment release, and release is always human-approved. Typical work covers month-end close, bank and ledger reconciliation with exception surfacing, aged-receivable follow-up and audit-evidence assembly.",
        "keywords": [
            "finance",
            "bookkeeping",
            "quickbooks",
            "xero",
            "stripe",
            "glba",
            "pci",
            "procure-to-pay",
            "reconciliation",
            "close"
        ]
    },
    {
        "id": "vertical-retail",
        "title": "Retail & E-commerce Business Vertical",
        "category": "Vertical SOPs",
        "content": "SOP guidelines for Retail & E-commerce automation: Shopify is the commerce connector, Stripe handles payments and QuickBooks the ledger. The compliance profile is payment-card protection plus the prohibition on unfair or deceptive practices, and the universal corpus adds commercial-email and calling rules to any outbound campaign. Refunds and chargebacks require approval before money moves. Typical work covers order dispatch and fulfilment exceptions, low-inventory restock triggers, abandoned-cart recovery, daily sales reconciliation and review escalation.",
        "keywords": [
            "retail",
            "ecommerce",
            "shopify",
            "stripe",
            "pci",
            "refund",
            "inventory",
            "orders",
            "cart",
            "reconciliation"
        ]
    },
    {
        "id": "vertical-realestate",
        "title": "Real Estate Business Vertical",
        "category": "Vertical SOPs",
        "content": "SOP guidelines for Real Estate automation: MLS access is region-specific. Resolve the covering board for the client market first, because board coverage is a live lookup rather than a guess, then connect either a direct per-board feed or the aggregate feed, which needs one key rather than a licence per board. Listing content is LICENSED to the brokerage and carries display obligations that travel with the data. Fair Housing screening applies to every outbound message, because exposure comes from language in ordinary communications. Resolving the phone or email of a property owner is compliance-floor work requiring explicit approval and a stated purpose, and it returns do-not-call and litigator flags rather than stripping them.",
        "keywords": [
            "real estate",
            "mls",
            "reso",
            "board",
            "listing",
            "fair housing",
            "skip trace",
            "tcpa",
            "licence",
            "broker"
        ]
    },
    {
        "id": "vertical-hospitality",
        "title": "Hospitality & Leisure Business Vertical",
        "category": "Vertical SOPs",
        "content": "SOP guidelines for Hospitality & Leisure automation: No property-management connector ships yet, so connect the PMS through API ingestion if it publishes a documented API, and otherwise operate on the universal baseline of scheduling, messaging, payments and documents. The compliance profile is public-accommodation accessibility, state alcohol licensing and food-safety handling. Typical work covers booking intake and confirmation, concierge request routing, pre-arrival and post-stay sequences, deposit and incidental charges with approval before capture, and complaint escalation with SLA tracking.",
        "keywords": [
            "hospitality",
            "hotel",
            "pms",
            "booking",
            "concierge",
            "ada",
            "alcohol",
            "food safety",
            "guest",
            "deposit"
        ]
    },
    {
        "id": "vertical-construction",
        "title": "Construction & Contracting Business Vertical",
        "category": "Vertical SOPs",
        "content": "SOP guidelines for Construction & Contracting automation: No project-management connector ships yet, so ingest the client platform API or operate on the universal baseline. The compliance profile is construction safety standards, state contractor licensing and scope limits, prevailing wage on federally funded work, lien notice deadlines and the lead-safe renovation rule. Typical work covers permit filing preparation and status tracking, materials ordering and delivery scheduling, subcontractor onboarding and insurance-certificate chase, change orders requiring approval before they reach the client, progress billing from milestone completion and lien-waiver collection.",
        "keywords": [
            "construction",
            "contracting",
            "osha",
            "licensing",
            "davis-bacon",
            "lien",
            "permit",
            "subcontractor",
            "change order",
            "safety"
        ]
    },
    {
        "id": "vertical-logistics",
        "title": "Logistics & Supply Chain Business Vertical",
        "category": "Vertical SOPs",
        "content": "SOP guidelines for Logistics & Supply Chain automation: No transport or warehouse management connector ships yet, so ingest the client platform API or operate on the universal baseline. The compliance profile covers driver hours-of-service and electronic logging, hazardous-materials handling and manifesting, carrier cargo liability and customs documentation. The governed corporate-travel map runs with a human checkpoint before booking. Typical work covers shipment exception monitoring with customer notification, carrier quote comparison with approval before committing spend, delivery appointment scheduling, proof-of-delivery filing and freight-invoice audit against the quoted rate.",
        "keywords": [
            "logistics",
            "supply chain",
            "tms",
            "wms",
            "fmcsa",
            "hazmat",
            "customs",
            "carrier",
            "freight",
            "shipment"
        ]
    },
    {
        "id": "vertical-education",
        "title": "Education & Tutoring Business Vertical",
        "category": "Vertical SOPs",
        "content": "SOP guidelines for Education & Tutoring automation: No student-information or learning-management connector ships yet, so ingest the client platform API or operate on the universal baseline. The compliance profile is student-record privacy covering consent before disclosure and the school-official exception, verifiable parental consent for under-13 information, and state student-data rules prohibiting profiling from student data. Instructor payroll is compliance-floor work. Typical work covers tutor rostering and session scheduling, enrolment and billing, attendance tracking and absence follow-up, guardian progress updates and make-up credit handling.",
        "keywords": [
            "education",
            "tutoring",
            "ferpa",
            "coppa",
            "student",
            "privacy",
            "roster",
            "enrolment",
            "attendance",
            "payroll"
        ]
    },
    {
        "id": "vertical-tech",
        "title": "SaaS & Tech Startups Business Vertical",
        "category": "Vertical SOPs",
        "content": "SOP guidelines for SaaS & Tech Startups automation: Operate on the universal baseline of support, CRM, payments and documents, and ingest product APIs as needed. The compliance profile is US state consumer privacy, copyright notice-and-takedown, and digital accessibility for customer-facing interfaces. Typical work covers support ticket and bug triage to the right owner, incident communication drafting requiring approval before publication, customer onboarding sequences, trial-to-paid follow-up, churn-risk escalation, renewal and failed-payment dunning, and usage-based invoice preparation.",
        "keywords": [
            "saas",
            "tech",
            "startup",
            "support",
            "triage",
            "incident",
            "churn",
            "dunning",
            "privacy",
            "accessibility"
        ]
    },
    {
        "id": "vertical-professional",
        "title": "Professional Services Business Vertical",
        "category": "Vertical SOPs",
        "content": "SOP guidelines for Professional Services automation: Clio serves practice management where applicable, and otherwise the universal baseline applies. The compliance profile is state professional licensing and scope-of-practice limits, the prohibition on unfair or deceptive practices, and confidentiality obligations. Typical work covers engagement scoping and proposal assembly, time capture and utilisation reporting, invoice preparation and dispatch, cadence client status reporting, scope-change approval before additional work proceeds, and deliverable review before client release.",
        "keywords": [
            "professional services",
            "consulting",
            "clio",
            "licensing",
            "confidentiality",
            "retainer",
            "utilisation",
            "proposal",
            "scope"
        ]
    },
    {
        "id": "vertical-nonprofit",
        "title": "Non-Profit Organizations Business Vertical",
        "category": "Vertical SOPs",
        "content": "SOP guidelines for Non-Profit Organizations automation: Operate on the universal baseline with the accounting connector for restricted-fund reporting. The compliance profile is state charitable-solicitation registration, which is required in roughly forty states BEFORE soliciting and is the most common trap in this vertical, plus tax-exempt purpose and political-activity limits, the annual information return, and written acknowledgement for contributions at or above the substantiation threshold. Typical work covers donor outreach and receipt dispatch, recurring-gift failure recovery, grant-deadline docketing, volunteer scheduling, acknowledgement letters inside the compliance window and board-pack assembly.",
        "keywords": [
            "nonprofit",
            "charity",
            "solicitation",
            "registration",
            "501c3",
            "form 990",
            "donor",
            "grant",
            "volunteer",
            "receipt"
        ]
    },
    {
        "id": "vertical-events",
        "title": "Event Planning & Management Business Vertical",
        "category": "Vertical SOPs",
        "content": "SOP guidelines for Event Planning & Management automation: Operate on the universal baseline of scheduling, messaging, payments and documents. The compliance profile is public-accommodation accessibility at venues, ticket sales restrictions, event alcohol licensing, and the enforceability limits on participant liability waivers. Typical work covers vendor booking and roster planning, brief to proposal assembly, contract and deposit tracking, run-of-show scheduling and crew calls, attendee registration, on-site issue escalation and post-event reconciliation.",
        "keywords": [
            "events",
            "planning",
            "venue",
            "ada",
            "tickets",
            "alcohol",
            "waiver",
            "vendor",
            "roster",
            "registration"
        ]
    },
    {
        "id": "vertical-event-rental",
        "title": "Event Rental & Equipment Business Vertical",
        "category": "Vertical SOPs",
        "content": "SOP guidelines for Event Rental & Equipment automation: No rental-management connector ships yet. If the client platform publishes a documented API, ingest it and serve it over MCP, and otherwise operate on the universal baseline of scheduling, payments and documents. The compliance profile is consumer product safety and recall obligations, amusement-device inspection rules, state limits on damage deposits and withholding, and accessibility of public-facing equipment. Typical work covers availability checks and reservation holds, delivery and pickup scheduling, damage assessment requiring approval before charging a customer, deposit capture and release, and maintenance scheduling on returned equipment.",
        "keywords": [
            "event rental",
            "equipment",
            "inventory",
            "cpsc",
            "amusement device",
            "deposit",
            "damage",
            "delivery",
            "reservation",
            "api ingestion"
        ]
    },
    {
        "id": "vertical-ai-consultancy",
        "title": "AI Strategy & Automation Consultancy (Reseller) Business Vertical",
        "category": "Vertical SOPs",
        "content": "SOP guidelines for AI Strategy & Automation Consultancy (Reseller) automation: This is the reseller vertical, where your clients are themselves platform tenants. That makes you a PROCESSOR of their data and a DEPLOYER of AI into their businesses, and the compliance profile reflects it: client confidentiality, data-processing and sub-processor disclosure, substantiation for AI capability claims because unsubstantiated outcome claims are your exposure rather than the client exposure, deployer obligations where a delivered system makes consequential decisions, and state privacy carried through to every deployment. Connect the consultancy stack of Google Workspace and Calendar, Microsoft 365, QuickBooks or Xero, Slack and HubSpot. Follow the ten-step deployment runbook, use the skills library and prompt frameworks for engagement work, and ask for guidance when stuck.",
        "keywords": [
            "consultancy",
            "reseller",
            "ai strategy",
            "automation",
            "processor",
            "sub-processor",
            "deployer",
            "claims",
            "runbook",
            "skills",
            "google",
            "microsoft",
            "quickbooks"
        ]
    },
    {
        "id": "help-killswitch",
        "title": "Agent Kill Switch & Safety Shut Off",
        "category": "Help Documentation",
        "content": "The red Shut Off Agent button in the header is the kill switch. It immediately halts active background runners, sets the status indicator to red, and pauses pending updates. Resume with administrative bypass credentials. The kill switch is always available and is never delegable, so no autonomy grant, licence tier or managed-service agreement removes it.",
        "keywords": [
            "kill switch",
            "shut off",
            "pause",
            "safety",
            "halt",
            "stop",
            "emergency",
            "red"
        ]
    },
    {
        "id": "help-hitl",
        "title": "Human-in-the-Loop (HITL) Queue & Governance",
        "category": "Help Documentation",
        "content": "The Operations Panel lists tasks awaiting human approval. Approve releases the payload to integrations, AI Compose triggers an LLM draft with cost shown before applying, Reject or Revise logs the directive and returns it to the agent, and Auto-Correct runs compliance normalisation. Approved tasks can be reversed from the Reversal History. An agent can never approve its own work, because a call arriving from an agent carrying an approval with no human identity behind it is refused outright.",
        "keywords": [
            "hitl",
            "oversight",
            "approve",
            "reject",
            "reverse",
            "rollback",
            "auto-correct",
            "ai compose",
            "self-approval",
            "queue"
        ]
    },
    {
        "id": "help-versioning",
        "title": "Version, Health and Deploy Verification",
        "category": "Help Documentation",
        "content": "The running version is reported by the health endpoint and by a dedicated version endpoint that also carries build provenance, meaning the commit the image was built from and when. Pass the expected version to that endpoint and the instance asserts its own identity, answering 200 on a match and 409 on a mismatch, so a release is verified rather than assumed. The operations hub shows its own version in the sidebar and asks the gateway what it is running, flagging a mismatch because the two deploy separately.",
        "keywords": [
            "version",
            "health",
            "deploy",
            "verify",
            "provenance",
            "commit",
            "mismatch",
            "release",
            "endpoint"
        ]
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
            // Fractional weight by how often the term actually appears in the
            // body. This is the tiebreak: two documents that both list a term as
            // a keyword previously scored identically and were ordered by their
            // position in the corpus, so adding an entry above another could
            // silently demote it. Depth of coverage is the honest signal — a
            // document that discusses a term throughout beats one that merely
            // tags it — and the weight is small enough never to outrank a real
            // keyword or title match.
            const occurrences = (doc.content.toLowerCase().match(new RegExp(`\\b${token}\\b`, 'g')) || []).length;
            if (occurrences > 0) {
                scores[doc.id] = (scores[doc.id] || 0) + Math.min(occurrences, 10) * 0.1;
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
