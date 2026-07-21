# CONVERGENCE-Ai — Status Briefing & GitHub Sync Instructions (for Antigravity)

**Read this whole document before touching git.** Your job in this session is to
**safely** sync the current working tree to GitHub — without breaking references,
leaking secrets, half-landing an in-flight refactor, or committing content that
belongs to a different product.

---

## 0. GROUND TRUTH — TWO SEPARATE REPOS

You operate two products. Keep them in their own repos; never cross-commit.

**A) CONVERGENCE-Ai (this repo — the Hub, Auditor, Social Agent, MCP)**
- **Remote (SINGLE SOURCE OF TRUTH):** https://github.com/OlaMaeGunn25/convergence
- **Local:** `C:/Users/dahao/.gemini/antigravity/scratch/convergence/` — branch `main`.
- **Last COMMITTED commit:** `71423db` — "Phase 5: unified AI TRiSM governance dashboard".

**B) ASES (AiWorXmiths Sales Enablement System / Salesbot — a DIFFERENT repo)**
- **Remote:** https://github.com/OlaMaeGunn25/aiworxmiths-cdqe — branch `master`.
- **Local:** `C:/Users/dahao/.gemini/antigravity/scratch/aiwx-ases-sales-enablement/`.
- Downstream of Convergence-Ai (lead-qualifying Salesbot + proposal engine).

This handoff **complements** the existing `CLAUDE_CODE_PROMPT.md` (dual-instance
prompt) — do not contradict it. Per `CONTRIBUTING.md`, all Convergence work lands
as commits in repo A. The retired `scratch/aiwx-*` sibling folders are not the
product (see `_CANONICAL_REPO.md` in each). Do not sync those.

**THE ONE LEGITIMATE SHARED FILE:** `SYSTEM_HANDOVER_SPECIFICATION.md` is the
integration contract between the two repos and lives in BOTH:
`convergence/aiwx-smb-auditor/SYSTEM_HANDOVER_SPECIFICATION.md` and
`aiwx-ases-sales-enablement/docs/SYSTEM_HANDOVER_SPECIFICATION.md`. If the
Auditor's endpoints/schemas/env change, update it in Convergence and copy it to
ASES so both stay aligned. It is the ONLY file that may be identical across the
two repos — nothing else crosses.
  ⚠️ This file is currently STALE (it says "Port 3000", "31 tests", and lists
  retired `scratch/` paths; it predates the governance/MCP/orchestrator/task-model
  work). It should be refreshed to: port **3003**, suite **128/128**, and the new
  architecture (auth/audit_log, provenance, tool registry `/api/tools`,
  orchestrator, MCP bridge) — then re-synced to ASES. Treat that as a follow-up,
  not part of this sync unless asked.

---

## 1. ⚠️ CO-MINGLING NOTICE — YOU RAN FOUR LOCAL INSTANCES; ATTRIBUTE EVERY CHANGE

You have been running **four separate local instances** side-by-side:

1. **Auditor** — `aiwx-smb-auditor/` *(part of this repo)*
2. **Social Media Agent** — `aiwx-social-media-agent/` *(part of this repo)*
3. **Convergence Deployment Hub** — `aiwx-convergence-ai/` (renamed from
   `aiwx-admin-agent/`) *(part of this repo)*
4. **ASES Sales-Enablement Agent** — `aiwx-ases-sales-enablement/` at scratch root
   **— this is a SEPARATE REPO** (`github.com/OlaMaeGunn25/aiworxmiths-cdqe`,
   branch `master`) and is **NOT part of this repo.** The only file that may cross
   is the shared `SYSTEM_HANDOVER_SPECIFICATION.md` (see Section 0).

**Because these ran together, their files have co-mingled.** Confirmed evidence:
ASES / sales-enablement content has bled into `aiwx-convergence-ai/` (e.g.
`aiwx-convergence-ai/agent/*.md`, `app.js`, `CONVERGENCE_FULL_SCOPE_DOCUMENT.md`
reference ASES/sales-enablement material — and `CONVERGENCE_FULL_SCOPE_DOCUMENT.md`
still mixes retired `scratch/aiwx-*` file paths with repo paths and stale figures
like "31 tests" / "Port 3000"). Verify before staging any of it.

