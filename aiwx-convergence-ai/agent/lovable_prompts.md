# Lovable.ai React/Tailwind Product Prompts Specification
### Product Owner: Agency Admin.com | Version: 1.1 | PROPRIETARY

Copy-paste these prompt specifications directly into **Lovable.ai**, **Bolt.new**, or **v0.dev** to build the entire suite in a modern React, TypeScript, Tailwind, and Supabase stack.

---

## 💎 Prompt 1: Remote Deployment Hub

```text
Build a high-fidelity, premium Google Cloud-optimized Super Admin Deployment Hub React component for "Agency Admin.com" using TypeScript and Tailwind CSS.

DESIGN SYSTEM:
- Font: Headings use Jonas Hecksher's "Play" (letter-spacing: -0.02em); body and UI text use "Inter".
- Palette: Neon electric blue (#0084ff) and cyan spark (#00c6ff). Base background is deep dark slate (#030712) with glassmorphism card containers (#0b0f19) and subtle glowing drop shadows.
- Brand Logo: Replace any text-based or generic SVG logo placeholder with a premium brand logo layout containing a modern network icon (using FontAwesome class `fa-solid fa-network-wired` styled with var(--primary-color) and a subtle glow) next to the wordmark "Agency Admin" styled in the "Play" font.
- Absolutely NO gold colors. Ensure visual elements look premium, alive, and modern.

FUNCTIONALITY:
1. Client Parameters Provisioning Form:
   - Inputs: Company Name, Logo Initials, Target Industry Vertical (Dropdown selector matching 1 of 12 industries), Primary Color (colorpicker), Secondary Color (colorpicker), Exposed API Endpoint URL, Vault KMS Access Key (password field), and a checkbox for "Enable Modular Workforce Upskilling Matrix" (upskill).
   - Expose interactive hover tooltips (using custom CSS styled tooltips with question-mark icons) next to each form field explaining the parameters in plain English.
2. Cryptographic Activation Token Generator & Animated Progress Cockpit:
   - The "Activate Deployment" button pulses dynamically (`pulse-btn`) to guide the user. Clicking it compiles a three-part Base64 license token holding the client configuration metadata.
   - Renders a 5-second animated installation progress cockpit (0% -> 100%) showing simulated logs for GCP container creation, Supabase RLS schema migrations, Twilio voice webhook linking, and mock QuickBooks sandbox mode verification.
   - Updates interactive checklist ticks and active badges in real-time as percentage grows.
   - Renders a green success results card with a "Copy to Clipboard" button once finished.
3. Auto-Login Launch Button:
   - Renders a "Launch Operations Panel" button that sets the active token in localStorage and redirects the user to `./operations_hub.html?token=...` to automatically log in and bypass the vault modal.
   - The button pulses dynamically (`pulse-btn`) and includes a dashed Next Step Indicator Banner underneath directing non-technical consultants to click it.
4. Non-Technical Installation Guide:
   - Adds a clean step-by-step graphical self-installation guide cards explaining how the container maps and wires GCP Cloud Run, n8n webhook routing, and Supabase security partitions.
5. Interactive MRR Recurring Margin Modeler:
   - Select Tier Costs ($99/mo, $199/mo, $499/mo) and slide or select container volumes (5 to 100).
   - Add a checkbox to "Include Workforce Upskilling Matrix Add-On (+ $49/mo per client)".
   - Dynamically calculates: "Gross Monthly MRR = (Tier Cost + (upskill ? 49 : 0)) * Volume". Renders a beautiful chart displaying gross SaaS revenue, estimated Compute COGS (base rate $35/mo per active docker container), and estimated Net Monthly Margins (82%+ efficiency gains).
6. Live License Repository:
   - Table of active provisioning keys and endpoints. Add search filter, status badges (ACTIVE, SUSPENDED, DEPLOYING), and click-actions to revoke or copy active tokens. Show if the Upskilling Matrix is licensed.
```

---

## 💎 Prompt 2: Secure Client Operations Hub ("AI Operations Middleware")

