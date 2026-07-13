// Tech Classifier Integration Test
const tc = require('../lib/tech_classifier');

let passed = 0;
let failed = 0;

function test(label, fn) {
  try {
    fn();
    console.log(`  ✅ ${label}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${label}: ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

console.log('\n=== Tech Classifier — BuiltWith Parity Tests ===\n');

// ── detectTechnologies ─────────────────────────────────────────────────────
console.log('detectTechnologies():');

test('Detects Shopify from CDN URL in HTML', () => {
  const html = '<script src="https://cdn.shopify.com/s/files/1/theme.js"></script>';
  const result = tc.detectTechnologies(html, {}, '', '');
  assert(result.some(t => t.name === 'Shopify'), 'Shopify not detected');
});

test('Detects WordPress from wp-content path', () => {
  const html = '<link rel="stylesheet" href="/wp-content/themes/style.css">';
  const result = tc.detectTechnologies(html, {}, '', '');
  assert(result.some(t => t.name === 'WordPress'), 'WordPress not detected');
});

test('Detects Google Analytics 4 from gtag config', () => {
  const html = "<script>gtag('config', 'G-ABC123XYZ');</script>";
  const result = tc.detectTechnologies(html, {}, '', '');
  assert(result.some(t => t.name === 'Google Analytics 4'), 'GA4 not detected');
});

test('Detects Meta Pixel from connect.facebook.net', () => {
  const html = '<script src="https://connect.facebook.net/en_US/fbevents.js"></script>';
  const result = tc.detectTechnologies(html, {}, '', '');
  assert(result.some(t => t.name === 'Meta Pixel'), 'Meta Pixel not detected');
});

test('Detects Google Tag Manager from GTM script', () => {
  const html = '<script src="https://www.googletagmanager.com/gtm.js?id=GTM-XXXXX"></script>';
  const result = tc.detectTechnologies(html, {}, '', '');
  assert(result.some(t => t.name === 'Google Tag Manager'), 'GTM not detected');
});

test('Detects LinkedIn Insight Tag from snap.licdn.com', () => {
  const html = '<script src="https://snap.licdn.com/li.lms-analytics/insight.min.js"></script>';
  const result = tc.detectTechnologies(html, {}, '', '');
  assert(result.some(t => t.name === 'LinkedIn Insight Tag'), 'LinkedIn Insight Tag not detected');
});

test('Detects Calendly from embed URL', () => {
  const html = '<link href="https://calendly.com/assets/external/widget.css" rel="stylesheet">';
  const result = tc.detectTechnologies(html, {}, '', '');
  assert(result.some(t => t.name === 'Calendly'), 'Calendly not detected');
});

test('Detects Google Fonts from CDN', () => {
  const html = '<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400" rel="stylesheet">';
  const result = tc.detectTechnologies(html, {}, '', '');
  assert(result.some(t => t.name === 'Google Fonts'), 'Google Fonts not detected');
});

test('Detects Cloudflare from response headers', () => {
  const result = tc.detectTechnologies('', { 'cf-ray': '7abc123', 'cf-cache-status': 'HIT' }, '', '');
  assert(result.some(t => t.name === 'Cloudflare'), 'Cloudflare not detected from headers');
});

test('Detects Schema.org JSON-LD from script block', () => {
  const html = '<script type="application/ld+json">{"@context": "https://schema.org", "@type": "LegalService"}</script>';
  const result = tc.detectTechnologies(html, {}, '', '');
  assert(result.some(t => t.name === 'Schema.org'), 'Schema.org not detected');
});

test('Detects Stripe from js.stripe.com script', () => {
  const html = '<script src="https://js.stripe.com/v3/"></script>';
  const result = tc.detectTechnologies(html, {}, '', '');
  assert(result.some(t => t.name === 'Stripe'), 'Stripe not detected');
});

test('Detects Trustpilot from widget script', () => {
  const html = '<div class="trustpilot-widget" data-template-id="5419b6a8b0d04a076446a9ad"></div>';
  const result = tc.detectTechnologies(html, {}, '', '');
  assert(result.some(t => t.name === 'Trustpilot'), 'Trustpilot not detected');
});

test('Returns isPaid=false for WordPress', () => {
  const html = '<link href="/wp-content/style.css">';
  const result = tc.detectTechnologies(html, {}, '', '');
  const wp = result.find(t => t.name === 'WordPress');
  assert(wp && wp.isPaid === false, 'WordPress isPaid should be false');
});

test('Returns confidence between 0 and 1', () => {
  const html = '<script src="https://cdn.shopify.com/s/files/theme.js"></script>';
  const result = tc.detectTechnologies(html, {}, '', '');
  result.forEach(t => {
    assert(t.confidence >= 0 && t.confidence <= 1, `${t.name} has invalid confidence: ${t.confidence}`);
  });
});

test('Returns detectedAt in YYYY-MM-DD format', () => {
  const html = '/wp-content/themes/';
  const result = tc.detectTechnologies(html, {}, '', '');
  result.forEach(t => {
    assert(/^\d{4}-\d{2}-\d{2}$/.test(t.detectedAt), `${t.name} has invalid detectedAt: ${t.detectedAt}`);
  });
});

// ── extractContactIntel ────────────────────────────────────────────────────
console.log('\nextractContactIntel():');

test('Extracts phone number from text', () => {
  const { phones } = tc.extractContactIntel('call us at (702) 555-0182 today', '');
  assert(phones.length > 0, 'No phone extracted');
});

test('Extracts email from text', () => {
  const { emails } = tc.extractContactIntel('email us at info@lobolaw.com', '');
  assert(emails.some(e => e.includes('lobolaw.com')), 'Email not extracted');
});

test('Filters noreply emails', () => {
  const { emails } = tc.extractContactIntel('noreply@example.com no-reply@test.com info@realsite.com', '');
  assert(!emails.some(e => e.startsWith('noreply')), 'noreply email not filtered');
});

test('Extracts LinkedIn social URL', () => {
  const { socialProfiles } = tc.extractContactIntel('https://linkedin.com/company/lobo-law', '');
  assert(socialProfiles.LinkedIn, 'LinkedIn URL not extracted');
});

test('Extracts Facebook social URL', () => {
  const { socialProfiles } = tc.extractContactIntel('https://facebook.com/lobolawlv', '');
  assert(socialProfiles.Facebook, 'Facebook URL not extracted');
});

// ── inferTrafficSignals ────────────────────────────────────────────────────
console.log('\ninferTrafficSignals():');

test('Returns Local Business tier for small page count', () => {
  const ts = tc.inferTrafficSignals('example.com', ['/', '/about', '/contact'], 'Unknown');
  assert(ts.trafficTier === 'Local Business', `Expected Local Business, got: ${ts.trafficTier}`);
});

test('Returns Regional SMB tier for medium page count with CDN', () => {
  const ts = tc.inferTrafficSignals('example.com', ['/', '/about', '/contact'], 'Cloudflare');
  assert(ts.trafficTier === 'Regional SMB', `Expected Regional SMB, got: ${ts.trafficTier}`);
});

test('Returns estimatedMonthlyVisits string', () => {
  const ts = tc.inferTrafficSignals('example.com', ['/', '/about'], 'Unknown');
  assert(typeof ts.estimatedMonthlyVisits === 'string' && ts.estimatedMonthlyVisits.includes('–'), 'estimatedMonthlyVisits format incorrect');
});

test('Returns sitemapPageCount equal to pages array length', () => {
  const pages = ['/', '/a', '/b', '/c', '/d'];
  const ts = tc.inferTrafficSignals('example.com', pages, 'Unknown');
  assert(ts.sitemapPageCount === pages.length, 'sitemapPageCount mismatch');
});

// ── groupByCategory ─────────────────────────────────────────────────────────
console.log('\ngroupByCategory():');

test('Groups technologies by category', () => {
  const techs = [
    { name: 'WordPress', category: 'CMS' },
    { name: 'Shopify', category: 'E-Commerce' },
    { name: 'GA4', category: 'Analytics' }
  ];
  const groups = tc.groupByCategory(techs);
  assert(groups['CMS'] && groups['CMS'].length === 1, 'CMS group incorrect');
  assert(groups['Analytics'] && groups['Analytics'].length === 1, 'Analytics group incorrect');
});

// Summary
console.log(`\n${'─'.repeat(50)}`);
console.log(`Total: ${passed + failed} tests | ✅ ${passed} passed | ❌ ${failed} failed`);
if (failed > 0) process.exit(1);
