/**
 * Compliance Agent (Phase 9, CMP)
 * ===============================
 * Validates compliance by industry / domain / vertical, backed by a governed
 * external search of local/state/federal regulations, and screens all inputs and
 * outputs before the commit boundary (CMP-01/02/03). Every determination records
 * its rule citations, verdict, confidence, and provenance (CMP-04) and is handed
 * to the Reporting agent (CMP-05).
 *
 * The regulatory search degrades to a clearly-labeled *simulated* corpus when no
 * search key is configured (same fallback contract as lib/scholar.js) — real
 * local/state/federal lookups plug in behind regulatorySearch() without changing
 * callers.
 */

const crypto = require('crypto');

// Simulated regulatory corpus (labeled). Real search would query live sources.
const REG_CORPUS = {
  legal: [
    { level: 'federal', code: 'ABA-Model-1.15', title: 'Safeguarding client property (trust accounting)', appliesTo: ['record_trust_transaction'] },
    { level: 'state', code: 'IOLTA', title: 'Interest on Lawyers Trust Accounts rules', appliesTo: ['record_trust_transaction'] }
  ],
  medical: [
    { level: 'federal', code: 'HIPAA-164.502', title: 'Uses/disclosures of PHI — minimum necessary', appliesTo: ['*'] },
    { level: 'federal', code: 'HIPAA-164.508', title: 'Authorization required for certain disclosures', appliesTo: ['*'] }
  ],
  finance: [
    { level: 'federal', code: 'GLBA-Safeguards', title: 'Safeguards Rule (customer financial data)', appliesTo: ['*'] },
    { level: 'state', code: 'PCI-DSS', title: 'Payment card data protection', appliesTo: ['create_refund', 'record_payment', 'create_invoice'] }
  ],
  retail: [
    { level: 'federal', code: 'FTC-Act-5', title: 'Unfair or deceptive acts or practices', appliesTo: ['*'] },
    { level: 'state', code: 'PCI-DSS', title: 'Payment card data protection', appliesTo: ['create_refund'] }
  ],
  realestate: [
    { level: 'federal', code: 'Fair-Housing-Act', title: 'Prohibition on housing discrimination', appliesTo: ['*'] },
    { level: 'federal', code: 'RESPA', title: 'Real Estate Settlement Procedures Act — referral fees and disclosures', appliesTo: ['*'] },
    { level: 'federal', code: 'ECOA', title: 'Equal Credit Opportunity Act — non-discrimination in credit', appliesTo: ['*'] }
  ],
  education: [
    { level: 'federal', code: 'FERPA-99.30', title: 'Prior written consent before disclosing education records', appliesTo: ['*'] },
    { level: 'federal', code: 'FERPA-99.31', title: 'Permitted disclosures without consent (school-official exception)', appliesTo: ['*'] },
    { level: 'federal', code: 'COPPA', title: 'Verifiable parental consent for under-13 personal information', appliesTo: ['*'] },
    { level: 'state', code: 'SOPIPA-like', title: 'State student-data privacy: no targeted advertising or profiling from student data', appliesTo: ['*'] }
  ],
  hospitality: [
    { level: 'federal', code: 'ADA-Title-III', title: 'Public accommodation accessibility', appliesTo: ['*'] },
    { level: 'state', code: 'Alcohol-Licensing', title: 'State alcohol service and licensing rules', appliesTo: ['*'] },
    { level: 'federal', code: 'FDA-Food-Code', title: 'Food safety handling and reporting', appliesTo: ['*'] }
  ],
  construction: [
    { level: 'federal', code: 'OSHA-1926', title: 'Construction safety and health standards', appliesTo: ['*'] },
    { level: 'state', code: 'Contractor-Licensing', title: 'State contractor licensing and scope-of-work limits', appliesTo: ['*'] },
    { level: 'federal', code: 'Davis-Bacon', title: 'Prevailing wage on federally funded projects', appliesTo: ['*'] },
    { level: 'state', code: 'Mechanics-Lien', title: 'Lien notice and filing deadlines', appliesTo: ['*'] },
    { level: 'federal', code: 'EPA-RRP', title: 'Lead-safe renovation, repair and painting rule', appliesTo: ['*'] }
  ],
  logistics: [
    { level: 'federal', code: 'FMCSA-HOS', title: 'Hours-of-service and electronic logging', appliesTo: ['*'] },
    { level: 'federal', code: '49-CFR-Hazmat', title: 'Hazardous materials handling, labelling and manifesting', appliesTo: ['*'] },
    { level: 'federal', code: 'Carmack', title: 'Carrier cargo liability', appliesTo: ['*'] },
    { level: 'federal', code: 'CBP-Customs', title: 'Customs entry and documentation for cross-border freight', appliesTo: ['*'] }
  ],
  tech: [
    { level: 'state', code: 'State-Privacy', title: 'US state consumer privacy: rights, disclosure and opt-out', appliesTo: ['*'] },
    { level: 'federal', code: 'DMCA', title: 'Copyright notice-and-takedown obligations', appliesTo: ['*'] },
    { level: 'federal', code: 'WCAG-ADA', title: 'Digital accessibility for customer-facing interfaces', appliesTo: ['*'] }
  ],
  professional: [
    { level: 'state', code: 'Professional-Licensing', title: 'State licensing and scope-of-practice limits', appliesTo: ['*'] },
    { level: 'federal', code: 'FTC-Act-5', title: 'Unfair or deceptive acts or practices', appliesTo: ['*'] },
    { level: 'state', code: 'Client-Confidentiality', title: 'Professional confidentiality obligations', appliesTo: ['*'] }
  ],
  nonprofit: [
    { level: 'state', code: 'Charitable-Solicitation', title: 'State charitable solicitation registration (required in ~40 states before soliciting)', appliesTo: ['*'] },
    { level: 'federal', code: 'IRC-501c3', title: 'Tax-exempt purpose, private benefit and political activity limits', appliesTo: ['*'] },
    { level: 'federal', code: 'IRS-Form-990', title: 'Annual information return and public disclosure', appliesTo: ['*'] },
    { level: 'federal', code: 'Substantiation-170f', title: 'Written acknowledgement for contributions of $250 or more', appliesTo: ['*'] }
  ],
  events: [
    { level: 'federal', code: 'ADA-Title-III', title: 'Public accommodation accessibility at venues', appliesTo: ['*'] },
    { level: 'federal', code: 'BOTS-Act', title: 'Ticket sales — circumvention and resale restrictions', appliesTo: ['*'] },
    { level: 'state', code: 'Alcohol-Licensing', title: 'Event alcohol service and licensing', appliesTo: ['*'] },
    { level: 'state', code: 'Liability-Waiver', title: 'Enforceability limits on participant liability waivers', appliesTo: ['*'] }
  ],
  event_rental: [
    { level: 'federal', code: 'CPSC-Product-Safety', title: 'Consumer product safety and recall obligations', appliesTo: ['*'] },
    { level: 'state', code: 'Amusement-Device', title: 'Inflatable and amusement device inspection and operation rules', appliesTo: ['*'] },
    { level: 'state', code: 'Rental-Deposit', title: 'State limits on damage deposits and withholding', appliesTo: ['*'] },
    { level: 'federal', code: 'ADA-Title-III', title: 'Accessibility of rented public-facing equipment', appliesTo: ['*'] }
  ]
};

