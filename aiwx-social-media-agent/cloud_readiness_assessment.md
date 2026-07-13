# ☁️ Cloud Readiness Assessment
## AiWorXmiths Social Media Agent + Convergence-AI
*Generated: 2026-07-09 | Architecture: Node.js / Express / Puppeteer / Google Analytics 4*

---

## Part 1 — Is the Social Media Agent Ready for the Cloud?

### Short Answer: **Not Yet — 8 Blockers Found**

A full audit of the codebase found **8 platform-specific or architecture-level issues** that prevent
a straight lift-and-shift to any cloud provider. The system was designed to run on a single Windows
machine with local file system access, a full Chrome install, and PowerShell. None of those exist on
a standard cloud container.

| # | Blocker | Severity | File |
|---|---|---|---|
| 1 | Chrome hard-coded to `C:\Program Files\Google\Chrome\...` | 🔴 Critical | `publish_headless.js` |
| 2 | PowerShell `send_notification.ps1` for alerts (Windows only) | 🔴 Critical | `server.js` |
| 3 | `campaign_schedule.json` used as the database (flat file, not cloud-safe) | 🔴 Critical | `server.js`, `config/` |
| 4 | `execFile('node', ...)` spawns child processes (blocked on serverless) | 🔴 Critical | `server.js` |
| 5 | Relative paths `../aiwx-social-media-agent` hard-wired | 🔴 Critical | `server.js` |
| 6 | Puppeteer (`puppeteer.launch`) requires a GUI/headless Chrome binary | 🟡 High | `publish_headless.js` |
| 7 | `FIRECRAWL_API_KEY` required at boot with no fallback | 🟡 High | `server.js` |
| 8 | GA4 service account key is a local file path on disk | 🟡 High | `lib/ga.js` |

---

## Part 2 — What Changes Moving to the Cloud

### Current Architecture (Local / Windows)

```
Your Windows PC
├── server.js          (Express HTTP server — runs as foreground process)
├── publish_api.js     (spawned via execFile for each post)
├── publish_headless.js (spawned via execFile, uses local Chrome)
├── config/
│   ├── campaign_schedule.json   ← flat-file "database"
│   ├── meta_credentials.json    ← API keys on disk
│   └── linkedin_credentials.json
└── logs/screenshots/            ← local screenshots
```

**Problems on a cloud VM or container:**
- No persistent disk between restarts
- No Chrome GUI process available
- No PowerShell
- No Windows paths

### Cloud Architecture (Target State)

```
Cloud Run / GCP Compute / Railway
├── server.js            (containerized Express — PORT from env var)
├── publish_api.js       (runs in same container, no execFile spawn needed)
├── publish_headless.js  (uses chromium via puppeteer-core + @sparticuz/chromium)
├── Firestore / Cloud SQL ← replaces campaign_schedule.json
├── Secret Manager       ← replaces credential files on disk
├── Cloud Logging        ← replaces local logs/screenshots/
├── Cloud Scheduler      ← replaces setInterval scheduler loop
└── Cloud Storage bucket ← replaces local screenshot saves
```

---

## Part 3 — Step-by-Step Cloud Migration Plan

### Phase 1 — Fix Critical Blockers (1–2 days)

**Step 1: Replace hard-coded Chrome path**
- Install `puppeteer-core` + `@sparticuz/chromium` (serverless-compatible Chromium)
- Update `publish_headless.js` launch logic:
```javascript
// Replace:
executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
// With:
const chromium = require('@sparticuz/chromium');
const executablePath = await chromium.executablePath();
```

**Step 2: Replace PowerShell notification**
- Replace `send_notification.ps1` with a cross-platform HTTP webhook call (Slack, Teams, or email via SendGrid)
- Simple 3-line `https.request()` to a webhook URL stored in env var

**Step 3: Replace flat-file database**
- Migrate `campaign_schedule.json` to **Firestore** (free tier handles this volume easily)
- Each post becomes a Firestore document with same fields; scheduler reads/writes Firestore instead of JSON file

**Step 4: Fix relative paths**
- Replace `path.resolve(__dirname, '../aiwx-social-media-agent')` with `path.resolve(__dirname, '.')`
- Agent and server should live in the same container root

