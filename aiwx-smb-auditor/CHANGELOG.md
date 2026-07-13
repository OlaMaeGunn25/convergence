# Changelog

All notable changes to the **CONVERGENCE-Ai SMB Auditor & AI Workforce Planner** will be documented in this file.

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
