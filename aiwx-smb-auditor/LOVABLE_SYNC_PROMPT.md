# Lovable.ai Engineering Sync Prompt (Full Functional Integration)

Copy and paste the text block below directly into your **Lovable.ai chat prompt**. This instruction set is formatted specifically to prevent Lovable from just modifying the UI and instead forces it to implement the underlying React controllers, clipboard fallbacks, simulated timeline log arrays, and routing parameters.

***

```text
Please completely replace or refactor our React+Vite+TypeScript SMB Auditor page (routed at `/admin/smb-auditor`) using the following instructions. 

CRITICAL REQUIREMENT: Do NOT just update the CSS styling or HTML markup. You MUST fully implement all state hook variables, lifecycle hooks, try-catch API fallbacks, clipboard copy algorithms, and data structures. Verify that the page executes the entire audit pipeline when the button is clicked.

1. COMPONENT STATE HOOKS & DOM lifecycle
Implement the following React states to govern the lifecycle of the audit:
- 'domainInput' (string): Binds to the value of the target URL input field. Do NOT query or modify the DOM input element value directly via DOM selectors.
- 'isLoading' (boolean): Tracks whether the audit pipeline is executing.
- 'logLines' (string[]): Holds the array of lines printed by the terminal logs console.
- 'activeAudit' (AuditData | null): Caches the active audit package.
- 'activeTab' (string): Manages the active panel ('overview', 'security', 'workforce', 'sales').
- 'ledger' (AuditData[]): Caches historical audit records loaded from/written to LocalStorage ('aiwx_audit_ledger').
- 'searchQuery' (string): Filters the client ledger sidebar list.

2. DOM LIFECYCLE INVOCATION & URL PARAMETERS
- Implement a 'useEffect' hook on component mount to load records from LocalStorage ('aiwx_audit_ledger') into the 'ledger' state.
- Implement a 'useEffect' hook on component mount to parse the query parameters of the current window URL (using `useSearchParams` or `window.location.search`). If a '?domain=xxx' parameter is detected, set the 'domainInput' state to this value and immediately trigger the audit pipeline execution.

3. DYNAMIC TERMINAL LOG TIMELINE ANIMATION
When the audit is deployed (via Form Submit or URL parameter):
- Immediately disable the input and button. Show a spinning indicator inside the button and change the text to "Deploying Node...".
- Show the loading log panel.
- Clear the 'logLines' array, then programmatically append the logs one-by-one at a 400ms interval using a 'setInterval' timer:
  1. "[NODE-INIT] Handshaking target: {domain}..."
  2. "[DNS] Fetching system NS, MX, TXT mappings..."
  3. "[DNS] Found Registrar nameservers. Security check initialized."
  4. "[SYSTEM] Active API handshake established."
  5. "[CRAWLER] Scraped homepage resources (Size: 52KB)"
  6. "[SCOURER] Commencing recursive corporate intelligence scour..."
  7. "[SCOURER] Searching active state registries (Delaware, CA, NY Secretary of State databases)..."
  8. "[SCOURER] Searching Federal CIK registrations & SEC database filings..."
  9. "[CRAWLER] Scoped financial parameters & annual revenue estimates..."
  10. "[FIREWALL] Analysing server edge proxy & reverse redirection headers..."
  11. "[ANALYZER] SWOT vulnerabilities compiled. Outlining threat postures."
  12. "[WORKFORCE] Inferring workforce job structures and AI upskilling paths..."
  13. "[SYSTEM] Compilation finished. Ready to mount dashboard."
  14. "[SYSTEM] Audit package successfully resolved. Injecting Ledger."
- Automatically scroll the log terminal container to the bottom whenever a new log line is appended using a ref ('terminalEndRef.current.scrollIntoView').
- Add the 'animate-pulse' and a pulsing neon border effect on the log terminal during loading. In your Tailwind configuration, include a 'log-pulse' animation:
  @keyframes log-pulse {
    0%, 100% { border-color: rgba(99, 102, 241, 0.3); box-shadow: 0 0 10px rgba(99, 102, 241, 0.1); }
    50% { border-color: rgba(99, 102, 241, 0.8); box-shadow: 0 0 20px rgba(99, 102, 241, 0.3); }
  }

4. API TRY-CATCH REQUEST WITH SIMULATION FALLBACK
- Within the async audit execution function, fetch the POST request to '/api/audit' containing the body '{ domain }'.
- Wrap the fetch call in a strict Try/Catch block. If the fetch throws a network error, CORS error, OR returns a non-OK status (like a 404 Not Found page because Lovable hosts the site statically without the Express server), catch the error, log a warning, and gracefully switch to a client-side mock simulation:
  `auditData = runClientSideAuditSimulation(domain);`
- Once the simulation resolves or the API returns successfully, store the result in the 'activeAudit' state, add it to the top of the 'ledger' array, save it back to LocalStorage, hide the loading panel, and show the results dashboard.

5. ROBUST COPY-TO-CLIPBOARD FUNCTION WITH TEXTAREA FALLBACK
- Implement a helper function `copyTextToClipboard(text: string): Promise<boolean>`.
- The helper must first attempt `navigator.clipboard.writeText(text)`.
- If the async clipboard API fails or throws a security permission block, catch it and fallback to creating an offscreen `<textarea>` DOM element:
  ```javascript
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
  ```
- Use this helper for both:
  - Copying the general report summary for ASES (using the 'Copy Summary for ASES' button).
  - Copying individual sales outreach scripts (using the 'Copy Script' button on each proposal card).
- When a copy succeeds, update the button UI to show "Copied!" for 1.5 seconds before returning to the default label.

6. BROWSER-SIDE MOCK SIMULATOR LOGIC
Implement the function `runClientSideAuditSimulation(domain)` to return a mock `AuditData` object with vertical-accurate parameters:
- Clean the domain (strip http/https/www/trailing paths).
- Dynamically detect vertical by matching domain keywords:
  - Food keywords (bread, restaurant, catering, kitchen, cafe) -> "E-Commerce & Retail"
  - Tech keywords (consulting, tech, software, saas, app, dev) -> "Technology & SaaS"
  - Health keywords (dental, clinic, care, health, med) -> "Healthcare & Wellness"
  - Otherwise -> "Professional Services"
- Set mock states:
  - Filings: state (LLC status, filing ID, Washington SOS SOS) and federal (Active SAM.gov registration with CAGE Code 9ZG28, CIK id).
  - News: list containing 2 positive/neutral news mentions referencing the business name.
  - Tech Stack: array containing Wordpress, Google Analytics 4, Cloudflare, and QuickBooks.
  - Scores: overall security score (50-74), tech modernization (60-79), security posture (same as overall), and AI upskilling readiness (65).
  - Workforce: array containing staff upskilled roles (e.g. support representative -> "AI Helpdesk Trainer & Live Escalator", Practice Administrator -> "AI Billing Director").
  - Proposals: array containing sales gap pitches with observed gap, AI service name, pricing (e.g. $3,500 Setup, $199/mo managed), and the copy-pasteable consultant outreach text.
```
