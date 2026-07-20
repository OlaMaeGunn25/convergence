# Technical Product Specifications: CONVERGENCE-Ai Admin Assistant™ Deployed Suite
### Product Owner: CONVERGENCE-Ai.com | Class: Master System Architecture Blueprint | Version: 1.0
#### Purpose: High-Fidelity Prompt Specification for Lovable.ai React/Tailwind Deploys

This document provides the complete technical specifications, state engines, SVG mapping coordinates, and visual tokens required to rebuild the entire **CONVERGENCE-Ai Admin Assistant™** product suite in a modern React, TypeScript, and Tailwind CSS stack on Lovable.ai.

---

## 1. Global Visual & Brand Design System (No Gold)

To maintain compliance with the active branding of **convergence-ai.com**, Lovable must apply these styling constraints:

*   **Primary Palette (Electric Blue)**: `#0084ff` (Tailwind equivalent: `bg-blue-600` / `text-blue-500`).
*   **Secondary Palette (Sky Blue / Cyan Sparkle)**: `#00c6ff` (Tailwind: `bg-cyan-400` / `text-cyan-400`).
*   **Base Backdrop**: Deep dark space charcoal (`#030712`) and slate card surfaces (`#0b0f19`).
*   **Borders**: Translucent glassmorphism borders (`rgba(255, 255, 255, 0.06)`) with glowing drop shadows (`rgba(0, 132, 255, 0.15)`).
*   **Fonts**: Headings use `Space Grotesk` (letter-spacing: `-0.02em`, bold weights); body and UI text use `Inter` (regular-medium).
*   **Raw SVG Corporate Logo**:
    ```xml
    <svg viewBox="0 0 200 60" width="160" height="48" style="display: block;">
        <path d="M130 18 C130 12, 134 8, 140 8 C134 8, 130 4, 130 -2 C130 4, 126 8, 120 8 C126 8, 130 12, 130 18 Z" fill="#00c6ff" />
        <path d="M152 28 C152 23, 155 20, 160 20 C155 20, 152 17, 152 12 C152 17, 149 20, 144 20 C149 20, 152 23, 152 28 Z" fill="#0084ff" />
        <text x="10" y="44" font-family="'Space Grotesk', sans-serif" font-size="28" font-weight="700" fill="#ffffff">
            AiWor<tspan fill="#0084ff">X</tspan>miths
        </text>
    </svg>
    ```

---

## 2. Core State Management & Schema

The entire platform shares a central React state hook or unified global store:

```typescript
interface TenantConfig {
  companyName: string;
  vertical: string; // 'medical' | 'legal' | 'realestate' | 'retail' | 'hospitality' | 'finance' | 'construction' | 'logistics' | 'education' | 'tech' | 'professional' | 'nonprofit' | 'events'
  logoText: string;
  primaryColor: string;
  secondaryColor: string;
  apiEndpoint: string;
  vaultKey: string;
}

interface HITLTask {
  id: string;
  vertical: string;
  type: string;
  details: string;
  status: 'pending' | 'completed';
  time: string;
  action: string;
}

interface PlatformState {
  isSuperAdmin: boolean;
  isActivated: boolean;
  tenantConfig: TenantConfig;
  hitlQueue: HITLTask[];
  completedCount: number;
  activeProcessNodeIndex: number;
}
```

---

## 3. Component Specification 1: Super Admin Deployment Hub

*   **File Origin**: Deployed on the central admin host (`deployment_hub.html`).
*   **Purpose**: Remotely configures, licenses, and provisions target client environments.

### Technical Capabilities:
1.  **Client Parameters Collector Form**:
    *   `deployCompany` (Input Text: e.g. "Apex Medical Care").
    *   `deployLogo` (Input Text short, default "AW" / "CONVERGENCE-Ai").
    *   `deployVertical` (Select Dropdown: Select exactly 1 of 12 verticals).
    *   `deployColor1` & `deployColor2` (HTML Color Pickers: default to `#0084ff` and `#00c6ff`).
    *   `deployEndpoint` (Input URL: Target container location).
    *   `deployVault` (Input Password: Credential KMS key).
2.  **Cryptographic License Handshake Token Generator**:
    *   *Algorithm*: Generates a three-part Base64 activation signature payload:
        *   `Header` (Base64 string of `{ alg: "AES256GCM", typ: "CONVERGENCE-Ai-LIC" }`).
        *   `Body` (Base64 string of `{ iss: "CONVERGENCE-Ai.com", company, vert, ep, vlt, c1, c2, logo, iat }`).
        *   `Signature` (Encrypted/hashed signature token).
3.  **MRR Recurring Margins Modeler**:
    *   *Inputs*: Selection Tier Select ($99, $199, $499) and Active Volume dropdown (5 to 100).
    *   *Calculation*: `Monthly MRR = Tier Cost * Active Volume`. Displays net margins with estimated self-hosted infrastructure COGS ($35/mo per container).

---

## 4. Component Specification 2: Client Deployed Operations Hub

*   **File Origin**: Deployed in the client's isolated workspace (`operations_hub.html` / `index.html`).
*   **Purpose**: The central workspace for client administrative tasks.

### Technical Capabilities:
1.  **Secure Activation Vault Modal overlay**:
    *   Hides the main interface behind a secure lock overlay until activated.
    *   Input Fields: Cryptographic License Token + Administrator Email Address.
2.  **Super Admin Bypass Engine**:
    *   *Regex validation*: If the administrator email address matches `aiworxmiths@gmail.com` or has the `@convergence-ai.com` suffix:
        *   `isSuperAdmin` state is set to `true`.
        *   Unlocks a **Super Admin Lock Bypass** vertical switcher in the dashboard header.