**Rule for this sync:** every file you stage must be attributable to ONE of the
three in-repo modules. Before committing:

- **Do NOT import ASES sales-enablement code/docs into this repo.** If a change in
  `aiwx-convergence-ai/` (or anywhere) is actually ASES content that co-mingled,
  leave it out — it belongs in the ASES project, not here.
- **Explain every non-trivial change in its commit message** — which module it
  belongs to and why it changed. If you cannot confidently attribute a change to
  the Auditor, Social Media Agent, or Deployment Hub, **do not commit it blind —
  flag it in your report-back instead.**
- Prefer **small, module-scoped commits** over one giant "sync everything" commit,
  so co-mingled content is easy to spot and revert.

---

## 2. WHAT IS ALREADY BUILT (committed through `71423db`)

A phased MCP-native rearchitecture, all as tested `lib/` engines. **Suite is
currently 128/128** (`cd aiwx-smb-auditor && node test/run.js`).

- **Phase 0** — forked codebase reconciled; **two-dimensional AI TRiSM governance**
  on every audit: WHO may act (auth/RBAC + immutable `audit_log` + HITL) and WHAT
  is true (per-field provenance, reliability score, distribution gate, methodology,
  disclaimer, validation).
- **Phase 1** — task-model spine (`lib/task_model.js`): state machine +
  dependency-gated atomic claim (`claim_next_task` SQL fn / JSON dev fallback).
- **Phase 2** — internal tool registry (`lib/tool_registry.js`): 10 Zod-typed tools
  with governance annotations + a central approval gate. Live at `GET /api/tools` +
  `POST /api/tools/:name` (auth-gated, inline in `server.js`).
- **Phase 2.5 (IN PROGRESS — DO NOT HALF-COMMIT):** `routes/` is a complete mirror
  of the inline `server.js` routes but is **not mounted**; `server.js` is still the
  monolith with routes + `setInterval` schedulers interleaved. A **route-parity
  guard** test protects the eventual cutover. `lib/schedulers|notify|publisher`
  are still orphaned.
- **Phase 3** — orchestrator engine (`lib/orchestrator.js`): claims ready tasks,
  invokes registry tools, transitions state; destructive tasks held for human
  approval; negotiation-as-a-strategy. **Not yet wired into `server.js`.**
- **Phase 4** — in-process MCP bridge (`lib/mcp_bridge.js`) + guarded
  streamable-HTTP transport (`lib/mcp_http.js`). **`POST /mcp` not mounted yet.**
- **Phase 5** — unified governance dashboard: `lib/governance_report.js` exposed as
  the `get_governance_report` registry tool; `governance_dashboard.html`.

---

## 3. WHAT IS UNCOMMITTED RIGHT NOW (your working-tree changes to review)

- **MODULE RENAME:** `aiwx-admin-agent/` was **deleted** and replaced by
  `aiwx-convergence-ai/` (untracked). ~90 files. `README.md`, `CONTRIBUTING.md`,
  `docs/*`, `.dockerignore`, `Dockerfile`, `package.json` were updated to the new
  name.
- Edits under `aiwx-smb-auditor/` (`server.js`, `lib/middleware.js`, `lib/paths.js`,
  `lib/stores/*`, `conversational_agent.js`, `CHANGELOG.md`) and social-media-agent
  docs.
- Untracked runtime dir `aiwx-smb-auditor/config/` (`tasks.json`,
  `local_analytics.json`, …) — **runtime state, NOT source.**

---

## 4. SECRETS — NEVER COMMIT (hard gate)

- Verify `.gitignore` still excludes: `.env*`, `cookies_*.json`,
  `**/config/credentials*.json`, `meta/linkedin/supabase_credentials.json`,
  `deep_analysis*.json`, `chrome_junction/`, `*.db`, `id_rsa*`, `temp_*`.
