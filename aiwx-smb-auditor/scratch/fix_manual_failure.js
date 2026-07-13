const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../public/social_media_hub.html');
let html = fs.readFileSync(filePath, 'utf8');

// We find the failure block
const targetStr = `        } else {

          logsBox.innerText += \`\\n[-] FAILURE: \${data.error || 'Unknown error occurred.'}\\n[-] Logs:\\n\${data.log || ''}\`;

          if (data.screenshot) {

            screenshotImg.src = getApiUrl(data.screenshot);

            screenshotContainer.style.display = 'block';

          }

        }`;

// Let's see if we can find a simpler match using regex:
const regex = /\} else \{\s+logsBox\.innerText \+= `\\n\[-\] FAILURE: \$\{data\.error \|\| 'Unknown error occurred\.'\}\\n\[-\] Logs:\\n\$\{data\.log \|\| ''\}`;\s+if \(data\.screenshot\) \{\s+screenshotImg\.src = getApiUrl\(data\.screenshot\);\s+screenshotContainer\.style\.display = 'block';\s+\}\s+\}/;

const replacement = `} else {
          logsBox.innerText += \`\\n[-] FAILURE: \${data.error || 'Unknown error occurred.'}\\n[-] Logs:\\n\${data.log || ''}\`;
          if (data.screenshot) {
            screenshotImg.src = getApiUrl(data.screenshot);
            screenshotContainer.style.display = 'block';
          }
          
          // Manually update status to FAILED in scheduler queue
          try {
            await fetch(getApiUrl('/api/update-post-status'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: post.id, status: 'FAILED' })
            });
            const localPosts = getHubPosts();
            const localPost = localPosts.find(p => p.id === post.id);
            if (localPost) {
              localPost.status = 'FAILED';
              saveHubPosts(localPosts);
              renderCalendar();
              loadPostPreview();
            }
          } catch (statusErr) {
            console.error('[Scheduler] Failed to sync manual publish failure to server:', statusErr);
          }
        }`;

// Let's do a simple replace using a more flexible pattern
const targetRegex = /\} else \{\s+logsBox\.innerText\s*\+=\s*`\\n\[-\]\s*FAILURE:[^`]+`[^}]+W?\}\s*\}/;

const beforeLength = html.length;
html = html.replace(targetRegex, replacement);

if (html.length !== beforeLength) {
  fs.writeFileSync(filePath, html, 'utf8');
  console.log('✓ Successfully injected failure state sync in social_media_hub.html');
} else {
  // Try exact string replacement by stripping double newlines
  const searchStr = `} else {

          logsBox.innerText += \`\\n[-] FAILURE: \${data.error || 'Unknown error occurred.'}\\n[-] Logs:\\n\${data.log || ''}\`;

          if (data.screenshot) {

            screenshotImg.src = getApiUrl(data.screenshot);

            screenshotContainer.style.display = 'block';

          }

        }`;
  html = html.replace(searchStr, replacement);
  if (html.indexOf('Failed to sync manual publish failure') !== -1) {
    fs.writeFileSync(filePath, html, 'utf8');
    console.log('✓ Successfully injected via exact match');
  } else {
    console.error('Failed to replace failure block.');
  }
}
