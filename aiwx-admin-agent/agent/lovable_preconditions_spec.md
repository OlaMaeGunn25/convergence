# Lovable.ai Specification: Comprehensive Pre-Conditions Blueprint
### Platform: CONVERGENCE-Ai Deployed Suites | Class: System Requirements Spec | Version: 1.0
#### Purpose: High-Fidelity Prompt Specifications to Build Pre-Condition Sections on Landing Pages

Use this document to direct **Lovable.ai** (or your preferred AI development companion) to build dedicated, high-converting **"System Pre-Conditions & Technical Prerequisites"** grids/cards on your three landing pages:
1.  **Solopreneur Landing Page** (No-IT Visual Requirements)
2.  **SMB Landing Page** (Enterprise Infrastructure Requirements)
3.  **Reseller Landing Page** (Agency Orchestration Requirements)

---

## Part 1: Copy-Pasteable Prompt for Lovable.ai

Copy and paste this entire prompt block directly into Lovable.ai to generate the prerequisites sections.

```text
Please build dedicated, responsive, and visually stunning "System Pre-Conditions & Prerequisites" sections for our three target market landing pages. 

Each page has completely different operational requirements based on their deployment style. Ensure that the lists are structured to reinforce our key selling points: zero IT complexity for Solopreneurs, vault-grade sovereignty for SMBs, and reseller leverage for Agency Partners.

Apply the following copy and visual guidelines:

---

### List 1: Solopreneur Pre-Conditions (To add to 'Solopreneurs Transition Hub')
*Positioning: Fast, visual, everyday accounts—zero coding or IT staff required.*

- **Google or Microsoft Account**: An active Google Workspace account (Gmail & Google Calendar) or Microsoft Outlook/Exchange account.
- **Stripe Merchant Account**: An active Stripe merchant profile (free to set up) to automate client invoicing and payment collections.
- **Modern Web Browser**: A standard browser (Chrome, Safari, Edge, Firefox) with local browser storage (`localStorage`) enabled.
- **Standard Internet Connection**: Standard high-speed internet to load the visual Operations Hub interface.
- **Twilio Account (Optional)**: If you wish to route telephone voice calls (otherwise, standard email and scheduler agents operate out-of-the-box).

---

### List 2: SMB & Growing Startup Pre-Conditions (To add to 'SMB Operations Hub')
*Positioning: Secured in your environment—setup collaboratively with your IT Staff or an CONVERGENCE-Ai Consultant.*

- **Server Hosting Environment (Choose One)**: 
  *   *Option A (Self-Hosted)*: A private virtual machine (VPS) or cloud cluster node (AWS Lightsail/ECS, GCP Cloud Run, DigitalOcean, or Azure VM) running Docker Engine (v20.10+).
  *   *Option B (Managed Google Cloud)*: **CONVERGENCE-Ai Managed Google Cloud Instance** resold and provisioned directly by CONVERGENCE-Ai for a flat **$79/month** compute retainer. Highly recommended for clients without internal servers or dedicated IT leads—we spin up and fully manage your isolated GCP Docker container cluster for you!
- **SSL-Terminated Subdomain**: A dedicated corporate subdomain (e.g. `aiwx.yourcompany.com`) with active SSL/TLS 1.3 certificate termination.
- **API Access Authorizations**:
  - Microsoft Graph API OAuth 2.0 or Google Workspace API tokens (to sync company mailboxes and employee roster calendars).
  - Twilio SID & Auth Tokens (if executing Twilio voice triage lines).
  - QuickBooks Online Developer Credentials (if executing Procure-to-Pay ledger entries).
- **Environmental Security Key**: A private environmental variable `CONVERGENCE-Ai_KMS_KEY` injected into the host server to authorize the local AES-256 credentials vault.

---

### List 3: Agency Reseller & Partner Pre-Conditions (To add to 'Solopreneurs Reseller Hub')
*Positioning: Resell, white-label, and manage multiple client portals with high-margin recurring retianers.*

- **Active CONVERGENCE-Ai Partner License**: Your master Reseller License key giving you full access to the Super Admin Deployment Hub.
- **Completed Consultant Certification**: Successful completion of the onboarding modules and quiz inside our Consultant Training Hub (`training_hub.html`).
- **Partner Billing Integration**: A Stripe Developer or Partner account to handle wholesale-to-retail billing captures for your client retainers.
- **Master Agency VPS / Demo Server**: A simple virtual machine to host white-labeled demo portals for pitching local prospects.
- **Basic Docker Familiarity**: Understanding basic compose setups (100% upskilled and automated by our built-in Consultant Onboarding guides).

---

### 4. Visual Layout & Style Guidelines (No Gold)
- Grid: Render these lists as highly modern, interactive checklists inside glassmorphic grids (`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`).
- Icons: Use premium FontAwesome icons (Electric Blue `text-blue-500` / Sky Blue `text-cyan-400`) in front of each prerequisite.
- NO GOLD or warning accents. All status badge checkmarks, active lines, and glows must use sky blue, electric blue, or success green.
```
