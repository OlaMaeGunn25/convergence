/**
 * Rigorous End-to-End Integration & Data Validation Test Suite
 * Designed to root out any subpar, generic, or misaligned outputs.
 */

const http = require('http');

let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`\x1b[32m✔ PASS:\x1b[0m ${message}`);
    passedAssertions++;
  } else {
    console.error(`\x1b[31m✘ FAIL:\x1b[0m ${message}`);
    failedAssertions++;
  }
}

/**
 * Helper to make a HTTP POST request to the running server
 */
function queryAuditApi(domain) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ domain });
    
    const options = {
      hostname: 'localhost',
      port: 3003,
      path: '/api/audit',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse API response JSON: ${e.message}. Raw output: ${data}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`HTTP request failed. Is the server running on port 3003? Details: ${e.message}`));
    });

    req.write(postData);
    req.end();
  });
}

async function runE2eTests() {
  console.log(`================================================================`);
  console.log(`🧪 COMMENCING RIGOROUS E2E AUDIT DATA VALIDATION SWEEP...`);
  console.log(`================================================================\n`);

  const testCases = [
    {
      domain: 'smartoptimalsolutions.com',
      expectedVertical: 'Sustainable Infrastructure & Green Tech',
      expectedName: 'Smart Optimal Solutions',
      specificKeyword: 'IoT Edge Security'
    },
    {
      domain: 'vintage-brew.com',
      expectedVertical: 'E-Commerce & Retail',
      expectedName: 'Vintage Brew',
      specificKeyword: 'E-Commerce Automated Marketing'
    },
    {
      domain: 'apex-tech.com',
      expectedVertical: 'Technology & SaaS',
      expectedName: 'Apex Tech',
      specificKeyword: 'WordPress' // WordPress pitch triggers because default mock uses WordPress
    },
    {
      domain: 'smiles-dental.net',
      expectedVertical: 'Healthcare & Wellness',
      expectedName: 'Smiles Dental',
      specificKeyword: 'AI Support Helpdesk'
    }
  ];

  for (const tc of testCases) {
    console.log(`----------------------------------------------------------------`);
    console.log(`🔍 Auditing Target: ${tc.domain}`);
    console.log(`----------------------------------------------------------------`);

    try {
      const response = await queryAuditApi(tc.domain);
      
      // 1. Basic Envelope Checks
      assert(response.success === true, 'Envelope reports success');
      assert(typeof response.timestamp === 'string', 'Valid ISO timestamp present');
      assert(response.domain === tc.domain, 'Correct domain mapped back');
      assert(response.vertical === tc.expectedVertical, `Vertical categorized accurately as: ${response.vertical}`);
      assert(response.businessName.includes(tc.expectedName) || response.businessName.includes('SOS'), `Dynamic brand name matches: ${response.businessName}`);

      // 2. Technical SWOT / systems-evaluation metrics checks
      //    (Scourer public-records + sales-pitch checks removed — ASES sales
      //    functions, not systems evaluation. See docs/AUDITOR_REFRAME.md.)
      const metrics = response.analyzerData.metrics;
      assert(metrics.overallHealth > 0 && metrics.overallHealth <= 100, `Health score resolved in range: ${metrics.overallHealth}`);
      assert(response.analyzerData.swot.strengths.length > 0, 'Strengths checklist populated');
      assert(response.analyzerData.swot.weaknesses.length > 0, 'Weaknesses checklist populated');

      // 3. Workforce Upskilling Checks
      const workforce = response.workforceData;
      assert(workforce.summary.totalStaffAudited > 0, `Upskilling audit profiles ${workforce.summary.totalStaffAudited} employees`);
      assert(workforce.roles.length > 0, 'Upskilling roles mapping matrix successfully generated');
      assert(workforce.hiringStrategy.length > 0, 'Forward-looking AI recruitment adjustments calculated');

    } catch (e) {
      assert(false, `E2E audit run crashed for ${tc.domain}: ${e.message}`);
    }
    console.log();
  }

  console.log(`================================================================`);
  console.log(`📊 E2E SWEEP VERIFICATION METRICS:`);
  console.log(`================================================================`);
  console.log(`📈 Passed Assertions: \x1b[32m${passedAssertions}\x1b[0m`);
  console.log(`📉 Failed Assertions: ${failedAssertions > 0 ? `\x1b[31m${failedAssertions}\x1b[0m` : `\x1b[32m0 (PERFECT COMPLIANCE)\x1b[0m`}`);
  console.log(`================================================================`);

  if (failedAssertions > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runE2eTests();
