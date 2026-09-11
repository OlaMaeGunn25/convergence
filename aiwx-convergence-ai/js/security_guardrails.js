/*
   CONVERGENCE-Ai — Per-Vertical Security Guardrail Declarations
   ----------------------------------------------------------------
   Declares the 4-tier defense-in-depth stack for EVERY vertical, on every deployment target.
   These are declarations consumed by the enforcement points — they do not enforce by themselves:
     - CURRENT (Lovable.ai + Supabase): Postgres RLS (security/supabase/rls_policies.sql) is the
       deterministic BOLA boundary; the edge-function gateway (security/supabase/semantic_gateway.ts)
       runs Model Armor + ShieldGemma.
     - GCP: Model Armor + ShieldGemma + BOLA Guard/OPA + Binary Authorization.
     - AWS: Bedrock Guardrails + ShieldGemma + OPA/Gatekeeper.
   The 4-tier blueprint, prompts and cloud mapping live in docs/AGENTIC_SECURITY_*.md.
   Invariant (SGoT-5): a probabilistic filter may only ALLOW; a deny must be reachable
   deterministically. A vertical missing any tier is a build-failing gap (CI: check_guardrail_coverage).
*/

export const SECURITY_TIERS = {
    tier1: 'Ingress & prompt security — Model Armor + ShieldGemma + DLP + BOLA/RLS (LLM01/02/06)',
    tier2: 'Runtime isolation — sandbox + zero-egress + no ambient credentials (LLM08/09)',
    tier3: 'Multi-agent zero trust — SPIFFE/JWT + default-deny OPA/RLS + compliance floor (LLM06/07)',
    tier4: 'Supply chain & posture — Gemini review + cosign + Binary Authorization (LLM05/10)',
};

export const DEPLOYMENT_TARGETS = {
    current: 'lovable-supabase',
    gcp: 'gcp',
    aws: 'aws',
};

// Enforcement primitive per tier per target. Same contract, different primitive.
export const ENFORCEMENT_MATRIX = {
    'lovable-supabase': {
        tier1: 'edge-function gateway -> Model Armor + ShieldGemma; PII masked before client',
        tier2: 'Supabase Edge Functions (Deno) sandbox; fetch allowlist',
        tier3: 'Supabase Auth JWT + Postgres RLS (row ownership = principal-to-object)',
        tier4: 'GitHub branch protection + required security checks + Gemini review before Lovable publishes',
    },
    gcp: {
        tier1: 'Model Armor + ShieldGemma + Cloud DLP; BOLA Guard at gateway',
        tier2: 'Cloud Run code execution; VPC-SC zero-egress',
        tier3: 'SPIFFE/SVID + OPA principal-to-object; default deny',
        tier4: 'cosign attest + Binary Authorization admission',
    },
    aws: {
        tier1: 'Bedrock Guardrails + self-hosted ShieldGemma + Macie/Comprehend PII',
        tier2: 'Firecracker/gVisor sandbox; private subnet deny-all egress',
        tier3: 'SPIFFE/SPIRE or IRSA + OPA/Cedar; default deny',
        tier4: 'cosign + ECR + Kyverno/OPA Gatekeeper admission',
    },
};

// Compliance floors — the deterministic gate a vertical can never bypass.
const FLOOR = {
    phi: 'PHI/HIPAA — no PHI to unauthorized recipient; HITL on clinical/billing',
    iolta: 'IOLTA + citation-release — no ungrounded legal output leaves; trust-account HITL',
    fair_housing: 'Fair Housing — no protected-class steering; valuation is not an appraisal',
    no_auto_money: 'No autonomous money movement or tax filing; 3-way match; segregation of duties; preparer sign-off before e-file',
    universal: 'TCPA/do-not-call, CAN-SPAM, US state privacy, ADA/WCAG — follows the action',
    processor_deployer: 'Processor + deployer — sub-processor disclosure before client data reaches a model; no unsubstantiated capability claim leaves; consequential-decision duties (notice, recorded basis, human review) attach to every delivered system',
};

// Threshold tau: block if p >= tau. Stricter (lower) for higher-stakes verticals.
const TAU = { strict: 0.2, elevated: 0.3, standard: 0.4 };