**Step 5: Move secrets to environment variables**
- Remove credential files from disk; load from **GCP Secret Manager** or plain env vars at boot:
  ```
  LINKEDIN_ACCESS_TOKEN=...
  META_USER_ACCESS_TOKEN=...
  META_PAGE_ID=...
  INSTAGRAM_ACCOUNT_ID=...
  THREADS_ACCESS_TOKEN=...
  GA4_CREDENTIALS_JSON=<base64 encoded service account JSON>
  FIRECRAWL_API_KEY=...
  ```
- Update `lib/ga.js` to use `credentials: JSON.parse(Buffer.from(process.env.GA4_CREDENTIALS_JSON, 'base64'))` instead of `keyFilename`

**Step 6: Make scheduler cloud-native**
- Remove `setInterval()` loop from `server.js`
- Create a **Cloud Scheduler** cron job that calls `POST /api/run-scheduler` every 60 seconds
- This decouples scheduling from the always-on server process

---

### Phase 2 — Containerize (0.5 day)

Create `Dockerfile`:
```dockerfile
FROM node:20-slim

# Install Chromium dependencies
RUN apt-get update && apt-get install -y \
    chromium fonts-liberation libappindicator3-1 \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 \
    libdbus-1-3 libgdk-pixbuf2.0-0 libnspr4 libnss3 \
    libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 \
    xdg-utils --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
```

Create `.dockerignore`:
```
config/
node_modules/
logs/
*.json (credentials)
.env
```

---

### Phase 3 — Deploy to Cloud Run (0.5 day)

Google Cloud Run is the ideal target — it:
- Scales to zero (no cost when idle)
- Is already in your GCP project `aiwx-sandbox-prod-88`
- Handles HTTPS automatically
- Integrates natively with Secret Manager + Firestore + Cloud Scheduler

```bash
# Build and deploy
gcloud builds submit --tag gcr.io/aiwx-sandbox-prod-88/social-media-agent
gcloud run deploy social-media-agent \
  --image gcr.io/aiwx-sandbox-prod-88/social-media-agent \
  --platform managed \
  --region us-east1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --set-secrets "META_USER_ACCESS_TOKEN=meta-user-token:latest,LINKEDIN_ACCESS_TOKEN=linkedin-token:latest"
```

> [!IMPORTANT]
> **Puppeteer on Cloud Run requires 2GB RAM minimum** — Chromium needs at least 1.5GB to launch
> without OOM (out-of-memory) kills. Set `--memory 2Gi` from day one.

---

## Part 4 — Cloud Cost Breakdown

### AiWorXmiths Social Media Agent

| Service | Usage | Monthly Cost |
|---|---|---|
| **Cloud Run** | ~1,000 requests/month (scheduler calls + UI visits). Scales to zero. | **$0–$5/mo** |
| **Firestore** | <50 posts, read/write ~200 times/day | **$0 (free tier)** |
| **Cloud Scheduler** | 1 job × 1440 calls/day = 43,200/mo | **$0.10/mo** |
| **Secret Manager** | ~8 secrets, ~10,000 accesses/mo | **$0.06/mo** |
| **Cloud Storage** | Screenshots ~50MB/mo | **$0.01/mo** |
| **Cloud Build** | Builds on deploy (< 120 min/day free) | **$0** |
| **Artifact Registry** | Container images | **$0.10/mo** |
| | **Total Estimate** | **~$5–$10/mo** |

> The biggest cost driver will be Cloud Run's **CPU during Puppeteer/Chromium sessions** (headless posting). Each post takes ~30 seconds × 4 platforms = ~2 minutes of CPU. At ~48 posts/month, that's ~96 minutes — well within the 180 CPU-minute free tier.

> [!TIP]
> **LinkedIn posts via the API** (once the `personUrn` issue is fixed) cost **$0 Puppeteer time**.
> Every platform that works via the official API avoids the Chromium cost entirely.

---

## Part 5 — Preparation Checklist Before Moving to Cloud

```
☐ 1. Add personUrn to linkedin_credentials.json (enables API posting — no Puppeteer needed for LinkedIn)
☐ 2. Gather all credentials and add to GCP Secret Manager
☐ 3. Replace campaign_schedule.json with Firestore
☐ 4. Install @sparticuz/chromium and update puppeteer launch args
☐ 5. Remove PowerShell notification — wire Slack/email webhook
☐ 6. Remove hard-coded Windows paths from all scripts
☐ 7. Create Dockerfile + .dockerignore
☐ 8. Enable Cloud Run API on project aiwx-sandbox-prod-88
☐ 9. Set up Cloud Scheduler cron for the posting loop
☐ 10. Test locally with Docker before deploying to Cloud Run
```

