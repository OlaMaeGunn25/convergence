const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// CLI Arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : null;
};

const platform = getArg('--platform') || 'linkedin';
const vertical = getArg('--vertical') || 'Tech';
const dryRun = args.includes('--dry-run');
const headful = args.includes('--headful');

const CONFIG_DIR = path.join(__dirname, 'config');
const DATABASE_FILE = path.join(CONFIG_DIR, 'invited_prospects.json');

// Ensure config dir exists
if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR);

// Load invited prospects database
let invitedProspects = {};
if (fs.existsSync(DATABASE_FILE)) {
  try {
    invitedProspects = JSON.parse(fs.readFileSync(DATABASE_FILE, 'utf8'));
  } catch (e) {
    console.warn('[!] Warning: Failed to parse invited_prospects.json, starting fresh.');
  }
}

// Save database helper
function saveDatabase() {
  fs.writeFileSync(DATABASE_FILE, JSON.stringify(invitedProspects, null, 2), 'utf8');
}

// Clean and format cookies helper (reused from publish_headless.js)
function getCleanCookies(rawCookies, targetPlat) {
  const cleaned = [];
  for (let cookie of rawCookies) {
    if (!cookie.name || !cookie.value) continue;
    let sameSite = undefined;
    if (cookie.sameSite) {
      const ssLower = cookie.sameSite.toLowerCase();
      if (ssLower === 'no_restriction' || ssLower === 'none') sameSite = 'None';
      else if (ssLower === 'lax') sameSite = 'Lax';
      else if (ssLower === 'strict') sameSite = 'Strict';
    }
    let domain = cookie.domain || (targetPlat === 'threads' ? '.threads.net' : '.linkedin.com');
    domain = domain.replace(/^"|"$/g, '').replace(/^\.www\./, 'www.');

    let expiresVal = cookie.expires || cookie.expirationDate;
    let expires = expiresVal ? Math.floor(Number(expiresVal)) : undefined;

    let urlVal = targetPlat === 'threads' ? 'https://www.threads.net' : 'https://www.linkedin.com';

    cleaned.push({
      name: cookie.name,
      value: cookie.value,
      url: urlVal,
      domain: domain,
      path: cookie.path || '/',
      secure: cookie.secure !== undefined ? cookie.secure : true,
      httpOnly: cookie.httpOnly !== undefined ? cookie.httpOnly : false,
      expires,
      sameSite
    });
  }
  return cleaned;
}

