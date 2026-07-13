const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');

// CLI Arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : null;
};

const platform = getArg('--platform');
const text = getArg('--text');
const image = getArg('--image');
const headful = args.includes('--headful');
const dryRun = args.includes('--dry-run');

if (!platform || !text) {
  console.error('[-] Error: Missing required arguments.');
  console.error('[-] Usage: node publish_headless.js --platform <platform> --text "<text>" [--image <image_filename>] [--headful] [--dry-run]');
  process.exit(1);
}

const CONFIG_DIR = path.join(__dirname, 'config');
const LOGS_DIR = path.join(__dirname, 'logs', 'screenshots');

// Ensure log directories exist
if (!fs.existsSync(path.join(__dirname, 'logs'))) fs.mkdirSync(path.join(__dirname, 'logs'));
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR);

// Helper to find and click button by text content
async function clickButtonByText(page, textVal, parentSelector = 'button', timeout = 10000) {
  try {
    await page.waitForSelector(parentSelector, { timeout });
    const elements = await page.$$(parentSelector);
    // 1. Try exact match first to prevent matching partial containment (e.g. "Add to your post" vs "Post")
    for (let el of elements) {
      const val = await page.evaluate(e => e.textContent, el);
      if (val.toLowerCase().trim() === textVal.toLowerCase().trim()) {
        await el.click();
        return true;
      }
    }
    // 2. Fall back to partial match
    for (let el of elements) {
      const val = await page.evaluate(e => e.textContent, el);
      if (val.toLowerCase().trim().includes(textVal.toLowerCase().trim())) {
        await el.click();
        return true;
      }
    }
  } catch (e) {
    // Timeout or click failed
  }
  return false;
}

// Helper to click by aria-label
async function clickByAriaLabel(page, label, tag = '*', timeout = 10000) {
  try {
    const selector = `${tag}[aria-label="${label}"]`;
    await page.waitForSelector(selector, { timeout });
    await page.click(selector);
    return true;
  } catch (e) {
    return false;
  }
}

