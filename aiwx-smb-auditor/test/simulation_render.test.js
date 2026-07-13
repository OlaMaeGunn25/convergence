const fs = require('fs');
const path = require('path');

// Read the benchmark.html file content
const htmlPath = path.join(__dirname, '../public/benchmark.html');
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
          setProperty(name, val) {},
          display: ''
        },
        appendChild(child) {},
        classList: {
          add(cls) {},
          remove(cls) {}
        },
        removeAttribute(attr) {},
        setAttribute(attr, val) {},
        scrollIntoView(opt) {}
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
        setProperty(name, val) {},
        display: ''
      },
      appendChild(child) {},
      classList: {
        add(cls) {},
        remove(cls) {}
      },
      removeAttribute(attr) {},
      setAttribute(attr, val) {},
      scrollIntoView(opt) {}
    };
  }
};

// Global variables needed by the script
global.document = documentMock;
global.window = {
  location: { hostname: 'localhost', search: '' },
  addEventListener(event, callback) {}
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

// Run client-side simulation rendering test
function runSimulationTest() {
  console.log("Evaluating client JS...");
  eval(jsCode);

  const domainsToTest = [
    'smartoptimalsolutions.com', // Sustainable
    'jenkinsbakery.com',         // Food/E-commerce
    'mercerclinic.com',          // Health
    'lobolaw.com',               // Legal/Other
    'randomconsulting.com'       // Generic fallback
  ];

  domainsToTest.forEach(domain => {
    console.log(`\nTesting simulation render for domain: ${domain}...`);
    const simulatedData = runClientSideAuditSimulation(domain);
    
    // Ensure all critical dashboard sections render correctly
    global.activeAuditData = simulatedData;
    renderDashboard(simulatedData);
    console.log(`✅ Success: renderDashboard ran with simulated package for ${domain}!`);
  });
}

runSimulationTest();
