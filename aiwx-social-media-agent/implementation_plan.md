# Implementation Plan: Google Analytics 4 Real Reporting & Clean-up

This plan outlines the steps to replace simulated dummy analytics with a live Google Analytics 4 (GA4) API integration, and provide a clear setup guide and error handling if credentials are not yet configured.

## User Review Required

> [!IMPORTANT]
> - **Zero-Dependency OAuth2 Signature**: To maintain codebase compatibility and lightweight setup, we will generate the Google API OAuth2 JSON Web Tokens (JWT) using the Node.js built-in `crypto` library. This avoids needing extra npm packages.
> - **Configuration Files**: Real analytics will require adding a GA4 Property ID in `.env` and placing a Google Service Account key file at `config/credentials-ga.json`.
> - **Configuration Setup UI**: If these credentials are not found, the "GA Dashboard" tab will automatically hide the mock data and display a step-by-step setup guide.

## Open Questions

None. The user has explicitly requested to remove dummy copy and explain what is needed if it is not functioning.

## Proposed Changes

### SMB Auditor Web Server
Path: `c:/Users/dahao/.gemini/antigravity/scratch/aiwx-smb-auditor`

---

#### [MODIFY] [server.js](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-smb-auditor/server.js)
- Add a new endpoint `GET /api/analytics` that:
  - Checks for the presence of `GA4_PROPERTY_ID` in `.env` and `config/credentials-ga.json` (or the fallback `credentials.json`).
  - If missing, returns a `success: false` response with a detailed configuration error explaining what credentials are missing.
  - If present, authenticates against `https://oauth2.googleapis.com/token` using a self-signed JWT assertion (RS256) and calls the GA4 Data API (`runReport` method) to fetch real click and conversion events matching `utm_source=linkedin`, `utm_source=instagram`, and `utm_source=threads`.
  - Aggregates the results (Impressions, Clicks, CTR, Conversions) and returns them.

#### [MODIFY] [public/social_media_hub.html](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-smb-auditor/public/social_media_hub.html) and [social_media_hub.html](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/social_media_hub.html)
- Clean up the hardcoded dummy values in the "GA Dashboard" tab.
- Add a loading spinner and dynamic container for the analytics metrics.
- If `/api/analytics` returns a configuration error:
  - Display a clean setup guide: **"Google Analytics 4 API Setup Required"** showing the exact steps to create a Google Cloud service account, enable the Google Analytics Data API, assign permissions, and configure local files.
- If configured successfully, render the live metrics and UTM campaign clicks dynamically.

---

## Verification Plan

### Automated Tests
- Test JWT creation and API endpoints with mock environment variables.

### Manual Verification
- View the "GA Dashboard" tab in the browser at `http://localhost:3003/social_media_hub.html` to confirm it displays the "Setup Required" guide when no keys are configured, instead of showing static dummy values.
