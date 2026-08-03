/**
 * Business Location & Location-Sharing Consent (LOC)
 * ==================================================
 * Several capabilities are region-bound — MLS board coverage most obviously, but
 * also regulatory search (state/local statutes) and any vertical whose practices
 * differ by jurisdiction. The system therefore needs to know where the business
 * operates, and it must get there honestly.
 *
 * Two things are deliberately separate:
 *
 *   1. BUSINESS ADDRESS is REQUIRED at onboarding (LOC-01). It is a business fact
 *      about a legal entity, the tenant declares it, and nothing has to be
 *      inferred to obtain it. It is the authoritative source.
 *
 *   2. DEVICE-DERIVED LOCATION (GPS, IP) is OPTIONAL and CONSENTED (LOC-02).
 *      GPS is a person's position and an IP address is personal data under GDPR
 *      and several US state statutes. So the tenant is ASKED, per method, by a
 *      named human with a company-domain identity; the answer is recorded with
 *      who granted it and when; and consent is revocable.
 *
 * Default is DENY. An un-answered onboarding yields no device-derived location —
 * correlation refuses a method it was not granted, rather than falling back to it
 * quietly. That ordering matters: the failure mode of "just use the IP" is a
 * system that silently profiles its users' whereabouts.
 *
 * Precedence when correlating: address > gps > ip. The declared business address
 * outranks a device reading, because a broker sitting in an airport is still a
 * broker licensed in their home state.
 */

const CONSENT_METHODS = ['gps', 'ip'];
const ALL_METHODS = ['address', 'gps', 'ip'];

/**
 * The disclosure the entity is shown at onboarding. Returned as data so the hub,
 * the installer and the docs all render the SAME question — a consent prompt that
 * differs between surfaces is not a consent prompt.
 */
function locationDisclosure() {
  return {
    required: {
      field: 'businessAddress',
      prompt: 'What is your business address?',
      why: 'Region-bound capabilities (MLS board coverage, state and local regulatory search, jurisdictional practices) resolve from this. It is required to complete onboarding.',
      optional: false
    },
    optional: [
      {
        method: 'gps',
        prompt: 'May we use this device\'s GPS to confirm the operating region?',
        why: 'Confirms the region when staff operate away from the registered address, and resolves the correct local MLS board for field work.',
        data: 'Approximate coordinates, used to derive a region only. Not stored as a track or history.',
        default: 'deny'
      },
      {
        method: 'ip',
        prompt: 'May we use this connection\'s IP address to confirm the operating region?',
        why: 'A coarse fallback when no address or GPS is available.',
        data: 'The IP address is personal data. It is used to derive a region and is not retained for profiling.',
        default: 'deny'
      }
    ],
    notes: [
      'The business address alone is enough to operate. Both optional methods may be declined.',
      'Consent is per method, is recorded with the granting human and timestamp, and can be revoked at any time.',
      'Revocation takes effect immediately: a revoked method is refused on the next correlation.'
    ]
  };
}

/**
 * Record a consent decision. `grantedBy` must be a company-domain identity — the
 * same standard the rest of HITL uses, because consenting on behalf of a business
 * is an act of authority, not a checkbox.
 *
 * @returns { ok, consent } | { ok:false, error }
 */
function recordConsent({ tenantId, methods = {}, grantedBy = null, at = null } = {}) {
  if (!tenantId) return { ok: false, error: 'tenantId is required.' };
  if (!grantedBy || !/@/.test(String(grantedBy))) {
    return { ok: false, error: 'A named human identity (company-domain email) must record the location-sharing decision.' };
  }

  const decisions = {};
  for (const m of CONSENT_METHODS) {
    // Absent === denied. Consent is never inferred from silence.
    decisions[m] = methods[m] === true;
  }

  return {
    ok: true,
    consent: {
      tenantId,
      methods: decisions,
      grantedBy,
      at: at || new Date().toISOString(),
      revoked: [],
      version: 1
    }
  };
}

/** Revoke one method. Immediate: the next correlation refuses it. */
function revokeConsent(consent, method, { by = null, at = null } = {}) {
  if (!consent || !CONSENT_METHODS.includes(method)) return consent;
  const next = JSON.parse(JSON.stringify(consent));
  next.methods[method] = false;
  next.revoked.push({ method, by: by || null, at: at || new Date().toISOString() });
  return next;
}

function hasConsent(consent, method) {
  if (method === 'address') return true; // Declared by the tenant; not device-derived.
  if (!consent || !consent.methods) return false;
  return consent.methods[method] === true;
}