3.  **Active Vertical Constraint**:
    *   If a standard client token is entered (without Admin email validation), `isSuperAdmin` remains `false`.
    *   The platform restricts the UI exclusively to the single vertical defined inside the activation token, hiding or disabling the other 11 modules to enforce multi-tenant licensing rules.
4.  **Rebranding Overrides Engine**:
    *   Reads color strings from the activation token.
    *   Dynamically overwrites CSS root properties (`--primary-color`, `--secondary-color`) on the body, updating logos and glows instantly.

---

## 5. Component Specification 3: Six Sigma SVG Process Mapping Canvas

*   **Purpose**: Real-time visualization of agentic decision paths.

### Coordinate Mappings (SVG viewBox "0 0 800 400"):

#### A. Procure-to-Pay (P2P) Flowchart Mappings
*   *Title*: "Procure-to-Pay Invoice Mapping (Six Sigma Swimlane)"
*   *Node Mappings*:
    *   Node 0: "Start: Invoice Input" (x: 60, y: 70, shape: "circle", type: "standard")
    *   Node 1: "Data OCR Extraction" (x: 190, y: 70, shape: "rect", type: "standard")
    *   Node 2: "Invoice-PO Match" (x: 320, y: 70, shape: "rect", type: "standard")
    *   Node 3: "Tolerance OK?" (x: 450, y: 70, shape: "diamond", type: "decision")
    *   Node 4: "Human Verification" (x: 450, y: 220, shape: "rect", type: "hitl")
    *   Node 5: "Post to QuickBooks" (x: 600, y: 70, shape: "rect", type: "standard")
    *   Node 6: "End: Release ACH" (x: 740, y: 70, shape: "circle", type: "standard")
*   *Paths*:
    *   `Node 0 ──> 1 ──> 2 ──> 3`
    *   `Node 3 ──(Yes)──> 5`
    *   `Node 3 ──(No)──> 4 ──(Approved)──> 5`
    *   `Node 5 ──> 6`

#### B. Twilio Phone Fielding Mappings
*   *Title*: "Inbound Call Routing (Basic Flowchart)"
*   *Node Mappings*:
    *   Node 0: "Incoming Call" (x: 60, y: 150, shape: "circle")
    *   Node 1: "Speech-to-Text" (x: 190, y: 150, shape: "rect")
    *   Node 2: "Intent Audit" (x: 320, y: 150, shape: "rect")
    *   Node 3: "General FAQ?" (x: 450, y: 150, shape: "diamond")
    *   Node 4: "Emergency Escalation" (x: 450, y: 290, shape: "rect", type: "hitl")
    *   Node 5: "Auto-Answer" (x: 600, y: 150, shape: "rect")
    *   Node 6: "End: CRM Log" (x: 740, y: 150, shape: "circle")

#### C. Travel & Logistics Mappings
*   *Title*: "Logistics: Corporate Travel Booking (SIPOC Map)"
*   *Node Mappings*:
    *   Node 0: "Travel Request" (x: 60, y: 120, shape: "circle")
    *   Node 1: "Cost Opt" (x: 190, y: 120, shape: "rect")
    *   Node 2: "Policy Compliance" (x: 320, y: 120, shape: "rect")
    *   Node 3: "In Budget?" (x: 450, y: 120, shape: "diamond")
    *   Node 4: "Flight Override" (x: 450, y: 260, shape: "rect", type: "hitl")
    *   Node 5: "Confirm Booking" (x: 600, y: 120, shape: "rect")
    *   Node 6: "End: Send Itinerary" (x: 740, y: 120, shape: "circle")

### Simulation Engine Specification:
*   A React `useEffect` timer (2500ms intervals) updates `activeProcessNodeIndex`.
*   Applies a `.active` CSS state to Node shapes and paths matching the active index.
*   **HITL Intercept**: When `activeProcessNodeIndex` hits `type: "hitl"` (Node 4), the interval freezes, pausing execution until the administrator triggers the Approve action.

---

## 6. Component Specification 4: Human-in-the-Loop (HITL) Queue

*   **Purpose**: Reviewing, approving, and correcting agent-drafted operations before execution.

### Functional Mechanics:
*   **Queue Filtering**:
    *   If `isSuperAdmin` is `true`: The queue displays all pending tasks across all verticals for multi-tenant testing.
    *   If `isSuperAdmin` is `false`: Filters the queue to only display tasks matching the active `vertical` parameter inside `tenantConfig`.
*   **Interactive Row Actions**:
    *   `Approve & Release`: Splices the item out of the array, increments the completed task counter, prints an operational trace inside the log console, and restarts the SVG Mapping Studio's simulation timer.
    *   `Revise / Correct`: Alters task status, prompting a text amendment override in the database.

---

## 7. Component Specification 5: Consultant Onboarding Academy

*   **File Origin**: Deployed in your workspace (`training_hub.html`).
*   **Purpose**: Enablement module for internal training.

### Technical Capabilities:
1.  **Docker YAML Compiler**:
    *   Input Fields: Client Key identifier (default "apexmed"), exposed port, target model framework.
    *   React Output: A dynamic, interactive `textarea` compiling a fully custom Docker Compose file in real-time.
2.  **Certification Quiz Controller**:
    *   Maintains active quiz indexes, disabling question buttons upon selection and rendering custom cyan/red explanation cards explaining RLS database isolation, JWT activation token parameters, and HITL protocols.
