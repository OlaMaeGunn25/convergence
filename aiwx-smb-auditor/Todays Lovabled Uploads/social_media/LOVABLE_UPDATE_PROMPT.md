# 🚀 Lovable.ai Update Package & Prompt (July 9, 2026)

All the necessary files for this update have been compiled in your local sync folder:
📁 **Sync Folder:** `c:\Users\dahao\.gemini\antigravity\scratch\aiwx-social-media-agent\lovable_upload\2026-07-09\`

### 📂 Files to Upload to Lovable:
*   `social_media_hub.html` (Visual calendar & alerts page)
*   `deployment_hub.html` (Deployment console page)
*   `js/alerts_ui.js` (Social activity scanner logic - simulation turned off)
*   `posts_data.json` (Rescheduled posts database)
*   `server.js` (Express backend serving pages, scheduler, and API routes)
*   `.env` (Environment variables configuration)
*   All campaign image files (`.png`) in the root of the folder.

***

### 💬 Copy-Paste this Prompt into Lovable:

```text
Please consume the attached "social_media_hub.html", "deployment_hub.html", "js/alerts_ui.js", "posts_data.json", and "server.js" files to update our Social Media Multiposting Hub application:

1. POST PREVIEW CARD CONTRAST REDESIGN:
   - Modify the CSS rule for ".preview-box" in both social_media_hub.html and deployment_hub.html:
     - Set the background to a solid white: "background: #ffffff;"
     - Set the text color to the primary dark color: "color: var(--text-primary);"
     - Add a subtle inner shadow for depth: "box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.06);"
     - This ensures that the dark navy post preview text is perfectly legible on a clean white card background.

2. UNREADABLE ERROR ALERTS RESTYLER:
   - Add the following dynamic MutationObserver script right before the closing "</script>" tag in both social_media_hub.html and deployment_hub.html. This script intercepts any injected DOM alerts containing "UI Exception" or "display error" (including dev-preview overlays) and restyles them with light backgrounds and high-contrast text:
     ```javascript
     (function() {
       const restyleElement = (el) => {
         if (!el || !el.textContent) return;
         const text = el.textContent.toLowerCase();
         if (text.includes('ui exception') || text.includes('display error')) {
           el.style.backgroundColor = '#ffffff';
           el.style.color = '#0f172a';
           el.style.border = '2px solid #ef4444';
           el.style.borderRadius = '12px';
           el.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.15)';
           el.style.padding = '1.5rem';
           
           const allTextElements = el.querySelectorAll('*');
           allTextElements.forEach(child => {
             if (child.textContent.toLowerCase().includes('exception')) {
               child.style.color = '#ef4444';
               child.style.fontWeight = 'bold';
             } else {
               child.style.color = '#334155';
             }
           });
         }
       };

       const observer = new MutationObserver((mutations) => {
         mutations.forEach(mutation => {
           mutation.addedNodes.forEach(node => {
             if (node.nodeType === Node.ELEMENT_NODE) {
               restyleElement(node);
               node.querySelectorAll('*').forEach(restyleElement);
             }
           });
         });
       });

       observer.observe(document.body, { childList: true, subtree: true });
       
       document.addEventListener('DOMContentLoaded', () => {
         document.querySelectorAll('*').forEach(restyleElement);
       });
     })();
     ```

3. SIMULATED COMMENTS OFF:
   - In server.js, ensure the server-side background simulation loop has an early return ("return; // Permanently disabled simulated alerts loop") at the start of the setInterval block.
   - In js/alerts_ui.js, ensure the client-side background offline fallback simulation has its trigger set to false:
     "if (false) { // Permanently disabled offline simulation"
     This permanently stops mock/simulated comments from appearing in the Activity Scanner inbox feed on both server and client levels.

4. BRAND SPELLING & SIGNATURE RULES:
   - Ensure the brand name is strictly spelled "AiWorXmiths" or "AiWorXmiths.com" (exact letter cases: capital A, W, X, lowercase i, o, r, m, i, t, h, s).
   - Ensure all post platforms copies have the following contact signature appended:
     "📞 Phone: 973-718-5161 | ✉️ Email: info@aiworxmiths.com | 🌐 Website: AiWorXmiths.com"
   - Do NOT reference "Convergence-Ai" or "CONVERGENCE-Ai" anywhere in the post content.

5. DATE TIMELINE & ACTIVE POST CALENDAR:
   - Set the active campaign posts timeline to launch on July 9, 2026, starting with "post_04" (The Invoicing Leak: Streamlining Client Ledgers).
   - Position past posts ("post_01", "post_02", "post_03") to the end of the calendar (August 13, 14, 18) to prevent altering content of future dates.
```
