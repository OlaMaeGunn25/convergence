# Lovable.ai Specification: Consultant Assisted Installation & Support Page
### Platform: CONVERGENCE-Ai Deployed Suites | Class: Support & Troubleshooting Spec | Version: 1.0
#### Purpose: High-Fidelity Copy-Pasteable Prompt Specifications to Build the Assisted Support Page

Use this document to direct **Lovable.ai** (or your preferred AI development companion) to build the **CONVERGENCE-Ai Consultant Assisted Installation & Troubleshooting Support Page** (`support_hub.html` or `/support` endpoint). 

This page serves as a secure, shared console where a certified CONVERGENCE-Ai Consultant remote-guides non-technical business clients through server setups, verification handshakes, and diagnostic troubleshooting without requiring an internal IT lead.

---

## Part 1: Copy-Pasteable Prompt for Lovable.ai

Copy and paste this entire prompt block directly into Lovable.ai to generate and style the new Support Page.

```text
Please build a dedicated React page component for the "CONVERGENCE-Ai Consultant Assisted Installation & Support Hub" (served under the `/support` route or `support_hub.html`). 

This page is designed for clients who do not have an internal IT lead. It guides both the client and their certified CONVERGENCE-Ai Consultant step-by-step through remote-assisted installation, real-time diagnostic checks, and common troubleshooting resolutions.

Apply the following layout, content, and styling properties:

---

### 1. Header: Shared Remote Support Bridge
- **Visuals**: A sleek, dark-slate header displaying our electric blue and sky-blue sparkles logo.
- **Support Indicator**: A glowing cyan indicator stating: `● SHARED REMOTE SESSION ACTIVE | CONSULTANT CONNECTED`
- **Call-To-Action**: A button to `Request Live Screen-Share Callback` that opens an interactive callback schedule modal.

---

### 2. Main Section A: The 5-Step Assisted Installation Outline
Render an interactive, step-by-step accordion/progress wizard mapping the remote installation path:

#### Step 1: Secure Alignment Screen-Share
*   *Action*: The consultant launches a secure Zoom/Teams link directly from the support page.
*   *Details*: *"Consultant establishes a live screen-share with the client. No technical knowledge is required from the client—our consultant handles the heavy lifting while explaining each step."*

#### Step 2: Hosting Environment Provisioning
*   *Action*: Consultant runs our automated docker scripts on the client's simple cloud instance (e.g. AWS Lightsail, DigitalOcean, or private VPS).
*   *Details*: *"We configure an isolated private Docker container node. All client operational databases (PostgreSQL) and workflow tools are stood up securely under the client's target DNS."*

#### Step 3: Magic Token Decryption
*   *Action*: The consultant inputs the Activation Token generated from the super admin Deployment Hub.
*   *Details*: *"Entering the token automatically provisions their company name, brands the system with their colors, and securely unlocks their isolated industry vertical sandbox."*

#### Step 4: Visual Account Handshake
*   *Action*: The client securely enters their credentials via OAuth web prompts.
*   *Details*: *"To maintain absolute security, the client logs in to their Gmail, Google Calendar, and Stripe accounts. Credentials are encrypted using local AES-256 keys, entirely invisible to the consultant and external databases."*

#### Step 5: HITL Verification Drill
*   *Action*: Consultant clicks "Run Diagnostic Test Task" to inject a fake invoice discrepancy or scheduling conflict.
*   *Details*: *"We run a live test loop to ensure the Human-in-the-Loop (HITL) Queue successfully pauses and holds high-risk operations for client approval before we go live."*

---

### 3. Main Section B: Live Environment Diagnostic Suite
Build a diagnostic console showing live environment health checks:
- **Connection Checks**:
  1. API Endpoint Check: `HEALTHY (200 OK)` (Glowing green badge)
  2. KMS Vault Decryption Handshake: `VERIFIED` (Glowing cyan badge)
  3. Database Row-Level Security: `LOCKED (RLS Active)` (Glowing green badge)
  4. Integration Auth Token Status: `CONNECTED (Valid)` (Glowing green badge)
- **"Run Diagnostic Scan" Button**: Clicking it triggers an animated progress bar that updates diagnostic check marks.

---

### 4. Main Section C: Diagnostic Troubleshooting Guide
Render a grid of expandable troubleshooting cards to address common setup hiccups:
- **Card 1: Invalid Token Signature (Lock Screen)**
  - *Fix*: Ensure the token was generated from `deployment_hub.html` with correct domain matches. Re-generate a fresh 7-day trial key.
- **Card 2: Gmail Sync Authorization Block**
  - *Fix*: Ensure Google Workspace administrator grants API scopes. Re-run Step 4's OAuth login window.
- **Card 3: QuickBooks/Stripe Webhook Timeout**
  - *Fix*: Check server firewall ports (Nginx standard ports 80/443). Confirm webhook URLs inside the Supabase vault config.

---

### 5. Visual Styling Design Tokens (No Gold)
- Base Backdrop: Deep charcoal (`bg-slate-950`) and glass panels (`bg-slate-900/40` with thin translucent borders).
- Typography: Space Grotesk (headings) and Inter (body).
- Primary Accents: Brilliant Electric Blue (`text-blue-500` / `bg-blue-600`) and glowing drop shadows.
- Accent Highlights: Sky Blue/Cyan Sparkle (`text-cyan-400` / `bg-cyan-500`).
- Strict Warning: **No gold/yellow warning elements**. All alert status, glows, and indicators must be in cyan, sky blue, or standard green.
```
