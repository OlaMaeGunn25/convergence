# Lovable.ai Specification: Integrations FAQ & Brand Voice Training
### Platform: CONVERGENCE-Ai Deployed Suites | Class: Landing Page FAQ Spec | Version: 1.0
#### Purpose: High-Fidelity Prompt Specifications to Build Integrations FAQ on Landing Pages

Use this document to direct **Lovable.ai** (or your preferred AI development companion) to add a premium, high-converting **"Flexible Integrations & Brand Voice Training FAQ"** section to all three product landing pages. This section directly addresses common client questions regarding non-QuickBooks setups, personal Gmail accounts, and custom brand voice calibration.

---

## Part 1: Copy-Pasteable Prompt for Lovable.ai

Copy and paste this entire prompt block directly into Lovable.ai to generate the new FAQ sections.

```text
Please add an interactive, glassmorphic "Flexible Integrations & Brand Voice Training FAQ" accordion component to all three landing pages (SMB, Solopreneur, and Reseller). 

This section must reassure non-technical clients and prospective resellers about platform flexibility, detailing support for alternative systems, personal accounts, and custom brand voice calibration.

Apply the following copy, questions, and styling properties:

---

### Question 1: What if our business doesn’t use QuickBooks for bookkeeping?
*   **Answer**: 
    "Our self-hosted n8n workflow runner is completely modular. If your business doesn't use QuickBooks Online, swapping your bookkeeping ledger is simple. 
    
    Out-of-the-box, we support native, secure integrations for **Xero, FreshBooks, Wave, Zoho Books, or even standard Google Sheets/Excel spreadsheets** as a lightweight ledger. Changing the accounting system only requires updating the n8n API node inside your container database, leaving your front-end Operations Hub and RAG logic completely untouched."

---

### Question 2: What if we don't have Google Workspace? Can we use a personal Gmail account?
*   **Answer**: 
    "Yes, absolutely! Standard personal `@gmail.com` accounts are fully supported. 
    
    During the visual connection setup, you simply authenticate using Google's secure OAuth 2.0 gateway or establish an encrypted SMTP/IMAP protocol connection using a standard **Google App Password**. Standard Gmail accounts operate out-of-the-box perfectly, though Google Workspace accounts are recommended for higher daily API rate quotas."

---

### Question 3: Can we train the AI agent on our specific brand voice, templates, and systems?
*   **Answer**: 
    "Yes! This is the ultimate competitive advantage of our private container architecture. Every deployed instance is trained and calibrated specifically for your brand:
    
    1. **Brand Voice RAG Ingestion**: You can upload existing email archives, copywriting samples, style guides, and customer support templates directly into the **RAG Knowledge Base** inside your private container. The agent automatically references this local semantic index to match your exact tone of voice in every draft.
    2. **Custom SOPs Integration**: Ingest your company's Standard Operating Procedures (SOPs), clinic guidelines, or booking buffers into the system's vector database. The agent references these strict instructions during intent routing.
    3. **Private Systems Registry**: Your Operations Hub includes an in-app integrations console, allowing you or your certified CONVERGENCE-Ai Consultant to easily map custom webhooks to whatever CRM, database, or tool (such as HubSpot, Notion, or custom SQL databases) your business already uses."

---

### 4. Visual Styling Design Tokens (No Gold)
- Base Backdrop: Deep slate base (`bg-slate-950`) with glass cards and thin borders (`border-white/5`).
- Typography: Space Grotesk (headings) and Inter (body).
- Primary Accents: Brilliant Electric Blue (`text-blue-500` / `bg-blue-600`) and glowing drop shadows.
- Accent Highlights: Sky Blue/Cyan Sparkle (`text-cyan-400` / `bg-cyan-500`).
- Strict Warning: **No gold/yellow warning elements**. All alert status, glows, and indicators must be in sky blue, electric blue, or success green.
```
