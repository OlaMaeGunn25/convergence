# Lovable.ai Campaign Auto-Scheduler Sync Prompt

Copy and paste the text block below directly into your **Lovable.ai chat prompt** to synchronize the Campaign Auto-Scheduler, calendar status indicators, background polling, and client-side simulation fallbacks into your React/TypeScript frontend page.

***

```text
Please refactor or update our React+Vite+TypeScript Social Media Hub page (routed at /social_media_hub or /admin/social-media) to integrate the Campaign Auto-Scheduler controls and real-time calendar status synchronizations:

1. COMPONENT STATE HOOKS & SYSTEM PARITY
Implement the following React states to manage the scheduler lifecycle:
- 'schedulerActive' (boolean): Tracks if the local campaign scheduler queue runner is active (defaults to false).
- 'nextPostLabel' (string): Holds the descriptive text for the next due post (e.g., "Next post: Post 1 to FACEBOOK on 2026-06-15 at 10:00 AM EST").
- 'posts' (Post[]): State tracking the 9 active campaign posts, initialized from LocalStorage ('aiwx_hub_posts').

2. CAMPAIGN AUTO-SCHEDULER SIDEBAR CARD
In the Visual Calendar tab sidebar (above the Post Review Console), add a styled container card:
- Title: "⚙️ Campaign Auto-Scheduler"
- Status Badge: Displays "ACTIVE" (green pill) or "INACTIVE" (orange/warning pill) based on 'schedulerActive' state.
- Next Post Information: A label displaying the 'nextPostLabel' value.
- Buttons:
  * "Schedule & Start Campaign" (calls syncAndStartScheduler())
  * "Toggle Scheduler State" (calls toggleSchedulerState())

3. SCHEDULER ACTIONS & ENDPOINT INTEGRATION
- Implement a helper `getApiUrl(endpoint)` that checks if the application is running on `localhost` or `127.0.0.1`. If it is running locally, use the relative path `endpoint`. If it is running on a remote hosted environment (such as Lovable's hosted preview), use `http://localhost:3003` as the base URL (i.e. return `http://localhost:3003` + `endpoint`). Use this helper for ALL API fetch calls in the application (scheduling, status, toggle, direct publish, analytics).
- Implement `syncAndStartScheduler()`:
  * Loops through the 9 active campaign posts and maps each post into 4 scheduled items (one for each target channel: Facebook, LinkedIn, Threads, Instagram) to ensure aligned daily messaging:
    - Facebook: Scheduled at 10:00 AM EST using the post's LinkedIn text copy.
    - LinkedIn: Scheduled at 10:00 AM EST using the post's LinkedIn text copy.
    - Threads: Scheduled at 9:00 AM EST using the post's Threads text copy.
    - Instagram: Scheduled at 6:00 PM EST using the post's Instagram text copy.
  * Appends appropriate platform suffixes to the IDs (e.g., `post_01_facebook`, `post_01_linkedin`, etc.) to prevent scheduling key collisions.
  * Performs a POST request to `getApiUrl('/api/schedule-campaign')` with `{ posts: payloadPosts }`.
  * Performs a POST request to `getApiUrl('/api/toggle-scheduler')` with `{ active: true }`.
  * Alerts on success or error.
- Implement `toggleSchedulerState()`:
  * Performs a POST request to `getApiUrl('/api/toggle-scheduler')` with `{ active: !schedulerActive }`.
  * Inverts the 'schedulerActive' state and updates the UI.

4. REAL-TIME STATUS POLLING & SYNC
- Add a `useEffect` hook that polls `GET getApiUrl('/api/scheduler-status')` every 15 seconds.
- In the polling logic:
  * Update 'schedulerActive' based on server state.
  * If the server updates post statuses (e.g., to 'PUBLISHED', 'FAILED', or 'PUBLISHING'), update the local React state and save the updated posts to LocalStorage ('aiwx_hub_posts').
  * Calculate the next scheduled post by scanning posts with status 'APPROVED' and finding the one with the closest future date/time. Display this in the 'nextPostLabel'.
- Helper function `parseScheduledTime(dateStr, timeStr)`:
  * Parse strings like "10:00 AM EST" and "2026-06-15" into a Date object for comparisons (e.g. strip " EST"/" EDT", convert to 24h format, and create new Date(`${dateStr}T${formattedTime}`)).

