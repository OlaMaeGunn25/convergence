# Future-State Integration — ELARION Semantic Memory + SovereignGuard

> **Status: FUTURE STATE — not built, not scheduled.** Nothing in this document is
> shipped. It records a proposed pre-deployment integration so the AWS target
> architecture stays open to it.
>
> **Confidentiality:** the source brief (ELARION Intelligence Ltd, Aug 2026) is
> marked *Confidential — post-NDA distribution*. This file summarizes only the
> integration surface CONVERGENCE-Ai must plan around; it does not reproduce the
> brief. Treat as confidential and confirm NDA coverage before circulating.

**Counterparty:** ELARION Intelligence Ltd (Augustine Chisom Kurumeh, Founder) ·
CAC 9393154, Abuja, Nigeria. Prepared for AiWorXmiths LLC & Rivalix, in the context
of an **AWS** startup-program review.

---

## 1. Why this is recorded now

CONVERGENCE-Ai is **pre-cloud-deployment**, and the proposal's central claim is that
this is the cheap moment to insert a memory + governance foundation — before agents
act against live enterprise systems. Recording it now keeps the AWS architecture
open to it. It does **not** commit us to it.

## 2. The two proposed layers

### Layer 1 — Semantic Memory Spine (RRS + Virtuoso)
Replaces the flat knowledge store with an **RDF knowledge graph** (Virtuoso), so the
KB correlation layer (industry-practice ↔ company-SOP ↔ capability) becomes
semantically *traversable* rather than only retrievable. Retrieval moves from vector
similarity to "resonance" — session-aware, provenance-preserving, and compounding
across engagements instead of rebuilt per tenant.

| Knowledge element | Today (shipped) | Proposed |
|---|---|---|
| Industry practices | Rows / text | Named entities with typed relationships |
| Company SOPs | Chunked documents | Authority graph — who owns a rule, when set |
| KB correlations | Similarity scores | Typed relations (`subsumes`, `governs`, `requires`, `permits`) |
| Agent actions | `audit_log` events | RDF triples: agent → action → outcome under authority |

### Layer 2 — SovereignGuard Governance Kernel
Deepens our **existing pre-commit gate** (`lib/precommit.js`) from application logic
to **infrastructure-level** governance, resolving four axes before any action crosses
the commit boundary:

| Axis | Question | Maps to our model |
|---|---|---|
| **Authority** | Who authorized this, and is it current + scoped? | **I2** (HITL absolute authority) + autonomy grants |
| **Purpose** | Does the action match the task's declared intent? | Drift between approved plan and executed action |
| **Coherence** | Is it coherent with organizational memory/state? | Cross-check against the knowledge graph |
| **Compute Sovereignty** | Is inference sovereign; where does data go? | On-prem mode + regulated verticals |

Plus a **Why-Log**: a semantic evidence record capturing not just *what happened*
but *why it was permitted* (authority resolved, purpose aligned, coherence score,
compute sovereignty, governing rule, payload hash) — the artifact HIPAA/SOC 2
reviewers ask for.

## 3. Honest assessment against what we actually shipped

The brief's critique is **largely accurate**, with two corrections:

**Accurate:**
- Our KB is a flat store; correlations are scored, not typed relations. Memory does
  **not** compound across engagements — each tenant starts from zero.
- Our pre-commit gate is **application-level** Node code, not infrastructure.
- `audit_log` records *what*, not *under whose verified authority*.
- pgvector + reranker are **seams**, not live (`docs/INTEGRATION_SEAMS.md`).

**Corrections to the brief's snapshot (it reflects an earlier build):**
- Tool registry is **90 tools**, not 72.
- The reranker ships with a working **local** implementation (Cohere is the seam).
- The roster is **13 agents** — correct — but now includes the human-care plane
  (Human Companion) and Gusto HR integration.

**Where we are already stronger than the brief implies:** the Human Companion's
confidentiality partition and the zero-leak upskilling design are governance
properties the brief does not account for, and they constrain any semantic-graph
integration — see §5.

## 4. AWS implications (target cloud = AWS)

- **Virtuoso** would run as an additional containerized service beside the Node 20
  gateway container — same deployment model, one more service (ECS/Fargate task or
  EKS pod + EBS/EFS-backed storage).
- **RRS** sits as middleware between the agent team and the knowledge store.
- Supabase/PostgreSQL is **retained** for operations (tenants, tasks, HITL queue,
  audit_log); the graph is additive, not a replacement.
- **Data-residency** posture: the sovereignty axis supports on-soil deployments
  (relevant to AU/NDPR/CBN contexts) and pairs with our existing on-prem mode.

## 5. Open questions we must answer before committing

1. **Plane boundary.** A knowledge graph that links entities *across* verticals must
   not become a path around the human-care partition. Employee/HR/training data must
   stay out of the graph, or the zero-leak guarantee (`docs` Doc 7D) is broken.
2. **Cross-tenant learning.** "Memory compounds across engagements" is valuable — but
   compounding across *tenants* is a data-isolation question, not just a technical
   one. Requires explicit contractual + technical boundaries.
3. **Vendor dependency.** Virtuoso + RRS + SovereignGuard is a third-party critical
   path. What is the exit story if the relationship ends?
4. **Duplication.** SovereignGuard's Authority/Purpose axes overlap our shipped
   attribution + autonomy-grant model. Scope must be "deepen", not "duplicate".
5. **Cost + latency.** A graph hop plus four-axis resolution on every commit adds
   latency to an already multi-gate path; budget it.
6. **Commercials/IP.** NDA, licensing, and where the patent-pending Companion Maker
   architecture sits relative to our Human Companion.

## 6. Position

**Directionally valuable, not yet committed.** The two gaps it names are real and we
have independently documented them (flat KB, application-level gate). The sensible
sequence is: **ship the AWS deployment on the current architecture**, keep the
knowledge-store interface abstracted (we already have `lib/embeddings.js` +
`lib/knowledge_ingest.js` seams a graph backend could implement), and evaluate this
integration against §5 before taking a dependency.
