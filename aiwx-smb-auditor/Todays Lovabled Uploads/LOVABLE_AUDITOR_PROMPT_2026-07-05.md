# Lovable.ai Sync Prompt: Enforce 1-Year Date Limit on Audit Report Recent Data

Copy and paste the prompt below into **Lovable.ai** and upload the three attached files (`smb-auditor.html`, `app.js`, and `admin.js`) from the `lovable_upload` directory to sync the changes:

***

```text
Please consume the attached "smb-auditor.html", "app.js", and "admin.js" files to update our React+Vite+TypeScript SMB Auditor application. Apply the following date filtering and simulated database date update parity:

1. DYNAMIC 1-YEAR DATE FILTER ON PUBLIC MENTIONS (NEWS):
   - Add a date filtering utility inside the client-side audit simulation code (`runClientSideAuditSimulation`):
     * Implement `isOlderThanOneYear(dateStr: string): boolean` which parses date strings (handles Month YYYY like "November 2025", MM/DD/YYYY like "11/05/2025", and "Recent Scrape") and compares them against (Current Date - 1 year).
     * Implement `filterRecentMentions(mentions: PublicMention[]): PublicMention[]`. This filters out any news mentions older than 1 year, unless there is no recent data available (i.e., if all mentions are >1 year old, it preserves them as the "only data available").
   - Filter the returns of the client-side simulated audit so that the public mentions shown in the customer portal and the admin ledger adhere to this 1-year rule.

2. FRESH SIMULATED DATES FOR CLIENT-SIDE AUDITS:
   - For all simulated vertical cases (such as E-Commerce & Retail, Technology & SaaS, Healthcare & Wellness, Professional Services), update the hardcoded mock/simulated news mentions and filings dates to be fresh:
     * Public news mentions dates should be updated from 2024/early-2025 to 2025/2026 (e.g. "November 2025", "June 2026", "February 2026", "September 2025", "January 2026", "August 2025", "December 2025").
     * State filings `lastAmended` dates should be updated to 2026 (e.g. "March 15, 2026", "May 02, 2026").
     * OSHA Compliance audits should be updated to "2026 Audit".
   - This ensures the default mock data presented on offline fallbacks is less than 1 year old.
```