- **`aiwx-convergence-ai/deep_analysis.json` exists and is a live-session-cookie
  dump** (Facebook / LinkedIn / Instagram / Threads). It came across in the rename.
  It MUST NOT be committed — confirm the `deep_analysis*.json` ignore covers the
  renamed path, and if this file was ever tracked, `git rm --cached` it.
- **Add to `.gitignore` if missing:** the whole `**/config/` runtime set
  (`config/tasks.json`, `config/local_analytics.json`, `config/*.json`) — the
  untracked `config/` dir must NOT be committed.
- **Final scan before every push:**
  ```
  git diff --cached | grep -iE "li_at|sessionid%3A|\bxs\b=|BEGIN.*PRIVATE|service_role.{0,3}[:=].{20}|sk-ant"
  ```
  Output must be empty.

---

## 5. SYNC PROCEDURE — IN ORDER

1. **Fix rename references.** `grep -ril "aiwx-admin-agent" .` (excluding
   node_modules) and update stale references to `aiwx-convergence-ai`. Confirm
   `supabase_schema.sql` moved with the rename. The gateway resolves sibling dirs
   via env (`CONVERGENCE_ROOT` / `SOCIAL_AGENT_DIR` / `ADMIN_DIST_DIR`) — verify no
   hardcoded old paths remain.
2. **Run the suite:** `cd aiwx-smb-auditor && node test/run.js` → **must be 128/128.**
   Do NOT commit a red tree.
3. **Boot check:** `PORT=3999 GATEWAY_API_KEY=k FIRECRAWL_API_KEY=t GA4_PROPERTY_ID=1
   GA4_MEASUREMENT_ID=G-T node aiwx-smb-auditor/server.js` → `/health` 200, no
   "Cannot find module" from the rename.
4. **Secret scan** (Section 4) — must be clean.
5. **Stage + commit coherently** (small, attributable commits — Section 1). Example:
   ```
   git add <files-for-the-rename-and-its-reference-updates>
   git commit -m "Rename aiwx-admin-agent -> aiwx-convergence-ai + update references"
   ```
   End every commit message with:
   ```
   Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
   ```
6. **Update stale counts:** `CONTRIBUTING.md` still says "79/79" → change to "128/128".
7. **Push:** `git push origin main`. On non-fast-forward, `git pull --rebase`,
   re-run the suite, then push.

---

## 6. DO NOT TOUCH / DO NOT REGRESS

- **Do not** mount `routes/` or delete inline `server.js` routes yet (the pending
  Phase-2.5 cutover; the parity guard must stay green).
- **Do not** wire the orchestrator loop, `POST /mcp`, or `GET /api/tasks` yet
  (deferred until the cutover lands).
- **Do not** weaken governance: auth on mutating endpoints, `audit_log`, the
  approval gate, and per-field provenance must remain.
- **Do not** re-introduce the deleted cookie-capture tooling
  (`extract_*cookies*.js`) or commit `chrome_junction/` / `deep_analysis.json`.
- **Do not** pull ASES sales-enablement content into this repo (Section 1).

---

## 7. KNOWN OPEN ITEMS (context; not required for this sync)

- Docker image has **never been built end-to-end** (no daemon on the dev host) — a
  CI build is the gating deploy step.
- Cloud deploy needs: CPU-always-on + `min-instances >= 1` (background loops run on
  `setInterval`), **Supabase is mandatory at multi-instance scale** (file-based
  state won't survive), Chromium memory (2–4 GB), Secret Manager, **HIPAA BAA** for
  the medical vertical.
- Two vertical taxonomies (8 audit verticals vs 4 licensing verticals) are not
  unified; also inconsistent ("Legal & Finance" combined vs split).
- The campaign scheduler is not claim-based → would double-fire across instances.

---

## 8. AFTER SYNC — REPORT BACK

State: the **commit SHA(s) pushed**, the **test count**, **which reference fixes**
the rename needed, **any co-mingled/ambiguous files you excluded or flagged**, and
**confirm no secrets were committed**.
```