```text
Build a secure, high-fidelity multi-tenant Client Operations Hub React component styled as "AI Operations Middleware" by Agency Admin using TypeScript, Tailwind CSS, Lucide icons, and Supabase Database integration.

DESIGN SYSTEM:
- Palette: Electric blue (#0084ff) and cyan spark (#00c6ff). Base background is deep dark slate (#030712) with card containers (#0b0f19).
- Font: Headings use Jonas Hecksher's "Play" (letter-spacing: -0.02em); body and UI text use "Inter".
- Brand Logo: Replace any text logo with a premium layout containing a modern network icon next to the wordmark "Agency Admin" styled in the "Play" font.
- Must support White-Label styling injections. Modify CSS variables dynamically based on active license token values (primary, secondary, logo initials, company name) in real-time. If custom logo text is configured, render it as custom text initials instead of the default agent_smithy composite logo.
- Remove all Six Sigma, BPMN, and SIPOC jargon. Replace with layman workflow terms: Workflow Designer, Action Flowchart, Step Configuration Editor, and Requires Human Approval.

CORE STATES & HANDSHAKES:
1. Secure Activation Vault Overlay Modal with URL Auto-Unlock:
   - Hides the dashboard under a locked glassmorphism panel. Requiring License Token input + Admin Email Address.
   - On load, check for URL query parameter `?token=...`. If present, automatically parse, verify, and store it to bypass the activation overlay modal seamlessly.
2. Super Admin Email Bypass Gate:
   - If user authenticates with 'Agency Admin@gmail.com' or any '@Agency Admin.com' email suffix, set isSuperAdmin to true and expose a "Super Admin Lock Bypass" vertical switcher dropdown in the header. Exposes all vertical modules.
3. Stakeholder Success Blueprints Panel:
   - Side-by-side cards detailing the exact goals, proof of completion, and real-world examples for the Consultant, the Business Owner, and the AI Assistant.
4. Interactive Workflow Designer Flowchart (SVG Canvas):
   - Renders interactive process diagrams with x,y coordinates inside a viewBox "0 0 800 400" using SVG circles, rects, paths, and diamond decision nodes.
   - Clicking any flowchart node highlights it and opens a "Step Configuration Editor" form in the sidebar.
   - Allows users to change step label name, trigger apps (QuickBooks, Twilio, Gmail, Sheets), execution role (Fully Automated vs Pause for Manual Approval vs Decision Logic), and action rules in real-time, instantly updating the SVG canvas.
   - Includes an "Add Step" button to append custom actions.
   - Live telemetries: An active step index is updated by a timer interval (2.5s). Nodes highlight green/active in sequence. When the index enters a node of type "hitl", freeze the timer and pause execution, rendering an orange "Oversight Needed" glow.
5. Deployed Connectors & Credentials Vault:
   - Display a grid of 9 integration cards with connection status badges (defaulting to `SANDBOX MOCK` in blue/cyan) representing:
     1. Google Spreadsheets (Sheets & Drive Data Sync)
     2. Gmail Auto-Route (IMAP Endpoint Hook)
     3. QuickBooks Ledger (Post-to-Pay Integration)
     4. Slack Workspace (Chat Ops & Alert Relays)
     5. Microsoft Teams (Collab Channel Routing)
     6. HubSpot CRM Client (Customer Sync & Pipeline)
     7. Microsoft Outlook Mail (Microsoft Graph Router)
     8. OneDrive Documents (Office 365 Ingestion)
     9. Microsoft Office Suite (Word, Excel, & PPT Automation)
   - Add a button "Configure New Integration" that programmatically clicks the settings tab, scrolls to the credentials card, and flashes a highlighted outline.
   - Provide an "API Credentials & Live Connection Vault" card inside white-label settings. Include inputs to securely save credentials: QuickBooks Client ID, QuickBooks Client Secret, Gmail IMAP password, Twilio Token, Slack Bot Token, Microsoft Graph Client ID, Microsoft Graph Client Secret, and HubSpot Private Access Token.
   - Saving credentials saves values in localStorage and upgrades the corresponding integration badges to `LIVE CONNECTED` with green success colors (Microsoft Teams and Microsoft Office Suite are upgraded when MS Graph credentials are provided; Outlook and OneDrive are updated when their flags are set). On page load, auto-fill inputs from localStorage.
6. Human-in-the-Loop (HITL) Queue:
   - Table displaying pending tasks matching the active vertical (unless Super Admin bypasses, in which case show all).
   - Actions: "Approve & Release" (splicing item, incrementing counters, logging in terminal, and resuming SVG process timer) and "Revise" (flagging task as [REVISION REQUESTED]).
   - Store all state changes, metrics, and queue tasks persistently inside Supabase PostgreSQL and fallback on localStorage to survive browser refreshes.
7. Workforce Transition & Upskilling Matrix locked overlay:
   - Hides the interactive upskilling matrix card under a glassmorphic blur overlay with a lock icon, a listing of features (skills mapping, 90-day upskilling roadmap), and an upgrade CTA.
   - The overlay must be removed if `upskill` is true in the decrypted Activation Token payload, or if the user is a logged-in Super Admin. Otherwise, prevent any user clicks on the roles.
8. White-Label Rebranding Panel Lock:
   - The rebranding panel settings tab must have a glassmorphic blur overlay with a lock icon and "Upgrade License Required" badge if the active session is for a Solopreneur client (detected by checking if `vaultKey` contains "Solo" or `logoText` is "SOLO" inside the decrypted activation token).
   - This overlay must be hidden and rebranding allowed for SMB and Reseller clients, or if a Super Admin bypass email is active.
9. Collapsible 6-Step Setup & Alignment Wizard with Setup Progress & Guidelines Card:
   - Header displaying onboarding title and progress bar tracking completion percentage (16% to 100%).
   - Arranged in a responsive two-column grid layout (left: step accordion, right: Setup Progress & Guidelines card).
   - Expose interactive hover tooltips (using custom CSS styled tooltips) next to form labels explaining the purpose of input parameters (e.g. Primary Color, API Endpoint, etc.).
   - Highlight all active Next Step buttons in Steps 2, 3, 4, and 5 with a pulsing animation overlay (`pulse-btn`) and label them sequentially (e.g., "Save/Apply & Continue to Step X").
   - Left column contains 6 steps:
     * (Step 1) Cryptographic Activation Status (autocompleted).
     * (Step 2) Define Agent Persona (Job Description input field and pulsing "Save & Continue to Step 3" button).
     * (Step 3) Task & Duty Allocation (grid of checkboxes/toggles for duties with pulsing "Save Allocation & Continue to Step 4" button).
     * (Step 4) SOP Ingestion (textarea with template loader dropdown and pulsing "Embed SOP & Continue to Step 5" button).
     * (Step 5) Workflow Simulation (dropdown selection and pulsing "Run Simulation & Continue to Step 6" button. Clicking this switches to the Workflow Designer tab to show the SVG path animation, waits 4.5s, then automatically switches back to the Dashboard tab, expands Step 6, and highlights the Oversight Queue table with a glowing border to prompt user action).
     * (Step 6) HITL Authorization (release first task in Oversight Queue).
   - Right column is a Setup Progress & Guidelines card containing:
     * A modern progress speedometer or status icon (e.g., `fa-solid fa-gauge-high`) styled with a glowing pulse effect.
     * Pulse dot heartbeat indicator (pulsing green).
     * A glassmorphic tips box with content dynamically updated based on the first incomplete step (e.g. prompt for title on Step 2, prompt for duties on Step 3, load templates on Step 4, etc.).
     * Subtle micro-animations (e.g., slideDown fade) when tips box content changes.
```

