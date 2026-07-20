# Lovable.ai Specification: Consultant Training Academy & Interactive Landing Page Tours
### Platform: CONVERGENCE-Ai Deployed Suites | Class: Architecture & Routing Blueprint | Version: 1.0
#### Purpose: High-Fidelity Prompt Prompt Specifications for Lovable.ai, Bolt.new, or v0.dev React Generation

Use this document to direct **Lovable.ai** (or your preferred AI development companion) to build the **Consultant Training Academy (with dynamic Docker auto-installer)** and integrate an **Interactive Step-by-Step Guided Setup Tour** on your high-converting landing pages.

---

## Part 1: Lovable.ai Prompt — Consultant Training Academy & Navigation Router

Copy and paste this entire prompt block into Lovable.ai to generate the multi-hub routing framework and the Consultant Enablement Portal.

```text
Please build a dedicated React component for the "CONVERGENCE-Ai Consultant Onboarding Academy & Installer Portal". This serves as our internal training hub where consultants validate client pre-conditions, compile Docker Compose auto-installer manifests on the fly, and take a certification quiz.

### 1. Global Navigation Routing & Redirect Requirements
Implement a unified router (e.g. React Router or unified navbar tabs) that establishes these seamless link redirects:
- `/` or `/landing` -> Landing Pages (SMB / Solopreneur)
- `/admin` or `/deploy` -> Super Admin Deployment Hub (deployment_hub.html)
- `/operations` or `/hub` -> Secure Client Operations Hub (index.html / operations_hub.html)
- `/academy` or `/training` -> Consultant Onboarding Academy (training_hub.html)

---

### 2. Tab Section A: Client Pre-Conditions Checklists
Provide an interactive, status-tracked checklist for consultants to audit client environments prior to deploying:
- **Server Cluster Node Audits**: Docker engine (v20.10+), Kubernetes namespaces, and DNS SSL termination keys.
- **Third-Party API Quotas**: MS Graph API OAuth credentials, Twilio SID credentials, and QuickBooks developer account access tokens.
- **KMS Environment injection variables**: Verifying `CONVERGENCE-Ai_KMS_KEY` exists in target server nodes.

---

### 3. Tab Section B: Dynamic Docker YAML Compose Auto-Installer Compiler
Create an interactive form that compiles a custom, production-grade Docker Compose config file in real-time.
- **Form Inputs**:
  - `Client identifier` (Input Text: e.g. "apexmed" or "solostudio").
  - `Exposed Port` (Input Number: e.g. "8080" or "3000").
  - `Database Platform` (Select Dropdown: "Supabase Cloud" | "Self-Hosted Postgres container").
  - `Max Memory Limits` (Select Dropdown: "2GB" | "4GB" | "8GB").
- **Dynamic Output Visualizer**:
  - Render a glowing, copy-pasteable `<textarea>` displaying a fully customized YAML manifest matching the consultant's inputs (integrating `dify-api`, `n8n`, and `supabase` service blocks).
  - Include an interactive **"Copy Installer Code"** button that changes status to a green "Copied!" checkmark.

---

### 4. Tab Section C: Consultant Certification Quiz Module
Build an interactive quiz for consultants to validate operational deployment, token handshakes, and security bypasses:
- Provide 4 multiple-choice questions.
- Once a consultant submits their choice, disable the buttons, render a glowing cyan explanation card for correct answers, or a red card for incorrect selections.
- **Pass Threshold**: Achieving 4/4 score marks the consultant as "CONVERGENCE-Ai Certified," triggering a visual certificate splash!

---

### 5. Styling Tokens (No Gold)
- Background: Black space charcoal (`bg-slate-950`) and slate panels (`bg-slate-900/50` with glassmorphic borders).
- Primary Accents: Brilliant Electric Blue (`text-blue-500` / `bg-blue-600`).
- Accent Highlights: Sky Blue/Cyan Sparkle (`text-cyan-400` / `bg-cyan-500`).
- Typography: Space Grotesk (headers) and Inter (body).
```

---

## Part 2: Lovable.ai Prompt — Interactive Step-by-Step Installation Setup Tour

Copy and paste this prompt block into Lovable.ai to add a highly engaging, visual, step-by-step onboarding walkthrough tour directly onto your SMB and Solopreneur landing pages.

```text
Please build an "Interactive Step-by-Step Guided Setup Tour" component for both the SMB and Solopreneur product landing pages. This tour should visually walk prospective clients and consultants through the seamless deployment journey, making it extremely clear how the agent operates.

### 1. Guided Tour UI Controller (Interactive Step Indicator)
Render a glowing step-by-step progress indicator at the top of the "How to Install/Deploy" section:
- **Steps**:
  - `Step 1: Secure KMS License` (The payment/trial funnel).
  - `Step 2: Account Visual Connect` (Visual OAuth mapping).
  - `Step 3: Setup HITL Guardrails` (Human control filters).
  - `Step 4: Launch Growth Sandbox` (Dynamic tracking).
- Clicking any step dynamically shifts the card display below, rendering active UI mockups and guided copy instructions.

---

### 2. Step-by-Step Interactive Slides / Visual Walkthroughs:

#### Slide 1: Secure Your Activation Key (Step 1)
- **Visual Mockup**: High-fidelity miniature replica of the secure purchase portal showing card inputs and an email field.
- **Guided Copy**: *"Input your credentials, secure your trial subscription container, and instantly generate a cryptographically valid KMS activation key. 100% risk-free 7-day cancellation shield is active."*
- **Action Trigger**: Click "Next Step" to animate transition.

#### Slide 2: Two-Click Visual connection (Step 2)
- **Visual Mockup**: Interactive mockup of the Visual Connect dashboard. Users can click emulated "Gmail Connect" or "Stripe Connect" buttons. Clicking transitions the button status to a glowing green checkmark.
- **Guided Copy**: *"No IT staff required. Non-technical solopreneurs simply visual-connect their active mailboxes, calendars, and Stripe accounts in under 5 minutes with our visual dashboard."*

#### Slide 3: Set Your Human-in-the-Loop Filters (Step 3)
- **Visual Mockup**: An interactive switchboard of control toggles:
  - `[Toggle: Auto-dispatch invoices]` (OFF - held in queue)
  - `[Toggle: Reschedule calendar slots]` (ON - automated)
  - `[Toggle: Send outbound email answers]` (OFF - held in queue)
- **Guided Copy**: *"Stay in complete operational command. Decide exactly which agent tasks run autonomously and which are held inside your secure HITL queue for manual sign-off."*

#### Slide 4: Launch Your Growth Sandbox (Step 4)
- **Visual Mockup**: Glowing process visualization showing tasks executing, a terminal spitting out active success logs, and a counter incrementing in real-time.
- **Guided Copy**: *"Observe your upskilled workflows live. The assistant fields leads, drafts invoices, and files data, empowering you to focus 100% of your energy on business growth, outreach, and reach expansion."*

---

### 3. Visual Styling Constraints
- Backgrounds: Dark slate base (`bg-slate-900`) with glass borders (`border-white/5`).
- Accents: Electric blue and sky-blue/cyan accents (`bg-cyan-500` / `text-blue-500`).
- Strict warning: **No gold/yellow elements**. All indicators, ticks, active lines, and glows must use sky blue, electric blue, or standard success green.
```