// ── IP handling ──────────────────────────────────────────────────────────────

/**
 * Private, loopback, link-local and CGNAT ranges carry no geographic meaning.
 * Treating one as a location produces a confident wrong answer, which is worse
 * than no answer.
 */
function isPrivateIp(ip) {
  const s = String(ip || '').trim();
  if (!s) return true;
  if (s === '::1' || s.toLowerCase().startsWith('fc') || s.toLowerCase().startsWith('fd')) return true;
  const m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return true;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

/**
 * Resolve a region from an IP. Deliberately a SEAM, not a guess: without an
 * injected resolver (or a configured service) this returns unresolved rather than
 * inventing a region. Geo-IP is approximate at the best of times and there is no
 * defensible way to fake it.
 */
async function resolveIpRegion(ip, { resolver = null } = {}) {
  if (!ip) return { region: null, resolved: false, reason: 'no_ip' };
  if (isPrivateIp(ip)) return { region: null, resolved: false, reason: 'private_or_reserved_ip' };
  if (typeof resolver !== 'function') {
    return { region: null, resolved: false, reason: 'no_geoip_resolver_configured' };
  }
  try {
    const out = await resolver(ip);
    const region = out && out.region ? String(out.region).toUpperCase() : null;
    return region ? { region, resolved: true } : { region: null, resolved: false, reason: 'resolver_returned_no_region' };
  } catch (e) {
    return { region: null, resolved: false, reason: `resolver_error: ${e.message}` };
  }
}

// ── Correlation ──────────────────────────────────────────────────────────────

/**
 * Correlate an operating region from whatever the tenant has actually permitted.
 *
 * Every method that was offered is reported in `attempted` with why it was or was
 * not used, so the result explains itself: a region derived from an IP and a
 * region read off the company's own letterhead are not the same claim, and the
 * caller should be able to tell them apart.
 *
 * @returns { region, method, confidence, attempted[], consentRecorded }
 */
async function correlateLocation({ businessAddress = null, gps = null, ip = null, consent = null, resolver = null } = {}) {
  const regionalSources = require('./regional_sources');
  const attempted = [];

  // 1. Declared business address — authoritative, no consent needed.
  if (businessAddress) {
    const det = regionalSources.detectRegion({ address: businessAddress });
    attempted.push({ method: 'address', used: true, resolved: !!det.region });
    if (det.region) {
      return {
        region: det.region, method: 'address', confidence: 'high',
        attempted, consentRecorded: !!consent,
        note: 'Region derived from the declared business address.'
      };
    }
  } else {
    attempted.push({ method: 'address', used: false, reason: 'not_provided' });
  }

  // 2. GPS — consented only.
  if (gps) {
    if (!hasConsent(consent, 'gps')) {
      attempted.push({ method: 'gps', used: false, reason: 'consent_not_granted' });
    } else {
      const det = regionalSources.detectRegion({ gps });
      attempted.push({ method: 'gps', used: true, resolved: !!det.region });
      if (det.region) {
        return {
          region: det.region, method: 'gps', confidence: 'medium',
          attempted, consentRecorded: true,
          note: 'Region derived from device GPS with recorded consent.'
        };
      }
    }
  } else {
    attempted.push({ method: 'gps', used: false, reason: 'not_provided' });
  }

  // 3. IP — consented only, and coarse.
  if (ip) {
    if (!hasConsent(consent, 'ip')) {
      attempted.push({ method: 'ip', used: false, reason: 'consent_not_granted' });
    } else {
      const res = await resolveIpRegion(ip, { resolver });
      attempted.push({ method: 'ip', used: true, resolved: res.resolved, reason: res.reason || null });
      if (res.region) {
        return {
          region: res.region, method: 'ip', confidence: 'low',
          attempted, consentRecorded: true,
          note: 'Region derived from IP with recorded consent. Coarse — confirm against the business address.'
        };
      }
    }
  } else {
    attempted.push({ method: 'ip', used: false, reason: 'not_provided' });
  }

  return {
    region: null, method: null, confidence: 'none', attempted,
    consentRecorded: !!consent,
    note: 'No region could be correlated from the permitted methods. Region-bound capabilities stay unconfigured until one resolves.'
  };
}

module.exports = {
  CONSENT_METHODS, ALL_METHODS,
  locationDisclosure, recordConsent, revokeConsent, hasConsent,
  isPrivateIp, resolveIpRegion, correlateLocation
};
