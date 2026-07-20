# CONVERGENCE-Ai™ — Cloud HITL AI Automation Hub

Multi-agent automation cockpit and pre-sales auditor by **AiWorXmiths**.

| Module | Role |
|---|---|
| `aiwx-smb-auditor/` | Express gateway (:3003) — HTTPS audits, Firecrawl lookups, campaign scheduler, analytics, Supabase CRM export. Single entry point. |
| `aiwx-convergence-ai/` | Vite dashboard (deployment hub, upskilling console) — built to `dist/`, served at `/admin`. Also contains the tenant-provisioning middleware (`server/`). |
| `aiwx-social-media-agent/` | Direct-posting agent — Meta/LinkedIn REST (`publish_api.js`) with Puppeteer headless fallback (`publish_headless.js`), prospecting agent, cron loop. |

## Quick start (Docker — production)

```bash
cp .env.example .env      # fill in your keys
docker build -t convergence-ai .
docker run --env-file .env -p 3003:3003 -v convergence-data:/data convergence-ai
```

The image builds the admin dashboard, installs system **Chromium** for Puppeteer
(`--no-sandbox` headless mode), and starts the gateway. Health probe: `GET /health`.

## Quick start (local dev)

```bash
npm run install:all
npm run build             # Vite build of the admin dashboard
cd aiwx-smb-auditor && npm start
```

## Configuration

All configuration is environment-driven — see [.env.example](.env.example).
Required at boot: `FIRECRAWL_API_KEY`, `GA4_PROPERTY_ID`, `GA4_MEASUREMENT_ID`.
GA4 service-account credentials load from `GA4_CREDENTIALS_BASE64` (preferred) or
`GA4_CREDENTIALS_PATH`. Supabase uses `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
(pooled keep-alive REST client with automatic retry on transient failures).

## Documentation

- [System assessment, gaps matrix & rearchitecture plan](docs/SYSTEM_ASSESSMENT.md)
- Live API docs: `GET /api/docs` (Swagger UI)