---

## 💎 Prompt 3: Consultant Training Hub

```text
Build a high-fidelity, interactive Consultant Onboarding & Training Academy React page with Tailwind CSS.

FEATURES:
1. Modular Onboarding Guides:
   - Clear sections covering Vault cryptographic decryptions, Row-Level-Security (RLS) policies, and DSI Six Sigma workflow standards.
2. Interactive Docker Compose YAML Manifest Generator:
   - Form inputs: Client Subdomain Prefix, Target External Port, KMS Key password.
   - Dynamically compiles and outputs a beautifully formatted, copyable Docker Compose YAML manifest containing isolated Dif.ai, n8n, and Supabase containers.
3. Interactive Onboarding Certification Quiz:
   - A multi-question interactive quiz validating consultant expertise on data security, supervisor email gates, and n8n integrations.
   - Renders beautiful cyan/red success/failure cards with clear explanations once questions are clicked.
4. Onboarding Pricing & TCO Simulator:
   - Add sliders and checkboxes mirroring the Deployment Hub calculations, allowing the consultant to toggle the +$49/mo Upskilling Matrix add-on and TCO impact dynamically.
```

---

## 💎 Prompt 4: Click-Funnel Landing Pages (Stripe Integrated)

```text
Build an elite, high-converting, Google Cloud-ready Click-Funnel Landing Page suite for "Agency Admin.com" featuring distinct tracks for SMBs, Solopreneurs, and Resellers.

DESIGN SYSTEM:
- Play for headings, Inter for body copy.
- Black/dark gray base (#030712) with neon electric blue (#0084ff) and cyan spark (#00c6ff) accent highlights. No gold.

COMPONENTS:
1. SMB "Operations Hub - How to Install" Page:
   - Titled: "SMB Operations Hub - How to Install".
   - 7-day free trial purchase funnel with secure credit card input forms and trial cancellation terms (day 8 code deactivation warning).
   - Add a checkbox to select the "Workforce Transition & Strategic Upskilling Matrix Add-On" (+ $49/mo). Update the checkout button to dynamically show $249/mo (standard) vs. $298/mo (bundled).
   - Dynamic SEO meta tags, a step-by-step numbered IT-supported setup guide, and a "Contact a Consultant" lead capture modal.
   - Interactive "Twilio Voice & Call-Fielding Receptor Console": Include a visual panel displaying an active AI voice call with real-time waveform animations, live transcription logs ("Answering patient query...", "Routing emergency call to supervisor..."), and quick-test prompt execution triggers.
   - Complete "Enterprise Integration Grid" showing glowing connector status badges.
2. Solopreneur "Transition Hub - How to Deploy" Page:
   - Titled: "Solopreneurs Transition Hub - How to deploy".
   - Geared toward solo practitioners with NO IT staff required.
   - Add a checkbox to select the "Workforce Transition & Strategic Upskilling Matrix Add-On" (+ $49/mo). Update checkout button text to dynamically calculate $99/mo vs. $148/mo.
   - Includes Twilio 24/7 digital receptionist visual highlights (answering calls, booking appointments, sending reminders).
   - Features an interactive "Administrative Burnout Capacity Calculator" that computes weekly/monthly hours saved and billable ROI gains in real-time under glowing cyan panels.
   - Secure credit card registration forms and 7-day cancellation deactivation notices.
3. Reseller "Build Your B2B SaaS Agency" Page:
   - Titled: "Solopreneurs Reseller Hub - Build Your Agency".
   - Geared toward consultants and resellers looking to scale B2B SaaS.
   - Includes a dynamic "Agency Revenue Modeler" calculating gross MRR and estimated profits (with a checkbox toggle to upsell the Workforce Upskilling Matrix at +$49/mo per client to model margin growth), and reseller-to-consultant guides.
4. E2E Super Admin Integration:
   - All forms support immediate bypass when entering "Agency Admin@gmail.com" or any email with "@Agency Admin.com" suffix.
   - Instantly generates client activation tokens (with upskill flag set appropriately based on selection), caches them in local storage, and redirects the session to operations_hub.html or deployment_hub.html with full Super Admin credentials active!
```

