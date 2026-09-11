# Convergence-Ai — Agentic Security Architecture (Cloud-Portable)

**Scope.** End-to-end security for Convergence-Ai across **every vertical**, deployable to **GCP or AWS**. This
document specifies the 4-tier defense-in-depth blueprint, the zero-trust model, the per-vertical semantic
guardrails, and the exact primitive on each cloud. Policy-as-code is in `security/`; per-vertical declarations are
in `js/security_guardrails.js`; the driving prompts are in `AGENTIC_SECURITY_GOT_PROMPTS.md`.

## The problem: the perimeter collapsed

In an agentic architecture the boundary between **data** and **instructions** disappears. Untrusted, unstructured
content — a support ticket, a scraped page, another agent's output — is co-mingled directly with control
instructions inside a probabilistic orchestrator's context window. A deterministic network firewall cannot parse
malicious intent hidden in infinite semantic permutations of natural language. So a single filter is never
enough: **probabilistic semantic filters require deterministic outer boundaries.** That is the thesis this whole
architecture implements.

Two rules follow and are enforced everywhere:
1. **Data is not instructions.** Retrieved content is evidence to reason over, never a directive to obey.
   Instructions come only from the signed system policy and the authenticated human principal.
2. **Probabilistic may only allow; deterministic must be able to deny.** A "looks safe" score never overrides a
   deterministic authorization check.

---

## The 4-tier defense-in-depth blueprint

Securing autonomous agents demands an immutable, layered architecture spanning from the outermost data-ingress
point down to the fundamental code and supply-chain level.

### Tier 1 — Ingress & prompt security  · OWASP LLM01 / LLM02 / LLM06
Neutralize prompt injection and broken authorization at the agent gateway, before any token reaches the
orchestrator.

- **Model Armor (Gateway Proxy):** inline inspect-and-block. Detects prompt injection & jailbreak (filter **v3**,
  tuned to cut false positives), malicious URLs, and integrates Sensitive Data Protection to redact/block **150+
  PII infotypes**. Runs on both prompt and response; supports streaming sanitization.
- **ShieldGemma (Safety Classifier):** open-weights text-to-text classifier (2B/9B) run in **scoring mode** —
  outputs `p = P(violates policy | context, policy)`. Vertical-specific harm policies and thresholds `τ`.
- **Cloud DLP / SDP (Egress Sanitization):** cryptographic token-masking of any PII attempting to leave the system.
- **BOLA Guard (deterministic tool-layer check):** verifies the authenticated caller principal holds legitimate
  authorization for the **specific object ID** — principal-to-object validation at the execution boundary. This is
  the boundary that holds when a novel jailbreak slips past the probabilistic filters.

**Defense-in-depth workflow:** if a sophisticated injection bypasses the probabilistic filters → the BOLA Guard
acts as a rigid, deterministic outer boundary that blocks unauthorized tool access and prevents data exposure.

### Tier 2 — Runtime isolation  · OWASP LLM08 / LLM09
Agent-generated code and tool calls run confined, ephemeral, and without ambient authority.

- **Cloud Run code execution:** sandboxed, kernel-confined, per-invocation execution of agent-authored code.
- **Zero-egress networks:** deny-all outbound by default; only an explicit destination allowlist is reachable, so
  SSRF to a metadata endpoint or an attacker host fails at the network layer.
- **No standing credentials:** secrets injected by reference, per-call, least-privilege, revoked on exit;
  CPU/memory/wall-clock bounds with kill-on-breach.

### Tier 3 — Multi-agent zero trust  · OWASP LLM06 / LLM07
No agent trusts another by position; every hop is cryptographically identified and authorized per call.

- **SPIFFE/SVID workload identity:** short-lived cryptographic identity per agent; mTLS between agents.
- **Agent Gateway policy enforcement (OPA):** default-deny principal-to-object authorization as policy-as-code;
  the human principal's authority is carried as an attenuated, scoped token, never the agent's ambient rights.
