const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const userDataDir = 'C:\\Users\\dahao\\AppData\\Local\\Google\\Chrome\\User Data';
const targetProfiles = ['Profile 2', 'Profile 27', 'Profile 28'];
const configDir = path.join(__dirname, 'config');

if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

async function extractFromProfile(profileName) {
  console.log(`\n[+] Launching Puppeteer on real profile: ${profileName}...`);
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    userDataDir: userDataDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `--profile-directory=${profileName}`
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // 1. Facebook Check
    console.log(`  - Checking Facebook session...`);
    await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2', timeout: 30000 });
    const fbCookies = await page.cookies();
    const hasFbSession = fbCookies.some(c => c.name === 'c_user');
    console.log(`    Facebook: found ${fbCookies.length} cookies. Session active: ${hasFbSession}`);

    // 2. Instagram Check
    console.log(`  - Checking Instagram session...`);
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2', timeout: 30000 });
    const igCookies = await page.cookies();
    const hasIgSession = igCookies.some(c => c.name === 'sessionid' || c.name === 'ds_user_id');
    console.log(`    Instagram: found ${igCookies.length} cookies. Session active: ${hasIgSession}`);

    // 3. Threads Check
    console.log(`  - Checking Threads session...`);
    await page.goto('https://www.threads.net/', { waitUntil: 'networkidle2', timeout: 30000 });
    const thCookies = await page.cookies();
    const hasThSession = thCookies.some(c => c.name === 'token' || c.name === 'sessionid') || thCookies.length > 5;
    console.log(`    Threads: found ${thCookies.length} cookies. Session active: ${hasThSession}`);

    if (hasFbSession || hasIgSession || hasThSession) {
      console.log(`\n[!] Found active sessions in ${profileName}!`);
      
      if (hasFbSession) {
        fs.writeFileSync(path.join(configDir, 'cookies_facebook.json'), JSON.stringify(fbCookies, null, 2));
        console.log('[+] Saved cookies_facebook.json');
      }
      if (hasIgSession) {
        fs.writeFileSync(path.join(configDir, 'cookies_instagram.json'), JSON.stringify(igCookies, null, 2));
        console.log('[+] Saved cookies_instagram.json');
      }
      if (hasThSession) {
        fs.writeFileSync(path.join(configDir, 'cookies_threads.json'), JSON.stringify(thCookies, null, 2));
        console.log('[+] Saved cookies_threads.json');
      }
      return true;
    }
  } catch (err) {
    console.error(`[-] Error scanning ${profileName}:`, err.message);
  } finally {
    await browser.close();
  }
  return false;
}

async function run() {
  for (const profile of targetProfiles) {
    const success = await extractFromProfile(profile);
    if (success) {
      console.log('\n[+] Cookie extraction completed successfully!');
      process.exit(0);
    }
  }
  console.log('\n[-] No active logged-in sessions found in Profile 2, Profile 27, or Profile 28.');
  process.exit(1);
}

run();
