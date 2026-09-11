/*
   CONVERGENCE-Ai™ Finance & Bookkeeping Agent Registry
   Machine-readable source of truth for bounded, control-audited finance automations for
   SMB firms — derived from docs/FINANCE_AGENT_REQUIREMENTS.md and the Graph-of-Thought
   derivations in docs/FINANCE_GOT_PROMPTS.md.

   NON-NEGOTIABLE governance (see FINANCE_AUDIT below):
   1. Double-entry integrity — every posting balances; no un-reconciled money movement.
   2. Segregation of duties + dual approval — the agent that prepares a payment never
      releases it; releases above threshold require human approval.
   3. Source-matched — every ledger entry ties to a source document (invoice/PO/receipt/
      bank feed) with an audit reference. No fabricated amounts.
   4. Human-owned money movement — payments, wires, journal posts above threshold, and
      payroll runs are human-approved (HITL). Agents prepare, match, and reconcile.
   5. Human-owned tax filing — no tax return, extension, or e-file is submitted
      autonomously. Agents assemble workpapers and drafts; a licensed preparer reviews,
      signs, and e-files (T1-preparer-signoff).

   The registry spans two layers:
   • Accounting / bookkeeping — general ledger, bank feeds, payments, expense, payroll.
   • Practice management / tax — the firm operating system (Karbon/TaxDome), client intake,
     document collection, tax-prep assembly, follow-up, deadlines, firm workflow. The
     administrative work *surrounding* the CPA/preparer — organizers, missing W-2s/1099s,
     status Q&A, signatures, invoice collection, deadline reminders — is the automation
     target, never the professional judgement itself.

   Connectors referenced here (quickbooks, xero, karbon, taxdome, netsuite, plaid, stripe,
   paypal, expensify, hubdoc, gusto, dandb) are defined in integrations.js.
*/

/* ------------------------------------------------------------------ *
 * 1. Source/system registry (finance systems already wired as connectors).
 * ------------------------------------------------------------------ */
export const FINANCE_SOURCE_REGISTRY = {
    quickbooks: { name: "QuickBooks Online", role: "general-ledger", provides: ["ledger, invoices, bills, journal entries"], auth: "OAuth2 per-tenant company realm" },
    xero:       { name: "Xero", role: "general-ledger", provides: ["accounts, invoices, contacts, bank transactions, payments, journals, reports, tax data"], auth: "OAuth2 per-tenant Xero organisation — official MCP server + AI toolkit" },
    karbon:     { name: "Karbon", role: "practice-management", provides: ["client records, organizations, work items, invoices, payments, custom fields, files, webhooks; recognizes Xero/QBO/ProConnect external IDs"], auth: "API key / OAuth per-tenant firm" },
    taxdome:    { name: "TaxDome", role: "practice-management", provides: ["CRM, workflow, documents, client portal, billing, e-signatures, organizers"], auth: "API per-tenant firm" },
    netsuite:   { name: "NetSuite ERP", role: "erp-ledger", provides: ["GL, payroll journals, procurement POs"], auth: "OAuth2 / token per-tenant account" },
    plaid:      { name: "Plaid", role: "bank-feed", provides: ["bank feeds, balances, ACH transfers"], auth: "OAuth2 / Link tokens per-tenant items" },
    stripe:     { name: "Stripe", role: "payments-ar", provides: ["subscriptions, invoices, charges, payouts"], auth: "OAuth2 / restricted key per-tenant" },
    paypal:     { name: "PayPal", role: "payments-ar", provides: ["deposits, settlements, refunds"], auth: "OAuth2 per-tenant merchant" },
    expensify:  { name: "Expensify", role: "expense", provides: ["receipt OCR, expense reports, card matches"], auth: "API credentials per-tenant" },
    hubdoc:     { name: "Hubdoc", role: "document-ocr", provides: ["vendor receipt/invoice OCR, metadata extraction"], auth: "OAuth2 per-tenant" },
    gusto:      { name: "Gusto", role: "payroll", provides: ["payroll runs, tax filings"], auth: "OAuth2 per-tenant company" },
    dandb:      { name: "Dun & Bradstreet", role: "risk", provides: ["supplier credit/risk scoring"], auth: "API key per-tenant" }
};

/* ------------------------------------------------------------------ *
 * 2. Control audit — the anti-error / anti-fraud contract.
 * ------------------------------------------------------------------ */
