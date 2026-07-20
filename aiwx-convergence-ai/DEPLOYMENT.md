# CONVERGENCE-Ai™ Cloud-Native AI Automations Hub Deployed Architecture & Operations Manual
### Product Owner: CONVERGENCE-Ai.com | Version: 1.0 | PROPRIETARY
#### Founders: Dahaomine Moody-Ward & Josette C. Kelley

This manual provides the developer blueprints, pre-conditions, security layouts, and open-source infrastructure specifications for the **CONVERGENCE-Ai™ Cloud-Native AI Automations Hub** (formerly CONVERGENCE-Ai Admin Assistant). 

---

## 1. Vault-Grade Security Architecture
To guarantee absolute vault-grade security (protecting client credentials, patient/medical records, and bookkeeping databases), every deployment follows a strict cryptographic design:

```
[Client Portal] ---> (HTTPS / TLS 1.3) ---> [API Gateway / OAuth Layer]
                                                  |
                                                  v
[Client KMS Vault] <--- (AES-256-GCM) <--- [Decryption Sandbox]
```

1. **Activation Licensing Handshake**:
   - **Super Admin (CONVERGENCE-Ai)** generates a sealed Base64 deployment token containing the designated vertical, database string, and access key.
   - **Client Operations Hub** remains entirely inactive until this token is decrypted using a local hardware environment key or server-side vault (KMS).
2. **Database Protection (Row-Level Security)**:
   - Deployed on **Supabase (PostgreSQL)** with Row-Level Security (RLS) active. Clients are separated by a strict `tenant_id` hash query.
   - All external keys (OpenAI, Twilio, QuickBooks) are encrypted at rest using **AES-256-GCM** inside the database vault, decrypted only inside ephemeral sandbox execution environments.

---

## 2. Production Open-Source Stack (Zero Vendor Lock-in)
To avoid high credit costs or vendor lock-in, the CONVERGENCE-Ai architecture employs top-tier open-source tools:

| Category | Recommended Open-Source Component | Rationale & Advantage |
| :--- | :--- | :--- |
| **Agentic Core** | **Dify.ai (Self-Hosted)** | Low-code RAG, prompt visualizer, and caching. Highly superior to Relevance. |
| **State Orchestrator** | **LangGraph / LangChain** | Handles cyclic agent loops and state-tracking for long-running workflows. |
| **Task Automation** | **n8n.io (Self-Hosted Community)** | Integrates directly with GSuite, Office, QuickBooks, and Sheets via custom workflows. |
| **Backend & Vault** | **Supabase / PostgreSQL** | Open-source Firebase alternative with enterprise-grade vaults and RLS. |
| **Voice & Phone** | **Twilio + Deepgram / ElevenLabs** | Inbound customer support speech synthesis and transcription pipelines. |

---

## 3. Pre-Conditions for Client Deployment
Before CONVERGENCE-Ai can spin up an instance for an SMB client, the following prerequisites must be active in the client's host environment:

- [ ] **Infrastructure Hosting**: A virtual machine/container cluster (e.g., Docker Compose, Kubernetes, or AWS ECS/GCP Cloud Run).
- [ ] **DNS & SSL Domains**: A dedicated sub-domain (e.g., `ai-assistant.clientcompany.com`) with active SSL/TLS 1.3 certificate termination.
- [ ] **External API Access Grants**:
  - Microsoft Graph API (for Office 365 Calendars & Outlook emails) or Google Workspace API.
  - Twilio SID & Auth Token (if answering phone calls).
  - QuickBooks Online developer credentials (for ledger bookkeeping).
- [ ] **Credential Vault Key**: An environmental parameter `CONVERGENCE-Ai_KMS_KEY` injected into the server container.

---

## 4. Deployed Step-by-Step Implementation Process

### Step 1: Provision the Server Containers
Deploy the open-source runner using Docker Compose on the client VM:
```yaml
version: '3.8'
services:
  aiwx-agent-dify:
    image: langgenius/dify-api:latest
    environment:
      - DB_USERNAME=postgres
      - DB_PASSWORD=your-secure-password
      - ENCRYPT_KEY=your-aes-encryption-key-for-credentials
    ports:
      - "5001:5001"
  aiwx-workflows-n8n:
    image: n8nio/n8n:latest
    environment:
      - N8N_ENCRYPTION_KEY=n8n-vault-key
    ports:
      - "5678:5678"
```

### Step 2: Super Admin License Activation
1. CONVERGENCE-Ai Super Admin opens the `deployment_hub.html`.
2. Enter the client details (e.g., "Apex Medical Care", "AMC").
3. Select **Exactly One** target industry vertical (e.g. `Medical & Healthcare`).
4. Select custom branding properties and API routes.
5. Click **Generate Activation Token** and copy the resulting cryptographic block.

### Step 3: Client Workspace Initialization
1. Spin up the client back-office operations console (`operations_hub.html`).
2. Paste the **Activation Token** into the secure lock panel.
3. The platform unlocks, restricting operations exclusively to the chosen vertical while setting company logo, fonts, and credentials vault mappings instantly.

---

## 5. Deployed Agent Training Methodology
To train the CONVERGENCE-Ai™ Cloud-Native AI Automations Hub to match Indeed administrative standards (scheduling, bookkeeping, phone answering, and writing memos), follow these direct injection protocols:

### A. Indeed Administrative Standard Alignment
1. **Writing Skills SOP**: Ingest brand templates and emails to teach the agent the business’s tone. The agent formats all letters with uniform header styles matching the company logo.
2. **Scheduling Calendars**: Ingest guidelines specifying appointment duration, preferred buffers (e.g., "Always add a 15-minute gap between patient slots"), and weekend rules.
3. **Filing & Bookkeeping**: Train the agent to match incoming invoice attachments to active purchase orders (PO), routing discrepancies directly to the human HITL queue if tolerances exceed 5%.

### B. Dynamic Process Mapping Mapping (Six Sigma DSI Standards)
The agent automatically maps input tasks using Six Sigma DSI standards:
- **SIPOC Diagram**: High-level tracking of customer requests, resource inputs, action procedures, outputs, and client receivers.
- **Swimlane Cross-Functional Diagrams**: Map routing loops across departments (e.g. Agent Drafts -> Admin Approves -> QuickBooks Release).
- **Decision Trees**: Strict conditions guaranteeing the AI system is entirely predictable.
