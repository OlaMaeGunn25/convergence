/**
 * RealEstateAPI Connector (MLS, property records & parcel data)
 * ============================================================
 * The other four real-estate entries in the catalog (RESO Web API, Trestle,
 * MLS Grid, Bridge) are per-board feeds: a brokerage signs a data licence with
 * each MLS it belongs to and gets one endpoint per board. That is correct for a
 * single-market brokerage and painful for anyone operating across markets.
 *
 * RealEstateAPI is the aggregated alternative — one key, one JSON REST surface,
 * nationwide coverage, with an explicit board-coverage lookup so a tenant's
 * LOCAL board can be resolved from its geography instead of hard-coded (this is
 * what lib/regional_sources.js consumes for REG-01/02).
 *
 * Governance:
 *   - Credentials ONLY from env / Secret Manager: REALESTATEAPI_KEY, sent as the
 *     `x-api-key` header. Never accepted over HTTP, never logged.
 *   - Reads degrade to a clearly-labeled *simulated* dataset when unconfigured,
 *     the same contract as scholar/clio/gusto, so onboarding never blanks.
 *   - SKIP TRACE IS ON THE COMPLIANCE FLOOR. It resolves a property owner's
 *     personal phone and email. That is regulated contact data (TCPA, state DNC,
 *     and in several states its use for solicitation is separately restricted),
 *     so it refuses without an explicit approval, is registered destructive, and
 *     is listed in autonomy.FLOOR_TOOLS so no standard grant can delegate it.
 *   - Owner contact fields are stripped by `redactOwnerContact()` on every path
 *     except an approved skip trace, so ordinary listing reads cannot become a
 *     back-door into personal data.
 *   - MLS content is LICENSED, not owned. Every listing payload carries a
 *     `license` block naming the board and the display obligation, because the
 *     tenant — not Convergence — holds that licence and must honour it.
 *
 * Docs: https://developer.realestateapi.com
 * Rate limits (as documented): 1,000,000 records/24h across PropertySearch +
 * SkipTrace scopes; /SkipTrace 10 req/s; /SkipTraceBatch 20 req/s. Exceeding any
 * of these returns HTTP 429 — surfaced to the caller rather than silently retried.
 */

const { copy } = require('../immutable');

function baseUrl() {
  return process.env.REALESTATEAPI_URL || 'https://api.realestateapi.com';
}

function isRealEstateApiConfigured() {
  return !!process.env.REALESTATEAPI_KEY;
}

/**
 * The vendor also publishes an MCP server over SSE. Returned for the connection
 * builder so a tenant can attach it as an MCP surface instead of the REST API.
 * The key is NEVER interpolated here — the builder resolves it from the secret
 * store at bind time; this is a shape, not a credential.
 */
function mcpConfig() {
  return {
    transport: 'sse',
    url: process.env.REALESTATEAPI_MCP_URL || 'https://mcp.realestateapi.com/sse',
    authHeader: 'x-api-key',
    secretRef: 'REALESTATEAPI_KEY',
    note: 'Attach as an MCP server; the gateway injects x-api-key from the secret store at bind time.',
    docs: 'https://developer.realestateapi.com/reference/mcp'
  };
}

