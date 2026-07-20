# Changelog

All notable changes to the **CONVERGENCE-Ai SMB Auditor & AI Workforce Planner** will be documented in this file.

## [Unreleased]

### Changed
- **Campaign scheduler, activity alerts, and audit queue moved to Supabase.** These three stores were JSON files (`config/campaign_schedule.json`, `config/activity_alerts.json`, `config/audit_queue.json`) that every writer read, mutated, and rewrote whole, with no locking. Concurrent writers could double-publish a post, run an audit twice, or silently drop each other's edits. Each store is now a table, and the queues are drained through Postgres functions using `SELECT ... FOR UPDATE SKIP LOCKED` so a job or post can only ever be claimed once.
- **`scheduler_daemon.js` and the in-process scheduler loop can now run concurrently.** Both claim work through the same locked queue instead of racing on the schedule file.
- **Campaign approvals can route through the shared `hitl_queue`.** Set `CAMPAIGN_HITL_APPROVAL=true` to hold `PENDING` posts for human release in the same queue the admin console already renders; a database trigger releases the post when the task is approved. Defaults to off, preserving the previous auto-approve behaviour.
- **Consolidated scheduled-time parsing into `lib/schedule_time.js`.** The copy in `server.js` built its `Date` from a bare `YYYY-MM-DDTHH:mm` string (interpreted in the host timezone rather than Eastern) and zeroed the hour for `12:xx PM` as well as `12:xx AM`. Both are fixed by adopting the daemon's correct implementation everywhere.

### Added
- `lib/stores/{campaign_store,alerts_store,audit_queue_store}.js` — one API per store, backed by Supabase in production and by the original JSON files in local dev when `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are unset.
- `lib/stores/json_file.js` — the dev fallback, now with a per-file async mutex and atomic temp-file-then-rename writes, so local runs no longer lose interleaved writes or observe half-written files.
- Stale-work recovery: posts stuck in `PUBLISHING` and jobs stuck in `running` after a worker crash are swept back to a runnable state (`STALE_JOB_MINUTES`, default 30).
- `updateRows`, `upsertRows`, `deleteRows`, and `rpc` on the Supabase REST client.
- Schema for `campaign_posts`, `campaign_schedule_state`, `activity_alerts`, `audit_queue_jobs`, and `audit_queue_state`, plus the claim/complete/requeue functions, in `aiwx-convergence-ai/supabase_schema.sql`.

### Fixed
- Enqueuing the same domain twice concurrently no longer creates duplicate audit jobs; a partial unique index on `(domain) WHERE status = 'queued'` makes the check atomic.

## [1.1.0] - 2026-07-07

### Added
- **Security Hardening**: Integrated Express `helmet` middleware for secure HTTP headers.
- **API Request Protection**: Configured `express-rate-limit` middleware protecting expensive endpoints (`/api/audit` and `/api/scout-prospects`).
- **Domain Verification**: Enforced RFC-compliant regex validation on inbound audit requests to prevent malformed or malicious inputs.
- **Request Timeout Protection**: Integrated `withTimeout` wrapper limiting heavy external Firecrawl queries to a maximum duration of 30 seconds.
- **Graceful Shutdown**: Added process handlers for `SIGTERM` and `SIGINT` to close pending network connections cleanly before process termination.
- **Crash Safety**: Implemented global handlers for `uncaughtException` and `unhandledRejection` to prevent silent server drops.
- **Structured Logging**: Added Express `morgan` HTTP request log formatter.
- **Response Compression**: Integrated Gzip/Deflate compression via `compression` middleware, reducing JSON payload transfers by up to 80%.
- **Health Check API**: Exposed a `/health` endpoint reflecting server uptime, environment variables status, and API availability.
- **Archive Log Rotation**: Capped active memory alert logging to 100 entries, dynamically archiving overflow items onto disk.
- **SEO & Social Metadata**: Added meta descriptions, Open Graph headers, and canonical links to all three major templates (`index.html`, `product.html`, `social_media_hub.html`).
- **Aria Accessibility & Keyboarding**: Added ARIA dialog, labeling, and close-action descriptors on custom UI modals.
- **Resilient Analytics Sync**: Created `/api/track-events-batch` and client event queueing inside `analytics_tracker.js` using exponential backoff retry loops and `sendBeacon` to protect tracking data from network dropouts.
- **Swagger Documentation**: Mounted interactive OpenAPI Swagger docs UI under `/api/docs`.

### Changed
- **Decomposed Frontend Code**: Split monolithic script inside `social_media_hub.html` into structured layout components: `js/calendar_ui.js` (calendar & scheduler timelines), `js/alerts_ui.js` (notification alerts), and `js/traffic_agent.js` (engagement metrics & audience simulation).
- **CORS Whitelist**: Replaced open wildcard header with a strict whitelist containing local dev servers and the production domain (`convergence-ai.com`).