export const FINANCE_AUDIT = {
    principle: "Every ledger action balances (double-entry), ties to a source document, and separates preparation " +
        "from release. Money moves only with human approval above threshold. No tax return is e-filed without a " +
        "licensed preparer's signature. Nothing is fabricated.",
    gates: [
        { id: "F1-balanced", name: "Double-entry balances", check: "Debits == credits for every posting; trial balance stays balanced. Unbalanced → rejected." },
        { id: "F2-sourced", name: "Source-document matched", check: "Every entry references a source doc (invoice/PO/receipt/bank line) with an audit id; amounts match within tolerance. Unmatched → exception queue." },
        { id: "F3-authorized", name: "Segregation + authorization", check: "Preparer != approver; releases above threshold require human approval; duplicate-payment check passes." },
        { id: "T1-preparer-signoff", name: "Preparer sign-off before filing", check: "No tax return, extension, or e-file is submitted without a licensed preparer's review + signature. Agents assemble workpapers and drafts only; autonomous filing → blocked." }
    ],
    threePointMatch: "AP invoices pass a PO ↔ receipt ↔ invoice 3-way match within tolerance before posting.",
    perEntryRequirement: "{ entry, debit, credit, sourceDocId, sourceSystem, matchStatus, postedBy(agentId), timestamp }",
    perActionRequirement: "{ actor(agentId), inputs, sourceDocs[], gatesPassed[], approver?, amount, timestamp, contentHash } — immutable audit log",
    onFailure: "Route to the exception/HITL queue with the failing evidence. No silent auto-post, no forced balance."
};

export const FINANCE_HITL_HARD_RULE =
    "Agents prepare, match, reconcile, and assemble. A human approves every payment, wire, payroll run, and journal " +
    "post above threshold; a licensed preparer reviews, signs, and e-files every tax return or extension. The agent " +
    "that prepares a payment never releases it, and no agent files a return (segregation of duties + preparer sign-off).";

/* ------------------------------------------------------------------ *
 * 3. Bounded agents.
 * ------------------------------------------------------------------ */
export const FINANCE_AGENTS = {
    accounts_payable: {
        id: "accounts_payable",
        name: "Accounts Payable / Procure-to-Pay Agent",
        purpose: "Ingest bills, run 3-way match, prepare payments for approval.",
        sources: ["hubdoc", "quickbooks", "netsuite", "plaid", "dandb"],
        actions: ["ingest-invoice", "three-way-match", "code-gl-account", "prepare-payment", "schedule-ach"],
        audit: ["F1-balanced", "F2-sourced", "F3-authorized"],
        hitlGates: ["payment-release", "wire", "match-exception"],
        degradeMode: "prepare + match only; a human releases every payment"
    },
    reconciliation: {
        id: "reconciliation",
        name: "Bank & Ledger Reconciliation Agent",
        purpose: "Match bank feeds to ledger, flag discrepancies, propose adjustments.",
        sources: ["plaid", "quickbooks", "netsuite", "stripe", "paypal"],
        actions: ["import-bank-feed", "auto-match", "flag-discrepancy", "propose-adjustment"],
        audit: ["F1-balanced", "F2-sourced"],
        hitlGates: ["adjusting-journal-entry"],
        degradeMode: "match + flag; a human approves adjustments"
    },
    accounts_receivable: {
        id: "accounts_receivable",
        name: "Invoicing & Collections Agent",
        purpose: "Issue invoices, track settlements, run dunning within policy.",
        sources: ["stripe", "paypal", "quickbooks"],
        actions: ["issue-invoice", "sync-settlement", "dunning-reminder", "aging-report"],
        audit: ["F1-balanced", "F2-sourced"],
        hitlGates: ["write-off", "refund"],
        degradeMode: "invoice + remind; a human approves write-offs/refunds"
    },
    payroll_journal: {
        id: "payroll_journal",
        name: "Payroll Journal Agent",
        purpose: "Pull finalized payroll and post balanced journal vouchers.",
        sources: ["gusto", "netsuite", "quickbooks"],
        actions: ["pull-payroll-run", "build-journal-voucher", "reconcile-to-bank"],
        audit: ["F1-balanced", "F2-sourced", "F3-authorized"],
        hitlGates: ["ALWAYS"],
        degradeMode: "draft voucher only; a human posts payroll journals"
    },
    expense_management: {
        id: "expense_management",
        name: "Expense Management Agent",
        purpose: "OCR receipts, match to card feeds, enforce policy.",
        sources: ["expensify", "hubdoc", "plaid", "quickbooks"],
        actions: ["ocr-receipt", "match-card-transaction", "policy-check", "code-expense"],
        audit: ["F2-sourced", "F3-authorized"],
        hitlGates: ["policy-exception", "reimbursement-release"],
        degradeMode: "match + policy-check; a human releases reimbursements"
    },
    close_reporting: {
        id: "close_reporting",
        name: "Month-End Close & Reporting Agent",
        purpose: "Drive the close checklist and assemble reconciled statements.",
        sources: ["quickbooks", "xero", "netsuite", "stripe", "plaid"],
        actions: ["run-close-checklist", "accruals-draft", "assemble-statements", "variance-analysis"],
        audit: ["F1-balanced", "F2-sourced"],
        hitlGates: ["statement-signoff"],
        degradeMode: "assemble + reconcile; a controller signs off"
    },

    /* -------- Practice-management / tax layer (the firm operating system) -------- *
     * These agents remove the administrative work surrounding the CPA/preparer. They
     * never give tax advice or file a return — a licensed preparer owns every filing. */
    client_intake: {
        id: "client_intake",
        name: "Client Intake & Engagement Agent",
        purpose: "Onboard a new client: create the record, draft the engagement, request organizer docs, run KYC.",
        sources: ["karbon", "taxdome"],
        actions: ["create-client", "create-engagement", "request-organizer", "kyc-check", "sync-crm"],
        audit: ["F2-sourced"],
        hitlGates: ["engagement-letter-signoff"],
        degradeMode: "draft engagement + collect intake; a human signs the engagement letter"
    },
    document_collection: {
        id: "document_collection",
        name: "Document Collection & Organizer Agent",
        purpose: "Send organizers and chase missing source documents (W-2s/1099s) until the file is complete.",
        sources: ["taxdome", "karbon", "hubdoc"],
        actions: ["send-organizer", "track-missing-docs", "chase-w2-1099", "ocr-intake", "index-to-folder"],
        audit: ["F2-sourced"],
        hitlGates: [],
        degradeMode: "reminders + indexing within policy; never fabricates a missing document"
    },
    tax_prep_assistant: {
        id: "tax_prep_assistant",
        name: "Tax Preparation Assistant",
        purpose: "Assemble return workpapers, reconcile books to tax, flag missing items — for a licensed preparer.",
        sources: ["taxdome", "karbon", "quickbooks", "xero", "hubdoc"],
        actions: ["assemble-workpapers", "reconcile-books-to-tax", "flag-missing-items", "prepare-draft-for-preparer"],
        audit: ["F2-sourced", "F3-authorized", "T1-preparer-signoff"],
        hitlGates: ["ALWAYS"],
        degradeMode: "assemble workpapers + draft only; a licensed preparer reviews, signs, and e-files. Never files."
    },
    client_followup: {
        id: "client_followup",
        name: "Client Follow-Up & Status Agent",
        purpose: "Answer status questions, send signature reminders, and schedule appointments within policy.",
        sources: ["karbon", "taxdome"],
        actions: ["status-update", "answer-status-question", "signature-reminder", "schedule-appointment"],
        audit: ["F2-sourced"],
        hitlGates: [],
        degradeMode: "grounded status replies + reminders (TCPA/CAN-SPAM); escalates substantive questions to staff"
    },
    tax_deadline: {
        id: "tax_deadline",
        name: "Tax Deadline & Compliance Calendar Agent",
        purpose: "Track filing deadlines, remind the team and clients, and flag returns needing an extension.",
        sources: ["karbon", "taxdome"],
        actions: ["track-deadlines", "remind-team", "remind-client", "flag-extension-needed"],
        audit: ["F2-sourced"],
        hitlGates: ["extension-filing"],
        degradeMode: "reminders + flags only; a licensed preparer files any extension"
    },
    firm_operations: {
        id: "firm_operations",
        name: "Firm Operations & Workflow Agent",
        purpose: "Route work items, assign preparers, track status, and trigger follow-ups across the firm.",
        sources: ["karbon", "taxdome", "quickbooks"],
        actions: ["route-work-item", "assign-preparer", "track-status", "trigger-followup", "sync-crm"],
        audit: ["F2-sourced"],
        hitlGates: [],
        degradeMode: "orchestration only; humans perform the professional work"
    }
};

