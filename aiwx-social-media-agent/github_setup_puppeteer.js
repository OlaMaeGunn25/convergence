const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function run() {
  const cookiesPath = 'c:/Users/dahao/Downloads/github.com_12-07-2026.json';
  if (!fs.existsSync(cookiesPath)) {
    console.error(`[-] ERROR: Cookies file not found at ${cookiesPath}`);
    process.exit(1);
  }

  const cookiesData = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
  const cookies = cookiesData.cookies;
  
  const formattedCookies = cookies.map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path || '/',
    secure: c.secure !== undefined ? c.secure : true,
    httpOnly: c.httpOnly !== undefined ? c.httpOnly : true,
    sameSite: c.sameSite ? (c.sameSite.toLowerCase() === 'lax' ? 'Lax' : c.sameSite.toLowerCase() === 'strict' ? 'Strict' : 'None') : 'Lax'
  }));

  console.log('[+] Launching Puppeteer...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1024 });

  console.log('[+] Injecting session cookies...');
  await page.setCookie(...formattedCookies);

  console.log('[+] Navigating to GitHub...');
  await page.goto('https://github.com', { waitUntil: 'networkidle2' });
  
  const loggedInUser = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="user-login"]');
    return meta ? meta.getAttribute('content') : null;
  });

  if (!loggedInUser) {
    console.error('[-] ERROR: Session is not authenticated. Please check your cookies file.');
    await browser.close();
    process.exit(1);
  }
  console.log(`[+] SUCCESS: Authenticated on GitHub as ${loggedInUser}`);

  // Check if repository already exists under aiworxmiths or user
  let repoOwner = 'OlaMaeGunn25'; // Fallback
  let repoName = 'convergence';
  let exists = false;

  const targetOwners = ['aiworxmiths', loggedInUser];
  for (const ownerCandidate of targetOwners) {
    const checkUrl = `https://github.com/${ownerCandidate}/${repoName}`;
    console.log(`[+] Checking repository existence at ${checkUrl}...`);
    try {
      const response = await page.goto(checkUrl, { waitUntil: 'networkidle2' });
      if (response.status() === 200) {
        console.log(`[+] Found existing repository at: ${checkUrl}`);
        repoOwner = ownerCandidate;
        exists = true;
        break;
      }
    } catch (err) {
      console.log(`[!] Failed checking ${checkUrl}: ${err.message}`);
    }
  }

  if (!exists) {
    console.log('[+] Repository not found. Creating a new one...');
    await page.goto('https://github.com/new', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: 'github_new_repo.png' });

    // Find repo name input dynamically
    const repoNameInputId = await page.evaluate(() => {
      const nameInput = document.querySelector('#repository-name-input') || 
                        document.querySelector('input[data-testid="repository-name-input"]') || 
                        document.querySelector('input[aria-label="Repository name"]') || 
                        Array.from(document.querySelectorAll('input')).find(i => i.placeholder === 'short-and-memorable' || i.id.includes('react-control') && i.type === 'text');
      return nameInput ? nameInput.id : null;
    });

    if (!repoNameInputId) {
      console.error('[-] ERROR: Repository name input not found.');
      await browser.close();
      process.exit(1);
    }
    console.log(`[+] Found repository name input with ID: ${repoNameInputId}`);
    
    await page.type(`#${repoNameInputId}`, 'convergence');
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'github_new_repo_filled.png' });

    // Owner selection
    try {
      const ownerBtn = await page.$('#owner-dropdown-header-button');
      if (ownerBtn) {
        await ownerBtn.click();
        await new Promise(r => setTimeout(r, 1500));
        
        const selectedAiworx = await page.evaluate(() => {
          const listItems = Array.from(document.querySelectorAll('span, div, button, [role="option"]'));
          const aiwx = listItems.find(el => el.textContent.trim().toLowerCase() === 'aiworxmiths');
          if (aiwx) {
            const clickable = aiwx.closest('div[role="option"]') || aiwx.closest('button') || aiwx;
            clickable.click();
            return true;
          }
          return false;
        });

        if (selectedAiworx) {
          console.log('[+] Selected "aiworxmiths" as owner.');
          repoOwner = 'aiworxmiths';
          await new Promise(r => setTimeout(r, 1000));
        } else {
          console.log('[+] "aiworxmiths" organization option not found in dropdown. Keeping default.');
          await ownerBtn.click();
        }
      }
    } catch (err) {
      console.log('[!] Warning during owner selection:', err.message);
    }

    // Visibility selection (Private)
    try {
      const visibilityBtn = await page.$('#visibility-anchor-button');
      if (visibilityBtn) {
        await visibilityBtn.click();
        await new Promise(r => setTimeout(r, 1500));
        
        const selectedPrivate = await page.evaluate(() => {
          const options = Array.from(document.querySelectorAll('span, div, button, [role="option"]'));
          const priv = options.find(el => el.textContent.trim().toLowerCase().includes('private'));
          if (priv) {
            const clickable = priv.closest('div[role="option"]') || priv.closest('button') || priv;
            clickable.click();
            return true;
          }
          return false;
        });
        console.log(`[+] Selected Private visibility: ${selectedPrivate}`);
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (err) {
      console.log('[!] Warning selecting visibility:', err.message);
    }

    await page.screenshot({ path: 'github_new_repo_ready.png' });

    console.log('[+] Submitting the Create Repository form...');
    const clickedSubmit = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const createBtn = btns.find(b => b.textContent.trim().toLowerCase() === 'create repository');
      if (createBtn) {
        createBtn.click();
        return true;
      }
      return false;
    });

    if (!clickedSubmit) {
      const submitBtn = await page.$('button[type="submit"]');
      if (submitBtn) await submitBtn.click();
    }

    console.log('[+] Waiting for redirect to repository page...');
    await new Promise(r => setTimeout(r, 12000));
    await page.screenshot({ path: 'github_repo_created.png' });

    const currentUrl = page.url();
    const urlParts = currentUrl.replace('https://github.com/', '').split('/');
    repoOwner = urlParts[0];
    repoName = urlParts[1].split('?')[0].split('#')[0];
    console.log(`[+] Repository created: ${repoOwner}/${repoName}`);
  }

  const gitUrl = `git@github.com:${repoOwner}/${repoName}.git`;
  console.log(`[+] Target Git Remote SSH URL: ${gitUrl}`);

  // Navigating to Deploy Keys settings new page
  const keysSettingsUrl = `https://github.com/${repoOwner}/${repoName}/settings/keys/new`;
  console.log(`[+] Navigating to Deploy Keys settings: ${keysSettingsUrl}`);
  await page.goto(keysSettingsUrl, { waitUntil: 'networkidle2' });
  await page.screenshot({ path: 'github_deploy_keys_new.png' });

  // Fill in Deploy Key form using verified DOM selectors
  console.log('[+] Filling deploy key form...');
  await page.waitForSelector('#public_key_title', { timeout: 15000 });
  await page.type('#public_key_title', 'Convergence Deploy Key');

  const pubKey = fs.readFileSync('id_rsa_github.pub', 'utf8').trim();
  await page.type('#public_key_key', pubKey);

  // Check allow write access checkbox (unchecking the "Read-only" checkbox)
  console.log('[+] Checking the Write Access permission checkbox (unchecking read_only)...');
  try {
    const isChecked = await page.evaluate(() => {
      const cb = document.querySelector('#read_only');
      return cb ? cb.checked : false;
    });
    if (isChecked) {
      console.log('[+] Checkbox is currently checked (read-only). Clicking it to uncheck...');
      await page.click('#read_only');
    } else {
      console.log('[+] Checkbox is already unchecked.');
    }
  } catch (err) {
    console.log('[!] Warning checking write access checkbox:', err.message);
  }

  await page.screenshot({ path: 'github_deploy_keys_filled.png' });

  // Click Add Key button
  console.log('[+] Clicking Add Key button...');
  const clickedAddKey = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const addKeyBtn = btns.find(b => b.textContent.includes('Add key'));
    if (addKeyBtn) {
      addKeyBtn.click();
      return true;
    }
    return false;
  });

  if (!clickedAddKey) {
    await page.click('button[type="submit"]');
  }
  
  await new Promise(r => setTimeout(r, 5000));
  await page.screenshot({ path: 'github_deploy_keys_added.png' });
  console.log('[+] Saved screenshot: github_deploy_keys_added.png');

  // Save repo details to json file
  fs.writeFileSync('repo_info.json', JSON.stringify({
    owner: repoOwner,
    repo: repoName,
    sshUrl: gitUrl,
    httpsUrl: `https://github.com/${repoOwner}/${repoName}`
  }, null, 2));

  console.log('[+] SUCCESS: Repository setup complete!');
  await browser.close();
}

run().catch(err => {
  console.error('[-] ERROR in script:', err);
  process.exit(1);
});
