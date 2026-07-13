const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function extract() {
  const userDataDir = 'C:\\Users\\dahao\\AppData\\Local\\Google\\Chrome\\User Data';
  console.log('[+] Launching Puppeteer with Chrome profile...');
  
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    userDataDir: userDataDir,
    dumpio: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Extract Facebook
    console.log('[+] Extracting Facebook cookies...');
    await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2' });
    const fbCookies = await page.cookies();
    fs.writeFileSync(
      path.join(__dirname, 'config', 'cookies_facebook.json'),
      JSON.stringify(fbCookies, null, 2)
    );
    console.log('[+] Saved cookies_facebook.json');

    // Extract Instagram
    console.log('[+] Extracting Instagram cookies...');
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });
    const igCookies = await page.cookies();
    fs.writeFileSync(
      path.join(__dirname, 'config', 'cookies_instagram.json'),
      JSON.stringify(igCookies, null, 2)
    );
    console.log('[+] Saved cookies_instagram.json');

    // Extract Threads
    console.log('[+] Extracting Threads cookies...');
    await page.goto('https://www.threads.net/', { waitUntil: 'networkidle2' });
    const thCookies = await page.cookies();
    fs.writeFileSync(
      path.join(__dirname, 'config', 'cookies_threads.json'),
      JSON.stringify(thCookies, null, 2)
    );
    console.log('[+] Saved cookies_threads.json');

    console.log('[+] All cookies extracted successfully!');
  } catch (err) {
    console.error('[-] Error extracting cookies:', err.message);
    console.log('[!] Please make sure Chrome is completely closed before running this script.');
  } finally {
    await browser.close();
  }
}

extract();
