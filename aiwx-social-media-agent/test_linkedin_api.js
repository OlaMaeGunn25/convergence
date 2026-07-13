const fs = require('fs');
const path = require('path');
const https = require('https');

const credsPath = path.join(__dirname, 'config', 'linkedin_credentials.json');
if (!fs.existsSync(credsPath)) {
  console.error("[-] LinkedIn credentials file not found.");
  process.exit(1);
}

const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
const ACCESS_TOKEN = creds.accessToken;

function makeRequest(method, url, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : {}
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: { rawText: data }
          });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function verifyLinkedIn() {
  console.log("================================================================");
  console.log("📊 AIWX SOCIAL MEDIA AGENT: LINKEDIN API DIAGNOSTICS");
  console.log("================================================================\n");

  console.log("[1/2] Fetching Profile details via OpenID Connect /userinfo...");
  try {
    // Attempt OpenID Connect userinfo first
    let res = await makeRequest('GET', 'https://api.linkedin.com/v2/userinfo');
    
    if (res.statusCode !== 200) {
      console.log(`  [-] /userinfo failed (Status ${res.statusCode}). Error body:`, res.body);
      console.log(`  [+] Trying legacy /me endpoint...`);
      res = await makeRequest('GET', 'https://api.linkedin.com/v2/me');
    }

    if (res.statusCode === 200) {
      const profile = res.body;
      const personUrn = profile.sub ? `urn:li:person:${profile.sub}` : `urn:li:person:${profile.id}`;
      console.log("  [+] SUCCESS: Authenticated successfully on LinkedIn!");
      console.log(`    - Name: ${profile.name || `${profile.localizedFirstName} ${profile.localizedLastName}`}`);
      console.log(`    - Email: ${profile.email || 'N/A'}`);
      console.log(`    - Person URN: ${personUrn}`);
      
      // Update credentials file with the Person URN so the publisher can use it
      creds.personUrn = personUrn;
      fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2), 'utf8');
      console.log("    - [Saved URN to config/linkedin_credentials.json]");
    } else {
      console.error("  [-] LinkedIn Authentication Failed!");
      console.error("    - Status Code:", res.statusCode);
      console.error("    - Error details:", res.body);
    }
  } catch (e) {
    console.error("  [-] Error calling LinkedIn API:", e.message);
  }
}

verifyLinkedIn();
