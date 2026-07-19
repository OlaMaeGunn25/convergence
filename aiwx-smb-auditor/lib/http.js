/**
 * HTTP response helpers
 * =====================
 * Standardizes how the gateway answers failures. The rule this module exists to
 * enforce: the raw `err.message` (which can carry file paths, upstream API
 * payloads, SQL/PostgREST detail, or credentials embedded in a URL) is written
 * to the server log, and the client receives only a fixed, operator-authored
 * message. Callers pass the public wording; they never hand `err.message` back
 * to the browser.
 */

const logger = require('./logger');

/**
 * Log a failure server-side and return a safe JSON error envelope.
 *
 * @param {import('express').Response} res
 * @param {number} status        HTTP status to send.
 * @param {string} publicMessage Client-safe wording. Never interpolate err into this.
 * @param {object} [opts]
 * @param {Error|any} [opts.err]   The underlying error — logged, never returned.
 * @param {string} [opts.context]  Log prefix identifying the call site, e.g. '[Audit]'.
 * @param {object} [opts.extra]    Extra client-safe fields to merge into the body.
 */
function sendError(res, status, publicMessage, { err, context = '[Server]', extra } = {}) {
  if (err) {
    const detail = err instanceof Error ? (err.stack || err.message) : String(err);
    logger.error(`${context} ${publicMessage} :: ${detail}`);
  } else {
    logger.warn(`${context} ${publicMessage}`);
  }
  return res.status(status).json({ success: false, error: publicMessage, ...(extra || {}) });
}

/**
 * Wrap an async route handler so a rejected promise becomes a logged 500
 * instead of an unhandled rejection that silently hangs the request.
 */
function asyncHandler(context, publicMessage, handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((err) => {
      if (res.headersSent) {
        logger.error(`${context} Error after response was sent :: ${err && err.stack ? err.stack : err}`);
        return;
      }
      sendError(res, 500, publicMessage, { err, context });
    });
  };
}

module.exports = { sendError, asyncHandler };