---

## 💎 Prompt 5: Product Documentation Center

```text
Build a high-fidelity, interactive client-facing Product Documentation Center React component using TypeScript and Tailwind CSS.

DESIGN SYSTEM:
- Font: Play for headers, Inter for body and UI elements.
- Palette: Neon electric blue (#0084ff) and cyan spark (#00c6ff). Base background is deep dark slate (#030712) with card containers (#0b0f19) and code blocks.
- Left-side navigation menu containing tab controls to toggle between documentation sections.

TABS & DOCUMENTATION SECTIONS:
1. Getting Started:
   - Technical walkthrough of the ops back-office architecture.
   - Core operational loops outline: Remote Provisioner, Licensing Vault, Secure Vault Lock, and Human-in-the-Loop checkpoints.
   - Alert block describing the in-app click-funnel strategy (zero third-party hosting, absolute compliance).
2. Licensing & KMS:
   - Detailed specifications of the HMAC-SHA256 JWT tokens.
   - Code block examples showing the JSON payload structure (company name, vertical, colors, API endpoint, etc.).
   - Warning box describing the isomorphic failover mechanism.
3. Orchestrator REST APIs:
   - A clean tabular layout listing API endpoints: `/api/deploy-agent` [POST], `/api/verify-token` [POST], `/api/hitl` [GET], `/api/hitl/action` [POST], and `/api/process-maps` [GET], complete with method badges (blue POST, green GET) and payload descriptions.
4. Supabase DB Schema:
   - Copy-pasteable SQL migration scripts to instantiate the tables: `tenant_configs` (company details, hex colors, vertical), and `hitl_queue` (oversight task logs).
   - Scripts to enable Row Level Security (RLS) and enforce tenant isolation policies.
5. Production Docker Compose:
   - Renders a copyable YAML manifest detailing service container orchestrations for the Express server, self-hosted n8n automation engine, and Dify.ai RAG model engine.
6. Human Expansion & Ingestion:
   - Explains the "Human Expansion Narrative" emphasizing employee upskilling rather than headcount elimination.
   - A distinct highlighted Alert Box detailing the "Workforce Retraining Transition Matrix". Must include the explicit licensing notice: the interactive Workforce Transition & Strategic Upskilling Matrix is a premium locked add-on. Solo and SMB configurations require the Base64 Activation Token to have the `upskill: true` flag enabled (priced at +$49/month recurring), while it is included natively in Growth ($499/mo) and Enterprise ($1,200/mo) tiers.
   - Summarizes the three custom process ingestion channels (SOP Document Parser, Audio/Loom Video Recorder, and Visual Swimlane Customizer) and displays a clean recurring billing pricing matrix table (Tiers 0 to 3).
```