function tier(threshold, floor, egress, extraDlp = []) {
    return {
        tier1: { modelArmor: true, shieldgemma: { mode: 'scoring', threshold }, dlpInfotypes: ['EMAIL_ADDRESS', 'PHONE_NUMBER', 'CREDIT_CARD_NUMBER', ...extraDlp] },
        tier2: { sandbox: true, zeroEgress: true, egressAllowlist: egress, ambientCredentials: false },
        tier3: { zeroTrust: true, defaultDeny: true, principalToObject: true, segregationOfDuties: true, complianceFloor: floor },
        tier4: { geminiReview: true, cosign: true, binaryAuthorization: true, requiredAttestations: ['gemini-code-review', 'vuln-scan', 'opa-policy-tests', 'build-provenance'] },
    };
}

const UNIVERSAL_EGRESS = ['*.googleapis.com', '*.microsoft.com', '*.twilio.com', '*.stripe.com'];

export const SECURITY_GUARDRAILS = {
    medical:      tier(TAU.strict,   FLOOR.phi,          ['*.epic.com', ...UNIVERSAL_EGRESS], ['US_HEALTHCARE_NPI', 'DATE_OF_BIRTH', 'MEDICAL_RECORD_NUMBER']),
    legal:        tier(TAU.strict,   FLOOR.iolta,        ['*.courtlistener.com', '*.govinfo.gov', '*.congress.gov', ...UNIVERSAL_EGRESS]),
    realestate:   tier(TAU.elevated, FLOOR.fair_housing, ['*.rentcast.io', '*.reso.org', ...UNIVERSAL_EGRESS]),
    finance:      tier(TAU.strict,   FLOOR.no_auto_money,['*.quickbooks.com', '*.xero.com', '*.karbonhq.com', '*.taxdome.com', ...UNIVERSAL_EGRESS], ['US_BANK_ROUTING_MICR', 'IBAN_CODE']),
    retail:       tier(TAU.standard, FLOOR.universal,    ['*.shopify.com', '*.stripe.com', ...UNIVERSAL_EGRESS]),
    hospitality:  tier(TAU.standard, FLOOR.universal,    UNIVERSAL_EGRESS),
    construction: tier(TAU.standard, FLOOR.universal,    UNIVERSAL_EGRESS),
    logistics:    tier(TAU.standard, FLOOR.universal,    ['*.slack.com', ...UNIVERSAL_EGRESS]),
    education:    tier(TAU.elevated, FLOOR.universal,    UNIVERSAL_EGRESS), // FERPA/COPPA-adjacent -> elevated
    tech:         tier(TAU.standard, FLOOR.universal,    ['*.zendesk.com', '*.slack.com', ...UNIVERSAL_EGRESS]),
    professional: tier(TAU.standard, FLOOR.universal,    UNIVERSAL_EGRESS),
    nonprofit:    tier(TAU.standard, FLOOR.universal,    ['*.salesforce.com', ...UNIVERSAL_EGRESS]),
    events:       tier(TAU.standard, FLOOR.universal,    UNIVERSAL_EGRESS),
    event_rental: tier(TAU.standard, FLOOR.universal,    UNIVERSAL_EGRESS),
    // The reseller vertical. ELEVATED rather than standard: a consultancy holds
    // data belonging to OTHER businesses, several of them in regulated verticals,
    // so a failure here is a cross-client exposure rather than a single-tenant
    // one. Its egress is the consultancy's own operating stack.
    ai_consultancy: tier(TAU.elevated, FLOOR.processor_deployer, ['*.quickbooks.com', '*.xero.com', '*.slack.com', '*.hubspot.com', ...UNIVERSAL_EGRESS]),
};

export function getGuardrail(vertical) {
    return SECURITY_GUARDRAILS[vertical] || null;
}

export function resolveEnforcement(target) {
    return ENFORCEMENT_MATRIX[target] || null;
}

// SGoT-5: assert all four tiers are bound for a vertical on a target. Returns missing tiers.
export function assertAllTiersBound(vertical, target = 'lovable-supabase') {
    const g = getGuardrail(vertical);
    const e = resolveEnforcement(target);
    if (!g) return { ok: false, missing: ['ALL'], reason: `no guardrail declaration for '${vertical}'` };
    if (!e) return { ok: false, missing: ['ALL'], reason: `unknown target '${target}'` };
    const missing = ['tier1', 'tier2', 'tier3', 'tier4'].filter((t) => !g[t] || !e[t]);
    return { ok: missing.length === 0, missing, vertical, target };
}

export function describeSecurityPosture() {
    return Object.keys(SECURITY_GUARDRAILS).map((v) => ({
        vertical: v,
        threshold: SECURITY_GUARDRAILS[v].tier1.shieldgemma.threshold,
        floor: SECURITY_GUARDRAILS[v].tier3.complianceFloor,
        tiersBound: assertAllTiersBound(v, 'lovable-supabase').ok,
    }));
}
