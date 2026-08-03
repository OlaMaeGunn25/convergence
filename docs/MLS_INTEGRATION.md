# MLS & Property Data Integration (Real Estate)

Real estate is the vertical where "connect the tenant's systems" is hardest, because
there is no single system to connect. MLS data is licensed board by board, a
brokerage's board is a function of its geography, and the same brokerage operating
in two markets holds two separate data licences with two separate feeds.

CONVERGENCE-Ai therefore offers two paths, and proposes both.

## The two paths

| Path | Connector(s) | What it needs | When it fits |
|---|---|---|---|
| Direct per-board feed | `reso_web_api`, `trestle`, `mls_grid`, `bridge` | A signed data licence with each MLS, plus that board's credentials | A single-market brokerage that already has its IDX/VOW licence |
| Aggregate feed | `realestateapi` | One API key | Multi-market brokerages, agents, and any tenant that needs to be operational before a board licence is negotiated |

Both are proposals. Neither binds without HITL approval — see invariant **I1**
(operationally-ready is not connected) and **REG-03**.

## Resolving the local board

The static `MLS_BY_REGION` table in `lib/regional_sources.js` names one
representative board per state. That is a reasonable default and a poor fact —
Washington alone has several boards. `boardsForRegionLive(region)` replaces the
guess with a lookup:

```
detect region  →  MLSBoardCoverage(state)  →  boards[]  →  propose for approval
```

Region detection is unchanged (explicit value, postal address, or GPS bounding
box). When the aggregate feed is unconfigured the resolver falls back to the
static table and says so — `source: 'static_table'` — rather than presenting a
guess as a lookup.

Tool: `realestate_mls_connection_options` does the whole chain in one call and
returns the direct feed, the aggregate feed, live board coverage, and the MCP
surface descriptor.

## REST or MCP

RealEstateAPI publishes both a JSON REST API and an MCP server over SSE. The
connector describes the MCP surface via `mcpConfig()`:

```json
{
  "transport": "sse",
  "url": "https://mcp.realestateapi.com/sse",
  "authHeader": "x-api-key",
  "secretRef": "REALESTATEAPI_KEY"
}
```

Note `secretRef`, not the key. The connection builder resolves it from the secret
store at bind time; the descriptor never carries a credential, so it is safe to
log, store on a connection record, and show to a human approving the connection.

## Tools

| Tool | Endpoint | Notes |
|---|---|---|
| `realestate_search_listings` | `POST /v3/MLSSearch` | Geography required |
| `realestate_get_listing` | `POST /v3/MLSDetail` | By `listingId` or `mlsNumber` |
| `realestate_mls_board_coverage` | `POST /v3/MLSBoardCoverage` | boards / zips / counties / cities |
| `realestate_search_properties` | `POST /v2/PropertySearch` | Public records; geography required |
| `realestate_get_property` | `POST /v2/PropertyDetail` | By id, address, or apn+fips |
| `realestate_skip_trace` | `POST /v2/SkipTrace` | **Compliance floor** — see below |
| `realestate_mls_connection_options` | — | Region → connection proposals |

## Three constraints worth stating plainly

**1. A geography is mandatory.** Both search tools refuse a request with no
bounded geography. This is not input validation for its own sake: an unbounded
nationwide sweep is a licence problem and it burns the shared daily record cap,
which degrades every other workflow running on the same key.

**2. Skip trace is on the compliance floor.** It resolves a named person's phone
and email. That is regulated contact data — TCPA, state do-not-call statutes, and
in several states separate restrictions on its use for solicitation. So it:

- refuses without an explicit approval, inside the connector, before the registry
  gate is even reached;
- additionally requires a **stated purpose**, recorded on the result, so the
  reason for the lookup is auditable after the fact;
- is listed in `autonomy.FLOOR_TOOLS`, so no standard autonomy grant can delegate
  it — only an elevated grant or a live human approval;
- returns the vendor's DNC and litigator flags rather than stripping them,
  because the human acting on the result is the one who needs to see them.

Every other read runs owner contact fields through `redactOwnerContact()`. A
listing search must not become a side door into personal data just because the
vendor happens to return it in the same payload.

**3. MLS content is licensed, not owned.** Every listing payload carries a
`license` block naming the board and the display obligation. The licence belongs
to the tenant brokerage; Convergence is a processor. Attribution, refresh cadence
and redistribution limits travel with the data as it moves through agents, task
records and exports.

## Governed process map

`realestate_buyer_lead` (in `lib/process_map_bridge.js`) turns the hub's "Real
Estate: Buyer Lead Nurturing & Contracts" drawing into a real task chain:

| # | Step | Type |
|---|---|---|
| 1 | Buyer enquiry received | system |
| 2 | Resolve covering MLS board for the buyer's region | agent |
| 3 | Search listings against buyer criteria | agent |
| 4 | Enrich shortlist with public property records | agent |
| 5 | **HITL Broker Review of shortlist** | gate |
| 6 | **HITL approval to contact owner (compliance floor)** | gate |
| 7 | Schedule showing and record the engagement | agent (destructive) |

Two things about the ordering are deliberate. Board resolution is step 2, before
any search — MLS access is board-bound, so searching before the board is known is
searching the wrong thing. And contacting an owner is its own gate at step 6,
separate from the shortlist review, because approving *which houses to show* is
not the same decision as approving *reaching out to a person*. Every step after
that gate is blocked behind it by the dependency edge.

## Rate limits

As documented by the vendor: 1,000,000 records per 24h across the PropertySearch
and SkipTrace scopes; `/SkipTrace` 10 req/s; `/SkipTraceBatch` 20 req/s. A 429 is
surfaced to the caller as an error, never retried blindly — a retry loop against a
shared daily cap is how one workflow takes down all of them.

## Configuration

```
REALESTATEAPI_KEY=...                                  # required for live data
REALESTATEAPI_URL=https://api.realestateapi.com        # optional override
REALESTATEAPI_MCP_URL=https://mcp.realestateapi.com/sse  # optional MCP surface
```

Unconfigured, every read returns a clearly-labeled simulated dataset
(`simulated: true`, `provenance: 'simulated'`) so onboarding and demos never
blank — the same contract as the Scholar, Clio and Gusto connectors.