---

## 💎 Prompt 6: Interactive Multi-Tenant Synchronization & Clean-State Provisioner

```text
Build a premium React, TypeScript, and Tailwind state synchronization system coordinating the Remote Deployment Hub and Client Operations Hub.

DESIGN AND INTERACTIVE REDIRECTIONS:
1. Unified 6-Step Interactive Stepper:
   - Make each step in the top progress bar clickable.
   - Stepper circles 1-2 redirect/navigate back to the Deployment Hub (`/site_builds/deployment_hub.html` or `site_builds_deployment_hub.html`).
   - Stepper circles 3-6 redirect/navigate forward to the Client Operations Hub (`/operations_hub.html` or `index.html`).
   - Support backwards and forwards redirection via URL parameters (e.g. `?step=X&token=...`), parsing parameters on page load to expand the appropriate step or activate/lock modules dynamically.
2. Real-Time Auto-Save and State Restore:
   - Automatically save every input value, checkbox toggle, color selection, and text area content immediately on input/change events to `localStorage`.
   - Restore all states on page load. If the page is locked, clicking "Auto-Fill Local Test Token" retrieves the pending token hash and activates the session.

DEMO ISOLATION & CLEAN-STATE DEPLOYMENTS:
1. Pure Multi-Tenant Clean Build:
   - For all standard tenants (any company name that does not contain "Agency Admin" and when the user is not bypass super admin), the workspace starts in a completely clean/empty state (0 projects in the library, 0 tasks in the oversight queue, blank rebranding fields).
2. Agency Admin Demo Session Access:
   - If the company name contains "Agency Admin" (e.g. typed in the Company input or decoded from the Activation Token), or if the user is a logged-in Super Admin, the interface automatically pre-populates with the 5 default demo projects (Elarion, CapHouseFest, Agency Admin Ops, Meaningful Expressions, PanAfricGenAI) and the 5 pending HITL tasks (T-1002 through T-1006).
   - This ensures the Agency Admin agency session always has active playability while standard clients deploy in a pristine state.
```

---

## 💎 Prompt 7: Visual Architecture Blueprints & Onboarding Wizard Transitions

```text
Build a premium React, TypeScript, and Tailwind Setup Onboarding Wizard and Self-Installation step list featuring interactive visual explanations and transitions.

1. Setup Onboarding Wizard (Steps 1 to 6):
   - Inside the expanded drawer of each step in the onboarding stepper wrapper, render a visually distinct Blueprint panel styled as a custom "Under the Hood: Technical Blueprint".
   - Set the background of the blueprint box to a deep slate tint with an electric blue or cyan accent border. Include high-quality icons matching each stage.
   - The panel must detail:
     * WHAT: The functional operational change taking place (e.g. decryption, prompt prefixing, webhook binding, pgvector semantic indexing, simulated canvas tracing, REST API transaction approval).
     * WHERE: The runtime environment context (e.g. secure browser local memory, local configuration files, self-hosted n8n routers, PostgreSQL pgvector schemas, in-browser visual canvas, Cloud Run containers).
     * WHY: The core business value and safety justification (e.g. compliance lockdowns, preventing LLM hallucinations, compute cost controls, factual grounding, safety validation, Human-in-the-Loop oversight).
     * HOW: The underlying mechanical execution (e.g. HMAC key signature checks, system prompt parameter injections, webhook triggers, cosine similarity matching, simulated coordinates processing, REST POST requests).
     * WHAT HAPPENS NEXT & WHY: Clear transition guidance explaining the logical bridge to the next onboarding step.

2. Landing Page Installation Steps (Steps 1 to 3):
   - At the bottom of the technical detail panels for the step-by-step installation guides on the SMB, Solopreneur, and Reseller landing pages, append a dedicated full-width transition warning section.
   - Style the warning section in an electric blue/cyan accent font with arrow icons.
   - Text must clearly guide the installer on the exact transition flow (e.g. registering trial licenses, provisioning Docker containers in private Google Cloud Run runtimes, and entering token keys inside the Operations Hub to configure duties and release their first HITL clearances).
```

