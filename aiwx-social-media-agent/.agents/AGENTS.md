# Workspace System Rules - AIWX Social Media Agent

## 🔌 API Wiring and Integration Mapping

* **Meta (Facebook / Instagram / Threads)**
  * **Configuration File:** [meta_credentials.json](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/config/meta_credentials.json)
  * **Contains:** App ID, User Access Token, Facebook Page ID (`1026296063897325`), Instagram Account ID (`17841480065034517`), and Threads App ID / Secret / Access Token.
  * **Expiration:** Tokens are valid until ~Sept 4, 2026.

* **LinkedIn**
  * **Configuration File:** [linkedin_credentials.json](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/config/linkedin_credentials.json)
  * **Contains:** Client ID, Client Secret, App ID (`256881790`), OAuth Access Token (scopes: `openid`, `profile`, `w_member_social`, `r_basicprofile`), and Redirect URI (`https://aiworxmiths.com/auth/linkedin/callback`).
  * **Expiration:** Access Token is valid until ~Sept 4, 2026.

* **Google Analytics 4**
  * **Credentials File:** [credentials-ga-socialmediahub.json](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/config/credentials-ga-socialmediahub.json) (Service account key for `aiwxsocialmediahub@aiwx-sandbox-prod-88.iam.gserviceaccount.com`).
  * **GA4 Target Info:** Property ID `521873458`, Account ID `361897142` (project: `aiwx-sandbox-prod-88`).
  * **Module:** `lovable_upload/2026-07-06/lib/ga.js` — exports `getGA4Metrics()` using the `BetaAnalyticsDataClient`.
  * **Environment Variables:** Loaded via `dotenv` from `lovable_upload/2026-07-06/.env` (defines `GA4_PROPERTY_ID`, `GA4_MEASUREMENT_ID` (`G-V2Z3W6F8G2`), `GA4_CREDENTIALS_PATH`, and `GOOGLE_CLOUD_PROJECT`).

* **Session Cookies (For Headless Browser Fallback Posting)**
  * **Files:** [cookies_facebook.json](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/config/cookies_facebook.json), [cookies_instagram.json](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/config/cookies_instagram.json), [cookies_linkedin.json](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/config/cookies_linkedin.json), and [cookies_threads.json](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/config/cookies_threads.json).

* **Guidelines for Agent Execution:**
  * Always load credentials dynamically from the `config/` folder.
  * Load environment variables via `dotenv` from `lovable_upload/2026-07-06/.env`.
  * Call `require('./lib/ga')` for Google Analytics 4 integration.
  * Never hardcode access tokens or credentials directly.
  * Never launch Google Chrome using personal profiles associated with `dahaominemoody@gmail.com` (specifically `Profile 5` and `Profile 14`).
  * Only launch Google Chrome using corporate/business profiles associated with `aiworxmiths@gmail.com` or `aiworxmiths.com` (specifically `Profile 2`, `Profile 27`, or `Profile 28`).
