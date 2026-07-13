const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const profiles = ['Profile 2', 'Profile 27', 'Profile 28'];
const localAppData = process.env.LOCALAPPDATA;

profiles.forEach(p => {
  const src = path.join(localAppData, 'Google', 'Chrome', 'User Data', p, 'Network', 'Cookies');
  const dest = path.join(__dirname, `temp_cookies_${p.replace(' ', '_')}.db`);
  if (fs.existsSync(src)) {
    try {
      execSync(`powershell -Command "Copy-Item -Path '${src.replace(/'/g, "''")}' -Destination '${dest.replace(/'/g, "''")}' -Force"`);
      if (fs.existsSync(dest)) {
        console.log(`Copied ${p} successfully. Size: ${fs.statSync(dest).size}`);
      } else {
        console.log(`Copy finished but destination for ${p} does not exist.`);
      }
    } catch (e) {
      console.log(`Failed to copy ${p}: ${e.message}`);
    }
  } else {
    console.log(`${p} does not exist at ${src}`);
  }
});
