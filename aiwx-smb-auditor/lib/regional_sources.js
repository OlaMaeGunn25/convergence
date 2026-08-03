/**
 * Regional / Local Data Sources (REG)
 * ===================================
 * Some verticals depend on LOCAL/REGIONAL data sources — most notably real-estate
 * MLS, which is region-specific. This module detects the tenant's region (from GPS,
 * a postal address, or an explicit region), resolves the correct local source, and
 * proposes it for HITL-approved connection (REG-01/02/03). Real-estate MLS is
 * connected via the RESO Web API standard (or a RESO aggregator: Trestle / MLS Grid
 * / Bridge). Deterministic + offline (a live geocoder plugs in behind detectRegion).
 */

const realEstateApi = require('./connectors/realestateapi');

// Verticals with local/regional data dependencies.
const VERTICAL_REGIONAL_SOURCES = {
  realestate: {
    type: 'MLS', standard: 'RESO Web API', connectorId: 'reso_web_api',
    // One key, nationwide, with a live board-coverage lookup — the path that works
    // before the tenant has negotiated a per-board data licence.
    aggregatorConnectorId: 'realestateapi', requiresRegion: true,
    note: 'MLS access is region-specific — connect the tenant\'s local MLS via the RESO Web API, a RESO aggregator, or the RealEstateAPI aggregate feed.'
  }
};

// Coarse US-state bounding boxes for GPS → region (illustrative subset; a live
// reverse-geocoder replaces this at the same seam).
const STATE_BBOX = {
  CA: { minLat: 32.5, maxLat: 42.0, minLng: -124.5, maxLng: -114.1 },
  TX: { minLat: 25.8, maxLat: 36.5, minLng: -106.7, maxLng: -93.5 },
  NY: { minLat: 40.5, maxLat: 45.02, minLng: -79.8, maxLng: -71.8 },
  FL: { minLat: 24.4, maxLat: 31.0, minLng: -87.7, maxLng: -80.0 },
  WA: { minLat: 45.5, maxLat: 49.0, minLng: -124.8, maxLng: -116.9 },
  IL: { minLat: 37.0, maxLat: 42.6, minLng: -91.6, maxLng: -87.0 }
};

// Representative regional MLS per region (illustrative — extend per market).
const MLS_BY_REGION = {
  CA: { mls: 'California Regional MLS (CRMLS)', provider: 'trestle', accessMethod: 'RESO Web API' },
  TX: { mls: 'North Texas Real Estate Information Systems (NTREIS)', provider: 'mls_grid', accessMethod: 'RESO Web API' },
  NY: { mls: 'OneKey MLS', provider: 'bridge', accessMethod: 'RESO Web API' },
  FL: { mls: 'Stellar MLS', provider: 'trestle', accessMethod: 'RESO Web API' },
  WA: { mls: 'Northwest MLS (NWMLS)', provider: 'reso_web_api', accessMethod: 'RESO Web API' },
  IL: { mls: 'Midwest Real Estate Data (MRED)', provider: 'mls_grid', accessMethod: 'RESO Web API' }
};

/** Resolve the tenant's region from an explicit value, a postal address, or GPS. */
function detectRegion({ gps = null, address = null, region = null } = {}) {
  if (region && STATE_BBOX[String(region).toUpperCase()]) return { region: String(region).toUpperCase(), source: 'explicit' };
  if (region) return { region: String(region).toUpperCase(), source: 'explicit' };
  if (address) {
    const m = String(address).toUpperCase().match(/\b([A-Z]{2})\b(?:\s+\d{5}(?:-\d{4})?)?\s*$/) || String(address).toUpperCase().match(/,\s*([A-Z]{2})\b/);
    if (m && STATE_BBOX[m[1]]) return { region: m[1], source: 'address' };
  }
  if (gps && typeof gps.lat === 'number' && typeof gps.lng === 'number') {
    for (const [st, b] of Object.entries(STATE_BBOX)) {
      if (gps.lat >= b.minLat && gps.lat <= b.maxLat && gps.lng >= b.minLng && gps.lng <= b.maxLng) return { region: st, source: 'gps' };
    }
  }
  return { region: null, source: 'unresolved' };
}

function mlsForRegion(region) {
  const r = String(region || '').toUpperCase();
  const m = MLS_BY_REGION[r];
  return m ? Object.assign({ region: r }, m) : null;
}

/**
 * Resolve the MLS board(s) covering a region from live coverage data, falling
 * back to the static table when the aggregate feed is unconfigured.
 *
 * The static MLS_BY_REGION table names ONE representative board per state, which
 * is wrong in most states — Washington alone has several. This is the seam where
 * that guess becomes an answer.
 */
async function boardsForRegionLive(region) {
  const r = String(region || '').toUpperCase();
  if (!r) return { region: null, boards: [], source: 'unresolved' };

  const res = await realEstateApi.boardCoverage({ state: r, mode: 'boards' });
  if (res && res.success && Array.isArray(res.data) && res.data.length) {
    return {
      region: r,
      boards: res.data.map(b => ({
        code: b.mls_board_code || b.code || null,
        name: b.mls_board_name || b.name || null,
        listingCount: b.listingCount ?? null
      })),
      source: res.simulated ? 'simulated' : 'live',
      provenance: res.provenance || (res.simulated ? 'simulated' : 'live')
    };
  }

  const fallback = mlsForRegion(r);
  return {
    region: r,
    boards: fallback ? [{ code: null, name: fallback.mls, listingCount: null }] : [],
    source: 'static_table',
    provenance: 'static',
    note: 'Live board coverage unavailable — showing the representative board from the static regional table.'
  };
}

/**
 * Recommend the regional data sources to connect for a vertical + resolved region.
 * Sources are proposed for HITL approval before binding (REG-03).
 */
function recommendSources({ vertical, region = null, gps = null, address = null } = {}) {
  const v = String(vertical || '').toLowerCase();
  const spec = VERTICAL_REGIONAL_SOURCES[v];
  if (!spec) return { vertical: v, regional: false, sources: [] };
  const det = detectRegion({ gps, address, region });
  const mls = det.region ? mlsForRegion(det.region) : null;
  const sources = mls ? [{
    type: spec.type, connectorId: spec.connectorId, provider: mls.provider,
    name: mls.mls, region: det.region, accessMethod: mls.accessMethod,
    requiresApprovalToConnect: true
  }] : [];

  // The aggregate feed is offered alongside the direct board feed whenever a
  // region resolves. It needs one key instead of a per-board data licence, so it
  // is usually what a tenant can actually connect on day one — but it is still a
  // proposal, not a binding (REG-03).
  if (det.region && spec.aggregatorConnectorId) {
    sources.push({
      type: spec.type, connectorId: spec.aggregatorConnectorId, provider: 'realestateapi',
      name: 'RealEstateAPI aggregate MLS feed', region: det.region,
      accessMethod: 'REST + MCP', aggregate: true,
      requiresApprovalToConnect: true,
      note: 'Nationwide aggregate feed. Board coverage for this region can be confirmed live via mls_board_coverage.'
    });
  }
  return {
    vertical: v, regional: true, standard: spec.standard,
    detectedRegion: det.region, regionSource: det.source, sources,
    note: det.region ? spec.note : `${spec.note} Region unresolved — provide GPS or an address to surface the local MLS.`
  };
}

module.exports = { detectRegion, mlsForRegion, boardsForRegionLive, recommendSources, VERTICAL_REGIONAL_SOURCES, MLS_BY_REGION, STATE_BBOX };