---

## 💎 Prompt 8: Social Media Hub & Campaign Auto-Scheduler (T/Th/F Peak Cadence & Alerts Inbox)

```text
Build a premium React, TypeScript, and Tailwind CSS Social Media Hub dashboard component representing a campaign performance tracker, calendar scheduler, and activity alerts monitor.

DESIGN SYSTEM:
- Palette: Electric blue (#0084ff) and cyan spark (#00c6ff). Base background is deep dark slate (#030712) with card containers (#0b0f19) and subtle glowing border overlays.
- Font: Headings use Jonas Hecksher's "Play"; body uses "Inter".
- Status Badges:
  * APPROVED -> Purple badge with time/date.
  * PUBLISHING -> Pulsing gold/accent badge.
  * PUBLISHED -> Green success badge.
  * FAILED -> Red danger badge.

CADENCE & SCHEDULER ACTIONS:
1. Version & Cache Breaking:
   - On render, check if `localStorage.getItem('aiwx_campaign_version') === 'v3_tue_thu_fri'`. If not, clear 'aiwx_hub_posts' and 'aiwx_activity_alerts' and update version key.
2. Tues/Thurs/Fri Peak Hours Logic:
   - Refactor `syncAndStartScheduler()` to schedule posts:
     * Tuesdays: Threads (9:00 AM EST), Instagram (12:00 PM EST).
     * Thursdays: LinkedIn (10:00 AM EST), Threads (9:00 AM EST).
     * Fridays: LinkedIn (10:00 AM EST), Threads (9:00 AM EST), Instagram (12:00 PM EST), Facebook (10:00 AM EST).
     * Suffix scheduled IDs with platform (e.g. `post_01_linkedin`).
   - Sync scheduled queue items via POST `/api/schedule-campaign` and activate background process via `/api/toggle-scheduler`.
3. Quick Post Approve/Postpone:
   - Trigger async POST request `/api/update-post-status` to save status changes to backend instantly.

⚡ SOCIAL ACTIVITY SCANNER & INBOX (NEW TAB):
- Tab button "⚡ Activity Monitor" with glowing dot.
- Split-pane layout:
  * Left: Unresolved comment alerts feed (platform badge, username, comment text, timestamp, and a warning lead detection label for inquiries referencing price, scoping, HIPAA, integrations, or setup).
  * Right: Detailed HITL Reply Console containing editable textarea pre-populated with AI-drafted reply (calls `/api/generate-reply` or generates in-browser).
  * Clicking "HITL Publish Response" calls POST `/api/post-reply` to mock-publish and resolves comment status.
  * Clicking "Dismiss Inquiry" calls POST `/api/activity-alerts/resolve` to archive comment.
- Settings Checkboxes:
  * "Windows Desktop Notifications" (toggles OS level alerts on backend server).
  * "Browser Sound Alerts (Web Audio)" (synthesizes double chime tone C5/E5 on inbound comment).

LIVE TRAFFIC & CLICK SIMULATION AGENT (GA DASHBOARD TAB):
- Below the "Google Analytics 4 API Setup Required" guide, render "Live Traffic & Click Simulation Agent" card:
  * Toggle Switch: "Start/Stop Traffic Agent".
  * Metrics row: Impressions, Clicks, CTR, and Conversions.
  * Live Traffic Logs console terminal streaming simulated click events.
- When active, run a timer (every 3 seconds) that increments Impressions, Clicks (by platform), and Conversions, logging visitor interactions.
- Render two responsive SVG-based charts:
  * Line Chart: Total Click Traffic (last 7 days) drawn dynamically using SVG path.
  * Bar Chart: Click Distribution by Platform (LinkedIn, Threads, Instagram, Facebook) drawn using SVG rects.
  * Recalculate and redraw SVG charts automatically on metrics changes or window resize.
```
