const http = require('http');

function testEndpoint(path, method = 'GET', postData = null) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3003,
      path: path,
      method: method,
      headers: {}
    };

    if (postData) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          path,
          statusCode: res.statusCode,
          success: res.statusCode === 200,
          dataLength: data.length
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        path,
        statusCode: 0,
        success: false,
        error: err.message
      });
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runSmokeTest() {
  console.log('================================================================');
  console.log('🧪 RUNNING SYSTEM SMOKE TEST...');
  console.log('================================================================');

  const targets = [
    { path: '/', method: 'GET' },
    { path: '/product.html', method: 'GET' },
    { path: '/social_media_hub.html', method: 'GET' },
    { path: '/admin/smb-auditor.html', method: 'GET' },
    { path: '/outreach_ui.js', method: 'GET' },
    { path: '/analytics_tracker.js', method: 'GET' },
    { path: '/posts_data.json', method: 'GET' },
    { path: '/api/posts-library', method: 'GET' },
    { path: '/api/analytics-config', method: 'GET' },
    { path: '/api/analytics', method: 'GET' },
    { path: '/api/track-event', method: 'POST', postData: JSON.stringify({ type: 'pageview' }) }
  ];

  let passed = 0;
  let failed = 0;

  for (const target of targets) {
    const result = await testEndpoint(target.path, target.method, target.postData);
    if (result.success) {
      console.log(`\x1b[32m✔ SUCCESS:\x1b[0m ${target.method} ${target.path} (Status ${result.statusCode}, Size ${result.dataLength} bytes)`);
      passed++;
    } else {
      console.error(`\x1b[31m✘ FAILURE:\x1b[0m ${target.method} ${target.path} - Status: ${result.statusCode}, Error: ${result.error || 'Server responded with error status'}`);
      failed++;
    }
  }

  console.log('================================================================');
  console.log(`📊 SMOKE TEST SUMMARY: Passed: ${passed}, Failed: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSmokeTest();
