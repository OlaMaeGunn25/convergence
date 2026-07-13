# Walkthrough: GTM Social Media Campaigns & Headless Direct Posting

We have successfully completed the visual rescheduling of the Go-To-Market campaign and implemented the local **Headless Browser Direct Posting Agent** utilizing session cookies for Facebook, Instagram, and Threads.

---

## 📅 Part 1: Services-Focused Campaign Rescheduling

We successfully restructured and rescheduled the campaign. All product-focused posts have been archived to a dedicated content backlog, leaving a clean, 9-post services campaign starting **Monday, June 15, 2026** on a Monday-Wednesday-Friday cadence.

- **[social_media_posts_library.md](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/social_media_posts_library.md)**: Reorganized into Active Campaign (Posts 1-9) and Backlog (A-I).
- **[aiwx_social_media_posting_plan.md](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/aiwx_social_media_posting_plan.md)**: Restructured campaign table starting June 15.
- **[social_media_campaign_brief.md](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/social_media_campaign_brief.md)**: Compressed to 9 active posts across 3 weeks.
- **[generate_assets.py](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/generate_assets.py)**: Fixed parsing bug that previously contaminated Post 9's copies with archived details.
- **Generated PDFs**: Recompiled [editorial_calendar.pdf](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/editorial_calendar.pdf) and [social_media_posts_review.pdf](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/social_media_posts_review.pdf).

---

## ⚡ Part 2: Headless Browser Posting Integration (Puppeteer & Cookies)

We built a browser automation agent that uses active browser cookies to authenticate and post directly to Threads, Instagram, and Facebook, bypassing the need for Meta Developer Apps or complex OAuth flows.

### 🛠️ Code and Infrastructure Changes
1. **Workspace Manifest**:
   - **[package.json](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/package.json)**: Added Node package definitions and registered `puppeteer` and `dotenv`.
2. **Headless Posting Engines**:
   - **[publish_headless.js](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/publish_headless.js)**: Puppeteer script that loads JSON cookies, navigates to social platforms, handles dialog flows (uploads files, types copy), and saves screenshots on success or error. It includes a non-destructive `--dry-run` flag.
   - **[test_headless_connection.js](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/test_headless_connection.js)**: Connection diagnostics script to verify cookie validity and log in without posting.
3. **Local Express Server Extension**:
   - **[server.js](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-smb-auditor/server.js)**: Mounted the agent's `logs/` directory to serve screenshots. Added the `/api/publish-post` POST route to trigger `publish_headless.js` on demand.
4. **Visual Web Hub Updates**:
   - **[social_media_hub.html](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/social_media_hub.html)**: Integrated a "⚡ Direct Headless Publish" button and "Dry-run mode" checkbox in the post review console. Created a log output console showing live agent feedback and the latest screenshot. Added a step-by-step Cookie Setup Guide.

---

## 🔬 Connection & Interface Verification Results

### 1. Script Testing
- **Instagram login check**: Ran `node test_headless_connection.js --platform instagram` with mock cookies. The script launched successfully, detected the login wall, and saved a verification screenshot.
- **Threads dry-run test**: Ran `node publish_headless.js --platform threads --text "Test Thread" --dry-run` to verify that invalid cookies trigger an instant, descriptive error and close the browser safely.

### 2. Sibling Server Synchronization & Restart
We copied the updated hub page to the active server folders under `aiwx-smb-auditor` and restarted the Node server process. The server is listening on:
`🌐 Server running at: http://localhost:3003`

### 3. Web UI Visual Check
We verified the integrated controls at `http://localhost:3003/social_media_hub.html` using a browser subagent. Below is the screenshot of the newly updated interface:

#### Visual Hub Direct Posting Controls & Cookie Guide
![Social Media Hub Direct Posting UI](/C:/Users/dahao/.gemini/antigravity-ide/brain/d045454d-012c-4ba0-bf36-f58a4e6e45db/publish_controls_and_guide_visible_1781468105557.png)