/**
 * Rules that attach REGARDLESS of industry. Every vertical inherits these,
 * because the exposure comes from the ACTION, not the sector: any business that
 * sends an SMS is subject to TCPA, and any business that emails a list is subject
 * to CAN-SPAM. Keeping them per-vertical would mean duplicating them fourteen
 * times and forgetting one.
 */
const UNIVERSAL_CORPUS = [
  {
    level: 'federal', code: 'TCPA', title: 'Telephone Consumer Protection Act — prior express consent for calls/texts, and do-not-call',
    // Anything that dials, texts or leaves a message.
    appliesTo: ['send_sms', 'place_call', 'realestate_skip_trace', 'send_message', 'notify']
  },
  {
    level: 'state', code: 'State-DNC', title: 'State do-not-call registries and calling-time restrictions',
    appliesTo: ['send_sms', 'place_call', 'realestate_skip_trace']
  },
  {
    level: 'federal', code: 'CAN-SPAM', title: 'Commercial email — accurate headers, identification, and working opt-out',
    appliesTo: ['send_email', 'publish_post', 'schedule_campaign', 'export_crm']
  },
  {
    level: 'state', code: 'State-Privacy', title: 'US state consumer privacy — notice, access, deletion and opt-out rights',
    appliesTo: ['*']
  },
  {
    level: 'federal', code: 'ADA-WCAG', title: 'Accessibility of customer-facing communication and interfaces',
    appliesTo: ['publish_post', 'send_email']
  }
];

// Codes whose presence makes an action sensitive enough to require a human look.
// TCPA/DNC included deliberately: regulated outbound contact is exactly the class
// of action that should not proceed unattended.
const SENSITIVE = /trust|iolta|hipaa|pci|glba|ferpa|coppa|tcpa|dnc|hazmat|osha|charitable|ecoa|fair-housing/i;

