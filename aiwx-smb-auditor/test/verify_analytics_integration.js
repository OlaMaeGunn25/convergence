const http = require('http');

function postJSON(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(body);
    
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(data) }));
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function getHTTP(url, parseJSON = false) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: parseJSON ? JSON.parse(data) : data
        });
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 Running Analytics & GA4 Integration Verification Tests...');
  console.log('================================================================');
  
  try {
    // 1. Verify social_media_hub.html contains the analytics tracker link
    const hubRes = await getHTTP('http://localhost:3003/social_media_hub.html');
    if (hubRes.statusCode === 200 && hubRes.body.includes('analytics_tracker.js')) {
      console.log('✔ PASS: social_media_hub.html references analytics_tracker.js');
    } else {
      throw new Error('FAIL: social_media_hub.html missing analytics_tracker.js script tag');
    }

    // 2. Verify analytics_tracker.js is served correctly
    const trackerRes = await getHTTP('http://localhost:3003/analytics_tracker.js');
    if (trackerRes.statusCode === 200 && trackerRes.body.includes('cta_click_proposal')) {
      console.log('✔ PASS: analytics_tracker.js serves tracking script successfully');
    } else {
      throw new Error('FAIL: analytics_tracker.js failed to serve tracker script');
    }

    // 3. Verify /api/analytics-config returns measurementId
    const configRes = await getHTTP('http://localhost:3003/api/analytics-config', true);
    if (configRes.statusCode === 200 && configRes.body.success && configRes.body.measurementId === 'G-V2Z3W6F8G2') {
      console.log('✔ PASS: /api/analytics-config returns correct GA4 Measurement ID');
    } else {
      throw new Error('FAIL: /api/analytics-config endpoint returned unexpected configuration');
    }

    // 4. Test tracking a landing pageview event
    const landingRes = await postJSON('http://localhost:3003/api/track-event', {
      type: 'pageview',
      campaign: 'consultancy_sprints',
      source: 'linkedin',
      medium: 'social'
    });
    if (landingRes.statusCode === 200 && landingRes.body.success) {
      console.log('✔ PASS: /api/track-event records landing pageviews successfully');
    } else {
      throw new Error('FAIL: /api/track-event failed to record pageview');
    }

    // 5. Test tracking a CTA conversion event
    const ctaRes = await postJSON('http://localhost:3003/api/track-event', {
      type: 'cta_click_audit',
      campaign: 'consultancy_sprints',
      source: 'linkedin',
      medium: 'social',
      label: 'Analyze Footprint',
      value: 1
    });
    if (ctaRes.statusCode === 200 && ctaRes.body.success) {
      console.log('✔ PASS: /api/track-event records CTA clicks successfully');
    } else {
      throw new Error('FAIL: /api/track-event failed to record CTA click event');
    }

    // 6. Verify /api/analytics aggregates and reports the tracked local events
    const analyticsRes = await getHTTP('http://localhost:3003/api/analytics', true);
    if (analyticsRes.statusCode === 200 && analyticsRes.body.success) {
      const summary = analyticsRes.body.summary;
      const campaigns = analyticsRes.body.campaigns;
      
      if (summary.clicks >= 1 && summary.conversions >= 1) {
        console.log('✔ PASS: /api/analytics successfully aggregates logged clicks and conversions');
      } else {
        throw new Error('FAIL: /api/analytics summary stats empty or failed to aggregate logs');
      }
      
      const ourCampaign = campaigns.find(c => c.campaign.includes('consultancy_sprints'));
      if (ourCampaign && ourCampaign.clicks >= 1 && ourCampaign.conversions >= 1) {
        console.log('✔ PASS: /api/analytics maps and returns campaign list with UTM details');
      } else {
        throw new Error('FAIL: /api/analytics campaigns array missing our tracked UTM details');
      }
    } else {
      throw new Error('FAIL: /api/analytics returned unsuccessful status');
    }

    console.log('================================================================');
    console.log('📊 Verification Results: All integration tests passed successfully!');
    console.log('================================================================');
  } catch (err) {
    console.error('❌ TEST FAILURE:', err.message);
    process.exit(1);
  }
}

runTests();