*To watch the full browser verification session, review the recording:*
![Browser Session Recording](/C:/Users/dahao/.gemini/antigravity-ide/brain/d045454d-012c-4ba0-bf36-f58a4e6e45db/verify_headless_ui_integration_1781468074182.webp)

---

## ⚙️ Part 3: Campaign Auto-Scheduler & Security Hardening

We have successfully implemented the Campaign Auto-Scheduler and resolved a security vulnerability that was causing local storage states to clear.

### 🛠️ Auto-Scheduler Implementation
1. **Express Server Background Scheduler**:
   - Modified [server.js](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-smb-auditor/server.js) to scan [campaign_schedule.json](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/config/campaign_schedule.json) every 60 seconds.
   - Parses the EDT calendar times and compares them to local system time.
   - Auto-publishes due posts to **Facebook, Instagram, and Threads** using `publish_headless.js` in live mode.
   - Integrates native **Windows OS Balloon Notifications** via [send_notification.ps1](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/send_notification.ps1) to alert you on task execution success or failure.
2. **Visual Scheduler Card & Real-Time Sync**:
   - Added the **⚙️ Campaign Auto-Scheduler** control card in the sidebar of [social_media_hub.html](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/social_media_hub.html).
   - Wired up **Schedule & Start Campaign** and **Toggle Scheduler State** buttons calling `/api/schedule-campaign` and `/api/toggle-scheduler`.
   - Displays real-time scheduler state and the details of the next scheduled post.
3. **Dynamic Calendar Badges**:
   - Updated the calendar renderer to map status states directly: `✓` for Published, `⏰` for Approved, `⚙️` for Publishing, `❌` for Failed.
   - Refreshes status indicators and calendar styles in real-time.

### 🛡️ Security Hardening (XSS Resolution)
- **Problem**: The Client Audit Ledger history list in the Consultant Audit Command Center rendered scoured domains via `innerHTML` ([smb-auditor.html](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-smb-auditor/smb-auditor.html) and [admin.js](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-smb-auditor/public/admin/admin.js)). A domain containing an XSS payload was triggering a script to clear `aiwx_hub_posts` in localStorage.
- **Fix**: Replaced the vulnerable `innerHTML` calls with secure DOM construction utilizing `textContent` elements. The ledger now securely displays scoured domains with no risk of arbitrary script execution.

---

## 🍪 Part 4: Cookie Extraction & Session Verification

We have successfully resolved the cookie extraction block and fully validated session authentication for all target platforms.

### 🛠️ Cookie Parser & Domain Duplication
1. **Netscape Cookie Parser (`parse_netscape_cookies.js`)**:
   - Created a JavaScript utility to convert Netscape-formatted cookie files (exported via Chrome extensions) into standard Puppeteer JSON files.
   - Saves cookies for Facebook, Instagram, Threads, and LinkedIn to the workspace `config/` directory.
2. **Threads Domain Duplication**:
   - Duplicated Threads session cookies for both `.threads.net` and `.threads.com` domains. This handles cases where geographic regions redirect Threads traffic, ensuring cookies are sent under either domain.
3. **Robust Threads UI Selectors**:
   - Enhanced `publish_headless.js` to click the new `"New thread"` sidebar button or `"What's new?"` feed box as fallbacks to support the latest Threads web layout.

### 🔬 Authentication Diagnostic Results
We ran connection diagnostics on each platform using `test_headless_connection.js` with the newly installed cookies:
- **Facebook**: `[+] SUCCESS: Authenticated successfully on facebook!`
- **Instagram**: `[+] SUCCESS: Authenticated successfully on instagram!`
- **Threads**: `[+] SUCCESS: Authenticated successfully on threads!`
- **Verification Screenshots**: Saved diagnostic screenshots under `logs/screenshots/` to confirm that the feeds load correctly and the login walls are successfully bypassed.

---

## 🛠️ Part 5: Resolving the Headless Publish Fetch Error & Console Logs

We have diagnosed and resolved the fetch error and log output issues when triggering the Direct Headless Publish button.

