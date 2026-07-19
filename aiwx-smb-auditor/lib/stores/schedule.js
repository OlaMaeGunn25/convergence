/**
 * Campaign schedule store + time parsing.
 */

const fs = require('fs');
const { SCHEDULE_FILE } = require('../paths');

function scheduleExists() {
  return fs.existsSync(SCHEDULE_FILE);
}

function readSchedule() {
  return JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
}

function writeSchedule(data) {
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(data, null, 2));
}

/**
 * Parse a "2026-08-04" + "1:30 PM EST" pair into a Date. Returns the epoch on
 * malformed input so a bad row is treated as long-overdue rather than crashing
 * the scheduler scan.
 */
function parseScheduledTime(dateStr, timeStr) {
  try {
    let timeOnly = timeStr.replace(' EST', '').replace(' EDT', '').trim();
    let [time, modifier] = timeOnly.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') {
      hours = '00';
    }
    if (modifier === 'PM') {
      hours = parseInt(hours, 10) + 12;
    }
    const formattedTime = `${String(hours).padStart(2, '0')}:${minutes}:00`;
    return new Date(`${dateStr}T${formattedTime}`);
  } catch (e) {
    return new Date(0);
  }
}

module.exports = { scheduleExists, readSchedule, writeSchedule, parseScheduledTime, SCHEDULE_FILE };
