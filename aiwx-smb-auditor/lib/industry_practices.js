/**
 * Industry-Standard Practices + Correlation Planner (Phase 2, KNW)
 * ================================================================
 * A per-vertical corpus of industry-standard practices (KNW-01) and the planner
 * agents use to correlate an intended action against: (a) the industry practice,
 * (b) the governing company SOP (from the knowledge base), and (c) the connected
 * system capability (KNW-02). On conflict, the company SOP governs and the
 * conflict is flagged to HITL (KNW-03).
 *
 * `appliesTo: ['*']` = the practice applies to any action in that vertical.
 */

const PRACTICES = {
  legal: [
    { id: 'legal-conflict-check', title: 'Conflict-of-interest check before intake', description: 'Screen new clients against existing matters and parties before opening a matter.', appliesTo: ['create_matter', 'list_contacts'] },
    { id: 'legal-trust-segregation', title: 'Trust funds segregation (IOLTA)', description: 'Client trust funds are held separately, never commingled; every trust transaction is recorded and reconciled.', appliesTo: ['record_trust_transaction'] },
    { id: 'legal-engagement-letter', title: 'Written engagement letter', description: 'Scope, fees, and responsibilities are documented before work begins.', appliesTo: ['create_matter'] }
  ],
  medical: [
    { id: 'med-hipaa-minimum', title: 'HIPAA minimum-necessary', description: 'Access and disclose only the minimum PHI necessary for the task.', appliesTo: ['*'] },
    { id: 'med-consent', title: 'Informed consent before scheduling/treatment', description: 'Obtain and record informed patient consent.', appliesTo: ['create_event'] }
  ],
  finance: [
    { id: 'fin-segregation-duties', title: 'Segregation of duties', description: 'The party recording a payment should not also approve it.', appliesTo: ['record_payment', 'create_invoice'] },
    { id: 'fin-reconciliation', title: 'Periodic reconciliation', description: 'Reconcile ledgers against bank/processor records.', appliesTo: ['list_payments', 'list_invoices'] }
  ],
  realestate: [
    { id: 're-fair-housing', title: 'Fair Housing compliance', description: 'No steering or discrimination in listings or communications.', appliesTo: ['*'] },
    { id: 're-disclosure', title: 'Material defect disclosure', description: 'Disclose known material defects to buyers.', appliesTo: ['*'] }
  ],
  retail: [
    { id: 'ret-pci', title: 'PCI-DSS for card data', description: 'Never store raw card data; use tokenized processors.', appliesTo: ['create_refund'] }
  ]
};

function getPractices(vertical) {
  return PRACTICES[String(vertical || '').toLowerCase()] || [];
}

/**
 * Correlate an intended `capability` (optionally on `connectorId`) with the
 * industry practice + governing company SOP + a grounded plan.
 * @returns { capability, industryPractices[], governingSop, sopGoverns, conflictFlaggedToHitl, plan }
 */
async function correlate({ vertical, capability, connectorId = null, knowledgeBase = null, tenantId = null }) {
  const practices = getPractices(vertical).filter(p => p.appliesTo.includes('*') || p.appliesTo.includes(capability));

  let governingSop = null;
  if (knowledgeBase) {
    const query = `${capability} ${practices.map(p => p.title).join(' ')}`.trim();
    const found = await knowledgeBase.search({ tenantId, query, k: 1 });
    governingSop = (found.results && found.results[0]) || null;
  }

  // Heuristic conflict seam: an SOP that says "do not"/"never"/"prohibited" about
  // the capability while a practice requires it is flagged (SOP governs either way).
  let conflictFlaggedToHitl = false;
  if (governingSop && practices.length) {
    const t = String(governingSop.text || '').toLowerCase();
    if (/\b(do not|don't|never|prohibited|must not)\b/.test(t) && t.includes(String(capability).toLowerCase())) {
      conflictFlaggedToHitl = true;
    }
  }

  const practiceStr = practices.map(p => p.title).join('; ') || 'standard practice';
  const sopStr = governingSop ? `, grounded by company SOP: "${String(governingSop.text || '').slice(0, 80)}…"` : '';
  return {
    capability, connectorId, vertical,
    industryPractices: practices,
    governingSop,
    sopGoverns: true, // company SOP always governs on conflict (KNW-03)
    conflictFlaggedToHitl,
    plan: `Perform "${capability}"${connectorId ? ` via ${connectorId}` : ''} in accordance with ${practiceStr}${sopStr}.`
  };
}

module.exports = { PRACTICES, getPractices, correlate };
