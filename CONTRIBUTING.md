# Contributing to CONVERGENCE-Ai

## Single Source of Truth (non-negotiable)

**This git repository is the only source of truth.** All work — by humans or AI
agents — MUST land here, through commits to `main` (or a branch + PR).

### Background

On 18–19 July 2026 the codebase forked into two unreconciled trees: an
Antigravity-edited working copy under `scratch/aiwx-smb-auditor/` (not
version-controlled) and this git repo. For roughly 48 hours, two agent lineages
built different halves of the product — data-provenance governance in one,
access governance + MCP + security hardening in the other — with **zero
synchronization**. Neither tree was deployable on its own. The two were
reconciled in Phase 0 (commits `1902b94`→`0bf2f65`).

This is the exact "uncontrolled parallel-agent divergence" failure that AI TRiSM
governance exists to prevent. The rule below prevents recurrence.

## The rule

1. **Do not edit the `scratch/aiwx-*` sibling folders as product source.** They
   are retired. See `_CANONICAL_REPO.md` in each.
2. **Every change is a commit in this repo.** No out-of-band edits.
3. **Prefer a branch + PR** for anything non-trivial; require review before merge.
4. **Keep the suite green.** `cd aiwx-smb-auditor && node test/run.js` must pass
   (currently 128/128) before committing.
5. **Never commit secrets.** `.env`, cookies, credential JSON, and session dumps
   are gitignored — keep it that way; use `.env.example` as the template.

## Layout

- `aiwx-smb-auditor/` — Express gateway (:3003): routes, lib (audit pipeline,
  governance, scholar, negotiation, stores), tests.
- `aiwx-convergence-ai/` — Vite dashboard + tenant-provisioning middleware (RLS).
- `aiwx-social-media-agent/` — publishing agent (Graph API primary; headless
  emergency-only).
- `aiwx-mcp-server/` — MCP orchestration surface over the governed gateway.
- `docs/` — assessment, architecture, prompt standards, governance.

## Governance model (what every change must respect)

Two dimensions, both enforced:

- **WHO may act** — API-key auth + RBAC on mutating endpoints; immutable
  `audit_log`; HITL approval for side-effectful actions.
- **WHAT is true** — every audit data point carries provenance + confidence;
  reports get a reliability score, distribution gate, methodology, disclaimer,
  and pre-delivery validation.

A change that weakens either dimension should not merge.
