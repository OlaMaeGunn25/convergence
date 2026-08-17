# Changelog

Release history for CONVERGENCE-Ai lives in **[docs/ROADMAP.md](docs/ROADMAP.md)**,
alongside the roadmap, so that what shipped and what is coming are read together
rather than in two files that disagree.

**Current version: v0.12.1**

## Where the version is written

Four places, and they must agree. The gateway test suite asserts it, so a bump in
one without the others fails the build rather than reaching a deployment:

| Location | What it is |
|---|---|
| `docs/ROADMAP.md` | Source of truth — the declared version and its release entry |
| `aiwx-smb-auditor/package.json` | Gateway package version; `lib/version.js` reads it |
| `aiwx-convergence-ai/package.json` | Hub package version |
| `aiwx-convergence-ai/js/version.js` | Hub runtime constant (the hub has no build step on this path) |

The published product documentation mirrors `docs/ROADMAP.md` — it is not a fifth
source, and it is updated in the same change.

## Releasing

1. Update all four locations above and add the release entry to `docs/ROADMAP.md`.
2. Run the gateway suite. The version-consistency assertions fail loudly on drift.
3. Tag the commit: `git tag -a vX.Y.Z -m "vX.Y.Z"` and push the tag.
4. Update the published documentation (Document 16 release history, header stamp).
5. After deploying, verify the running instance agrees rather than assuming it:

```
curl "https://<host>/api/version?expected=X.Y.Z"
```

That returns HTTP 200 when the deployed version matches and 409 when it does not,
so a release can be verified rather than trusted.
