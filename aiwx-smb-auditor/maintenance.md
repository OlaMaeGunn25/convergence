# Maintenance & Token Rotation Schedule

This document outlines key operational dates and rotation details for API integrations, authentication tokens, and credentials.

---

## 🔑 Platform Token Rotation (Meta, Threads, LinkedIn)

| Platform | Scope | Secret Location | Expiry Date | Recommended Refresh | Status |
|---|---|---|---|---|---|
| **Meta Graph API** | Facebook Direct Posting | `config/meta_credentials.json` | Sept 3-4, 2026 | **August 20, 2026** | 🟢 Active |
| **Threads API** | Threads Direct Posting | `config/cookies_threads.json` | Sept 3-4, 2026 | **August 20, 2026** | 🟢 Active |
| **LinkedIn OAuth** | LinkedIn Direct Posting | `config/cookies_linkedin.json` | Sept 3-4, 2026 | **August 20, 2026** | 🟢 Active |

---

## 🛡️ Google Analytics 4 (Service Account Key)

| Key Name | Location | Scope | Expiry Date | Recommended Rotation | Status |
|---|---|---|---|---|---|
| **GA4 Service Account Key** | `config/credentials-ga-socialmediahub.json` | GA4 Reporting API | Never (Static Service Account Key) | Annually | 🟢 Verified Active |