5. DYNAMIC CALENDAR CELL STATUS INDICATORS
- Update the visual calendar days to render status indicators:
  - APPROVED -> Show "⏰ [Post Title]" (purple badge)
  - PUBLISHING -> Show "⚙️ [Post Title]" (pulsing gold/accent badge)
  - PUBLISHED -> Show "✓ [Post Title]" (green success badge)
  - FAILED -> Show "❌ [Post Title]" (red danger badge)
  - PENDING / POSTPONED -> Show "⏰ [Post Title]" (orange warning badge)

6. NO SIMULATION FALLBACK & EXPLICIT ERROR REPORTING
- Wrap all scheduler and campaign API calls in try-catch.
- Do NOT implement any mock or simulated states for the scheduler or campaign lifecycle when the backend is offline.
- If a fetch request to the local API endpoints fails (due to network error, CORS, or backend being offline):
  * Catch the error and display a clear, red visual alert badge/banner in the UI saying: "Unable to connect to local backend (http://localhost:3003). Ensure local server is running and CORS is configured."
  * Reset the scheduler states (e.g., set `schedulerActive` to false) and do not fake scheduler activation or post status changes in the UI.

7. GOOGLE ANALYTICS 4 DYNAMIC DASHBOARD & SETUP GUIDE
- In the "GA Dashboard" tab, purge all hardcoded mock numbers and campaign log tables.
- Implement `loadAnalytics()` (called when the tab is clicked):
  * Performs a GET request to `getApiUrl('/api/analytics')`.
  * If the response returns `success: false` (e.g. credentials-ga.json not found), render the "Google Analytics 4 API Setup Required" panel containing the 7-step setup instructions and show the specific server error.
  * If the response returns `success: true`, show the metrics panel and campaign log table, populating the active user clicks, CTR, conversions, and estimated impressions dynamically from the API values.
  * Dynamically evaluate campaign alerts: if total clicks are 0, show a "No traffic recorded" alert. Otherwise, for any campaign row with a CTR < 2.0%, render a custom "Low Conversion" warning box recommending copy modifications.
  * Wrap the call in a try-catch. If the backend is offline or the request fails, show the "Google Analytics 4 API Setup Required" panel or a distinct connection error message ("Unable to query analytics API: Local backend offline"). Do NOT fallback to mock stats or dummy interactive clicks/conversions.

8. DIRECT HEADLESS PUBLISH CONSOLE & LIVE LOGS DISPLAY
- Implement a logs panel container and log viewer box:
  * Container ID: 'publishLogsContainer'
  * Log Box ID: 'publishLogs'
  * Screenshot Preview Container ID: 'publishScreenshotContainer'
  * Screenshot Image ID: 'publishScreenshotImg'
- In the React page controller, implement `publishDirectly()` triggered by the "⚡ Direct Headless Publish" button:
  * Determine the target platform (if 'linkedin' is selected, fall back to 'facebook' as LinkedIn posting is not yet implemented).
  * Show the logs panel, hide any previous screenshot preview, and print the initial logs in the log box:
    `[+] Initiating direct publish to [PLATFORM]...\n[+] Dry Run: [isDry]\n[+] Launching local Puppeteer browser...\n`
  * Call `POST getApiUrl('/api/publish-post')` passing `{ platform: targetPlatform, text: copyText, image: postImage, dryRun: isDry }`.
  * Wrap the fetch call in a try-catch:
    - On success, read the response JSON:
      * If `data.success` is true, append the full execution logs string (`data.log`) to the console box (prefixed with `\n[+] SUCCESS!\n[+] Logs:\n`). If `data.screenshot` is provided, set the screenshot image source to the returned URL path and display the screenshot preview container.
      * If `data.success` is false, append the error details (`data.error`) and logs (`data.log`) prefixed with `\n[-] FAILURE:\n`.
    - If the fetch fails or the server is offline, catch the error and display it directly in the console log box:
      `[!] ERROR: Failed to connect to the backend server at http://localhost:3003/api/publish-post.`
      `[!] Please make sure your local server is running on port 3003, and that you have allowed 'Insecure content' in your browser site settings for this hosted page to allow localhost connections.`
      Do NOT perform any simulation fallback or faked publishing logs.
```

***

## ⚙️ Backend API Reference

When Lovable integrates with your local Express server, it will communicate with these endpoints:
1. `POST /api/schedule-campaign` -> Receives queue posts, stores them locally in JSON.
2. `GET /api/scheduler-status` -> Returns active state and queue post statuses.
3. `POST /api/toggle-scheduler` -> Inverts background task execution active loop.
4. `POST /api/publish-post` -> Dispatches direct headless browser posting on demand. Returns a JSON response containing `{ success: boolean, platform: string, dryRun: boolean, log: string, screenshot?: string, error?: string }` where `log` contains the full step-by-step Puppeteer execution stdout.