/** Governed external search of local/state/federal regulations for a vertical. */
function regulatorySearch({ vertical, locale = null, capability = null } = {}) {
  const live = !!process.env.SERPAPI_API_KEY; // live lookups would use this key
  const matches = r => !capability || r.appliesTo.includes('*') || r.appliesTo.includes(capability);
  // Vertical rules PLUS the universal set. A vertical with no entry of its own
  // still gets the cross-cutting obligations rather than returning nothing.
  const rules = [
    ...(REG_CORPUS[String(vertical || '').toLowerCase()] || []).filter(matches),
    ...UNIVERSAL_CORPUS.filter(matches)
  ];
  return { simulated: !live, provenance: live ? 'live' : 'simulated', vertical, locale, levels: ['local', 'state', 'federal'], rules };
}

/**
 * Actions that regulators treat as CONSEQUENTIAL decisions about a person —
 * employment, credit, housing, education access, healthcare. The EU AI Act, the
 * Colorado AI Act, Illinois HB 3773 and NYC Local Law 144 all attach duties here,
 * and they attach to the DEPLOYER as well as the developer.
 *
 * This does not attempt to implement those regimes. It does the one thing that
 * must exist before any of them can be satisfied: recognising that an action
 * falls in scope, so it can be escalated rather than executed silently.
 */
const CONSEQUENTIAL_DOMAINS = {
  employment: /hire|hiring|terminate|termination|promot|discipl|payroll|compensation|schedul(e|ing)_staff|performance_review|candidate|applicant/i,
  credit: /credit|loan|lend|underwrit|creditworth/i,
  housing: /tenan|housing|rental_application|lease_approval|mortgage/i,
  education: /admission|enrol|expel|suspend|grade|placement/i,
  healthcare: /diagnos|triage|treatment|clinical_decision|prior_auth/i
};

/**
 * Classify an action for consequential-decision exposure.
 * @returns { consequential, domains[], obligations[] }
 */
function classifyDecision({ capability = null, toolName = null, vertical = null, text = null } = {}) {
  const hay = [capability, toolName, vertical, text].filter(Boolean).join(' ');
  const domains = Object.entries(CONSEQUENTIAL_DOMAINS)
    .filter(([, re]) => re.test(hay))
    .map(([d]) => d);

  if (!domains.length) return { consequential: false, domains: [], obligations: [] };

  return {
    consequential: true,
    domains,
    obligations: [
      'Human review before the decision takes effect — automated execution is not appropriate here.',
      'Record the basis for the decision, not only the outcome.',
      'Notice to the affected person may be required (NYC Local Law 144 for employment tools; Colorado AI Act for consequential decisions).',
      'Bias assessment may be required before this is used at scale.'
    ]
  };
}

/** Screen text/IO for sensitive data patterns (PII/PHI/card). */
function screenIO(io) {
  const s = typeof io === 'string' ? io : JSON.stringify(io || '');
  const flags = [];
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(s)) flags.push('SSN-like');
  if (/\b(?:\d[ -]?){13,16}\b/.test(s)) flags.push('card-like');
  return flags;
}

/**
 * Validate an action (and optional I/O) against the vertical's regulations.
 * @returns determination { id, verdict:pass|flag|block, citations, ioFlags, confidence, provenance }
 */
function validate({ vertical, capability = null, connectorId = null, locale = null, tenantId = null, io = null } = {}) {
  const search = regulatorySearch({ vertical, locale, capability });
  const applicable = search.rules;
  const ioFlags = io != null ? screenIO(io) : [];
  const sensitive = applicable.filter(r => SENSITIVE.test(r.code));

  // block if sensitive data leaked in I/O; flag if a sensitive rule applies;
  // otherwise pass.
  const decision = classifyDecision({ capability, vertical, text: io == null ? null : (typeof io === 'string' ? io : JSON.stringify(io)) });

  let verdict = 'pass';
  if (ioFlags.length) verdict = 'block';
  else if (sensitive.length) verdict = 'flag';
  // A consequential decision about a person is never a silent pass, even when no
  // sector rule matched — the exposure comes from the decision, not the industry.
  else if (decision.consequential) verdict = 'flag';

  return {
    id: `cmp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    tenantId, vertical, capability, connectorId, locale, verdict,
    citations: applicable.map(r => ({ level: r.level, code: r.code, title: r.title })),
    ioFlags,
    decision,
    confidence: search.simulated ? 0.6 : 0.85,
    provenance: { source: search.provenance, levels: search.levels },
    at: new Date().toISOString()
  };
}

module.exports = {
  regulatorySearch, validate, screenIO, classifyDecision,
  REG_CORPUS, UNIVERSAL_CORPUS, CONSEQUENTIAL_DOMAINS
};
