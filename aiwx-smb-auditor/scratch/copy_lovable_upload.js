const fs = require('fs');
const path = require('path');

const todayStr = '2026-07-07';
const uploadDir = path.resolve(__dirname, `../lovable-${todayStr}/lovable_upload`);

// Make directory
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Files to copy
const filesToCopy = [
  { src: 'public/analytics_tracker.js', dest: 'analytics_tracker.js' },
  { src: 'public/js/calendar_ui.js', dest: 'calendar_ui.js' },
  { src: 'public/js/alerts_ui.js', dest: 'alerts_ui.js' },
  { src: 'public/js/traffic_agent.js', dest: 'traffic_agent.js' },
  { src: 'public/social_media_hub.html', dest: 'social_media_hub.html' },
  { src: 'public/index.html', dest: 'index.html' },
  { src: 'public/product.html', dest: 'product.html' }
];

console.log(`Copying files to Lovable upload folder: ${uploadDir}`);

filesToCopy.forEach(f => {
  const srcPath = path.resolve(__dirname, '..', f.src);
  const destPath = path.join(uploadDir, f.dest);
  
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`✓ Copied: ${f.src} -> ${f.dest}`);
  } else {
    console.warn(`⚠ Missing file: ${f.src}`);
  }
});

// Also save the sync prompt in the same folder for convenience!
const promptContent = `# Lovable.ai A+ Sync Prompt (July 7, 2026)

Copy and paste the text block below directly into your Lovable.ai prompt window:

\`\`\`text
Please refactor and synchronize our React + Vite + TypeScript application to align with the latest system-wide upgrades and modular files I have uploaded:

1. OFFLINE-RESILIENT ANALYTICS BATCHING
- Purge direct single-event fetch log calls. Implement a local event queue array inside our client-side tracker/hook.
- Implement logEventToServer(type, label, value) to push events to this queue and trigger a batch flush timer.
- Flush queue events every 2 seconds by sending a single POST request to getApiUrl('/api/track-events-batch') containing { events: batch }.
- If the batch request fails due to network dropouts or backend offline, implement an exponential backoff retry loop (retry up to 3 times, waiting 2s, 4s, and 8s). Re-queue failed events on consecutive timeouts.
- Listen for window 'beforeunload' and trigger a navigator.sendBeacon(getApiUrl('/api/track-events-batch')) call to flush any remaining queued clicks/conversions before the tab closes.

2. GLOBAL CLIENT-SIDE ERROR BOUNDARIES
- Mount window error listeners on component mount to catch all uncaught JavaScript errors (window.onerror) and unhandled promise rejections (unhandledrejection).
- Display a sleek toast notification ("A background operation failed. Please check your connection.") instead of failing silently.

3. ACCESSIBILITY (ARIA) & PERFORMANCE (LCP)
- Add role="dialog", aria-modal="true", and aria-labelledby properties on the outreach and custom dialog modals.
- Include explicit aria-label attributes on all close action controls (e.g. close buttons) and platform trigger actions.
- Add loading="lazy" on the scheduled image previews and Puppeteer screenshot displays to ensure they do not delay page loading metrics.

4. SEO & SOCIAL SHARE TAGS (META/OPEN GRAPH)
- Inject meta description tags, Open Graph tags (og:title, og:description, og:image, og:url), and canonical links to our route heads (/, /product, and /social_media_hub).

5. CODE DECOMPOSITION
- Decompose the Social Media Hub React component into separate, modular components/hooks mimicking the uploaded files:
  * CalendarUI component: Handles visual grid timelines, approvals, and postponements.
  * AlertsUI component: Handles incoming DMs, auto-reply drafting, and alert logs.
  * TrafficAgent component: Handles simulated charts and metrics loops.
\`\`\`
`;

fs.writeFileSync(path.join(uploadDir, 'LOVABLE_SYNC_PROMPT.md'), promptContent, 'utf8');
console.log('✓ Created LOVABLE_SYNC_PROMPT.md inside the upload folder.');
console.log('Done!');