async function publishPost() {
  console.log(`[+] Initializing headless publisher for ${platform.toUpperCase()}...`);
  if (dryRun) console.log('[+] DRY-RUN ACTIVE: Will not perform the final publish click.');

  const cookiePath = path.join(CONFIG_DIR, `cookies_${platform}.json`);
  if (!fs.existsSync(cookiePath)) {
    console.error(`[-] Error: Cookie file not found at ${cookiePath}`);
    process.exit(1);
  }

  let cookies;
  try {
    cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));
  } catch (e) {
    console.error(`[-] Error: Failed to parse JSON cookies: ${e.message}`);
    process.exit(1);
  }

  // Resolve visual asset path if supplied
  let absoluteImagePath = null;
  let downloadedTempPath = null;
  if (image) {
    if (image.startsWith('http://') || image.startsWith('https://')) {
      console.log(`[+] Downloading campaign image from URL: ${image}...`);
      const tempFilename = `temp_headless_${Date.now()}_${path.basename(image)}`;
      const tempPath = path.join(__dirname, tempFilename);
      try {
        await new Promise((resolve, reject) => {
          const file = fs.createWriteStream(tempPath);
          https.get(image, response => {
            if (response.statusCode !== 200) {
              reject(new Error(`Failed to download image: Status ${response.statusCode}`));
              return;
            }
            response.pipe(file);
            file.on('finish', () => {
              file.close();
              resolve();
            });
          }).on('error', err => {
            fs.unlink(tempPath, () => {});
            reject(err);
          });
        });
        absoluteImagePath = tempPath;
        downloadedTempPath = tempPath;
        console.log(`[+] Downloaded temp image to: ${absoluteImagePath}`);
      } catch (err) {
        console.error(`[-] Failed to download remote image on the fly: ${err.message}. Posting text-only.`);
        absoluteImagePath = null;
      }
    } else {
      absoluteImagePath = path.isAbsolute(image) ? image : path.join(__dirname, image);
      if (!fs.existsSync(absoluteImagePath)) {
        // Check directly in workspace root too
        const altPath = path.join(__dirname, path.basename(image));
        if (fs.existsSync(altPath)) {
          absoluteImagePath = altPath;
        } else {
          console.warn(`[!] Warning: Image file not found at ${absoluteImagePath}. Posting text-only instead.`);
          absoluteImagePath = null;
        }
      }
    }
  }

  // Chromium/Chrome binary resolution: cloud containers set PUPPETEER_EXECUTABLE_PATH
  // (e.g. /usr/bin/chromium); on the Windows dev host we fall back to the local
  // Chrome install; otherwise Puppeteer's own bundled browser is used.
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH
    || (process.platform === 'win32' && fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : undefined);

  const browser = await puppeteer.launch({
    headless: 'new',
    ...(executablePath ? { executablePath } : {}),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-notifications']
  });

  let page = null;
  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 850 });

    // Set standard non-headless User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Evasion: hide navigator.webdriver
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    let targetUrl = '';
    if (platform === 'instagram') targetUrl = 'https://www.instagram.com/';
    else if (platform === 'threads') targetUrl = 'https://www.threads.net/';
    else if (platform === 'facebook') targetUrl = 'https://www.facebook.com/';
    else if (platform === 'linkedin') targetUrl = 'https://www.linkedin.com/feed/';

    if (platform === 'linkedin') {
      console.log('[+] Establishing domain context by navigating to LinkedIn homepage first...');
      await page.goto('https://www.linkedin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await new Promise(r => setTimeout(r, 3000));

      console.log('[+] Injecting essential LinkedIn session cookies...');
      const essentialCookies = ['li_at', 'JSESSIONID'];
      for (let cookie of cookies) {
        if (!cookie.name || !cookie.value) continue;
        if (!essentialCookies.includes(cookie.name)) continue;

        let sameSite = undefined;
        if (cookie.sameSite) {
          const ssLower = cookie.sameSite.toLowerCase();
          if (ssLower === 'no_restriction' || ssLower === 'none') sameSite = 'None';
          else if (ssLower === 'lax') sameSite = 'Lax';
          else if (ssLower === 'strict') sameSite = 'Strict';
        }

        const cleanCookie = {
          name: cookie.name,
          value: cookie.value,
          domain: '.linkedin.com',
          path: cookie.path || '/',
          secure: cookie.secure !== undefined ? cookie.secure : true,
          httpOnly: cookie.httpOnly !== undefined ? cookie.httpOnly : false,
          sameSite
        };
        await page.setCookie(cleanCookie);
      }
    } else {
      console.log(`[+] Injecting ${cookies.length} cookies...`);
      for (let cookie of cookies) {
        if (!cookie.name || !cookie.value) continue;

        let sameSite = undefined;
        if (cookie.sameSite) {
          const ssLower = cookie.sameSite.toLowerCase();
          if (ssLower === 'no_restriction' || ssLower === 'none') sameSite = 'None';
          else if (ssLower === 'lax') sameSite = 'Lax';
          else if (ssLower === 'strict') sameSite = 'Strict';
        }

        let domain = cookie.domain || (platform === 'threads' ? '.threads.net' : platform === 'instagram' ? '.instagram.com' : '.facebook.com');
        domain = domain.replace(/^"|"$/g, '');
        domain = domain.replace(/^\.www\./, 'www.');

        let expiresVal = cookie.expires || cookie.expirationDate;
        let expires = expiresVal ? Math.floor(Number(expiresVal)) : undefined;

        let urlVal = undefined;
        if (platform === 'instagram') urlVal = 'https://www.instagram.com';
        else if (platform === 'threads') urlVal = 'https://www.threads.net';
        else if (platform === 'facebook') urlVal = 'https://www.facebook.com';

        const cleanCookie = {
          name: cookie.name,
          value: cookie.value,
          url: urlVal,
          domain: domain,
          path: cookie.path || '/',
          secure: cookie.secure !== undefined ? cookie.secure : true,
          httpOnly: cookie.httpOnly !== undefined ? cookie.httpOnly : false,
          expires,
          sameSite
        };
        await page.setCookie(cleanCookie);
      }
    }

    console.log(`[+] Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 6000));

    const currentUrl = page.url();
    console.log(`[+] Current URL: ${currentUrl}`);

    // Verify login state
    let loggedIn = true;
    if (platform === 'instagram') {
      const loginForm = await page.$('form#loginForm, input[name="username"]');
      if (loginForm || currentUrl.includes('accounts/login')) loggedIn = false;
    } else if (platform === 'threads') {
      const hasLogInText = await page.evaluate(() => {
        const text = document.body.textContent.toLowerCase();
        return text.includes('log in') || text.includes('continue with instagram') || text.includes('welcome to threads');
      });
      const composeBox = await page.$('div[contenteditable="true"]');
      if (hasLogInText && !composeBox) loggedIn = false;
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
        console.log('[+] Found Facebook "Continue" button. Triggering click...');
        await page.evaluate(el => el.click(), continueBtn);
        await new Promise(r => setTimeout(r, 8000));
      }

      const loginForm = await page.$('form#login_form, input#email');
      if (loginForm || page.url().includes('login')) loggedIn = false;
    } else if (platform === 'linkedin') {
      const loginForm = await page.$('form.login__form, input#username, form#login-submit');
      if (loginForm || currentUrl.includes('login') || currentUrl.includes('signup') || !page.url().includes('/feed')) loggedIn = false;
    }

    if (!loggedIn) {
      throw new Error(`Authentication failed: Your session cookies for ${platform} are expired or invalid. Please re-export them from an active browser session.`);
    }

    // ----------------------------------------------------
    // PLATFORM FLOW: INSTAGRAM
    // ----------------------------------------------------
    if (platform === 'instagram') {
      if (!absoluteImagePath) {
        throw new Error('Instagram requires a visual asset/image to publish.');
      }
      console.log('[+] Opening Create Post dialog...');
      
      // Click create button
      let clickedCreate = await clickByAriaLabel(page, 'Create', 'span');
      if (!clickedCreate) clickedCreate = await clickByAriaLabel(page, 'New post', 'svg');
      if (!clickedCreate) clickedCreate = await clickButtonByText(page, 'Create', 'a');
      
      if (!clickedCreate) {
        // Fallback selector check
        const fallbackSel = 'svg[aria-label="New post"], svg[aria-label="Create"]';
        await page.waitForSelector(fallbackSel, { timeout: 5000 });
        await page.click(fallbackSel);
      }

      // Click "Post" in the Create sub-menu popover
      await new Promise(r => setTimeout(r, 2000));
      let clickedPostSubmenu = await clickButtonByText(page, 'Post', 'span');
      if (!clickedPostSubmenu) clickedPostSubmenu = await clickButtonByText(page, 'Post', 'div');
      if (!clickedPostSubmenu) clickedPostSubmenu = await clickButtonByText(page, 'Post', 'button');


      console.log('[+] Uploading image asset...');
      const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 15000 });
      await fileInput.uploadFile(absoluteImagePath);
      await new Promise(r => setTimeout(r, 5000));

      // Click "Next" on Crop modal
      console.log('[+] Advancing crop window...');
      let nextBtn = await clickButtonByText(page, 'Next', 'button');
      if (!nextBtn) nextBtn = await clickButtonByText(page, 'Next', 'div');
      
      await new Promise(r => setTimeout(r, 3000));

      // Click "Next" on Filters/Adjustment modal
      console.log('[+] Advancing filter window...');
      nextBtn = await clickButtonByText(page, 'Next', 'button');
      if (!nextBtn) nextBtn = await clickButtonByText(page, 'Next', 'div');
      
      await new Promise(r => setTimeout(r, 3000));

      // Write caption
      console.log('[+] Typing caption...');
      const captionBox = await page.waitForSelector('div[aria-label="Write a caption..."]', { timeout: 15000 });
      await captionBox.click();
      await page.keyboard.type(text);
      await new Promise(r => setTimeout(r, 2000));

      // Capture preview screenshot
      const postTime = Date.now();
      const previewPath = path.join(LOGS_DIR, `preview_${platform}_${postTime}.png`);
      await page.screenshot({ path: previewPath });
      console.log(`[+] Preview screenshot saved to: ${previewPath}`);

      if (dryRun) {
        console.log('[+] Dry-run: Skipping share click.');
      } else {
        console.log('[+] Sharing post live...');
        let shareBtn = await clickButtonByText(page, 'Share', 'div[role="dialog"] [role="button"]');
        if (!shareBtn) shareBtn = await clickButtonByText(page, 'Share', 'div[role="dialog"] div');
        if (!shareBtn) shareBtn = await clickButtonByText(page, 'Share', 'div[role="dialog"] button');
        if (!shareBtn) shareBtn = await clickButtonByText(page, 'Share', 'button');
        if (!shareBtn) shareBtn = await clickButtonByText(page, 'Share', 'div');
        if (!shareBtn) throw new Error('Could not find Share button inside Instagram post modal.');
        
        console.log('[+] Waiting for share completion confirmation...');
        await new Promise(r => setTimeout(r, 15000)); // wait 15 seconds to allow upload
      }
    }

    // ----------------------------------------------------
    // PLATFORM FLOW: THREADS
    // ----------------------------------------------------
    else if (platform === 'threads') {
      console.log('[+] Opening Threads compose editor...');
      
      // Look for "Start a thread..." box or navigation compose button
      let composeClicked = false;
      const textareas = await page.$$('div[contenteditable="true"]');
      if (textareas.length > 0) {
        // Direct click on feed editor
        await textareas[0].click();
        composeClicked = true;
      } else {
        composeClicked = await clickByAriaLabel(page, 'Compose', 'svg');
        if (!composeClicked) composeClicked = await clickButtonByText(page, 'New thread', 'span');
        if (!composeClicked) composeClicked = await clickButtonByText(page, 'New thread', 'div');
        if (!composeClicked) composeClicked = await clickButtonByText(page, "What's new?", 'span');
        if (!composeClicked) composeClicked = await clickButtonByText(page, "What's new?", 'div');
        if (!composeClicked) composeClicked = await clickButtonByText(page, 'Start a thread...', 'div');
      }

      // Wait for editor modal if needed
      await new Promise(r => setTimeout(r, 4000));

      console.log('[+] Typing Thread content...');
      const activeTextarea = await page.waitForSelector('div[contenteditable="true"]', { timeout: 15000 });
      await activeTextarea.focus();
      await page.keyboard.type(text);
      await new Promise(r => setTimeout(r, 2000));

      if (absoluteImagePath) {
        console.log('[+] Attaching image asset...');
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
          await fileInput.uploadFile(absoluteImagePath);
          await new Promise(r => setTimeout(r, 4000));
        } else {
          console.warn('[!] Warning: Attachment file input not found in Threads UI.');
        }
      }

      // Capture preview screenshot
      const postTime = Date.now();
      const previewPath = path.join(LOGS_DIR, `preview_${platform}_${postTime}.png`);
      await page.screenshot({ path: previewPath });
      console.log(`[+] Preview screenshot saved to: ${previewPath}`);

      if (dryRun) {
        console.log('[+] Dry-run: Skipping publish click.');
      } else {
        let postBtn = await clickButtonByText(page, 'Post', 'div[role="dialog"] button');
        if (!postBtn) postBtn = await clickButtonByText(page, 'Post', 'div[role="dialog"] div[role="button"]');
        if (!postBtn) postBtn = await clickButtonByText(page, 'Post', 'button');
        if (!postBtn) postBtn = await clickButtonByText(page, 'Post', 'div');
        
        console.log('[+] Waiting for Threads upload...');
        await new Promise(r => setTimeout(r, 10000));
      }
    }

    // ----------------------------------------------------
    // PLATFORM FLOW: FACEBOOK
    // ----------------------------------------------------
    else if (platform === 'facebook') {
      console.log('[+] Starting Facebook publishing flow...');
      
      if (absoluteImagePath) {
        console.log('[+] Attaching image asset first to open the composer modal with the image...');
        // Find the global file input on the homepage
        const fileInput = await page.waitForSelector('input[type="file"][accept*="image"], input[type="file"]', { timeout: 15000 });
        await fileInput.uploadFile(absoluteImagePath);
        console.log('[+] Uploaded image. Waiting for compose modal to open...');
        await new Promise(r => setTimeout(r, 6000));
        
        console.log('[+] Writing Facebook status copy into the modal...');
        const textbox = await page.waitForSelector('div[role="dialog"] div[role="textbox"][contenteditable="true"], div[role="textbox"][contenteditable="true"]', { timeout: 15000 });
        await textbox.click();
        await textbox.focus();
        await page.keyboard.type(text);
        await new Promise(r => setTimeout(r, 2000));
      } else {
        console.log('[+] Clicking Facebook compose trigger for text-only post...');
        let composeClicked = await clickButtonByText(page, "What's on your mind", 'span', 15000);
        if (!composeClicked) composeClicked = await clickButtonByText(page, "Create post", 'span', 5000);
        
        if (!composeClicked) {
          const composeTrigger = await page.$('div[role="button"][class*="x1i10hfl"]');
          if (composeTrigger) {
            await composeTrigger.click();
            composeClicked = true;
          }
        }
        
        await new Promise(r => setTimeout(r, 4000));

        console.log('[+] Writing Facebook status copy...');
        const textbox = await page.waitForSelector('div[role="textbox"][contenteditable="true"]', { timeout: 15000 });
        await textbox.click();
        await textbox.focus();
        await page.keyboard.type(text);
        await new Promise(r => setTimeout(r, 2000));
      }

      // Capture preview screenshot
      const postTime = Date.now();
      const previewPath = path.join(LOGS_DIR, `preview_${platform}_${postTime}.png`);
      await page.screenshot({ path: previewPath });
      console.log(`[+] Preview screenshot saved to: ${previewPath}`);

      if (dryRun) {
        console.log('[+] Dry-run: Skipping publish click.');
      } else {
        console.log('[+] Submitting Facebook post...');
        // 1. Check if there is a "Next" button (Facebook Professional/Page flows)
        let nextBtn = await clickButtonByText(page, 'Next', 'div[role="button"]');
        if (!nextBtn) nextBtn = await clickButtonByText(page, 'Next', 'button');
        if (nextBtn) {
          console.log('[+] Clicked "Next" sharing options button. Waiting for final Post/Share button...');
          await new Promise(r => setTimeout(r, 3000));
        }

        // 2. Click the final Post/Share/Submit button
        let postBtn = await clickButtonByText(page, 'Post', 'div[role="button"]');
        if (!postBtn) postBtn = await clickButtonByText(page, 'Post', 'button');
        if (!postBtn) postBtn = await clickButtonByText(page, 'Share', 'div[role="button"]');
        if (!postBtn) postBtn = await clickButtonByText(page, 'Share', 'button');
        if (!postBtn) {
          // Direct selectors for Facebook submit button
          const fallbackSubmit = await page.$('div[aria-label="Post"][role="button"]') || await page.$('div[aria-label="Share"][role="button"]');
          if (fallbackSubmit) {
            await fallbackSubmit.click();
            postBtn = true;
          }
        }

        console.log('[+] Waiting for Facebook publish transaction...');
        await new Promise(r => setTimeout(r, 12000));
      }
    }
    
    // ----------------------------------------------------
    // PLATFORM FLOW: LINKEDIN
    // ----------------------------------------------------
    else if (platform === 'linkedin') {
      console.log('[+] Opening LinkedIn compose editor...');
      let composeClicked = false;
      const selectors = [
        '.share-box-feed-entry__trigger',
        'button.share-box-feed-entry__trigger',
        'button',
        'span',
        'div'
      ];
      for (const sel of selectors) {
        try {
          composeClicked = await clickButtonByText(page, 'Start a post', sel, 2000);
          if (composeClicked) {
            console.log(`[+] Clicked LinkedIn compose trigger using selector: ${sel}`);
            break;
          }
        } catch (e) {
          // Keep searching
        }
      }
      if (!composeClicked) {
        throw new Error('Could not find start post button on LinkedIn feed.');
      }

      await new Promise(r => setTimeout(r, 4000));

      console.log('[+] Writing LinkedIn post copy...');
      const textbox = await page.waitForSelector('div.ql-editor, div[role="textbox"][contenteditable="true"], div[contenteditable="true"]', { timeout: 15000 });
      await textbox.focus();
      await page.keyboard.type(text);
      await new Promise(r => setTimeout(r, 2000));

      if (absoluteImagePath) {
        console.log('[+] Attaching image asset to LinkedIn post...');
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
          await fileInput.uploadFile(absoluteImagePath);
          await new Promise(r => setTimeout(r, 6000));
          
          console.log('[+] Clicking Done button in media preview...');
          let doneBtn = await clickButtonByText(page, 'Done', 'button');
          if (!doneBtn) doneBtn = await clickButtonByText(page, 'Next', 'button');
          await new Promise(r => setTimeout(r, 3000));
        } else {
          console.warn('[!] Warning: File input element not found in LinkedIn UI.');
        }
      }

      // Capture preview screenshot
      const postTime = Date.now();
      const previewPath = path.join(LOGS_DIR, `preview_${platform}_${postTime}.png`);
      await page.screenshot({ path: previewPath });
      console.log(`[+] Preview screenshot saved to: ${previewPath}`);

      if (dryRun) {
        console.log('[+] Dry-run: Skipping publish click.');
      } else {
        console.log('[+] Submitting LinkedIn post...');
        let postBtn = await clickButtonByText(page, 'Post', 'div[role="dialog"] button');
        if (!postBtn) postBtn = await clickButtonByText(page, 'Post', '.share-creation-state button');
        if (!postBtn) postBtn = await clickButtonByText(page, 'Post', 'button');
        if (!postBtn) {
          const fallbackBtn = await page.$('.share-actions__primary-action');
          if (fallbackBtn) await fallbackBtn.click();
        }
        
        console.log('[+] Waiting for LinkedIn publish transaction...');
        await new Promise(r => setTimeout(r, 10000));
      }
    }

    console.log(`[+] SUCCESS: Platform ${platform} execution completed.`);
    
    // Create execution log output
    const timestamp = Date.now();
    const resultScreenshot = path.join(LOGS_DIR, `result_${platform}_${timestamp}.png`);
    await page.screenshot({ path: resultScreenshot });
    console.log(`[+] Final verification screenshot saved to: ${resultScreenshot}`);

    // Output JSON result for server parsing
    console.log(JSON.stringify({
      success: true,
      platform,
      dryRun,
      screenshot: `/logs/screenshots/${path.basename(resultScreenshot)}`
    }));

  } catch (err) {
    console.error(`[-] ERROR during publishing flow: ${err.message}`);
    
    // Capture error state
    try {
      const errTime = Date.now();
      const errScreenshot = path.join(LOGS_DIR, `error_${platform}_${errTime}.png`);
      await page.screenshot({ path: errScreenshot });
      console.error(`[-] Error screenshot saved to: ${errScreenshot}`);
      
      console.log(JSON.stringify({
        success: false,
        platform,
        error: err.message,
        screenshot: `/logs/screenshots/${path.basename(errScreenshot)}`
      }));
    } catch (screerr) {
      // ignore screenshot failures
    }
    throw err;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    if (downloadedTempPath && fs.existsSync(downloadedTempPath)) {
      try {
        fs.unlinkSync(downloadedTempPath);
        console.log(`[+] Cleaned up temporary image: ${downloadedTempPath}`);
      } catch (e) {
        // ignore
      }
    }
    console.log('[+] Headless browser closed.');
  }
}

publishPost();
