const fs = require('fs');
const path = require('path');
const https = require('https');

const credsPath = path.join(__dirname, 'config', 'meta_credentials.json');
if (!fs.existsSync(credsPath)) {
  console.error("[-] Credentials file not found.");
  process.exit(1);
}

const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));

function makeRequest(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: headers
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}. Data: ${data}`));
        }
      });
    }).on('on', reject).on('error', reject);
  });
}

async function runDiagnostics() {
  console.log("================================================================");
  console.log("📊 AIWX SOCIAL MEDIA AGENT: META & THREADS API DIAGNOSTICS");
  console.log("================================================================\n");

  let facebookSuccess = false;
  let instagramSuccess = false;
  let threadsSuccess = false;

  // ----------------------------------------------------
  // 1. FACEBOOK GRAPH API & USER ACCESS TOKEN DIAGNOSTICS
  // ----------------------------------------------------
  console.log("[1/3] Checking Facebook & Meta App Connection...");
  const userToken = creds.userAccessToken;
  
  if (!userToken) {
    console.error("  [-] Facebook User Access Token is missing!");
  } else {
    try {
      const debugUrl = `https://graph.facebook.com/debug_token?input_token=${userToken}&access_token=${userToken}`;
      const debugData = await makeRequest(debugUrl);
      
      if (debugData.error) {
        console.error("  [-] Token verification failed:", debugData.error.message);
      } else {
        const info = debugData.data;
        console.log("  [+] Token is VALID!");
        console.log(`    - Application: ${info.application} (App ID: ${info.app_id})`);
        console.log(`    - Scopes: ${info.scopes.join(', ')}`);
        
        // Check if required scopes exist
        const required = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'publish_to_groups'];
        const missing = required.filter(s => !info.scopes.includes(s));
        if (missing.length > 0) {
          console.warn(`    - ⚠️ Note: Missing some potential scopes: ${missing.join(', ')}`);
        }
      }

      // Check specific Page ID if provided
      if (creds.pageId) {
        console.log(`  [+] Querying Facebook Page ID: ${creds.pageId}...`);
        // We query Page endpoint using the user token (or page token)
        const pageUrl = `https://graph.facebook.com/v19.0/${creds.pageId}?fields=name,category,username,access_token&access_token=${userToken}`;
        const pageData = await makeRequest(pageUrl);
        
        if (pageData.error) {
          console.error("    [-] Page Access Check Failed:", pageData.error.message);
        } else {
          console.log(`    [+] SUCCESS! Page access verified.`);
          console.log(`      * Page Name: ${pageData.name}`);
          console.log(`      * Username: ${pageData.username || 'N/A'}`);
          console.log(`      * Category: ${pageData.category}`);
          facebookSuccess = true;
        }
      } else {
        console.log("  [-] No pageId configured in credentials.json.");
      }
    } catch (e) {
      console.error("  [-] Error checking Facebook Graph API:", e.message);
    }
  }

  // ----------------------------------------------------
  // 2. INSTAGRAM GRAPH API DIAGNOSTICS
  // ----------------------------------------------------
  console.log("\n[2/3] Checking Instagram Business API Connection...");
  const igAccountId = creds.instagramAccountId;
  
  if (!igAccountId) {
    console.error("  [-] Instagram Account ID is missing!");
  } else {
    try {
      console.log(`  [+] Querying Instagram Business Account ID: ${igAccountId}...`);
      const igUrl = `https://graph.facebook.com/v19.0/${igAccountId}?fields=username,name,biography,profile_picture_url&access_token=${userToken}`;
      const igData = await makeRequest(igUrl);
      
      if (igData.error) {
        console.error("    [-] Instagram Access Check Failed:", igData.error.message);
      } else {
        console.log(`    [+] SUCCESS! Instagram account verified.`);
        console.log(`      * Name: ${igData.name || 'N/A'}`);
        console.log(`      * Username: @${igData.username}`);
        console.log(`      * Bio: ${igData.biography || 'N/A'}`);
        instagramSuccess = true;
      }
    } catch (e) {
      console.error("  [-] Error checking Instagram API:", e.message);
    }
  }

  // ----------------------------------------------------
  // 3. THREADS API DIAGNOSTICS
  // ----------------------------------------------------
  console.log("\n[3/3] Checking Threads API Connection...");
  const threadsToken = creds.threadsAccessToken;
  
  if (!threadsToken) {
    console.error("  [-] Threads User Access Token is missing!");
  } else {
    try {
      console.log("  [+] Querying Threads Profile...");
      const threadsUrl = `https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url&access_token=${threadsToken}`;
      const threadsData = await makeRequest(threadsUrl);
      
      if (threadsData.error) {
        console.error("    [-] Threads Access Check Failed:", threadsData.error.message);
      } else {
        console.log(`    [+] SUCCESS! Threads profile verified.`);
        console.log(`      * Username: @${threadsData.username}`);
        console.log(`      * Name: ${threadsData.name || 'N/A'}`);
        console.log(`      * Threads ID: ${threadsData.id}`);
        threadsSuccess = true;
      }
    } catch (e) {
      console.error("  [-] Error checking Threads API:", e.message);
    }
  }

  // ----------------------------------------------------
  // SUMMARY REPORT
  // ----------------------------------------------------
  console.log("\n================================================================");
  console.log("📊 DIAGNOSTIC RUN SUMMARY:");
  console.log(`  - Facebook Page API:  ${facebookSuccess ? '✅ CONNECTED' : '❌ FAILED'}`);
  console.log(`  - Instagram Graph API: ${instagramSuccess ? '✅ CONNECTED' : '❌ FAILED'}`);
  console.log(`  - Threads API:         ${threadsSuccess ? '✅ CONNECTED' : '❌ FAILED'}`);
  console.log("================================================================");
}

runDiagnostics();
