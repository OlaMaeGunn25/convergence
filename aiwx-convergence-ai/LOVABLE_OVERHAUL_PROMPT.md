# CRITICAL OVERHAUL & SYSTEM-WIDE RE-INGESTION INSTRUCTIONS

> [!IMPORTANT]
> **TO THE AI ENGINE:** This upload contains a complete redesign, visual brand overhaul, and technical upgrade of our existing files. You MUST treat this upload as a fresh, top-level ingestion. Completely replace all previously cached versions of these pages and re-implement them from scratch using the provided files. Do NOT merge with old styles, templates, or logo configurations.

---

## 🎨 1. VISUAL BRAND REDESIGN (AiWorXmiths Accent System)
* Replace all previous branding (including any references to CONVERGENCE-Ai or gold accent themes) with the new **AiWorXmiths** design system:
  * **Brand Colors:** Deep dark navy/slate base backgrounds (`#002354`), electric blue (`#0086EF` / `#009EE6`) and cyan highlights, with clean white/grey typography.
  * **Branded Headers:** Load and render the transparent logo `aiwx_logo_transparent.png` (or `convergence-ai_logo_light.png` which has been overwritten with the new logo in the Admin Hub) next to the wordmark "AiWorXmiths" across all page headers.
  * **Aesthetics:** Maintain a premium glassmorphic dashboard feel with translucent cards, glowing indigo/cyan drop shadows, and high-quality status badges.

---

## 📋 2. CORE SYSTEM & COMPONENT INGESTIONS

### A. SMB Auditor Dashboard (Routed at `/admin/smb-auditor`)
* **State & Lifecycle Hook Variables:** Ensure strict client-side reactive states are bound to input controls (`domainInput`, `isLoading`, `logLines`, `activeAudit`, `ledger`, `searchQuery`).
* **Logs Console Timeline:** When an audit is triggered, play a scrolling console log sequence detailing DNS queries, firewall status, and regulatory filings searches with automated scrolling container refs.
* **API Handshake with Simulation Fallback:** Execute an async POST request to `/api/audit`. If it throws a network/CORS error (e.g. when static previews are hosted), gracefully execute a client-side mock simulation using vertical-accurate parameters (Retail, Tech, Health, Professional Services).
* **Robust Clipboard Copy Fallback:** All copy-paste triggers (like the "Copy Summary for ASES" and outreach script cards) must attempt the modern `navigator.clipboard.writeText` API, and fall back to creating an off-screen `<textarea>` DOM selection block if blocked by browser security restrictions.

### B. B2B Benchmark Report Generator (`benchmark.html`)
* **Sidebar Branding:** Load the transparent logo `aiwx_logo_transparent.png` and render the wordmark "BENCHMARK REPORT" in the sidebar header.
* **Individual Section Downloads:** Enable a download button (`📥 Download Section`) on all major cards. Clicking the button calls `downloadSection(containerId, sectionTitle)` to clone the node, strip print-only buttons, construct a Word-formatted HTML document, and download it as a `.doc` file named `${domain}_${sectionName}.doc`.
* **Dynamic Search & Compare Ingestion:** Wired input fields (`prospect-domain` and `prospect-known-tech`) and a trigger action calling `deployAuditSequence()` to crawl, scour registries, and load benchmark comparison states.

### C. Admin Assistant Operations & Deployment Hubs
* **White-Label Branding Engine:** Support dynamic style injection of primary/secondary colors and logo text initials configured via the Deployment Hub.
* **Onboarding & Setup Wizard:** A 6-step progress accordion with clear technical blueprints for each phase. Step 5 must animate the interactive SVG workflow flowchart and guide the user directly to the HITL approval queue.
* **Human-in-the-Loop (HITL) Queue:** Filter pending tasks based on vertical configurations (unless bypassed by Super Admin email suffixes like `@Agency Admin.com`). Splicing tasks updates metrics counters in real-time.
* **Upskilling & Rebranding Lock Overlays:** Implement glassmorphic blur lock overlays for the Workforce Upskilling Matrix (unlocks when `upskill: true` is decoded from the license key) and the Rebranding settings panel (restricted for Solopreneur licenses).

---

## 📂 3. UPLOADED FILE INGESTION MATRIX
Implement the layout, styles, and logic exactly as structured in the following uploaded files:
* **Styles & Tokens:** `styles.css` (Admin) and `/css/styles.css` (Auditor)
* **Client Pages:** `index.html` (Auditor), `benchmark.html` (B2B Benchmark Report), `social_media_hub.html` (Multiposting & Traffic simulator), `deployment_hub.html` (Super Admin console), `operations_hub.html` (Client Operations portal), `training_hub.html` (Consultant academy), and click-funnel landers (`smb_landing.html`, `solopreneur_landing.html`, `reseller_landing.html`).
* **Modules & Controllers:** `app.js` (Auditor core), `admin.js` (Auditor panel controller), and the client scripts contained within the `js/` directory.
