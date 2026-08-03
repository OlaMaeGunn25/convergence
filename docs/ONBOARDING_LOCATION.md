# Onboarding: Business Location & Location-Sharing Consent (LOC)

Several capabilities are region-bound — MLS board coverage most visibly, but also
state and local regulatory search and any vertical whose practices differ by
jurisdiction. So the system needs to know where the business operates. How it
finds out is a governance question, not a plumbing one.

Two things are kept deliberately separate.

## 1. Business address — required (LOC-01)

Asked at onboarding, and **installation refuses without it**:

```
businessAddress is required to install — region-bound capabilities resolve from it (LOC-01).
```

It is a business fact about a legal entity, the tenant declares it, and nothing
has to be inferred to obtain it. It is also the authoritative source: a broker
sitting in an airport is still licensed in their home state.

The requirement is enforced in `installation.install()`, not only in the
knowledge-base step. That step catches its own errors, so a requirement enforced
only there would be swallowed and silently skipped — which is no requirement.

The address and the correlated region are written into the company knowledge base
as part of the business-intelligence profile, so downstream agents can ground on
them like any other company fact.

## 2. Device-derived location — optional and consented (LOC-02)

GPS is a person's position. An IP address is personal data under GDPR and several
US state statutes. Neither is taken silently.

`get_location_disclosure` returns the exact prompts so the installer, the hub and
the docs ask the identical question — a consent prompt that differs between
surfaces is not a consent prompt:

| Method | Default | Why it is asked |
|---|---|---|
| `gps` | **deny** | Confirms the region when staff operate away from the registered address; resolves the correct local MLS board for field work |
| `ip` | **deny** | Coarse fallback when no address or GPS is available |

Rules the implementation actually enforces:

- **Absent means denied.** `recordConsent()` writes `false` for any method not
  explicitly granted. Consent is never inferred from silence.
- **A named human grants it.** A company-domain identity is required — consenting
  on behalf of a business is an act of authority, not a checkbox.
- **Revocation is immediate** and does not mutate the original record; the next
  correlation refuses the revoked method.
- **Correlation refuses what it was not granted**, rather than falling back to it
  quietly. The failure mode of "just use the IP" is a system that silently
  profiles its users' whereabouts.

## Correlation and how it reports itself

Precedence: **address > gps > ip**.

```js
correlateLocation({ businessAddress, gps, ip, consent, resolver })
// → { region, method, confidence, attempted[], consentRecorded, note }
```

Every method offered appears in `attempted` with whether it was used and why not,
so the result explains itself. A region read off the company's letterhead and a
region guessed from an IP are not the same claim, and the caller can tell them
apart:

| Method | Confidence |
|---|---|
| address | high |
| gps | medium |
| ip | low |

## IP handling

Two things prevent confident wrong answers:

**Private ranges resolve to nothing.** RFC1918, loopback, link-local and CGNAT
carry no geographic meaning. `isPrivateIp()` catches them and correlation returns
`private_or_reserved_ip` rather than a region.

**Geo-IP is a seam, not a guess.** Without an injected resolver the system returns
`no_geoip_resolver_configured` and declines to produce a region. Geo-IP is
approximate at the best of times and there is no defensible way to fake it — so an
unconfigured deployment says "unresolved" instead of inventing a state.

```js
correlateLocation({ ip, consent, resolver: async (ip) => ({ region: 'NY' }) })
```

## Tools

| Tool | Purpose |
|---|---|
| `get_location_disclosure` | The onboarding questions, as data |
| `record_location_consent` | Record the per-method decision with the granting identity |
| `correlate_location` | Resolve the region from permitted methods only |
| `install_convergence` | `businessAddress` is a required input |

## When nothing resolves

Region-bound capabilities stay unconfigured and say so. The system does not pick
a plausible region to keep a workflow moving — an MLS search against the wrong
board is worse than an MLS search that did not run.
