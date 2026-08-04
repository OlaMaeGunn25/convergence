# Epic Integration (Medical Vertical) — Pre-Connection

Epic is the system of record for most US health systems. The API is a clean FHIR
R4 surface and is not the hard part. The hard part is that **access is granted by
each health organisation individually**, not by us and not by a single vendor key.

That is why Epic ships as **pre-connection** rather than *available*: the code is
in place, and the connection cannot be made until the tenant clears several
out-of-band steps that no amount of correct code satisfies.

## Programme naming (this changed)

| Current | Retired |
|---|---|
| **Vendor Services** — the developer programme | App Orchard |
| **Showroom** — the marketplace | App Market |
| **Connection Hub** — where apps are registered and OAuth client IDs managed | — |

Guidance telling you to "get listed in App Orchard" is out of date. If a health
system's IT team says it, they are working from an old runbook.

## Preconditions

Declared in the catalogue entry and enforced by `lib/preconditions.js`. The
connection builder refuses while any blocking one is unmet, and the connection
sits in the `preconditions_pending` state so an operator sees *waiting on the
health system* rather than a connection that merely never succeeds.

| # | Scope | Precondition | How it is satisfied |
|---|---|---|---|
| 1 | vertical | Tenant is on the Medical & Healthcare vertical | Automatic — checked against the tenant |
| 2 | compliance | Business Associate Agreement executed | Attestation with the agreement reference |
| 3 | vendor | Epic Vendor Services account established | Attestation |
| 4 | vendor | Application registered, client IDs issued | Attestation — register in the Connection Hub with the exact resources and scopes, upload the public key |
| 5 | vendor | Epic security review passed | Attestation — SMART on FHIR, OAuth 2.0, US Core conformance |
| 6 | vendor | Each health organisation has enabled the app | Attestation, **once per organisation** |
| 7 | technical | Signing key and organisation map configured | Automatic — checked against the environment |
| 8 | compliance | Scopes reviewed against minimum necessary | Attestation (advisory, non-blocking) |

Attestations require a company-domain identity and record who attested, when, and
against what reference. An agent asserting that a BAA exists is worth nothing; a
named person asserting it is a record.

Note that attestations alone do not unblock. Precondition 7 is checked against the
real environment, so a tenant that has signed everything and configured nothing is
still — correctly — blocked.

## Why credentials are per organisation

Epic issues client IDs per app and recommends unique credentials per customer
organisation and per environment. A tenant operating across three health systems
holds three sets of credentials and clears precondition 6 three times.

The connector is therefore multi-organisation from the outset: every call names
which organisation it is for, and `orgId` is mandatory. A single global token
would be wrong in a way that is expensive to unpick later.

```
EPIC_PRIVATE_KEY      # signing key, from the secret store — never in a response
EPIC_ORGANIZATIONS    # {"mercy-general": {"baseUrl": "...", "clientId": "..."}}
```

Authentication is a **signed JWT assertion**, not a client secret: the app
registers a public key and each token request presents a JWT signed with the
matching private key. There is no shared secret to leak, which is the point.

## PHI handling

Every Epic read is PHI. Not *may contain* — is. So:

- **A stated purpose is mandatory on every read**, and is recorded with the
  result. This is not ceremony: HIPAA's minimum-necessary standard is about the
  purpose of the access, so a system that cannot say why it read something cannot
  demonstrate compliance with it.
- **Direct identifiers are redacted by default.** A workflow that schedules an
  appointment does not need a date of birth or an address, and a payload carrying
  them anyway becomes a breach the moment it is logged, exported, or shown to the
  wrong agent. `includePhi` exists but must be justified.
- **`containsPhi()` is the check on the control** — the invariant is asserted
  against read paths rather than assumed from having called the redactor.
- **Writes are on the compliance floor.** `epic_schedule_appointment` writes into
  a health system's record of care, which has consequences for a real person's
  treatment. Explicit approval, no standard autonomy grant, stated purpose.

## Tools

| Tool | Notes |
|---|---|
| `get_connection_preconditions` | State of every prerequisite and the single next action |
| `attest_precondition` | Record a named human's attestation with its reference |
| `epic_list_organizations` | Organisations credentials are held for; returns no key material |
| `epic_list_appointments` | Requires `orgId` and `purpose` |
| `epic_list_practitioners` | Requires `orgId` and `purpose` |
| `epic_schedule_appointment` | **Compliance floor** |

## Events

Clinical events fail closed. Appointment booked, cancelled and no-show map to
proposed tasks; inbound referrals and available results require review; anything
unrecognised requires approval rather than being dropped.

## Sequencing advice

Epic is the highest-value and highest-friction item on the roadmap. The
authorisation path is longer than the build. Start the conversation with the
health system's IT governance before writing integration code, because sandbox
success is necessary and nowhere near sufficient — a live connection at a real
Epic customer site is the hard gate.
