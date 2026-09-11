// Convergence-Ai — Semantic Gateway (CURRENT deployment: Supabase Edge Function, Deno)
//
// Tier 1 enforcement point for the live Lovable.ai + Supabase deployment. EVERY prompt and
// response passes through here before/after the LLM. It runs the probabilistic filters
// (Model Armor -> ShieldGemma) and then hands off to the deterministic boundary (RLS at the
// DB). Probabilistic may only ALLOW; a deny must always be reachable deterministically.
//
// Secrets (MODEL_ARMOR_ENDPOINT, SHIELDGEMMA_ENDPOINT, service-role key) come from Supabase
// project secrets / Vault and never leave the server. The browser holds only the anon key.
//
// [VERIFY] exact request/response shapes against current Model Armor + ShieldGemma docs at
// implementation time; the control flow and the fail-closed posture are the contract.

import { createClient } from "jsr:@supabase/supabase-js@2";

type Verdict = {
  decision: "allow" | "block" | "route_to_hitl";
  tier: 1;
  control: string;
  score?: number;
  threshold?: number;
  reason: string;
  verdict: "probabilistic" | "deterministic";
};

// Per-vertical thresholds mirror js/security_guardrails.js and
// security/shieldgemma/shieldgemma-gateway.yaml. Stricter (lower) = more cautious.
const TAU: Record<string, number> = {
  medical: 0.2, legal: 0.2, finance: 0.2,
  realestate: 0.3, default: 0.4,
};

async function modelArmor(text: string, direction: "prompt" | "response"): Promise<Verdict> {
  // Model Armor (filter v3): prompt-injection/jailbreak, malicious-URL, SDP/DLP (150+ PII).
  const res = await fetch(Deno.env.get("MODEL_ARMOR_ENDPOINT")!, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${Deno.env.get("GCP_TOKEN") ?? ""}` },
    body: JSON.stringify({ text, direction }),
  }).catch(() => null);

  if (!res || !res.ok) {
    // FAIL CLOSED: if the filter is unreachable, do not pass the text through.
    return { decision: "block", tier: 1, control: "model_armor", reason: "filter unavailable — fail closed", verdict: "deterministic" };
  }
  const out = await res.json();
  if (out.promptInjectionDetected || out.jailbreakDetected || out.maliciousUri || out.sdpAction === "BLOCK") {
    return { decision: "block", tier: 1, control: "model_armor", reason: out.reason ?? "model_armor matched", verdict: "probabilistic" };
  }
  return { decision: "allow", tier: 1, control: "model_armor", reason: "clean", verdict: "probabilistic" };
}

async function shieldGemma(text: string, vertical: string): Promise<Verdict> {
  const tau = TAU[vertical] ?? TAU.default;
  const res = await fetch(Deno.env.get("SHIELDGEMMA_ENDPOINT")!, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, vertical }), // scoring mode -> p(violates policy)
  }).catch(() => null);

  if (!res || !res.ok) {
    return { decision: "block", tier: 1, control: "shieldgemma", reason: "classifier unavailable — fail closed", verdict: "deterministic" };
  }
  const { p } = await res.json() as { p: number };
  if (p >= tau) {
    return { decision: "route_to_hitl", tier: 1, control: "shieldgemma", score: p, threshold: tau, reason: `p>=${tau}`, verdict: "probabilistic" };
  }
  return { decision: "allow", tier: 1, control: "shieldgemma", score: p, threshold: tau, reason: `p<${tau}`, verdict: "probabilistic" };
}

async function logDecision(admin: ReturnType<typeof createClient>, tenant: string, principal: string, v: Verdict) {
  // Append-only evidence trail (RLS: insert/read only). Blocks are logged as loudly as allows.
  await admin.from("audit_log").insert({ tenant_id: tenant, principal, ...v, at: new Date().toISOString() });
}

Deno.serve(async (req) => {
  const body = await req.json();
  const { text, direction = "prompt", vertical = "default", tenant, principal } = body;

  // Service-role client for the audit insert only; the caller's own JWT (RLS) governs data.
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // 1) Model Armor — hard gate.
  const ma = await modelArmor(text, direction);
  await logDecision(admin, tenant, principal, ma);
  if (ma.decision === "block") return Response.json({ allowed: false, verdict: ma }, { status: 403 });

  // 2) ShieldGemma — threshold gate at the vertical's tau.
  const sg = await shieldGemma(text, vertical);
  await logDecision(admin, tenant, principal, sg);
  if (sg.decision !== "allow") return Response.json({ allowed: false, verdict: sg }, { status: 403 });

  // 3) Deterministic boundary is RLS at the DB: any tool/data access the LLM subsequently
  //    triggers runs under the caller's JWT, so a cross-tenant read is refused by Postgres,
  //    not by this gateway. This function never uses the service-role key for tenant data.
  return Response.json({ allowed: true, verdicts: [ma, sg] });
});