- **Segregation of duties + vertical compliance floor:** requester ≠ approver; PHI / IOLTA / Fair-Housing /
  no-autonomous-money-movement gates attach here and cannot be bypassed by an inter-agent call.

### Tier 4 — Supply chain & posture  · OWASP LLM05 / LLM10
Only reviewed, signed, provenance-attested artifacts ever run.

- **Gemini Code Assist review:** automated security review on every PR; unresolved critical findings block merge.
- **SBOM + provenance + scanning:** SBOM and SLSA-style provenance at build; container + dependency + secret scans;
  OPA policy tests must pass.
- **cosign signing + attestations:** images signed; attestations created for review/scan/provenance.
- **Binary Authorization:** the runtime admits only images carrying all required attestations from trusted
  attestors — unsigned/unattested images are refused at deploy.

---

## Deployment portability — current (Lovable.ai + Supabase) → GCP → AWS

The security **contract** is identical on every target; only the enforcement **primitive** changes. This covers the
system as it runs **today on Lovable.ai + Supabase** (our first test deployment) and as it will run on GCP or AWS.
The same policy-as-code and the same per-vertical guardrail declaration resolve to the right column below.

| Control | **Current — Lovable.ai + Supabase** | GCP | AWS |
|---|---|---|---|
| Semantic prompt firewall | **Supabase Edge Function gateway** calling Model Armor API (or hosted ShieldGemma) before the LLM | **Model Armor** | Bedrock **Guardrails** + self-hosted ShieldGemma |
| Safety classifier | **ShieldGemma** via an inference endpoint the edge function calls | ShieldGemma on Vertex / GKE | ShieldGemma on SageMaker / EKS |
| PII detection & masking | Model Armor/SDP call from the edge function; PII never returned to the client | **Sensitive Data Protection (DLP)** | Amazon Macie + Comprehend PII |
| **Deterministic BOLA / principal-to-object** | **Postgres Row-Level Security (RLS)** — the row-ownership policy is the boundary that holds when the model is co-opted | **BOLA Guard + OPA** at the Agent Gateway | OPA/Cedar + app-layer object check |
| Code sandbox | **Supabase Edge Functions (Deno)** — sandboxed, ephemeral, no ambient host access | **Cloud Run code execution** | Firecracker microVM / Lambda / gVisor on Fargate |
| Zero-egress network | Edge-function outbound restricted to an explicit destination allowlist; deny metadata/SSRF hosts | VPC-SC + no egress | VPC private subnet, deny-all egress + endpoint allowlist |
| Workload / principal identity | **Supabase Auth (JWT)**; service-role key server-side only, never shipped to the browser | **SPIFFE/SVID**, Workload Identity | SPIFFE/SPIRE on EKS; IRSA |
| Policy engine | RLS policies + OPA tests in CI (advisory→enforced) | OPA / Agent Gateway | OPA/Gatekeeper; Cedar / Verified Permissions |
| Secret store | **Supabase Vault / project secrets** (referenced, never inlined) | Secret Manager | AWS Secrets Manager / Parameter Store |
| Image / artifact signing | Git provenance on the GitHub repo Lovable syncs to; cosign in CI for container targets | cosign + Artifact Registry | cosign + ECR; AWS Signer |
| Deploy admission | **GitHub branch protection + required security checks** before Lovable publishes | **Binary Authorization** | Kyverno / OPA Gatekeeper; ECR scan-gate |
| Automated PR review | **Gemini Code Assist for GitHub** on the synced repo | Gemini Code Assist for GitHub | CodeGuru Reviewer (+ keep Gemini review) |
| Audit log | Supabase `audit_log` table (append-only, RLS-protected) + Postgres logs | Cloud Logging (immutable sink) | CloudTrail + CloudWatch (S3 Object Lock) |

