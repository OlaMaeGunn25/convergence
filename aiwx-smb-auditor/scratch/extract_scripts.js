const fs = require('fs');
const path = require('path');

const hubPath = path.resolve(__dirname, '../public/social_media_hub.html');
let html = fs.readFileSync(hubPath, 'utf8');

function extractFunction(name) {
  const marker = `function ${name}`;
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) {
    console.warn(`Function not found: ${name}`);
    return '';
  }
  
  const braceStart = html.indexOf('{', startIdx);
  if (braceStart === -1) return '';
  
  let braceCount = 1;
  let idx = braceStart + 1;
  while (braceCount > 0 && idx < html.length) {
    const char = html[idx];
    if (char === '{') braceCount++;
    else if (char === '}') braceCount--;
    idx++;
  }
  
  const funcBody = html.substring(startIdx, idx);
  // Remove function from html
  html = html.substring(0, startIdx) + html.substring(idx);
  return funcBody;
}

const calendarFuncs = [
  'setCalendarMonth',
  'renderCalendar',
  'selectPost',
  'switchPlatform',
  'loadPostPreview',
  'loadPostPreviewText',
  'approvePost',
  'postponePost',
  'deletePost',
  'renderComments',
  'addComment'
];

const alertsFuncs = [
  'loadActivityAlerts',
  'renderAlertsInbox',
  'selectCommentAlert',
  'regenerateAIDraft',
  'submitHITLReply',
  'dismissAlert',
  'updateScanFrequency',
  'playAlertSound',
  'showToastAlert'
];

const trafficFuncs = [
  'toggleSimulatedTrafficAgent',
  'loadSimulatedAnalytics',
  'renderSimulatedCharts'
];

console.log('Extracting calendar functions...');
let calendarContent = '// calendar_ui.js - Extracted scheduling and calendar display logic\n\n';
for (const f of calendarFuncs) {
  const code = extractFunction(f);
  if (code) calendarContent += code + '\n\n';
}

console.log('Extracting alerts functions...');
let alertsContent = '// alerts_ui.js - Extracted inbox notification alerts logic\n\n';
for (const f of alertsFuncs) {
  const code = extractFunction(f);
  if (code) alertsContent += code + '\n\n';
}

console.log('Extracting traffic agent functions...');
let trafficContent = '// traffic_agent.js - Extracted simulated audience agent & engagement charts logic\n\n';
for (const f of trafficFuncs) {
  const code = extractFunction(f);
  if (code) trafficContent += code + '\n\n';
}

// Write the files
const jsDir = path.resolve(__dirname, '../public/js');
if (!fs.existsSync(jsDir)) {
  fs.mkdirSync(jsDir, { recursive: true });
}

fs.writeFileSync(path.join(jsDir, 'calendar_ui.js'), calendarContent, 'utf8');
fs.writeFileSync(path.join(jsDir, 'alerts_ui.js'), alertsContent, 'utf8');
fs.writeFileSync(path.join(jsDir, 'traffic_agent.js'), trafficContent, 'utf8');

console.log('Successfully wrote external JS scripts.');

// Now insert <script> loaders in social_media_hub.html
// Let's insert them right before the main <script> tag which was on line 3627 (or after outreach_ui.js)
const outreachMarker = '<script src="/outreach_ui.js"></script>';
const markerIdx = html.indexOf(outreachMarker);
if (markerIdx !== -1) {
  const insertion = `${outreachMarker}\n  <script src="/js/calendar_ui.js" defer></script>\n  <script src="/js/alerts_ui.js" defer></script>\n  <script src="/js/traffic_agent.js" defer></script>`;
  html = html.replace(outreachMarker, insertion);
}

fs.writeFileSync(hubPath, html, 'utf8');
console.log('Successfully updated social_media_hub.html and saved.');
