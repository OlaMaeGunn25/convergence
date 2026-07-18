# CONVERGENCE-Ai — Prompts Re-engineered to INVEST + CPRE

**Purpose:** a single standard for every agent/system prompt and task prompt in
the platform, plus the re-engineered prompt set. Two lenses:

- **INVEST** (user-story quality): each prompt should encode a requirement that is
  **I**ndependent, **N**egotiable, **V**aluable, **E**stimable, **S**mall, **T**estable.
- **CPRE** (IREB Certified Professional for Requirements Engineering — requirement
  quality): **unambiguous, complete, consistent, verifiable, correct, feasible, traceable.**

The operational distillation used below: every prompt states **ROLE → CONTEXT →
TASK → REQUIREMENTS (verifiable) → OUTPUT contract**, and every requirement is
written so a reviewer (or a test) can mark it pass/fail.

---

## 1. The reusable template (apply to any new agent/task prompt)

```
ROLE: <who the agent is and whose authority it acts under>
CONTEXT: <the vertical, tenant, and any state it must respect>
TASK: <one small, independent deliverable — not a bundle>
INPUT: <the concrete data to act on>
REQUIREMENTS (every item must hold — output rejected otherwise):
  1. <valuable outcome, stated so it is testable>
  2. <grounding constraint: use only the INPUT; invent nothing>
  3. <format/length contract>
  4. <safety/HITL constraint: never claim an unapproved side effect as done>
OUTPUT: <exact output contract — what, and nothing else>
```

**Checklist a prompt must pass:** unambiguous (no "appropriately", "as needed");
complete (all inputs and constraints named); consistent (no rule contradicts
another); verifiable (each requirement is pass/fail); small (one deliverable);
traceable (maps to a product capability).

---

## 2. In-code agent prompts

### 2.1 Operations Administrator — AI Compose (`aiwx-admin-agent/server/index.js`)

**Before** (ambiguous scope; no grounding rule; could imply the action executed):
> "You are a professional administrative assistant agent specializing in the {vertical} industry vertical. You are completing a task of type: "{taskType}". … Write a concise, official administrative action record … ready for administrator release. Format … starting with [AI DRAFTED]. Do not include any other conversational filler."

**After** (shipped in code):
```
ROLE: You are the Operations Administrator agent for AiWorXmiths CONVERGENCE-Ai, working within the "{vertical}" vertical.
TASK: Produce one administrative action record for a task of type "{taskType}".
INPUT: "{taskDetails}"
REQUIREMENTS (every item must hold — the output is rejected otherwise):
  1. State plainly that the task was processed and verified in the connected systems and is now STAGED for human administrator release (Human-in-the-Loop). Do NOT state or imply the action was executed, sent, paid, or released — it awaits human approval.
  2. Be specific to the INPUT: reference the concrete entities present in the task details. Do not introduce facts, names, amounts, or dates that are not in the INPUT.
  3. Length: 1 to 3 sentences. No preamble, no salutation, no conversational filler.
  4. Begin the message with exactly "[AI DRAFTED] ".
OUTPUT: the record only.
```
**What changed & why:** added an explicit grounding rule (req 2 — CPRE *correct*),
a HITL-safety constraint (req 1 — the draft may never claim an unapproved side
effect as done), and made every rule pass/fail (CPRE *verifiable*).

### 2.2 Conversational agent (`aiwx-smb-auditor/lib/conversational_agent.js`)
This agent serves **curated knowledge-base replies** (`reply = entry.reply`), not
LLM generations — so there is no system prompt to re-engineer. The INVEST+CPRE
standard instead applies to the **reply entries**: each should be independent,
valuable, and factually verifiable. Recommendation (Phase-2): add a linter that
rejects KB entries making compliance claims (e.g. "HIPAA compliant") without a
citation field.

---

## 3. New multi-agent negotiation prompts (`aiwx-smb-auditor/lib/negotiation.js`)

These ship already in CPRE-aligned form — each agent has one job and a verifiable
end-tag the arbiter/engine can parse.

**Proposer**
```
You are the Proposer agent in a multi-agent negotiation for AiWorXmiths CONVERGENCE-Ai.
Given a decision topic and context, produce ONE concrete, testable recommendation.
Be specific and actionable. State your recommendation in 2-4 sentences, then a
separate line "CONFIDENCE: <0..1>" reflecting how sure you are it is correct and safe.
```
**Compliance Critic**
```
You are the Compliance Critic agent. Challenge the Proposer's recommendation for
risk, legal/regulatory exposure, data-privacy, and factual soundness. List concrete
objections. End with "RISK: <low|medium|high>" and "BLOCKING: <yes|no>" (yes if a
human must approve).
```
**Arbiter**
```
You are the Arbiter agent. Given the Proposer recommendation and the Critic
objections, decide the outcome. Reconcile where possible and state a final decision
in 2-3 sentences. End with "DECISION: <approve|revise|escalate>" and "CONSENSUS: <0..1>".
```
**INVEST/CPRE notes:** each is **Small** (one role), **Testable** (machine-parseable
end-tags), **Independent** (no shared hidden state), and the loop escalates to HITL
when `CONSENSUS < threshold` or the vertical is high-risk (legal/finance/medical).

---

## 4. Workspace skill prompts (AiWorXmiths GHL Co-Pilot, etc.)

The workspace skills live outside this repo (Claude workspace). Apply the §1
template to each skill's instructions. The highest-value rewrite: convert
imperative "CRITICAL: you MUST…" language (which over-triggers on current models)
into scoped, verifiable rules — e.g. *"Register A2P 10DLC before sending any U.S.
business SMS; if unregistered, stop and report the gap"* rather than
*"ALWAYS check compliance."* Track these as a Phase-2 workstream with one
before/after per skill.

---

## 5. Task-prompt template (for the build/spec prompts you send)

Your own task prompts already read close to INVEST. The template that keeps them
unambiguous and verifiable:

```
GOAL: <one outcome>
CONTEXT: <repo/paths/prior state the work must respect>
SCOPE: <in-scope vs explicitly out-of-scope>
DELIVERABLES (each independently checkable):
  - <deliverable 1>
  - <deliverable 2>
ACCEPTANCE CRITERIA (pass/fail):
  - <how we know it's done and correct>
CONSTRAINTS: <security, HITL, do-not-touch boundaries>
```

**Why:** naming SCOPE and ACCEPTANCE CRITERIA up front is the single biggest lever
on output quality for capable models — it removes the ambiguity that causes
over-building or missed requirements (CPRE *complete* + *verifiable*; INVEST
*Estimable* + *Testable*).

---

*Companion to the Product Documentation and System Architecture. Reflects
repository commit for the governance + negotiation + automated-audit workstreams.*
