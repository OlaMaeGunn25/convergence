/**
 * Google Scholar Integration — Legal Services vertical
 * ====================================================
 * Powers automated case-law searches, expert-witness publication vetting, and
 * scientific-precedent checks for the CONVERGENCE-Ai Legal vertical.
 *
 * Uses SerpApi's Google Scholar engine (https://serpapi.com/google-scholar-api).
 * Configuration is environment-only:
 *   SERPAPI_API_KEY  (preferred)  — or  SCHOLAR_API_KEY  (alias)
 *
 * If no key is configured, or the live request fails, searchScholar() degrades
 * gracefully to a deterministic simulated dataset so the Legal vertical remains
 * demonstrable without external dependencies.
 */

const https = require('https');

const SERP_HOST = 'serpapi.com';

function getApiKey(explicit) {
  return explicit || process.env.SERPAPI_API_KEY || process.env.SCHOLAR_API_KEY || null;
}

function isScholarConfigured() {
  return Boolean(process.env.SERPAPI_API_KEY || process.env.SCHOLAR_API_KEY);
}

/**
 * Simulated fallback dataset — activates when the API key is missing or a live
 * call fails. Returns representative case-law citations and expert-witness
 * publications so the Legal vertical UI and PDF reports render end-to-end.
 */
function getSimulatedResults(query) {
  const q = (query || 'legal precedent').trim();
  return {
    success: true,
    simulated: true,
    query: q,
    engine: 'google_scholar',
    totalResults: 5,
    results: [
      {
        title: 'State of Nevada vs. Floyd Mayweather',
        source: 'Supreme Court of Nevada',
        authors: ['Hon. R. Gonzalez'],
        publicationDate: '2021',
        citationsCount: 148,
        link: 'https://scholar.google.com/scholar_case?about=nevada_v_mayweather',
        snippet: 'Appellate review of settlement enforcement and confidentiality obligations in high-profile civil disputes.',
        type: 'case_law'
      },
      {
        title: 'Lobo Law Appeals Precedents: Trial Defense Doctrine',
        source: 'Nevada Law Review',
        authors: ['A. Lobo', 'S. Jenkins'],
        publicationDate: '2019',
        citationsCount: 62,
        link: 'https://scholar.google.com/scholar?q=lobo_law_appeals_precedents',
        snippet: 'Analysis of trial defense strategy and appellate precedent in criminal defense practice.',
        type: 'case_law'
      },
      {
        title: 'Daubert Standard and the Admissibility of Expert Scientific Testimony',
        source: 'Harvard Journal of Law & Technology',
        authors: ['M. Feldman', 'K. Osei'],
        publicationDate: '2020',
        citationsCount: 431,
        link: 'https://scholar.google.com/scholar?q=daubert_expert_testimony',
        snippet: 'Framework for vetting expert-witness reliability under the Daubert scientific-precedent test.',
        type: 'expert_publication'
      },
      {
        title: 'Forensic Accounting Methodologies in Commercial Litigation',
        source: 'Journal of Forensic & Investigative Accounting',
        authors: ['D. Whitfield'],
        publicationDate: '2022',
        citationsCount: 87,
        link: 'https://scholar.google.com/scholar?q=forensic_accounting_litigation',
        snippet: 'Peer-reviewed methodology frequently cited when vetting financial expert witnesses.',
        type: 'expert_publication'
      },
      {
        title: 'Chain-of-Custody Reliability in Digital Evidence Precedent',
        source: 'Stanford Technology Law Review',
        authors: ['P. Nkemdirim', 'J. Vance'],
        publicationDate: '2023',
        citationsCount: 54,
        link: 'https://scholar.google.com/scholar?q=digital_evidence_chain_of_custody',
        snippet: 'Scientific-precedent review governing digital forensic evidence admissibility.',
        type: 'scientific_precedent'
      }
    ]
  };
}

/**
 * Normalize a single SerpApi google_scholar organic result into the flat schema
 * the UI and PDF consume: title, source, authors[], publicationDate,
 * citationsCount, link, snippet.
 */
