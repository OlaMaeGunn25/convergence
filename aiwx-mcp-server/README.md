# CONVERGENCE-Ai MCP Server

Exposes the governed CONVERGENCE-Ai gateway as **Model Context Protocol** tools so
Claude (and other MCP clients) can drive the hub through the same authenticated,
audit-logged surface a human uses — never a back door.

## Why this exists

CONVERGENCE-Ai positions itself as a *cockpit of agents*. This server is the
protocol adapter that lets agents **operate** the hub: run audits, search legal
precedent, read analytics, and — under human-in-the-loop control — approve HITL
tasks and publish posts. Every call authenticates with the gateway's
`GATEWAY_API_KEY` and is recorded in `audit_log`.

## Tools

| Tool | Kind | Endpoint |
|------|------|----------|
| `run_audit` | write (openWorld) | `POST /api/audit` |
| `search_scholar` | read | `GET /api/scholar/search` |
| `get_analytics` | read | `GET /api/analytics` |
| `get_scheduler_status` | read | `GET /api/scheduler-status` |
| `list_hitl_queue` | read | `GET {ADMIN}/api/hitl` |
| `action_hitl_task` | **destructive, HITL** | `POST {ADMIN}/api/hitl/action` |
| `publish_post` | **destructive, dry-run default** | `POST /api/publish-post` |
| `export_crm` | write | `POST /api/export-crm` |

**Human-in-the-loop is preserved:** `publish_post` is dry-run unless
`confirm:true`, and the intended path for side-effectful work is to stage it and
approve via `list_hitl_queue` → `action_hitl_task` (which stamps the approving
actor into the immutable audit trail).

## Configure

```bash
cp .env.example .env
# GATEWAY_URL=http://localhost:3003
# ADMIN_URL=http://localhost:8080
# GATEWAY_API_KEY=<operator key matching the gateway>
npm install
npm start            # stdio transport
npm run inspect      # test with the MCP Inspector
```

### Register with Claude / an MCP client

```json
{
  "mcpServers": {
    "convergence-ai": {
      "command": "node",
      "args": ["/path/to/convergence/aiwx-mcp-server/src/index.js"],
      "env": {
        "GATEWAY_URL": "https://your-gateway-host",
        "GATEWAY_API_KEY": "your-operator-key"
      }
    }
  }
}
```

## Verify

```bash
npm run inspect      # lists tools; call run_audit / search_scholar read tools
```

The server requires the CONVERGENCE-Ai gateway (and, for HITL tools, the admin
orchestrator) to be reachable at the configured URLs.
