# Clio Integration (Legal Practice Management)

**Module:** `aiwx-smb-auditor/lib/connectors/clio.js` · **Catalog id:** `clio` ·
**Status:** available · **Vertical:** Legal Services

Clio is the first concrete connector wired into the CONVERGENCE-Ai governed MCP
layer. It follows the same two-dimensional AI TRiSM contract as everything else:
**WHO may act** (auth + HITL approval on writes) and **WHAT is true** (live vs.
clearly-labeled simulated data).

## 1. What it connects

| Capability | Tool | Risk | Governance |
|---|---|---|---|
| List matters | `clio_list_matters` | read | readOnly; simulated fallback |
| List contacts / activities | (connector fns) | read | readOnly; simulated fallback |
| Log a billable activity | `clio_create_activity` | write | destructive → **HITL approval** |
| Open a matter | (connector fn) | write | destructive → HITL approval |
| Trust (IOLTA) transaction | `clio_record_trust_transaction` | **highest** | **always HITL**; connector re-checks `approved` |

## 2. Auth (OAuth 2.0, credentials env-only)

Clio uses OAuth 2.0. Credentials come **only** from env / Secret Manager — never
over any API (the connection builder refuses secret-looking config):

```ini
CLIO_CLIENT_ID=
CLIO_CLIENT_SECRET=
CLIO_ACCESS_TOKEN=       # bearer; presence flips reads/writes from simulated -> live
CLIO_REGION=us           # us | eu | ca | au  (regional data centers)
CLIO_WEBHOOK_SECRET=     # optional; enables HMAC-SHA256 verification on the webhook
```

Regional base URLs (`lib/connectors/clio.js` → `REGIONS`): `app.clio.com` (US),
`eu.app.clio.com`, `ca.app.clio.com`, `au.app.clio.com`. API version `api/v4`.
OAuth endpoints per region are exposed via `oauthConfig()`.

Without `CLIO_ACCESS_TOKEN`, reads return a labeled **simulated** dataset
(`simulated:true`, `provenance:'simulated'`) so demos never blank — never present
simulated rows as live records.

## 3. Connecting Clio

Via the connection builder (approval-gated):

```bash
# 1. Discover it
GET /api/connectors?vertical=Legal%20Services      # -> includes { id:"clio", ... }

# 2. Build the connection (approval required)
POST /api/connections { "connectorId":"clio" }      # -> 202 requires_approval
POST /api/connections { "connectorId":"clio", "approved":true }
# -> { connection:{ status:"configuring", health:"pending_credentials" },
#      authAction:{ type:"oauth2", message:"Complete the Clio OAuth grant ..." } }
```

Once `CLIO_ACCESS_TOKEN` is present in env, the next build moves the connection to
`connected` / `health:ok`. Live status shows in the floating component
(`GET /api/connections`).

Equivalent registry tools (also reachable over MCP): `connect_system`,
`get_connection_status`, `list_connectors`.

## 4. Webhooks → governed tasks

Clio webhooks post to `POST /api/clio/webhook`. When `CLIO_WEBHOOK_SECRET` is set,
the HMAC-SHA256 signature (`X-Hook-Signature`) is verified before processing.
`clio.mapWebhookToTask()` turns each event into a task_model task, routing
high-risk events through HITL:

| Clio event | Task type | Initial state |
|---|---|---|
| `matter.created` | `clio.matter.review` | proposed |
| `contact.created` | `clio.contact.enrich` | proposed |
| `activity.created` | `clio.activity.review` | proposed |
| `bill.created` | `clio.bill.review` | **pending_approval** |
| `trust.transaction.created` | `clio.trust.review` | **pending_approval** |
| (unknown) | `clio.event.unhandled` | **pending_approval** (fail-safe) |

> **Production note:** robust HMAC needs the raw request body; wire an
> `express.raw()` capture on `/api/clio/webhook` before JSON parsing. The current
> implementation signs the re-serialized body as a best effort.

## 5. Trust-accounting (IOLTA) rule

Moving money held in trust is the highest-risk action a legal integration can
take. `recordTrustTransaction()` refuses to proceed unless it receives an explicit
`approved` flag, **and** the `clio_record_trust_transaction` tool is marked
`requiresApproval` so the registry gate blocks it too. Two independent gates,
by design.

## 6. Tests

`aiwx-smb-auditor/test/run.js` Test Set 14 covers: simulated-fallback reads, the
trust-transaction double-gate, webhook→task risk mapping, and the approval gate on
`clio_create_activity` / `clio_record_trust_transaction`.
