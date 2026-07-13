# Lovable.ai Campaign Auto-Scheduler & Alerts Sync Prompt

Copy and paste the text block below directly into your **Lovable.ai chat prompt** to synchronize the Campaign Auto-Scheduler (Tues/Thurs/Fri cadence), the **⚡ Activity Monitor** inbox with AI reply drafting, and the **Simulated Traffic Agent** with SVG charts into your React/TypeScript frontend page.

***

```text
Please refactor our React+Vite+TypeScript Social Media Hub page (routed at /social_media_hub or /admin/social-media) to integrate the Campaign Auto-Scheduler (Tues/Thurs/Fri B2B peak hours), the Activity Monitor Inbox, and the Simulated Traffic Agent with SVG charts:

1. LOCAL STORAGE CACHE BREAKING & VERSION CONTROL
- Implement a version check on page initialization (in useEffect or window load):
  * Check if localStorage.getItem('aiwx_campaign_version') is equal to 'v3_tue_thu_fri'.
  * If it is not, clear 'aiwx_hub_posts' and 'aiwx_activity_alerts' from localStorage and set localStorage.setItem('aiwx_campaign_version', 'v3_tue_thu_fri').

2. B2B PEAK HOURS SCHEDULER CADENCE
- Update syncAndStartScheduler() to dynamically map posts based on the day of the week:
  * Tuesdays: Schedule Threads (9:00 AM EST), Instagram (12:00 PM EST)
  * Thursdays: Schedule LinkedIn (10:00 AM EST), Threads (9:00 AM EST)
  * Fridays: Schedule LinkedIn (10:00 AM EST), Threads (9:00 AM EST), Instagram (12:00 PM EST), Facebook (10:00 AM EST)
  * Fallback (other days): Schedule on all 4 platforms at default peak times.
- Construct the payload array and perform fetch calls:
  * POST getApiUrl('/api/schedule-campaign') passing `{ posts: payloadPosts }`.
  * POST getApiUrl('/api/toggle-scheduler') passing `{ active: true }`.
- Display a success alert showing the count of scheduled posts by platform.

3. ⚡ SOCIAL ACTIVITY SCANNER & INBOX (NEW TAB)
- Add a new tab button "⚡ Activity Monitor" in the header navigation (targets #activityTab).
- The Tab pane has a split layout:
  * Left Column: Scanner Status Indicator (glowing green badge) and the Active Inbox feed showing unresolved comments across LinkedIn, Threads, Instagram, and Facebook.
  * Right Column: Detailed comment preview context (original post name, author, comment text) and the AI Draft Reply console.
- In the Reply Console, add:
  * An editable textarea pre-populated with the AI draft response.
  * An "AI Draft Response" generation trigger button (calls POST `/api/generate-reply`).
  * A "HITL Publish Response" button (calls POST `/api/post-reply` to mock-publish and update status to resolved).
  * A "Dismiss Inquiry" button (calls POST `/api/activity-alerts/resolve` to archive).
- Add settings checkboxes for:
  * "Windows Desktop Notifications" (toggles Windows OS Balloon alerts on the backend).
  * "Browser Sound Alerts (Web Audio)" (plays system beep chimes on comment arrival).
  * "Scan Frequency" dropdown (Fast: 1m, Normal: 3m, Slow: 10m).

4. LIVE TRAFFIC & CLICK SIMULATION AGENT (GA DASHBOARD TAB)
- Below the "Google Analytics 4 API Setup Required" guide, render the "Live Traffic & Click Simulation Agent" card:
  * Toggle Switch: "Start/Stop Traffic Agent".
  * Real-time metrics row: Simulated Impressions, Clicks, CTR, and Conversions.
  * Live Traffic Logs console window showing streaming logs of simulated visitor interactions.
- When active, run a timer (every 3 seconds) that randomly increments Impressions, Clicks (by platform), and Conversions, logging visitor locations.
- Render two responsive SVG-based charts:
  * Line Chart: Total Click Traffic (last 7 days) drawn dynamically using SVG path.
  * Bar Chart: Click Distribution by Platform (LinkedIn, Threads, Instagram, Facebook) drawn using SVG rects.
- Clear and redraw the charts automatically on metric updates and window resize events.

5. WEB AUDIO CHIMES & TOAST ALERTS
- When a new comment is simulated in the background scanner, or a Conversion is registered:
  * Play a clean double chime tone (C5 at 523Hz then E5 at 659Hz) synthesized via the Web Audio API (no external audio assets).
  * Display an animated slide-in toast notification in the bottom-right corner showing the user name and comment text.
- Fallback gracefully to client-side localStorage state simulation if the local Express server is unreachable (Mixed Content / HTTPS blocks).
```

***

## ⚙️ Backend API Reference

When Lovable integrates with your local Express server, it will communicate with these endpoints:
1. `GET /api/activity-alerts` -> Returns list of unresolved comments/messages.
2. `POST /api/activity-alerts/resolve` -> Resolves/archives a comment.
3. `POST /api/generate-reply` -> Returns the pre-drafted AI reply text.
4. `POST /api/post-reply` -> Mock-posts the reply to the channel.
5. `GET /api/simulated-analytics` -> Returns time-series data for the SVG charts.