/** Low-level authenticated POST. Throws if unconfigured — callers fall back. */
async function reapiRequest(resourcePath, body = {}) {
  if (!isRealEstateApiConfigured()) throw new Error('RealEstateAPI is not configured (REALESTATEAPI_KEY missing).');
  if (typeof fetch !== 'function') throw new Error('global fetch unavailable in this runtime.');
  const res = await fetch(`${baseUrl()}${resourcePath}`, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.REALESTATEAPI_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (res.status === 429) {
    // Documented daily/per-second caps. Do not retry blindly — a caller that
    // burns the daily window degrades every other workflow on the same key.
    throw new Error('RealEstateAPI rate limit exceeded (429). Back off before retrying.');
  }
  if (!res.ok) throw new Error(`RealEstateAPI POST ${resourcePath} failed: ${res.status}`);
  return res.json();
}

// ── Personal-data boundary ───────────────────────────────────────────────────

/**
 * Strip owner/occupant contact details. Listing and property reads are business
 * data; a person's phone, email and mailing address are not, and they must not
 * ride along on an ordinary search just because the vendor returns them.
 */
function redactOwnerContact(record) {
  if (!record || typeof record !== 'object') return record;
  if (Array.isArray(record)) return record.map(redactOwnerContact);
  const SENSITIVE = /^(phone|phone_?numbers?|mobile|landline|email|emails?|dnc|litigator|ssn|social_security_number|date_?of_?birth|dob|owner_?email|owner_?phone)$/i;
  const out = {};
  for (const [k, v] of Object.entries(record)) {
    if (SENSITIVE.test(k)) { out[k] = '[redacted — personal contact data; requires an approved skip trace]'; continue; }
    out[k] = (v && typeof v === 'object') ? redactOwnerContact(v) : v;
  }
  return out;
}

/**
 * MLS content is licensed per board and carries display obligations (attribution,
 * refresh cadence, and for most boards a prohibition on redistribution). Stamping
 * it on the payload keeps the obligation attached to the data as it moves through
 * agents, records and exports.
 */
function licenseNotice(board = null) {
  return {
    licensed: true,
    board: board || 'per originating MLS board',
    obligation: 'MLS listing content is licensed to the brokerage, not to Convergence. Display attribution, honour the board\'s refresh and redistribution rules, and do not export beyond the licensed use.',
    holder: 'tenant brokerage'
  };
}

// ── Simulated fallback datasets (clearly labeled) ────────────────────────────
function simulated(kind, rows, extra = {}) {
  return Object.assign({
    success: true, simulated: true, provenance: 'simulated',
    source: 'realestateapi_simulator', kind, data: copy(rows)
  }, extra);
}

const SIM_LISTINGS = [
  {
    listingId: 'L-88213', mlsNumber: 'NWM-2210934', standardStatus: 'Active',
    address: { street: '1420 Alder St', city: 'Seattle', state: 'WA', zip: '98122' },
    bedrooms: 3, bathrooms: 2, livingArea: 1840, lotSizeSquareFeet: 4200, yearBuilt: 1994,
    mlsListingPrice: 749000, pricePerSqFt: 407, daysOnMarket: 12,
    listingAgent: { name: 'R. Okafor', license: 'WA-114892' },
    listingOffice: { name: 'Cascade Realty Group' },
    primaryListingImageUrl: 'https://example.invalid/listing/88213/1.jpg', photosCount: 24
  },
  {
    listingId: 'L-88477', mlsNumber: 'NWM-2211220', standardStatus: 'Pending',
    address: { street: '77 Beacon Hill Ave', city: 'Seattle', state: 'WA', zip: '98144' },
    bedrooms: 4, bathrooms: 3, livingArea: 2410, lotSizeSquareFeet: 5100, yearBuilt: 2006,
    mlsListingPrice: 985000, pricePerSqFt: 409, daysOnMarket: 31,
    listingAgent: { name: 'M. Delgado', license: 'WA-127755' },
    listingOffice: { name: 'Puget Sound Partners' },
    primaryListingImageUrl: 'https://example.invalid/listing/88477/1.jpg', photosCount: 18
  }
];

const SIM_PROPERTY = {
  id: 'P-5512090', apn: '284670-0145', fips: '53033',
  address: { street: '1420 Alder St', city: 'Seattle', state: 'WA', zip: '98122' },
  owner: { name: 'ALDER ST HOLDINGS LLC', ownerOccupied: false, mailingState: 'WA' },
  assessedValue: 688000, estimatedValue: 761000, lastSaleAmount: 540000, lastSaleDate: '2019-06-11',
  bedrooms: 3, bathrooms: 2, livingArea: 1840, yearBuilt: 1994,
  flags: { preForeclosure: false, absenteeOwner: true, cashBuyer: false }
};

const SIM_BOARDS = [
  { mls_board_code: 'NWMLS', mls_board_name: 'Northwest Multiple Listing Service', state: 'WA', listingCount: 41230 },
  { mls_board_code: 'SPOK', mls_board_name: 'Spokane Association of REALTORS', state: 'WA', listingCount: 6120 }
];

// ── MLS reads ────────────────────────────────────────────────────────────────

/**
 * Search MLS listings (POST /v3/MLSSearch). Geography is required in one of the
 * documented combinations — an unbounded nationwide sweep is both a licence
 * problem and a fast way to burn the daily record cap, so it is refused here
 * rather than at the vendor.
 */
async function searchListings(params = {}) {
  const {
    mlsBoardCode = null, city = null, state = null, county = null, zip = null,
    latitude = null, longitude = null, radius = null, address = null,
    status = null, listingPriceMin = null, listingPriceMax = null,
    bedrooms = null, bathrooms = null, daysOnMarketMax = null,
    size = 25, resultIndex = 0, includePhotos = false
  } = params;

  const hasGeo = !!(mlsBoardCode || zip || (city && state) || (county && state) ||
    (latitude != null && longitude != null && radius != null) || (address && radius));
  if (!hasGeo) {
    return {
      success: false, kind: 'mls_listings',
      error: 'A geography is required: mlsBoardCode, zip, city+state, county+state, address+radius, or latitude+longitude+radius.'
    };
  }

  const body = {
    mls_board_code: mlsBoardCode, city, state, county, zip,
    latitude, longitude, radius, address, status,
    listing_price_min: listingPriceMin, listing_price_max: listingPriceMax,
    bedrooms, bathrooms, days_on_market_max: daysOnMarketMax,
    size, resultIndex, include_photos: includePhotos
  };
  for (const k of Object.keys(body)) if (body[k] === null) delete body[k];

  try {
    const data = await reapiRequest('/v3/MLSSearch', body);
    return {
      success: true, simulated: false, provenance: 'live', kind: 'mls_listings',
      resultCount: data.resultCount ?? (data.data || []).length,
      data: redactOwnerContact(data.data || data),
      license: licenseNotice(mlsBoardCode)
    };
  } catch (e) {
    return simulated('mls_listings', redactOwnerContact(SIM_LISTINGS), {
      license: licenseNotice(mlsBoardCode), note: `Simulated: ${e.message}`
    });
  }
}

/** Full listing detail for one MLS listing (POST /v3/MLSDetail). */
async function getListing({ listingId = null, mlsNumber = null, mlsBoardCode = null } = {}) {
  if (!listingId && !mlsNumber) {
    return { success: false, kind: 'mls_listing', error: 'listingId or mlsNumber is required.' };
  }
  const body = {};
  if (listingId) body.id = listingId;
  if (mlsNumber) body.mls_number = mlsNumber;
  if (mlsBoardCode) body.mls_board_code = mlsBoardCode;

  try {
    const data = await reapiRequest('/v3/MLSDetail', body);
    return {
      success: true, simulated: false, provenance: 'live', kind: 'mls_listing',
      data: redactOwnerContact(data.data || data), license: licenseNotice(mlsBoardCode)
    };
  } catch (e) {
    const row = SIM_LISTINGS.find(l => l.listingId === listingId || l.mlsNumber === mlsNumber) || SIM_LISTINGS[0];
    return simulated('mls_listing', redactOwnerContact(row), {
      license: licenseNotice(mlsBoardCode), note: `Simulated: ${e.message}`
    });
  }
}

/**
 * Which MLS board(s) cover a geography (POST /v3/MLSBoardCoverage).
 *
 * This is the piece the regional binding actually needed: "the tenant is in WA,
 * therefore its board is NWMLS" stops being a hard-coded table and becomes a
 * lookup against live coverage.
 */
async function boardCoverage({ state, mode = 'boards', groupByState = false, showAll = false, size = 500, cursor = null } = {}) {
  if (!state) return { success: false, kind: 'mls_boards', error: 'state is required.' };
  if (!['boards', 'zips', 'counties', 'cities'].includes(mode)) {
    return { success: false, kind: 'mls_boards', error: 'mode must be boards|zips|counties|cities.' };
  }
  const body = { state, mode, group_by_state: groupByState, show_all: showAll, size };
  if (cursor) body.cursor = cursor;

  try {
    const data = await reapiRequest('/v3/MLSBoardCoverage', body);
    return { success: true, simulated: false, provenance: 'live', kind: 'mls_boards', mode, data: data.data || data };
  } catch (e) {
    const st = String(state).toUpperCase();
    return simulated('mls_boards', SIM_BOARDS.filter(b => b.state === st), { mode, note: `Simulated: ${e.message}` });
  }
}

// ── Public-record property reads ─────────────────────────────────────────────

/** Property records search (POST /v2/PropertySearch). Owner contact is redacted. */
async function searchProperties(params = {}) {
  const { city = null, state = null, county = null, zip = null, address = null,
    latitude = null, longitude = null, radius = null,
    size = 25, resultIndex = 0, count = false } = params;

  const hasGeo = !!(zip || (city && state) || (county && state) || address ||
    (latitude != null && longitude != null && radius != null));
  if (!hasGeo) {
    return { success: false, kind: 'properties', error: 'A geography is required: zip, city+state, county+state, address, or latitude+longitude+radius.' };
  }

  const body = { city, state, county, zip, address, latitude, longitude, radius, size, resultIndex, count };
  for (const k of Object.keys(body)) if (body[k] === null) delete body[k];

  try {
    const data = await reapiRequest('/v2/PropertySearch', body);
    return {
      success: true, simulated: false, provenance: 'live', kind: 'properties',
      resultCount: data.resultCount ?? (data.data || []).length,
      data: redactOwnerContact(data.data || data)
    };
  } catch (e) {
    return simulated('properties', redactOwnerContact([SIM_PROPERTY]), { note: `Simulated: ${e.message}` });
  }
}

/** Single property record (POST /v2/PropertyDetail). Owner contact is redacted. */
async function getProperty({ id = null, address = null, apn = null, fips = null } = {}) {
  if (!id && !address && !(apn && fips)) {
    return { success: false, kind: 'property', error: 'id, address, or apn+fips is required.' };
  }
  const body = {};
  if (id) body.id = id;
  if (address) body.address = address;
  if (apn) body.apn = apn;
  if (fips) body.fips = fips;

  try {
    const data = await reapiRequest('/v2/PropertyDetail', body);
    return { success: true, simulated: false, provenance: 'live', kind: 'property', data: redactOwnerContact(data.data || data) };
  } catch (e) {
    return simulated('property', redactOwnerContact(SIM_PROPERTY), { note: `Simulated: ${e.message}` });
  }
}

// ── Skip trace (COMPLIANCE FLOOR) ────────────────────────────────────────────

/**
 * Resolve a property owner's personal contact details (POST /v2/SkipTrace).
 *
 * This is the one call in this connector that produces regulated personal data,
 * and it is deliberately the hardest to reach: it refuses without an explicit
 * approval even before the registry's own gate, it records the stated purpose on
 * the result so the reason for the lookup is auditable, and it returns the
 * vendor's DNC / litigator flags rather than stripping them, because the human
 * who acts on the result needs to see them.
 */
async function skipTrace({ address = null, city = null, state = null, zip = null,
  firstName = null, lastName = null, mailAddress = null, purpose = null, approved = false } = {}) {
  if (!approved) {
    return {
      success: false, requiresApproval: true, kind: 'skip_trace',
      message: 'Skip trace resolves a person\'s phone and email. It is regulated contact data (TCPA / state DNC) and requires explicit human approval (compliance floor).',
      pending: { address, city, state, zip, firstName, lastName }
    };
  }
  if (!purpose) {
    return {
      success: false, kind: 'skip_trace',
      error: 'A stated purpose is required for an approved skip trace — it is recorded with the result for audit.'
    };
  }
  if (!address && !(firstName && lastName)) {
    return { success: false, kind: 'skip_trace', error: 'address, or firstName + lastName, is required.' };
  }

  const body = { address, city, state, zip, first_name: firstName, last_name: lastName, mail_address: mailAddress };
  for (const k of Object.keys(body)) if (body[k] === null) delete body[k];

  try {
    const data = await reapiRequest('/v2/SkipTrace', body);
    return {
      success: true, simulated: false, provenance: 'live', kind: 'skip_trace',
      purpose, data: data.output || data.data || data,
      compliance: 'Verify DNC and litigator flags before any outbound contact. Consent and state solicitation rules are the tenant\'s obligation.'
    };
  } catch (e) {
    return {
      success: true, simulated: true, staged: true, kind: 'skip_trace', purpose,
      wouldTrace: body,
      note: `Simulated (${e.message}). In production this returns owner contact data after approval.`,
      compliance: 'Verify DNC and litigator flags before any outbound contact. Consent and state solicitation rules are the tenant\'s obligation.'
    };
  }
}

/**
 * Map a listing-change event to a CONVERGENCE-Ai task descriptor. Price and
 * status changes are routine; anything touching an executed contract lands
 * pending_approval, because that is money and a legal instrument.
 */
function mapListingEventToTask(event = {}) {
  const kind = event.event_type || event.event || 'unknown';
  const data = event.payload || event.data || {};
  const TABLE = {
    'listing.created': { type: 'mls.listing.review', requiresApproval: false, summary: 'Review new listing' },
    'listing.price_changed': { type: 'mls.listing.price_change', requiresApproval: false, summary: 'Review listing price change' },
    'listing.status_changed': { type: 'mls.listing.status_change', requiresApproval: false, summary: 'Review listing status change' },
    'listing.under_contract': { type: 'mls.listing.under_contract', requiresApproval: true, summary: 'Confirm listing under contract' },
    'listing.sold': { type: 'mls.listing.sold', requiresApproval: true, summary: 'Reconcile sold listing and commission' }
  };
  const entry = TABLE[kind] || { type: 'mls.event.unhandled', requiresApproval: true, summary: `Unhandled MLS event: ${kind}` };
  return {
    type: entry.type,
    status: entry.requiresApproval ? 'pending_approval' : 'proposed',
    actor: 'realestateapi-webhook',
    payload: { source: 'realestateapi', event: kind, summary: entry.summary, data: redactOwnerContact(data) },
    provenance: { source: 'realestateapi_webhook', event: kind }
  };
}

module.exports = {
  isRealEstateApiConfigured, baseUrl, mcpConfig,
  searchListings, getListing, boardCoverage,
  searchProperties, getProperty, skipTrace,
  redactOwnerContact, licenseNotice, mapListingEventToTask
};