/* ------------------------------------------------------------------ *
 * 4. Accessors / helpers
 * ------------------------------------------------------------------ */
export function getFinanceAgent(id) {
    return FINANCE_AGENTS[id] || null;
}

export function auditGatesFor(agentId) {
    return (FINANCE_AGENTS[agentId]?.audit) || FINANCE_AUDIT.gates.map((g) => g.id);
}

/** Does this action require human approval (money movement / segregation)? */
export function requiresApproval(agentId, action) {
    const a = FINANCE_AGENTS[agentId];
    if (!a) return true;
    if (a.hitlGates.includes("ALWAYS")) return true;
    return a.hitlGates.includes(action);
}

/** Shape every ledger entry must satisfy before posting. */
export function requireBalancedEntry(entry, debit, credit, sourceDocId, sourceSystem) {
    return {
        entry, debit, credit, sourceDocId, sourceSystem,
        balanced: Number(debit) === Number(credit),
        matchStatus: sourceDocId ? "matched" : "unmatched",
        timestamp: new Date().toISOString()
    };
}

export function describeFinanceCapabilities() {
    const lines = [];
    lines.push(`Finance & bookkeeping — ${Object.keys(FINANCE_SOURCE_REGISTRY).length} systems ` +
        `(GL/ERP, bank feeds, payments, expense, payroll, risk).`);
    lines.push(`Controls: double-entry balance + source-document match + segregation of duties; ` +
        `${FINANCE_AUDIT.threePointMatch} ${FINANCE_HITL_HARD_RULE}`);
    Object.values(FINANCE_AGENTS).forEach((a) => {
        const gate = a.hitlGates.includes("ALWAYS") ? "ALWAYS HITL" : `HITL: ${a.hitlGates.join(", ")}`;
        lines.push(`• ${a.name} — sources[${a.sources.length}] actions[${a.actions.length}] — ${gate}`);
    });
    return lines.join("\n");
}
