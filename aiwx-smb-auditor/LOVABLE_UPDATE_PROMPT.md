# Lovable.ai Sync Prompt for SMB Auditor (Clean Load, Font Upgrade, & Loading Parity)

Copy-paste the prompt below into **Lovable.ai** and upload the updated `smb-auditor.html` file from this workspace directory to sync the changes:

***

```text
Please consume the attached "smb-auditor.html" file to update our React+Vite+TypeScript Auditor application. Apply the layout, styling, and JS controller parity, focusing on the following font upgrades, loading visual indications, and backend integration updates:

1. FONT UPGRADE (REMOVE GROTESK & USE GOOGLE PLAY):
   - Completely remove any default Grotesk fonts (e.g. Bricolage Grotesque, Space Grotesk) from headings, variables, and body styles.
   - Import and use the Google Font "Play" (https://fonts.googleapis.com/css2?family=Play:wght@400;700&display=swap).
   - Set the sans-serif and display custom variables to use 'Play' as the primary font family:
     * --font-sans: 'Play', 'Inter', sans-serif;
     * --font-display: 'Play', 'Outfit', sans-serif;
   - Ensure headings, dashboard numbers, and body text render in the premium, clean 'Play' typography.

2. SEARCH LOADING INDICATION (BUTTON LIFE-CYCLE & PROGRESS):
   - When the user clicks the submit button (e.g. "#admin-trigger-audit" or "#trigger-audit"):
     * Immediately disable the button.
     * Render an inline spinning loader and change the text inside the button to show progress (e.g., `<span class="inline-spinner"></span> Deploying Node...` or `Analyzing...`).
     * Ensure the loading panel section (the log terminal and larger spinner) becomes visible immediately.
   - When the audit finishes successfully or fails, restore the button to its active state with the original HTML contents/labels.
   - Add the following CSS helper class for the inline button spinner:
     .inline-spinner {
       display: inline-block;
       width: 14px;
       height: 14px;
       border: 2px solid rgba(255, 255, 255, 0.3);
       border-radius: 50%;
       border-top-color: #fff;
       animation: spin 1s infinite linear;
       margin-right: 8px;
       vertical-align: middle;
     }

3. REMOVE FIRECRAWL KEY INPUTS & LOG MESSAGES FROM FRONTEND:
   - Completely remove the Firecrawl API Key input field (#admin-firecrawl-key and #firecrawl-key) and its related helper labels/placeholders from both the Consultants Audit Command Center and the Consumer Portal pages.
   - The Firecrawl API Key is now handled securely on the backend server environment (via environment variables) and must never be requested, referenced, or displayed via the frontend.
   - Remove any references to "Firecrawl key absent" or "Firecrawl key not detected" in the console logging simulation. Instead, log neutral messages:
     * When crawling is simulated: "[SYSTEM] Initiating analysis and database scouring module..." or "[SYSTEM] Launching Smart Ingestion Simulator."
     * When crawling is live: "[SYSTEM] Secure crawler routing established." or "[SYSTEM] Active API handshake established."
   - Change result badge text from "Live Firecrawl" to "Live Audit" (and keep "Simulated Scan" or "Simulated Audit" for simulation modes).

4. FIX REACT STATE BINDING FOR TARGET DOMAIN & URL PARAMS:
   - Make sure the target URL input field value is correctly bound to a React component state variable (e.g. `domain`).
   - Do NOT access or modify the input value directly via DOM selectors (like `document.getElementById('admin-target-domain').value = ...`) as this bypasses React's virtual DOM state and causes searches to submit empty strings or fail.
   - If query parameter `domain` is provided in the URL query string (`window.location.search` or using `useSearchParams`), parse it on load and synchronize it into the React state.
   - If a query parameter is present, automatically trigger the audit execution immediately after synchronizing the state.

5. RESTRICT CLIENT-SIDE SIMULATION TO STATIC PREVIEWS ONLY (NO FALLBACK ON BACKEND ERRORS):
   - The React search submission must wrap the fetch call to `/api/audit` in a try-catch block.
   - Client-side simulation (`runClientSideAuditSimulation(domain)`) must ONLY be triggered if the request fails with a `404 Not Found` (which occurs when hosted statically on Lovable's preview subdomain without a running backend).
   - If the request connects to a backend but returns a `500` error, a non-OK status (other than 404), or a JSON response indicating failure (`success: false`), the application must strictly display the error message and MUST NOT render simulated data.
   - This ensures simulated data does not run when connecting the auditor to your actual backend server.

6. CLEAN LOAD DEFAULT STATE:
   - The search input must start completely blank/empty by default on initial page load (unless query params are present). Do not prepopulate with default domains in the React state.
   - The results dashboard must be hidden on initial load and only become visible after an audit resolves successfully.
```

***

## What Changed in the Files

1. **Font Upgraded to Play:**
   - [public/css/styles.css](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-smb-auditor/public/css/styles.css) was updated to import the `Play` font from Google Fonts and set it as the primary sans and display font variable. Added `.inline-spinner` styles.

2. **Loading Indication Added to Button Click:**
   - Modified `deployAuditPipeline` in [public/admin/admin.js](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-smb-auditor/public/admin/admin.js) and root [smb-auditor.html](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-smb-auditor/smb-auditor.html) to render a spinner inside the "Deploy Audit Node" button and disable it during scanning.
   - Modified `executeAudit` in [public/app.js](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-smb-auditor/public/app.js) to render a spinner inside the "Analyze Footprint" button and disable it during scanning.

3. **Firecrawl Input Group & Messages Removed:**
   - Removed key input HTML blocks, script references, and logs containing `"Firecrawl key absent"` or `"not detected"`.
   - Updated documentation guides in [public/admin/guide.html](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-smb-auditor/public/admin/guide.html) to reflect the backend-only key ingestion.
