/**
 * Campaign schedule store + time parsing.
 *
 * Writes go through json_file's atomic replace. Previously this did a bare
 * `writeFileSync`, so the scheduler daemon and the HTTP handlers could interleave
 * and truncate each other's campaign schedule.
 *
 * `readSchedule` deliberately keeps its original throwing contract for a missing
 * or malformed file — callers gate on `scheduleExists()` first, and silently
 * returning an empty schedule would make a corrupted file look like "no campaigns
 * are scheduled", which is the wrong answer to give a scheduler.
 */

const fs = require('fs');
const jsonFile = require('./json_file');
const { SCHEDULE_FILE } = require('../paths');

function scheduleExists() {
  return fs.existsSync(SCHEDULE_FILE);
}

function readSchedule() {
  // Unchanged semantics: throws on missing/invalid, by design (see header).
  return JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
}

function writeSchedule(data) {
  return jsonFile.mutate(SCHEDULE_FILE, null, () => ({ value: data, result: data }));
}

/**
 * Read-modify-write under the lock, for callers whose new value depends on the
 * current one. Reads through the same lock the write takes, so a concurrent
 * writeSchedule cannot land between the read and the write.
 */
function updateSchedule(mutator) {
  return jsonFile.mutate(SCHEDULE_FILE, null, (store) => {
    const next = mutator(store) || store;
    return { value: next, result: next };
  });
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

module.exports = { scheduleExists, readSchedule, writeSchedule, updateSchedule, parseScheduledTime, SCHEDULE_FILE };
