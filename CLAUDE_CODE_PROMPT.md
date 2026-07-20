# Claude Code Instructions: System Architecture & Handoff Prompt

Use this prompt in any other agent/Claude Code session to bring the engine up to speed on the dual-instance configuration and latest version status.

---

## 📌 CONTEXT & DUAL-INSTANCE REPO STRUCTURE

We are running two separate products/repositories side-by-side:

1. **CONVERGENCE-Ai (The Hub, Auditor, and Social Agent)**
   - **GitHub Remote:** `https://github.com/OlaMaeGunn25/convergence`
   - **Local Copy:** `C:/Users/dahao/.gemini/antigravity/scratch/convergence/`
   - **Rename Update:** The admin dashboard module formerly known as `aiwx-admin-agent/` has been renamed to `aiwx-convergence-ai/`. All files, configurations, and imports have been updated.
   - **Current Status:** Phase 5 complete. Test suite is **128/128** passing. Boot check `/health` runs on port 3999 successfully.

2. **ASES (AiWorXmiths Sales Enablement System / Salesbot)**
   - **GitHub Remote:** `https://github.com/OlaMaeGunn25/aiworxmiths-cdqe`
   - **Local Copy:** `C:/Users/dahao/.gemini/antigravity/scratch/aiwx-ases-sales-enablement/`
   - **Current Status:** Conversational lead qualifying agent (Salesbot) and Proposal generating engine. Works downstream of Convergence-Ai.

---

## 🔄 SHARED COMPONENTS & SYNC PROTOCOL

The two projects share a critical documentation file:
- **Shared File:** `SYSTEM_HANDOVER_SPECIFICATION.md`
  - In Convergence: `aiwx-smb-auditor/SYSTEM_HANDOVER_SPECIFICATION.md`
  - In ASES: `docs/SYSTEM_HANDOVER_SPECIFICATION.md`
- **Sync Protocol:**
  - This file serves as the API and integration spec between the two instances.
  - If any endpoints, schemas, or variables change in Convergence-Ai, the `SYSTEM_HANDOVER_SPECIFICATION.md` must be updated in `aiwx-smb-auditor/` and copied to `docs/SYSTEM_HANDOVER_SPECIFICATION.md` in `aiwx-ases-sales-enablement` to keep both systems aligned.

---

## 🤖 CLAUDE CODE PROMPT (COPY-PASTE IN NEW SESSIONS)

```markdown
You are pair-programming in a workstation that runs two separate repositories:
1. **Convergence-Ai**: Located at `C:/Users/dahao/.gemini/antigravity/scratch/convergence/`. Under branch `main`. Runs three sub-modules:
   - `aiwx-smb-auditor/` (Core Express test-suite: 128/128)
   - `aiwx-social-media-agent/` (Vanguard posting scheduler)
   - `aiwx-convergence-ai/` (Vite admin dashboard; renamed from `aiwx-admin-agent/`)
2. **ASES (Sales Enablement System)**: Located at `C:/Users/dahao/.gemini/antigravity/scratch/aiwx-ases-sales-enablement/`. Under branch `master`.

**Rules of Engagement:**
- NEVER commit ASES code/documents into the `convergence` repository or vice versa.
- The two repositories share `SYSTEM_HANDOVER_SPECIFICATION.md`. Keep both instances in sync.
- Verify `.gitignore` excludes runtime configurations (`**/config/*.json`), `.env` files, and `deep_analysis.json` sessions database before git pushes.
- Run tests (`node test/run.js` inside `aiwx-smb-auditor/`) before committing.
```
