/**
 * Campaign schedule time parsing — single source of truth.
 * =======================================================
 * Posts are authored as a date ('2026-07-20') plus a wall-clock Eastern time
 * ('10:00 AM EST'). Every consumer needs the same absolute instant for that
 * pair, so the conversion lives here rather than being reimplemented per caller.
 *
 * This is the scheduler_daemon.js implementation, which is the correct one. The
 * copy that used to live in server.js built the Date from a bare
 * `${date}T${time}` string — that is interpreted in the *host* timezone, not
 * Eastern, and its AM/PM branch zeroed the hour for any 12:xx PM slot as well as
 * 12:xx AM. Both are fixed by consolidating here.
 */

/**
 * Eastern offset in hours for a given instant: -4 during daylight saving,
 * -5 otherwise. Derived from the host's own DST transitions.
 */
function getEasternOffsetHours(at = new Date()) {
  const jan = new Date(at.getFullYear(), 0, 1);
  const jul = new Date(at.getFullYear(), 6, 1);
  const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  const isDST = at.getTimezoneOffset() < stdOffset;
  return isDST ? -4 : -5;
}

/**
 * @param {string} dateStr 'YYYY-MM-DD'
 * @param {string} timeStr '10:00 AM EST' / '3:30 PM EDT' / '14:00'
 * @returns {Date} the absolute instant, or epoch 0 when unparseable (callers
 *                 treat epoch 0 as "immediately due", matching prior behaviour).
 */
function parseScheduledTime(dateStr, timeStr) {
  try {
    const cleaned = String(timeStr).replace(/ E[SD]T$/i, '').trim();
    const [timePart, meridiem] = cleaned.split(' ');
    const [rawHour, m] = timePart.split(':').map(Number);
    let h = rawHour;
    if (Number.isNaN(h) || Number.isNaN(m)) return new Date(0);

    if (meridiem === 'PM' && h !== 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;

    const offset = getEasternOffsetHours();
    const offsetStr = offset < 0
      ? `-${String(Math.abs(offset)).padStart(2, '0')}:00`
      : `+${String(offset).padStart(2, '0')}:00`;

    const iso = `${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00${offsetStr}`;
    const dt = new Date(iso);
    return isNaN(dt.getTime()) ? new Date(0) : dt;
  } catch (e) {
    return new Date(0);
  }
}

/** ISO string for the resolved instant, for the campaign_posts.scheduled_at column. */
function toScheduledAt(dateStr, timeStr) {
  const dt = parseScheduledTime(dateStr, timeStr);
  return dt.getTime() === 0 ? null : dt.toISOString();
}

module.exports = { parseScheduledTime, toScheduledAt, getEasternOffsetHours };
