require('dotenv').config();
const fs = require('fs');
const path = require('path');

const { scrapeDomain } = require('./lib/scraper');
const { scourBusiness } = require('./lib/scourer');
const { analyzeFootprint } = require('./lib/analyzer');
const { analyzeWorkforce } = require('./lib/workforce');

// Read the benchmark.html file content
const htmlPath = path.join(__dirname, 'public', 'benchmark.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Mock DOM environment
const documentMock = {
  elements: {},
  getElementById(id) {
    if (!this.elements[id]) {
      this.elements[id] = {
        textContent: '',
        innerHTML: '',
        style: {
          setProperty(name, val) {}
        },
        appendChild(child) {},
        classList: {
          add(cls) {},
          remove(cls) {}
        },
        removeAttribute(attr) {},
        setAttribute(attr, val) {}
      };
    }
    return this.elements[id];
  },
  querySelector(selector) {
    if (!this.elements[selector]) {
      this.elements[selector] = {
        textContent: '',
        innerHTML: ''
      };
    }
    return this.elements[selector];
  },
  createElement(tag) {
    return {
      textContent: '',
      innerHTML: '',
      style: {
        setProperty(name, val) {}
      },
      appendChild(child) {},
      classList: {
        add(cls) {},
        remove(cls) {}
      },
      removeAttribute(attr) {},
      setAttribute(attr, val) {}
    };
  }
};

// Global variables needed by the script
global.document = documentMock;
global.window = {
  location: { hostname: 'localhost', search: '' },
  addEventListener(event, callback) {}
};
global.navigator = {
  clipboard: {
    writeText(text) { return Promise.resolve(); }
  }
};

// Extract functions from the HTML
const scriptRegex = /<script>([\s\S]*?)<\/script>/gi;
let match;
let jsCode = '';
while ((match = scriptRegex.exec(htmlContent)) !== null) {
  jsCode += match[1] + '\n';
}

// Clean up browser-specific things
jsCode = jsCode.replace(/localStorage\.getItem/g, '(() => null)');
jsCode = jsCode.replace(/localStorage\.setItem/g, '(() => null)');
jsCode = jsCode.replace(/window\.print\(\)/g, '(() => null)');

// Run live audit pipeline in Node
async function runLiveTest() {
  const domain = 'lvcriminallawfirm.com';
  const apiKey = process.env.FIRECRAWL_API_KEY;
  
  console.log(`Executing live scrape & scour for ${domain}...`);
  try {
    const scrapedData = await scrapeDomain(domain, apiKey);
    const teamNames = (scrapedData.rawTeamData || []).map(m => m.name);
    const scourerData = await scourBusiness(
      scrapedData.domain, 
      scrapedData.businessName, 
      scrapedData.vertical, 
      apiKey,
      teamNames
    );
    const analyzerData = analyzeFootprint(scrapedData);
    const workforceData = analyzeWorkforce(scrapedData);
    
    const auditPackage = {
      success: true,
      timestamp: new Date().toISOString(),
      domain: scrapedData.domain,
      businessName: scrapedData.businessName,
      vertical: scrapedData.vertical,
      isSimulated: false,
      scrapedData: {
        technologies: scrapedData.technologies,
        subdomains: scrapedData.subdomains,
        metaData: scrapedData.metaData,
        scrapedPages: scrapedData.scrapedPages,
        firewallAudit: scrapedData.firewallAudit
      },
      scourerData,
      analyzerData,
      workforceData
    };
    
    console.log("Server-side audit package compiled successfully. Evaluating client JS...");
    eval(jsCode);
    
    global.activeAuditData = auditPackage;
    renderDashboard(auditPackage);
    console.log("SUCCESS: renderDashboard ran with live audit package with no errors!");
  } catch (e) {
    console.error("PIPELINE OR RENDER CRASHED:");
    console.error(e);
  }
}

runLiveTest();