**What this means for the live deployment.** On Lovable.ai the two non-negotiable deterministic boundaries already
have a home: **RLS** is the principal-to-object BOLA boundary (a co-opted agent still cannot read another tenant's
row), and the **edge-function gateway** is where Model Armor + ShieldGemma screen every prompt and response before
the LLM sees them and before any PII returns to the client. The service-role key stays server-side; the browser
only ever holds an anon key bound by RLS. `security/supabase/` holds the RLS policies and the edge-gateway
reference; `security/opa/` holds the same logic as portable policy-as-code for the GCP/AWS targets.

**Branching plan.** Future `deploy/gcp` and `deploy/aws` branches differ only in the concrete infra manifests and
the CI target; the current Lovable/Supabase deployment keeps running from the shared line. The application, the
vertical registries, the OPA policies, the ShieldGemma thresholds, and the guardrail declarations are shared and
unchanged across all three — deployment mode is configuration, not a code fork.

---

## Zero-trust model (both clouds)

1. **Default deny.** Every tool call, agent hop, and object access is denied unless a policy explicitly allows it.
2. **Authenticate the workload, not the network.** SPIFFE identity + mTLS; network position grants nothing.
3. **Attenuate authority.** Carry the human principal's scoped rights per call; agents hold no ambient standing
   authority. Secrets are per-call, by reference, revoked on exit.
4. **Principal-to-object on every access.** The deterministic BOLA/OPA check is the boundary that survives a
   co-opted model.
5. **Assume breach.** Sandbox everything executable; zero-egress by default; log every decision, block included.

---

## Semantic guardrails for every vertical

Every vertical — the four completed (medical, legal, real-estate, finance) and the ten to come — inherits the full
4-tier stack. What differs per vertical is declared in `js/security_guardrails.js`:

- **Thresholds `τ`** for Model Armor / ShieldGemma — stricter for medical, legal, finance.
- **DLP infotypes** — e.g. PHI identifiers (medical), account/routing numbers (finance), client-confidential (legal).
- **Egress allowlist** — the exact destinations that vertical's tools may reach.
- **Compliance floor** — the deterministic gate that cannot be bypassed: medical → PHI/HIPAA; legal → IOLTA +
  citation-release (no ungrounded output leaves); real-estate → Fair-Housing anti-steering; finance →
  no-autonomous-money-movement + segregation of duties.
- **Required attestations** — the Tier-4 gates the vertical's deploy path must satisfy.

A vertical that cannot resolve all four tiers on the target cloud is a **build-failing gap**, never a silent
default — enforced by SGoT-5 and the CI policy tests.

---

## OWASP LLM Top 10 + SAIF coverage map

| OWASP LLM | Risk | Tier / control |
|---|---|---|
| LLM01 | Prompt injection | T1 Model Armor + ShieldGemma; T3 data-is-not-instructions |
| LLM02 | Sensitive information disclosure | T1 DLP/SDP egress masking; T2 zero-egress |
| LLM05 | Improper output / code handling | T2 sandbox + output validation; T4 review gate |
| LLM06 | Excessive agency / broken authorization | T1 BOLA Guard; T3 OPA principal-to-object |
| LLM07 | System-prompt / insecure workflow leakage | T3 zero-trust, SoD, compliance floor |
| LLM08 | Vector/embedding & SSRF via tools | T2 zero-egress, allowlist |
| LLM09 | Misinformation / insecure plugin design | T1/T2 output re-screening; per-vertical audit |
| LLM10 | Unbounded consumption / supply chain | T2 resource bounds; T4 SBOM + Binary Authorization |

SAIF pillars are covered across the tiers: secure-by-default gateways (T1), isolation & least privilege (T2/T3),
detection & response via the immutable audit log (all tiers), and secure supply chain (T4).

---

### Source notes
Google for Startups **Agentic Defense Framework** (screenshots on file); Google Cloud docs for **Model Armor**,
**ShieldGemma** model card, **Cloud Run code execution**, **Binary Authorization**, and **Gemini Code Assist for
GitHub**. AWS equivalents are the current-generation services as of August 2026; `[VERIFY]` exact service
names/limits at implementation time.
