/**
 * Operator notifications
 * ======================
 * Desktop toast notifications only exist on the Windows dev host; in a Linux
 * container we log the event instead so cloud log drains still capture it.
 */

const { execFile } = require('child_process');
const logger = require('./logger');
const { SOCIAL_AGENT_DIR } = require('./paths');

function sendNotification(title, message) {
  if (process.platform !== 'win32') {
    logger.info(`[Notification] ${title}: ${message}`);
    return;
  }
  // execFile avoids the command-line quoting/spacing pitfalls of a shell string.
  execFile('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', 'send_notification.ps1', title, message], { cwd: SOCIAL_AGENT_DIR }, (err) => {
    if (err) logger.error(`[Notification] Failed to trigger notification :: ${err.message}`);
  });
}

module.exports = { sendNotification };
