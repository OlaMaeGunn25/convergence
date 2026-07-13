const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// CLI Arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : null;
};

const platform = getArg('--platform') || 'instagram'; // default
const headful = args.includes('--headful');

const CONFIG_DIR = path.join(__dirname, 'config');
const LOGS_DIR = path.join(__dirname, 'logs', 'screenshots');

// Ensure log directories exist
if (!fs.existsSync(path.join(__dirname, 'logs'))) fs.mkdirSync(path.join(__dirname, 'logs'));
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR);

async function testConnection() {
  console.log(`[+] Starting connection test for platform: ${platform}`);
  
  const cookiePath = path.join(CONFIG_DIR, `cookies_${platform}.json`);
  if (!fs.existsSync(cookiePath)) {
    console.error(`[-] Error: Cookie file not found at ${cookiePath}`);
    console.error(`[-] Please export your cookies for ${platform} in JSON format using a browser extension (e.g., EditThisCookie) and save them to this path.`);
    process.exit(1);
  }

  let cookies;
  try {
    cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));
  } catch (e) {
    console.error(`[-] Error: Failed to parse JSON cookie file: ${e.message}`);
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: !headful,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    console.log(`[+] Injecting ${cookies.length} cookies...`);
    for (let cookie of cookies) {
      if (!cookie.name || !cookie.value) continue;
      const cleanCookie = {
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain || (platform === 'threads' ? '.threads.net' : platform === 'instagram' ? '.instagram.com' : platform === 'linkedin' ? '.linkedin.com' : '.facebook.com'),
        path: cookie.path || '/',
        secure: cookie.secure !== undefined ? cookie.secure : true,
        httpOnly: cookie.httpOnly !== undefined ? cookie.httpOnly : false
      };
      await page.setCookie(cleanCookie);
    }

    let targetUrl = '';
    if (platform === 'instagram') targetUrl = 'https://www.instagram.com/';
    else if (platform === 'threads') targetUrl = 'https://www.threads.net/';
    else if (platform === 'facebook') targetUrl = 'https://www.facebook.com/';
    else if (platform === 'linkedin') targetUrl = 'https://www.linkedin.com/';

    console.log(`[+] Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log('[+] Waiting for page to stabilize...');
    await new Promise(r => setTimeout(r, 8000)); // Wait 8 seconds

    const currentUrl = page.url();
    console.log(`[+] Current page URL: ${currentUrl}`);

    // Check login indicators
    let isLoggedIn = false;
    let reason = '';

    if (platform === 'instagram') {
      const loginRedirect = currentUrl.includes('accounts/login');
      const createBtn = await page.$('svg[aria-label="New post"], svg[aria-label="Create"], img[alt*="profile picture"]');
      if (!loginRedirect && createBtn) {
        isLoggedIn = true;
      } else {
        reason = loginRedirect ? 'Redirected to login page' : 'Create button/profile icon not found on feed';
      }
    } else if (platform === 'threads') {
      const loginRedirect = currentUrl.includes('login') || currentUrl.includes('welcome');
      const hasNewThreadText = await page.evaluate(() => {
        const text = document.body.textContent.toLowerCase();
        return text.includes('new thread') || text.includes("what's new?") || text.includes('insights');
      });
      const composeBox = await page.$('div[contenteditable="true"], svg[aria-label="Compose"], div[role="main"]');
      if (!loginRedirect && (composeBox || hasNewThreadText)) {
        isLoggedIn = true;
      } else {
        reason = loginRedirect ? 'Redirected to login/welcome page' : 'Compose box and new thread text not found';
      }
    } else if (platform === 'facebook') {
      // Handle "Continue as..." or "Continue" interstitial via native Puppeteer click
      const buttons = await page.$$('button, div[role="button"], a, span');
      let continueBtn = null;
      for (let btn of buttons) {
        const text = await page.evaluate(el => el.textContent.trim(), btn);
        if (text === 'Continue' || text.startsWith('Continue as') || text === 'Continue with Facebook') {
          continueBtn = btn;
          break;
        }
      }

      if (continueBtn) {
        console.log('[+] Found Facebook "Continue" button. Triggering native click...');
        await continueBtn.click();
        await new Promise(r => setTimeout(r, 8000));
      }

      const loginRedirect = page.url().includes('login') || page.url().includes('recover');
      const mindBox = await page.$('div[aria-label*="What\'s on your mind"], div[role="feed"], div[role="navigation"]');
      if (!loginRedirect && mindBox) {
        isLoggedIn = true;
      } else {
        reason = loginRedirect ? 'Redirected to login page' : 'Whats on your mind input / feed not found';
      }
    } else if (platform === 'linkedin') {
      const loginRedirect = currentUrl.includes('login') || currentUrl.includes('signup');
      const feedOrCompose = await page.$('div.share-box-feed-entry__trigger, button.share-box-feed-entry__trigger, div.global-nav');
      if (!loginRedirect && feedOrCompose) {
        isLoggedIn = true;
      } else {
        reason = loginRedirect ? 'Redirected to login/signup page' : 'Share box trigger / global nav not found on feed';
      }
    }

    const timestamp = Date.now();
    const screenshotPath = path.join(LOGS_DIR, `connection_${platform}_${timestamp}.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`[+] Screenshot saved to: ${screenshotPath}`);

    if (isLoggedIn) {
      console.log(`[+] SUCCESS: Authenticated successfully on ${platform}!`);
    } else {
      console.error(`[-] FAILURE: Could not authenticate on ${platform}. Reason: ${reason}`);
      console.error(`[-] Please verify if your session cookies are fresh and you exported them from a logged-in tab.`);
    }

  } catch (err) {
    console.error(`[-] Exception occurred: ${err.message}`);
  } finally {
    await browser.close();
    console.log('[+] Browser closed. Test finished.');
  }
}

testConnection();
