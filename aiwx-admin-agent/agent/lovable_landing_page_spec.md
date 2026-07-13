# Lovable.ai Landing Page Redesign: Master Specification Prompt
### Product Owner: CONVERGENCE-Ai.com | Version: 1.0 | PROPRIETARY
#### Target Systems: Lovable.ai, Bolt.new, v0.dev, or Custom React/Tailwind Frameworks

Copy and paste this entire specification document directly into **Lovable.ai** (or your preferred AI development companion) to instantly generate and redesign the premium, conversion-optimized landing pages for both the **SMB Market** and the **Solopreneur Market**.

---

## Part 1: Global Visual Style & Brand Design Tokens (No Gold)

Apply these global variables, layout properties, and styling guidelines across all generated pages:

*   **Primary Corporate Theme Color**: `#0084ff` (Brilliant Electric Blue).
*   **Secondary/Accent Theme Color**: `#00c6ff` (Sky Blue / Cyan).
*   **Base Backdrop**: Deep dark space charcoal (`#030712`) grading to dark slate surfaces (`#0b0f19`).
*   **Border Styling**: Glassmorphic borders (`rgba(255, 255, 255, 0.06)`) with subtle glowing shadows (`rgba(0, 132, 255, 0.15)`).
*   **Typography Framework (Google Fonts)**:
    *   *Headings / Titles*: `Space Grotesk`, sans-serif (Bold weight, tight letter-spacing `-0.02em`).
    *   *Body / UI Text*: `Inter`, sans-serif (Regular/Medium weights, line-height `1.5` to `1.6`).
*   **Raw SVG Sparkles Logo**: Render this raw inline SVG in the header and sidebars:
    ```xml
    <svg viewBox="0 0 200 60" width="160" height="48" style="display: block;">
        <!-- Sparkles -->
        <path d="M130 18 C130 12, 134 8, 140 8 C134 8, 130 4, 130 -2 C130 4, 126 8, 120 8 C126 8, 130 12, 130 18 Z" fill="#00c6ff" />
        <path d="M152 28 C152 23, 155 20, 160 20 C155 20, 152 17, 152 12 C152 17, 149 20, 144 20 C149 20, 152 23, 152 28 Z" fill="#0084ff" />
        <!-- Text -->
        <text x="10" y="44" font-family="'Space Grotesk', 'Inter', sans-serif" font-size="28" font-weight="700" fill="#ffffff">
            AiWor<tspan fill="#0084ff">X</tspan>miths
        </text>
    </svg>
    ```

---

## Part 2: Landing Page Specs — The SMB & Startup Market

### 1. Headline Strategy & Positioning
*   **Target Hook**: Cost reduction, data security (vault-grade), operational compliance, and Human-in-the-Loop oversight.
*   **Headline (Space Grotesk Bold)**: Scale Your Business Operations. Slash Administrative Spend.
*   **Subheadline (Inter Regular)**: Deploy secure, multi-tenant AI agents inside your host environment to automate phone calls, scheduling, bookkeeping, and invoices. Autonomy with oversight—monitored by your team, secured behind private vaults.
*   **Primary CTA Trigger**: Request Enterprise Demo
*   **Secondary CTA Trigger**: Explore Deployed Verticals

### 2. Main Page Layout Sections

#### Section A: Hero Showcase Block
*   **Mockup**: Render a high-fidelity visual mockup of the **CONVERGENCE-Ai Operations Hub** dashboard showing:
    1.  An animated process-flow diagram.
    2.  An active terminal window detailing live emulated agent logs.
    3.  A metric panel displaying "completed tasks."

#### Section B: Corporate Overhead vs. CONVERGENCE-Ai Cost Matrix
*   **Design**: A clean comparative pricing layout.
*   **Copy**:
    *   *Human Administrative Assistant*: High overhead ($45,000 average salary + benefits, payroll tax, sick leave) with restricted 40hr limits.
    *   *CONVERGENCE-Ai Admin Assistant*: Flat-tier pricing ($249/mo subscription), active 24/7/365, zero liability, and instant workflow scalability.

