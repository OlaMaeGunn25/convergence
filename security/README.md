# Convergence-Ai — Security (policy-as-code & guardrails)

End-to-end agentic security for **every vertical**, on **every deployment target** — the current
Lovable.ai + Supabase test deployment, and future GCP / AWS branches. The architecture, the
Graph-of-Thought prompts, and the deployment-portability mapping are in
[`../public/admin/convergence/docs/`](../public/admin/convergence/docs/):
`AGENTIC_SECURITY_ARCHITECTURE.md` and `AGENTIC_SECURITY_GOT_PROMPTS.md`.

## The thesis
Probabilistic semantic filters (Model Armor, ShieldGemma) require **deterministic outer boundaries**
(BOLA / RLS, zero-egress, Binary Authorization). A "looks safe" score never overrides a deterministic
deny. **Data is not instructions** — retrieved content is evidence, never a directive.

## Layout
| Path | What | Applies to |
|---|---|---|
| `opa/bola_guard.rego` (+ test) | Deterministic principal-to-object authorization | GCP/AWS gateway |
| `opa/egress_policy.rego` | Zero-egress allowlist; blocks metadata/SSRF hosts | GCP/AWS |
| `opa/tool_authorization.rego` | Default-deny tool auth + vertical compliance floors | all |
| `supabase/rls_policies.sql` | **RLS = the BOLA boundary on the live deployment** | current (Lovable/Supabase) |
| `supabase/semantic_gateway.ts` | Edge-function Tier-1 gateway (Model Armor + ShieldGemma, fail-closed) | current |
| `model-armor/model-armor-template.yaml` | Model Armor filter template | GCP |
| `shieldgemma/shieldgemma-gateway.yaml` | ShieldGemma thresholds per vertical | all |
| `binary-authorization/policy.yaml` | Attestation-gated deploy admission | GCP |
| `ci/cloudbuild.security.yaml` | GCP supply-chain gate (scan → sign → attest → BinAuthz) | GCP |
| `scripts/check_guardrail_coverage.mjs` | Fails build if any vertical lacks a guardrail | all |
| `../.github/workflows/agentic-security.yml` | Portable CI gate (OPA, RLS, coverage, secrets, Gemini) | all |
| `../.gemini/config.yaml` | Gemini Code Assist PR-review config (Tier 4) | all |
| `../public/admin/convergence/js/security_guardrails.js` | Per-vertical 4-tier declaration (14 verticals) | all |

## The two deterministic boundaries that already exist on the live deployment
1. **RLS** (`supabase/rls_policies.sql`) — a co-opted agent still cannot read another tenant's row.
2. **Edge-function semantic gateway** (`supabase/semantic_gateway.ts`) — Model Armor + ShieldGemma
   screen every prompt/response before the LLM, and PII never returns to the browser. The service-role
   key stays server-side; the client holds only the RLS-bound anon key.

## Run the checks locally
```
opa test security/opa -v
node security/scripts/check_guardrail_coverage.mjs
node --check public/admin/convergence/js/security_guardrails.js
```

## Cloud-portability in one line
Same policy-as-code, different primitive: **RLS/edge-function (current) ↔ Model Armor + BOLA + Binary
Authorization (GCP) ↔ Bedrock Guardrails + OPA/Gatekeeper (AWS)**. Deployment mode is configuration,
not a code fork. Full table in `AGENTIC_SECURITY_ARCHITECTURE.md`.