### 🔍 Identified Root Causes
1. **Server Offline / Port Inactive**: The Node Express server on port `3003` was initially inactive, resulting in the `Failed to fetch` connection error.
2. **Orphaned Chromium Instances**: Multiple background Chromium processes remained active from previous runs, locking user profiles.
3. **Multiline Shell Parsing Hang (Windows)**: Triggering `publish_headless.js` via `child_process.exec()` with a string-interpolated command line failed on Windows when parsing multiline status copies (which contain newlines, quotes, and markdown symbols).
4. **Console Logs Missing**: The Express API `/api/publish-post` was parsing the final JSON stdout line from Puppeteer but discarding the rest of the stdout lines, which caused the frontend logs window to display a generic `"Execution successful."` message instead of the step-by-step progress.

### 🛠️ Core Fixes Applied
1. **Migration to `execFile`**: Updated the `/api/publish-post` endpoint, the background scheduler checker, and the OS notification builder in [server.js](file:///C:/Users/dahao/.gemini/antigravity/scratch/aiwx-smb-auditor/server.js) to execute subprocesses via `child_process.execFile()`. Arguments are now passed safely as an array, preventing any command parsing issues or shell hangs on Windows.
2. **Process Cleanup**: Terminated all orphaned Puppeteer Chromium processes running on the system to clean up the browser profile locks.
3. **Logs Preservation**: Modified the API parser block in [server.js](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-smb-auditor/server.js) to preserve the full process `stdout` under the `log` field on success, ensuring the UI console has access to all step-by-step logs.
4. **Service Launch**: Launched the Express server successfully in the background on port `3003`.

---

## 📅 Part 6: Operations Administrator Posts Archiving & Reverted Schedule

Per your request, we have removed all the **Operations Administrator** campaign posts (Weeks 4–6 / Posts 10–18) from the active campaign schedule and archived them back to the content library backlog for future scheduling, since they are still undergoing testing.

### 🛠️ Key Modifications Completed:
1. **Reorganized Content Library**:
   - Updated **[social_media_posts_library.md](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/social_media_posts_library.md)** to move Posts 10–18 out of the active parsing list and into a dedicated backlog section: `## 📦 Future Operations Administrator Campaign (Under Testing - Do Not Schedule)`.
2. **Reverted Calendar & Briefs**:
   - Reverted **[social_media_hub.html](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/social_media_hub.html)**'s `defaultPosts` array back to the active **9-post services campaign** (Weeks 1–3: June 15 - July 3, 2026).
   - Removed Weeks 4–6 from **[aiwx_social_media_posting_plan.md](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/aiwx_social_media_posting_plan.md)** and **[social_media_campaign_brief.md](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/social_media_campaign_brief.md)**.
   - Refactored **[lovable_social_media_hub_prompt.md](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/lovable_social_media_hub_prompt.md)** to instruct Lovable to synchronise the 9 active campaign posts in the React frontend.
3. **Asset Compilation**:
   - Executed `generate_assets.py` to regenerate the official campaign PDFs. The compiler successfully parsed only the **9 active posts** for Weeks 1–3.
   - Saved the newly generated PDFs directly to your conversation's scratch directory:
     - **[social_media_posts_review.pdf](file:///C:/Users/dahao/.gemini/antigravity-ide/brain/2e9d0ea8-0cc1-41b6-b87a-4dff6e0f8f04/scratch/social_media_posts_review.pdf)**
     - **[editorial_calendar.pdf](file:///C:/Users/dahao/.gemini/antigravity-ide/brain/2e9d0ea8-0cc1-41b6-b87a-4dff6e0f8f04/scratch/editorial_calendar.pdf)**
4. **Server & Public Folder Sync**:
   - Synced all updated HTML, Markdown, and PDF assets back to the live Express server directory (`aiwx-smb-auditor/public/`).

---

## 📅 Part 7: Re-aligning Post 5 (Pure Service & Audit Focus)

To keep the GTM campaign strictly focused on **Services & Audits** (and avoid mentioning specific product implementations), we swapped out the previous Post 5 ("The 90-Day Upskilling Roadmap") and archived it.

### 🛠️ Key Modifications Completed:
1. **New Post 5 Integration**:
   - Created purely service-focused copies for Post 5: **"Stop Automating Bad Workflows: Six Sigma Scoping"**.
   - Updated the content in **[social_media_posts_library.md](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/social_media_posts_library.md)**, **[social_media_hub.html](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/social_media_hub.html)**, **[aiwx_social_media_posting_plan.md](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/aiwx_social_media_posting_plan.md)**, and **[social_media_campaign_brief.md](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/social_media_campaign_brief.md)**.
2. **Archived Previous Version**:
   - Relabeled the old version as `Post J: [Archived Operations Administrator Campaign]` and filed it away in the backlog/archived section of the library.
3. **Mockup Generation**:
   - Generated a fresh mockup representing the Slide 1 of the new Post 5 and saved it to the scratch folder at:
     - **[instagram_slide_post5_scoping_1781630136452.png](file:///C:/Users/dahao/.gemini/antigravity-ide/brain/2e9d0ea8-0cc1-41b6-b87a-4dff6e0f8f04/scratch/instagram_slide_post5_scoping_1781630136452.png)**
4. **PDF compilation & sync**:
   - Re-compiled campaign assets via `generate_assets.py` to update the posts review PDF and calendar.
   - Pushed all fresh assets to the server's public folder.

---

## 🎨 Part 8: Purging Agent Smithy Branding & Realigning Product Videos Showcase

Per your instructions, we have completely scrubbed the Agent Smithy avatar (`agent_smithy.png`) and text references from the showcase files and backup layouts, replacing them with generic, brand-neutral setups.

### 🛠️ Key Modifications Completed:
1. **Product Video Showcase Purged**:
   - **[product-videos/index.html](file:///c:/Users/dahao/.gemini/antigravity/scratch/product-videos/index.html)**: Replaced `assets/agent_smithy.png` in the voice/chat dock with a styled FontAwesome microphone icon (`fa-microphone-lines`). Updated headings and speech bubble greetings to refer to the **AI Operations Guide** instead of Agent Smithy.
   - **[product-videos/app.js](file:///c:/Users/dahao/.gemini/antigravity/scratch/product-videos/app.js)**: Realigned the SpeechSynthesis voice dropdown labels from "Agent Smithy Standard/Natural/Professional/Premium" to "AI Guide Standard/Natural/Professional/Premium". Updated browser notification alerts and Q&A chat trigger answers to refer to the **AI Operations Guide** and use generic settings menus instead of referencing avatars.
2. **Scrubbed Backup Layout Files**:
   - **[backup_new_ui/operations_hub.html](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-admin-agent/backup_new_ui/operations_hub.html)** & **[backup_new_ui/index.html](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-admin-agent/backup_new_ui/index.html)**: Replaced the onboarding card coach avatar image (`agent_smithy.png`) with a brand-neutral "Setup Assistant" card utilizing a system gauge icon (`fa-gauge-high`). Scrubbed default JS speech parameters from "I am Agent Smithy" to generic instructions.
   - **[backup_new_ui/app.js](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-admin-agent/backup_new_ui/app.js)**: Scrubbed the brand logo image `agent_smithy.png` and replaced it with a network-wired icon (`fa-network-wired`) matching the active dashboard branding.
3. **Landing Page Syntax Verification**:
   - Fixed syntax errors on [solopreneur_landing.html](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-admin-agent/solopreneur_landing.html), [smb_landing.html](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-admin-agent/smb_landing.html), and [reseller_landing.html](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-admin-agent/reseller_landing.html) caused by partial removal of the `triggerSmithy` function in previous edits. Deleted the unused script sections entirely.
4. **Aligned Campaign Schedule JSON**:
   - Updated [campaign_schedule.json](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/config/campaign_schedule.json) to change all destination URLs to `/services` and updated Post 8's copywriting to use the capacity-focused audit details instead of product pricing.

