const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const profiles = ['Profile 2', 'Profile 27', 'Profile 28'];
const junctionUserDataDir = path.join(__dirname, 'chrome_junction');

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
    console.log(`  - Checking Facebook...`);
    await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2', timeout: 30000 }).catch(e => console.log('    FB error: ' + e.message));
    const fbCookies = await page.cookies();
    const hasFbSession = fbCookies.some(c => c.name === 'c_user');
    console.log(`    Facebook: found ${fbCookies.length} cookies. Session active: ${hasFbSession}`);
    
    // Instagram
    console.log(`  - Checking Instagram...`);
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2', timeout: 30000 }).catch(e => console.log('    IG error: ' + e.message));
    const igCookies = await page.cookies();
    const hasIgSession = igCookies.some(c => c.name === 'sessionid' || c.name === 'ds_user_id');
    console.log(`    Instagram: found ${igCookies.length} cookies. Session active: ${hasIgSession}`);
    
    // Threads
    console.log(`  - Checking Threads...`);
    await page.goto('https://www.threads.net/', { waitUntil: 'networkidle2', timeout: 30000 }).catch(e => console.log('    Threads error: ' + e.message));
    const thCookies = await page.cookies();
    const hasThSession = thCookies.some(c => c.name === 'token' || c.name === 'sessionid') || thCookies.length > 5;
    console.log(`    Threads: found ${thCookies.length} cookies. Session active: ${hasThSession}`);

    if (hasFbSession || hasIgSession || hasThSession) {
      console.log(`[!] Found active sessions in ${profileName}! Saving cookies...`);
      const configDir = path.join(__dirname, 'config');
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      fs.writeFileSync(path.join(configDir, 'cookies_facebook.json'), JSON.stringify(fbCookies, null, 2));
      fs.writeFileSync(path.join(configDir, 'cookies_instagram.json'), JSON.stringify(igCookies, null, 2));
      fs.writeFileSync(path.join(configDir, 'cookies_threads.json'), JSON.stringify(thCookies, null, 2));
      
      console.log(`[+] Saved cookies to config directory from ${profileName}!`);
      return true;
    }
  } catch (err) {
    console.error(`[-] Error in ${profileName}:`, err.message);
  } finally {
    await browser.close();
  }
  return false;
}

async function run() {
  for (const profile of profiles) {
    try {
      const success = await checkProfile(profile);
      if (success) {
        console.log('\n[+] Cookie extraction successful!');
        process.exit(0);
      }
    } catch (e) {
      console.error(`[-] Profile ${profile} failed to run:`, e.message);
    }
  }
  console.log('\n[-] No active sessions found in any tested profiles.');
  process.exit(1);
}

run();