---

---

## Part 6 — Convergence-AI on a Separate Cloud Instance

### What Is Convergence-AI?

Based on the codebase, Convergence-AI is the **SMB Auditor + Prospecting Intelligence layer** —
it includes:
- `lib/scraper.js` — Domain header/WAF/DNS analysis
- `lib/analyzer.js` — Digital footprint scoring
- `lib/workforce.js` — LinkedIn workforce signal analysis
- `lib/scourer.js` — Business scouting and intel gathering
- `lib/scouting.js` — Local prospect identification
- `lib/conversational_agent.js` — AI-powered reply generation
- `smb-auditor.html` — The SMB Audit UI
- `smb_landing_page_*.png` — Campaign landing pages
- Firecrawl API key for deep web crawling

### Separate Cloud Instance Architecture

Convergence-AI can be split into its own Cloud Run service alongside the Social Media Agent:

```
GCP Project: aiwx-sandbox-prod-88
├── Cloud Run: social-media-agent     (Posts, Scheduler, Campaign UI)
│     └── Handles: /api/publish-post, /api/schedule, social_media_hub.html
│
└── Cloud Run: convergence-ai         (Intelligence, Audit, Prospecting)
      └── Handles: /api/audit, /api/scout, /api/analyze, smb-auditor.html
```

### What It Takes to Deploy Convergence-AI Separately

**1. Split the server.js** — Extract Convergence-AI routes into their own `convergence_server.js`:
- All `/api/audit/*`, `/api/scout`, `/api/analyze`, `/api/workforce` routes move here
- Social media routes stay in `server.js`

**2. Separate package.json** with its own dependencies:
```json
{
  "name": "convergence-ai",
  "dependencies": {
    "express": "^4.x",
    "firecrawl": "^latest",
    "@google-analytics/data": "^4.x",
    "helmet": "^7.x",
    "morgan": "^1.x"
  }
}
```

**3. Convergence-AI has NO Puppeteer dependency** — it uses the Firecrawl API for crawling
(external service, not Chromium). This means it's **much cheaper to run**:

| Service | Convergence-AI | Social Media Agent |
|---|---|---|
| RAM needed | **512 MB** | 2 GB (Chromium) |
| CPU needed | Low | Medium-High |
| Monthly cost | **~$1–3/mo** | ~$5–10/mo |

**4. Deploy separately:**
```bash
gcloud run deploy convergence-ai \
  --image gcr.io/aiwx-sandbox-prod-88/convergence-ai \
  --region us-east1 \
  --memory 512Mi \
  --cpu 1 \
  --set-secrets "FIRECRAWL_API_KEY=firecrawl-key:latest,GA4_CREDENTIALS_JSON=ga4-creds:latest"
```

**5. Shared Firestore** — Both services can read/write the same Firestore database, sharing
prospect lists and analytics data between the social agent and the intelligence layer.

### Total Combined Cloud Cost

| Service | Monthly |
|---|---|
| social-media-agent (Cloud Run) | ~$5–10 |
| convergence-ai (Cloud Run) | ~$1–3 |
| Shared Firestore | $0 (free tier) |
| Shared Secret Manager | ~$0.10 |
| Cloud Scheduler | ~$0.10 |
| **TOTAL** | **~$7–14/month** |

> [!NOTE]
> This is significantly cheaper than a dedicated VM (a `e2-small` GCP VM would cost ~$12/mo **always-on**,
> with no auto-scaling). Cloud Run scales to zero overnight and on weekends, which is when the social
> media scheduler isn't running.

---

## Recommended Deployment Target: Google Cloud Run

**Why Cloud Run over alternatives:**
| Platform | Verdict |
|---|---|
| **Cloud Run** ✅ | Already in your GCP project. Scales to zero. Native Firestore/Secret Manager. Best fit. |
| Railway | Easy but limited control; costs more at scale; no native GCP integrations |
| Fly.io | Good but requires separate secret management; no GCP-native integrations |
| Heroku | Expensive for always-on dynos; Chromium issues on free tier |
| AWS Lambda | Puppeteer/Chromium layers are complex; 15min timeout limits |
| GCP Compute VM | Too expensive for sporadic workloads; no auto-scale |
