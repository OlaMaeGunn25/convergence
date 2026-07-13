const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const junctionUserDataDir = path.join(__dirname, 'chrome_junction');
const targetProfiles = ['Profile 2', 'Profile 27', 'Profile 28'];
const configDir = path.join(__dirname, 'config');

async function checkProfile(profileName) {
  console.log(`\n[+] Testing profile in headful mode: ${profileName}...`);
  const browser = await puppeteer.launch({
    headless: false,  // Open a real browser window to allow App-Bound decryption to work
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    userDataDir: junctionUserDataDir,
    ignoreDefaultArgs: ['--password-store', '--use-mock-keychain'],
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `--profile-directory=${profileName}`
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // Ensure logs directory exists
    const logsScreenshotDir = path.join(__dirname, 'logs', 'screenshots');
    if (!fs.existsSync(logsScreenshotDir)) {
      fs.mkdirSync(logsScreenshotDir, { recursive: true });
    }

    // Facebook
    console.log(`  - Checking Facebook...`);
    await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2', timeout: 35000 }).catch(e => console.log('    FB error: ' + e.message));
    await page.screenshot({ path: path.join(logsScreenshotDir, `check_${profileName}_fb.png`) });
    const fbCookies = await page.cookies();
    const hasFbSession = fbCookies.some(c => c.name === 'c_user');
    console.log(`    Facebook: found ${fbCookies.length} cookies. Session active: ${hasFbSession}`);
    
    // Instagram
    console.log(`  - Checking Instagram...`);
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2', timeout: 35000 }).catch(e => console.log('    IG error: ' + e.message));
    await page.screenshot({ path: path.join(logsScreenshotDir, `check_${profileName}_ig.png`) });
    const igCookies = await page.cookies();
    const hasIgSession = igCookies.some(c => c.name === 'sessionid' || c.name === 'ds_user_id');
    console.log(`    Instagram: found ${igCookies.length} cookies. Session active: ${hasIgSession}`);
    
    // Threads
    console.log(`  - Checking Threads...`);
    await page.goto('https://www.threads.net/', { waitUntil: 'networkidle2', timeout: 35000 }).catch(e => console.log('    Threads error: ' + e.message));
    await page.screenshot({ path: path.join(logsScreenshotDir, `check_${profileName}_threads.png`) });
    const thCookies = await page.cookies();
    const hasThSession = thCookies.some(c => c.name === 'token' || c.name === 'sessionid') || thCookies.length > 5;
    console.log(`    Threads: found ${thCookies.length} cookies. Session active: ${hasThSession}`);

    if (hasFbSession || hasIgSession || hasThSession) {
      console.log(`[!] Found active sessions in ${profileName}! Saving cookies...`);
      
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
  for (const profile of targetProfiles) {
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
  console.log('\n[-] No active sessions found in target profiles.');
  process.exit(1);
}

run();