#### Section C: Interactive SVG Swimlane Flowchart (Six Sigma DSI Standard)
*   **Design**: Render an SVG diagram representing a **Procure-to-Pay (P2P)** Swimlane flowchart:
    `Incoming Invoice` ──> `Data OCR Extraction` ──> `PO Match Check` ──> `Decision Block: Tolerance OK?` ──> `Human Verification Queue (HITL)` ──> `Release Ledger Post`.
*   **Visual Highlights**: The active node during scroll should glow with an electric blue border, with the Human Verification node colored in cyan.
*   **Copy**: "Your operational procedures are complex. Our system executes tasks systematically node-by-node. The agent automatically diagrams, schedules, and handles travel manifests according to strict process rules."

#### Section D: Human-in-the-Loop (HITL) Queue Card
*   **Design**: An interactive task approval widget.
*   **Simulated Task**: `Task ID: T-1003 | Amount: $4,850.00 | Supplier: Acmax Corp | PO Match: Success. Action: Release payment.`
*   **Interaction buttons**: `[Approve & Release]` (glowing green success) and `[Request Revision]` (cyan).
*   **Copy**: "Never worry about an AI acting out of bounds. All financial payouts, outward customer emails, and scheduling overrides route to your secure HITL Queue first, requiring physical administrator sign-off."

#### Section E: Growth SMB Pricing Spotlight Card
*   **Design**: Premium spotlight card displaying:
    *   **Price**: **$249/month**
    *   **Included Features**: 1 locked industry vertical container, 5 active agent assistants, full integrations, process mapping studio, shared HITL console for 3 users.

---

## Part 3: Landing Page Specs — The Solopreneur Market

### 1. Headline Strategy & Positioning
*   **Target Hook**: Time saving, burnout relief, administrative dread elimination, and 1-click simple integrations.
*   **Headline (Space Grotesk Bold)**: Stop Doing Admin Work. Reclaim 15+ Hours Every Week.
*   **Subheadline (Inter Regular)**: Deploy a secure, 24/7 digital virtual assistant designed specifically for solo operators. Automatically answers leads, schedules calendar slots, sorts invoices, and dispatches follow-ups—all for under $100/mo.
*   **Primary CTA Trigger**: Activate Your Solo Assistant ($99/mo)
*   **Secondary CTA Trigger**: Test Your Burnout Level

### 2. Main Page Layout Sections

#### Section A: The Administrative Burnout Calculator
*   **Design**: Interactive checkbox list styled with glassmorphism.
*   **Checklist Toggles**:
    *   [ ] I spend more than 2 hours a day on emails, billing, and invoices.
    *   [ ] I have lost warm leads because I couldn't respond fast enough.
    *   [ ] Hiring a human virtual assistant ($2,500/mo) is out of my budget.
    *   [ ] I am burnt out from managing scheduling clashes and calendar ping-pong.
*   **Dynamic Response Action**: When a user selects any option, display a glowing cyan alert:
    `"Immediate ROI: Reclaiming just 15 hours a week represents $4,500 in new monthly billable capacity. CONVERGENCE-Ai covers this administrative load for a flat $99/mo."`

#### Section B: One-Click Connection Hub
*   **Design**: A clean visual connector grid showing popular solo platforms (Gmail, Google Calendar, Stripe, Twilio, Slack) linking to a single glowing CONVERGENCE-Ai core.
*   **Copy**: "Connects to your workspace in 2 clicks. No coding required. No complicated developer configurations. Connect your accounts and your assistant is ready to operate immediately."

#### Section C: 24/7 Administrative Task Slider
*   **Design**: Responsive swipeable card carousel.
*   **Included Slides**:
    1.  *Lead Fielding*: "Instantly fields inbound questions and schedules warm leads directly into your calendar."
    2.  *Calendar Master*: "Negotiates slots with clients, schedules appointments, and sends confirmations."
    3.  *Stripe Invoicing*: "Drafts, audits, and dispatches invoices to clients, recording payments automatically."

#### Section D: Solo Practitioner Pricing Spotlight Card
*   **Design**: Approachable, high-contrast spotlight card:
    *   **Price**: **$99/month**
    *   **Included Features**: 1 active industry vertical container, 2 active digital agents (scheduling and lead fielding), standard integrations (Gmail, Google Drive, Stripe), and full Human-in-the-Loop verification checks.
