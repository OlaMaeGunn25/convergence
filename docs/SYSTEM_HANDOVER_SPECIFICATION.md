# SYSTEM_HANDOVER_SPECIFICATION — pointer

**This is not the spec — it's a signpost.** The Auditor↔ASES integration contract
is kept as a single canonical file to avoid drift:

- **Canonical (edit here):** [`../aiwx-smb-auditor/SYSTEM_HANDOVER_SPECIFICATION.md`](../aiwx-smb-auditor/SYSTEM_HANDOVER_SPECIFICATION.md)
- **ASES copy (other repo `aiworxmiths-cdqe`):** `docs/SYSTEM_HANDOVER_SPECIFICATION.md`

## Why the split

The contract lives in **two repositories** and must stay in sync:

| Repo | Path |
|---|---|
| CONVERGENCE-Ai (this repo) | `aiwx-smb-auditor/SYSTEM_HANDOVER_SPECIFICATION.md` |
| ASES (`aiworxmiths-cdqe`) | `docs/SYSTEM_HANDOVER_SPECIFICATION.md` |

If the Auditor's endpoints, schemas, auth, or env change, edit the canonical file
above, then copy it into the ASES repo's `docs/` to re-sync. This pointer exists
only so anyone looking in `docs/` (where the other handover docs live) finds the
right file.