async function runProspecting() {
  console.log(`[+] Initializing outbound prospecting agent for platform: ${platform.toUpperCase()}`);
  console.log(`[+] Target Vertical: ${vertical}`);
  if (dryRun) console.log('[+] DRY-RUN MODE ACTIVE: No invites will actually be submitted.');

  const cookiePath = path.join(CONFIG_DIR, `cookies_${platform}.json`);
  if (!fs.existsSync(cookiePath)) {
    console.error(`[-] Error: Connection session cookies not found at ${cookiePath}`);
    process.exit(1);
  }

  let rawCookies;
  try {
    rawCookies = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));
  } catch (e) {
    console.error(`[-] Error: Failed to parse cookies JSON: ${e.message}`);
    process.exit(1);
  }

  const cookies = getCleanCookies(rawCookies, platform);
  const browser = await puppeteer.launch({
    headless: !headful,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-notifications']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 850 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Evade webdriver detection
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  try {
    console.log('[+] Injecting session cookies...');
    for (let c of cookies) {
      await page.setCookie(c);
    }

    if (platform === 'linkedin') {
      console.log('[+] Navigating to LinkedIn Feed to establish session...');
      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await new Promise(r => setTimeout(r, 6000));

      const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=CEO%20${encodeURIComponent(vertical)}`;
      console.log(`[+] Navigating to LinkedIn Search: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await new Promise(r => setTimeout(r, 6000));

      // Extract search result profiles
      const profileLinks = await page.evaluate(() => {
        const links = [];
        const anchors = document.querySelectorAll('a');
        anchors.forEach(a => {
          const href = a.href;
          if (href && href.includes('/in/') && !href.includes('/overlay/')) {
            const cleanUrl = href.split('?')[0];
            if (!links.includes(cleanUrl)) links.push(cleanUrl);
          }
        });
        return links;
      });

      if (profileLinks.length === 0) {
        console.warn('[-] No prospects found on the search page. Ensure your session cookies are fresh.');
        await browser.close();
        return;
      }

      console.log(`[+] Found ${profileLinks.length} potential prospects on page.`);
      
      // Find the first un-invited prospect
      let targetProspect = null;
      for (let link of profileLinks) {
        if (!invitedProspects[link]) {
          targetProspect = link;
          break;
        }
      }

      if (!targetProspect) {
        console.log('[+] All prospects on this page have already been invited.');
        await browser.close();
        return;
      }

      console.log(`[+] Selecting un-contacted prospect: ${targetProspect}`);
      console.log(`[+] Navigating to prospect profile page...`);
      await page.goto(targetProspect, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await new Promise(r => setTimeout(r, 5000));

      // Extract prospect name
      const prospectName = await page.evaluate(() => {
        const titleEl = document.querySelector('h1');
        return titleEl ? titleEl.textContent.trim() : 'there';
      });
      const firstName = prospectName.split(' ')[0];

      // Formulate note message (Strictly under 300 characters)
      const noteMessage = `Hi ${firstName}, I'm Agent Smithy, the AI Social Media Agent for AiWorXmiths. I'd love to connect to show you how I work live. If you're looking to reclaim operational capacity while keeping your team in control (Human-in-the-Loop), let's connect. When it suits you, let's talk!`;
      console.log(`[+] Prepared connection note (Length: ${noteMessage.length}):`);
      console.log(`    "${noteMessage}"`);

      if (dryRun) {
        console.log(`[DRY RUN] Would send connection invitation note to: ${prospectName} (${targetProspect})`);
        await browser.close();
        return;
      }

      // Look for the "Connect" button on the profile page
      // LinkedIn sometimes hides "Connect" inside the "More" dropdown
      let connectBtn = null;
      const buttons = await page.$$('button');
      for (let btn of buttons) {
        const text = await page.evaluate(el => el.textContent.trim(), btn);
        if (text === 'Connect') {
          connectBtn = btn;
          break;
        }
      }

      if (!connectBtn) {
        console.log('[+] Connect button not found directly. Opening "More" dropdown...');
        // Look for the More button
        let moreBtn = null;
        for (let btn of buttons) {
          const text = await page.evaluate(el => el.textContent.trim(), btn);
          if (text === 'More') {
            moreBtn = btn;
            break;
          }
        }

        if (moreBtn) {
          await moreBtn.click();
          await new Promise(r => setTimeout(r, 2000));
          // Look for Connect in dropdown options
          const dropdownOptions = await page.$$('div[role="button"], span, li');
          for (let opt of dropdownOptions) {
            const text = await page.evaluate(el => el.textContent.trim(), opt);
            if (text.includes('Connect')) {
              connectBtn = opt;
              break;
            }
          }
        }
      }

      if (!connectBtn) {
        throw new Error('Could not find the Connect button on the profile page.');
      }

      console.log('[+] Connect button found. Clicking...');
      await connectBtn.click();
      await new Promise(r => setTimeout(r, 2500));

      // Look for "Add a note" button in the dialog modal
      const modalButtons = await page.$$('button');
      let addNoteBtn = null;
      for (let btn of modalButtons) {
        const text = await page.evaluate(el => el.textContent.trim(), btn);
        if (text.includes('Add a note')) {
          addNoteBtn = btn;
          break;
        }
      }

      if (addNoteBtn) {
        console.log('[+] Add a note button found. Clicking...');
        await addNoteBtn.click();
        await new Promise(r => setTimeout(r, 1500));

        // Locate textarea and type the message
        const textarea = await page.$('textarea[name="message"], textarea#custom-message');
        if (textarea) {
          await textarea.type(noteMessage, { delay: 30 });
          await new Promise(r => setTimeout(r, 1500));
        } else {
          throw new Error('Custom note textarea not found in dialog.');
        }

        // Click the send button (usually "Send" or "Send now")
        let sendBtn = null;
        const postModalButtons = await page.$$('button');
        for (let btn of postModalButtons) {
          const text = await page.evaluate(el => el.textContent.trim(), btn);
          if (text === 'Send' || text === 'Send now') {
            sendBtn = btn;
            break;
          }
        }

        if (sendBtn) {
          console.log('[+] Sending connection request with note...');
          await sendBtn.click();
          await new Promise(r => setTimeout(r, 3000));
        } else {
          throw new Error('Send button not found in note dialog.');
        }
      } else {
        // Fallback: Check if we can send direct connect request without note
        let sendWithoutNoteBtn = null;
        for (let btn of modalButtons) {
          const text = await page.evaluate(el => el.textContent.trim(), btn);
          if (text === 'Send without a note' || text === 'Send') {
            sendWithoutNoteBtn = btn;
            break;
          }
        }
        if (sendWithoutNoteBtn) {
          console.log('[+] Clicking Send without a note...');
          await sendWithoutNoteBtn.click();
          await new Promise(r => setTimeout(r, 3000));
        } else {
          throw new Error('Add note modal button not found.');
        }
      }

      // Record successful invite
      invitedProspects[targetProspect] = {
        name: prospectName,
        date: new Date().toISOString().split('T')[0],
        vertical: vertical
      };
      saveDatabase();
      console.log(`[+] SUCCESS: Connection invitation successfully sent to ${prospectName} (${targetProspect})!`);

    } else if (platform === 'threads') {
      console.log('[+] Navigating to Threads Home to establish session...');
      await page.goto('https://www.threads.net/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await new Promise(r => setTimeout(r, 6000));

      const searchUrl = `https://www.threads.net/search?q=${encodeURIComponent(vertical)}%20business`;
      console.log(`[+] Navigating to Threads search: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await new Promise(r => setTimeout(r, 6000));

      // Extract search result profile handles
      const profileHandles = await page.evaluate(() => {
        const handles = [];
        const anchors = document.querySelectorAll('a');
        anchors.forEach(a => {
          const href = a.href;
          if (href && href.includes('threads.net/@')) {
            const handle = href.split('threads.net/')[1].split('?')[0];
            if (!handles.includes(handle)) handles.push(handle);
          }
        });
        return handles;
      });

      if (profileHandles.length === 0) {
        console.warn('[-] No accounts found on search page.');
        await browser.close();
        return;
      }

      let targetHandle = null;
      for (let h of profileHandles) {
        if (!invitedProspects[h]) {
          targetHandle = h;
          break;
        }
      }

      if (!targetHandle) {
        console.log('[+] All handles on this page have already been followed.');
        await browser.close();
        return;
      }

      console.log(`[+] Selecting un-contacted handle: ${targetHandle}`);
      const targetUrl = `https://www.threads.net/${targetHandle}`;
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await new Promise(r => setTimeout(r, 5000));

      if (dryRun) {
        console.log(`[DRY RUN] Would follow Threads account: ${targetHandle}`);
        await browser.close();
        return;
      }

      // Look for follow button
      const buttons = await page.$$('button');
      let followBtn = null;
      for (let btn of buttons) {
        const text = await page.evaluate(el => el.textContent.trim(), btn);
        if (text === 'Follow') {
          followBtn = btn;
          break;
        }
      }

      if (followBtn) {
        console.log(`[+] Follow button found. Clicking to follow ${targetHandle}...`);
        await followBtn.click();
        await new Promise(r => setTimeout(r, 3000));

        // Save
        invitedProspects[targetHandle] = {
          name: targetHandle,
          date: new Date().toISOString().split('T')[0],
          vertical: vertical
        };
        saveDatabase();
        console.log(`[+] SUCCESS: Followed Threads user ${targetHandle}!`);
      } else {
        console.log(`[!] Already following ${targetHandle} or follow button is not accessible.`);
      }
    }

  } catch (err) {
    console.error(`[-] Prospecting failed: ${err.message}`);
    // Save page screenshot for debugging
    const errorScreenshot = path.join(__dirname, `logs/screenshots/prospecting_error_${Date.now()}.png`);
    await page.screenshot({ path: errorScreenshot });
    console.log(`[-] Debug screenshot saved to ${errorScreenshot}`);
  } finally {
    await browser.close();
    console.log('[+] Browser session closed.');
  }
}

runProspecting();
