/**
 * Supabase REST client — environment-driven, pooled, and resilient.
 *
 * Configuration comes STRICTLY from process.env:
 *   SUPABASE_URL               e.g. https://xyzcompany.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  service-role key (server-side only, never sent to browsers)
 *
 * Connections are pooled via a shared keep-alive https.Agent so repeated writes
 * reuse sockets instead of opening a new TLS handshake per request. Transient
 * network errors (ECONNRESET, ETIMEDOUT, EAI_AGAIN, 5xx) are retried with
 * exponential backoff before the error is surfaced to the caller.
 */

const https = require('https');

const KEEPALIVE_AGENT = new https.Agent({
  keepAlive: true,
  maxSockets: parseInt(process.env.SUPABASE_POOL_SIZE, 10) || 10,
  maxFreeSockets: 4,
  timeout: 30000
});

const RETRYABLE_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE', 'EAI_AGAIN', 'ENOTFOUND']);
const MAX_RETRIES = parseInt(process.env.SUPABASE_MAX_RETRIES, 10) || 3;

function getConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }
  return { url: url.replace(/\/+$/, ''), key };
}

function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function requestOnce(method, requestPath, payload) {
  const { url, key } = getConfig();
  return new Promise((resolve, reject) => {
    const urlObj = new URL(`${url}${requestPath}`);
    const postData = payload !== undefined ? JSON.stringify(payload) : null;

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method,
      agent: KEEPALIVE_AGENT,
      timeout: parseInt(process.env.SUPABASE_REQUEST_TIMEOUT_MS, 10) || 15000,
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(data ? JSON.parse(data) : null);
          } catch (e) {
            resolve(data);
          }
        } else {
          const err = new Error(`Supabase REST ${method} ${requestPath} returned status ${res.statusCode}: ${data}`);
          err.statusCode = res.statusCode;
          reject(err);
        }
      });
    });

    req.on('timeout', () => req.destroy(Object.assign(new Error('Supabase request timed out'), { code: 'ETIMEDOUT' })));
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function isTransient(err) {
  if (err.code && RETRYABLE_CODES.has(err.code)) return true;
  if (err.statusCode && err.statusCode >= 500) return true;
  return false;
}

async function request(method, requestPath, payload) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await requestOnce(method, requestPath, payload);
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || attempt === MAX_RETRIES) throw err;
      const backoff = Math.min(500 * Math.pow(2, attempt), 8000);
      console.warn(`[Supabase] Transient error (${err.code || err.statusCode}), retry ${attempt + 1}/${MAX_RETRIES} in ${backoff}ms`);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

function insertRow(table, payload) {
  return request('POST', `/rest/v1/${table}`, payload);
}

function selectRows(table, queryString = '') {
  return request('GET', `/rest/v1/${table}${queryString ? `?${queryString}` : ''}`);
}

module.exports = {
  isSupabaseConfigured,
  insertRow,
  selectRows
};