function normalizeResult(item) {
  const pubInfo = item.publication_info || {};
  const summary = pubInfo.summary || '';

  // Authors: prefer structured authors[], else parse the leading segment of the summary
  let authors = [];
  if (Array.isArray(pubInfo.authors) && pubInfo.authors.length) {
    authors = pubInfo.authors.map(a => a.name).filter(Boolean);
  } else if (summary) {
    authors = summary.split(' - ')[0].split(',').map(s => s.trim()).filter(Boolean);
  }

  // Source and publication date are typically the middle segment: "… - Journal, 2019 - site"
  let source = '';
  let publicationDate = '';
  const segments = summary.split(' - ');
  if (segments.length >= 2) {
    const middle = segments[1];
    const yearMatch = middle.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) publicationDate = yearMatch[0];
    source = middle.replace(/,?\s*\b(19|20)\d{2}\b/, '').trim();
  }

  const citationsCount = (item.inline_links
    && item.inline_links.cited_by
    && typeof item.inline_links.cited_by.total === 'number')
    ? item.inline_links.cited_by.total
    : 0;

  return {
    title: item.title || 'Untitled',
    source: source || '(source not listed)',
    authors,
    publicationDate: publicationDate || '(n/a)',
    citationsCount,
    link: item.link || (item.resources && item.resources[0] && item.resources[0].link) || '',
    snippet: item.snippet || '',
    type: 'case_law'
  };
}

/**
 * Perform a live SerpApi Google Scholar request.
 */
function serpApiRequest(params, apiKey, timeoutMs) {
  return new Promise((resolve, reject) => {
    const search = new URLSearchParams({ ...params, api_key: apiKey });
    const req = https.request(
      { hostname: SERP_HOST, path: `/search.json?${search.toString()}`, method: 'GET' },
      (res) => {
        let body = '';
        res.on('data', (c) => body += c);
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`SerpApi returned status ${res.statusCode}: ${body.slice(0, 300)}`));
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error('Failed to parse SerpApi response as JSON.'));
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`SerpApi request timed out after ${timeoutMs}ms`)));
    req.end();
  });
}

/**
 * searchScholar(query, options)
 * @param {string} query  The Google Scholar search query.
 * @param {object} options
 *   - apiKey    {string}  Override the environment key.
 *   - engine    {string}  'google_scholar' (default) or 'google_scholar_author'.
 *   - num       {number}  Max results to return (default 10).
 *   - authorId  {string}  For the google_scholar_author engine.
 *   - timeoutMs {number}  Request timeout (default 20000).
 * @returns {Promise<object>} { success, simulated, query, engine, totalResults, results[] }
 */
async function searchScholar(query, options = {}) {
  const cleanQuery = (query || '').toString().trim();
  if (!cleanQuery && options.engine !== 'google_scholar_author') {
    return { success: false, simulated: false, query: '', engine: options.engine || 'google_scholar', totalResults: 0, results: [], error: 'A non-empty query is required.' };
  }

  const apiKey = getApiKey(options.apiKey);
  const engine = options.engine === 'google_scholar_author' ? 'google_scholar_author' : 'google_scholar';
  const num = Math.min(Math.max(parseInt(options.num, 10) || 10, 1), 20);
  const timeoutMs = parseInt(options.timeoutMs, 10) || 20000;

  // No key configured → deterministic simulated dataset (graceful fallback).
  if (!apiKey) {
    return getSimulatedResults(cleanQuery);
  }

  try {
    const params = engine === 'google_scholar_author'
      ? { engine, author_id: options.authorId || '', num: String(num) }
      : { engine, q: cleanQuery, num: String(num) };

    const raw = await serpApiRequest(params, apiKey, timeoutMs);
    const organic = raw.organic_results || raw.articles || [];
    const results = organic.slice(0, num).map(normalizeResult);

    return {
      success: true,
      simulated: false,
      query: cleanQuery,
      engine,
      totalResults: results.length,
      results
    };
  } catch (err) {
    // Live call failed — degrade gracefully rather than break the Legal vertical.
    console.warn(`[Scholar] Live SerpApi request failed (${err.message}); using simulated fallback.`);
    const fallback = getSimulatedResults(cleanQuery);
    fallback.degraded = true;
    fallback.error = err.message;
    return fallback;
  }
}

module.exports = {
  searchScholar,
  isScholarConfigured,
  getSimulatedResults
};
