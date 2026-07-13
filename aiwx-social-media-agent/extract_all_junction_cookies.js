const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const junctionUserDataDir = path.join(__dirname, 'chrome_junction');

// Get all profiles dynamically, but strictly restrict to allowed business profiles
const dirs = fs.readdirSync(junctionUserDataDir);
const allowedProfiles = ['Profile 2', 'Profile 27', 'Profile 28'];
const profiles = dirs.filter(d => allowedProfiles.includes(d));

console.log(`[+] Found profiles to test: ${profiles.join(', ')}`);

async function checkProfile(profileName) {
  console.log(`\n[+] Testing profile: ${profileName}...`);
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    userDataDir: junctionUserDataDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `--profile-directory=${profileName}`
    ]
  });

  try {
    const page = await browser.newPage();
    
    // Facebook
    await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2', timeout: 30000 }).catch(e => {});
    const fbCookies = await page.cookies();
    const hasFbSession = fbCookies.some(c => c.name === 'c_user');
    
    // Instagram
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2', timeout: 30000 }).catch(e => {});
    const igCookies = await page.cookies();
    const hasIgSession = igCookies.some(c => c.name === 'sessionid' || c.name === 'ds_user_id');
    
    // Threads
    await page.goto('https://www.threads.net/', { waitUntil: 'networkidle2', timeout: 30000 }).catch(e => {});
    const thCookies = await page.cookies();
    const hasThSession = thCookies.some(c => c.name === 'token' || c.name === 'sessionid') || thCookies.length > 5;

    console.log(`    Results for ${profileName}:`);
    console.log(`      - Facebook: found ${fbCookies.length} cookies. Session active: ${hasFbSession}`);
    console.log(`      - Instagram: found ${igCookies.length} cookies. Session active: ${hasIgSession}`);
    console.log(`      - Threads: found ${thCookies.length} cookies. Session active: ${hasThSession}`);

    if (hasFbSession || hasIgSession || hasThSession) {
      console.log(`[!] SUCCESS: Found active sessions in ${profileName}!`);
      const configDir = path.join(__dirname, 'config');
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      if (hasFbSession) {
        fs.writeFileSync(path.join(configDir, 'cookies_facebook.json'), JSON.stringify(fbCookies, null, 2));
        console.log(`[+] Saved cookies_facebook.json`);
      }
      if (hasIgSession) {
        fs.writeFileSync(path.join(configDir, 'cookies_instagram.json'), JSON.stringify(igCookies, null, 2));
        console.log(`[+] Saved cookies_instagram.json`);
      }
      if (hasThSession) {
        fs.writeFileSync(path.join(configDir, 'cookies_threads.json'), JSON.stringify(thCookies, null, 2));
        console.log(`[+] Saved cookies_threads.json`);
      }
      return {
        facebook: hasFbSession,
        instagram: hasIgSession,
        threads: hasThSession
      };
    }
  } catch (err) {
    console.error(`[-] Error in ${profileName}:`, err.message);
  } finally {
    await browser.close();
  }
  return null;
}

async function run() {
  let foundStats = { facebook: false, instagram: false, threads: false };
  for (const profile of profiles) {
    try {
      const result = await checkProfile(profile);
      if (result) {
        if (result.facebook) foundStats.facebook = true;
        if (result.instagram) foundStats.instagram = true;
        if (result.threads) foundStats.threads = true;
        
        // If we found all three, we can stop early!
        if (foundStats.facebook && foundStats.instagram && foundStats.threads) {
          console.log('\n[+] Found active sessions for all three platforms. Stopping search.');
          process.exit(0);
        }
      }
    } catch (e) {
      console.error(`[-] Profile ${profile} failed to run:`, e.message);
    }
  }
  
  console.log('\n[+] Finished scanning all profiles.');
  console.log(`    Status: FB: ${foundStats.facebook}, IG: ${foundStats.instagram}, Threads: ${foundStats.threads}`);
  if (foundStats.facebook || foundStats.instagram || foundStats.threads) {
    process.exit(0);
  } else {
    console.log('[-] No active sessions found in any Chrome profiles.');
    process.exit(1);
  }
}

run();
