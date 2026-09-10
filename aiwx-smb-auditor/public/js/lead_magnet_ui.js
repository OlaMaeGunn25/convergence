/**
 * lead_magnet_ui.js - Controller for AiWorX Nexus™ Inbound Diagnostic Engine
 * Adheres to AiWorXmiths Official Report Brand System (v1.0 - July 2026)
 */

let activeDiagnosticResult = null;
let selectedVertical = 'Legal & Law Firms';
let selectedBottlenecks = ['Inbound Intake Latency'];

// Parse URL search parameters (for tokenized / outbound campaign links)
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const domainParam = params.get('d') || params.get('domain');
  if (domainParam) {
    const domainInput = document.getElementById('targetDomain');
    if (domainInput) {
      domainInput.value = domainParam;
      executeDomainScan();
    }
  }
});

function switchTab(mode) {
  const tabDomain = document.getElementById('tabDomain');
  const tabQuiz = document.getElementById('tabQuiz');
  const viewDomain = document.getElementById('viewDomain');
  const viewQuiz = document.getElementById('viewQuiz');

  if (mode === 'domain') {
    tabDomain.classList.add('active');
    tabQuiz.classList.remove('active');
    viewDomain.style.display = 'block';
    viewQuiz.style.display = 'none';
  } else {
    tabQuiz.classList.add('active');
    tabDomain.classList.remove('active');
    viewQuiz.style.display = 'block';
    viewDomain.style.display = 'none';
  }
}

function selectVertical(cardElement, verticalName) {
  document.querySelectorAll('.archetype-card').forEach(el => el.classList.remove('selected'));
  cardElement.classList.add('selected');
  selectedVertical = verticalName;
}

function updateCalculations() {
  const teamSize = document.getElementById('sliderTeamSize').value;
  const hoursSpent = document.getElementById('sliderHoursSpent').value;
  document.getElementById('labelTeamSize').textContent = `${teamSize} Team Members`;
  document.getElementById('labelHoursSpent').textContent = `${hoursSpent} Hours / Wk`;
}

async function executeDomainScan() {
  const domainInput = document.getElementById('targetDomain');
  const domain = domainInput.value.trim();
  if (!domain) {
    alert('Please enter a company domain (e.g. yourcompany.com).');
    domainInput.focus();
    return;
  }

  showProgress([
    `[Audit Engine] Connecting to ${domain}...`,
    `[Inspection] Inspecting SSL, HTTP headers, and CMS signatures...`,
    `[SWOT Model] Analyzing customer intake & booking latency...`,
    `[ROI Model] Calculating 12-month labor capacity reclaim...`,
    `[Complete] Quantum Scorecard Compiled!`
  ]);

  try {
    const res = await fetch('/api/lead-magnet/instant-diagnostic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, vertical: 'Professional Services' })
    });
    const data = await res.json();
    activeDiagnosticResult = data;
    renderResults(data);
  } catch (err) {
    console.error('Diagnostic error:', err);
    alert('Failed to connect to diagnostic server.');
  }
}

async function executeQuizDiagnostic() {
  const teamSize = parseInt(document.getElementById('sliderTeamSize').value, 10);
  const hoursSpent = parseInt(document.getElementById('sliderHoursSpent').value, 10);

  showProgress([
    `[Diagnostic] Aggregating operational friction parameters for ${selectedVertical}...`,
    `[Benchmark] Comparing against 2026 industry efficiency baselines...`,
    `[ROI Engine] Simulating Human-in-the-Loop automation yield...`,
    `[Complete] Audit results compiled!`
  ]);

  try {
    const res = await fetch('/api/lead-magnet/instant-diagnostic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vertical: selectedVertical,
        teamSize,
        bottlenecks: selectedBottlenecks,
        hoursSpentPerWeek: hoursSpent
      })
    });
    const data = await res.json();
    activeDiagnosticResult = data;
    renderResults(data);
  } catch (err) {
    console.error('Quiz diagnostic error:', err);
    alert('Failed to generate diagnostic.');
  }
}

function showProgress(steps) {
  const progressBox = document.getElementById('scanProgress');
  const bar = document.getElementById('progressBar');
  const log = document.getElementById('progressLog');
  const resultsView = document.getElementById('resultsView');

  resultsView.style.display = 'none';
  progressBox.style.display = 'block';
  bar.style.width = '10%';

  let stepIdx = 0;
  const interval = setInterval(() => {
    if (stepIdx < steps.length) {
      log.textContent = steps[stepIdx];
      bar.style.width = `${((stepIdx + 1) / steps.length) * 100}%`;
      stepIdx++;
    } else {
      clearInterval(interval);
      setTimeout(() => {
        progressBox.style.display = 'none';
        resultsView.style.display = 'block';
      }, 400);
    }
  }, 450);
}

function renderResults(data) {
  document.getElementById('displayScore').textContent = data.aiReadinessScore || 70;
  document.getElementById('displayRoi').textContent = `$${(data.projectedRoiDollars || 459000).toLocaleString()}`;
  document.getElementById('displayHours').textContent = `${(data.reclaimedHoursAnnual || 5400).toLocaleString()} Labor Hours Reclaimed`;

  const container = document.getElementById('gapsContainer');
  container.innerHTML = '';

  // Render using Official Brand Component: Numbered Card (01, 02, 03) with Diamond Bullets
  (data.vulnerabilityGaps || []).forEach((gap, idx) => {
    const num = (idx + 1).toString().padStart(2, '0');
    const card = document.createElement('div');
    card.className = 'numbered-card';
    card.innerHTML = `
      <div class="numbered-digit">${num}</div>
      <div class="numbered-content">
        <h4>${gap.title}</h4>
        <p>${gap.impact}</p>
        <div class="bullet-lead">
          <span class="bullet-diamond">◆</span> AiWorXmiths Solution: <span style="color:var(--core-blue); font-weight:600;">${gap.solution}</span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function openLeadGateModal() {
  document.getElementById('gateModal').style.display = 'flex';
}

function closeLeadGateModal() {
  document.getElementById('gateModal').style.display = 'none';
}

async function submitLeadCapture(event) {
  event.preventDefault();
  const btn = document.getElementById('btnSubmitLead');
  btn.disabled = true;
  btn.textContent = 'Dispatching Asset...';

  const fullName = document.getElementById('leadName').value.trim();
  const email = document.getElementById('leadEmail').value.trim();
  const phone = document.getElementById('leadPhone').value.trim();
  const domain = (activeDiagnosticResult && activeDiagnosticResult.domain) ? activeDiagnosticResult.domain : '';

  try {
    const res = await fetch('/api/lead-magnet/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName,
        email,
        phone,
        domain,
        vertical: (activeDiagnosticResult && activeDiagnosticResult.vertical) || selectedVertical || 'Professional Services',
        teamSize: (activeDiagnosticResult && activeDiagnosticResult.teamSize) || 6,
        leadMagnetSource: 'nexus_ai_scorecard'
      })
    });
    const result = await res.json();

    if (result.success) {
      document.getElementById('formContainer').style.display = 'none';
      document.getElementById('confirmEmail').textContent = email;
      document.getElementById('confirmContainer').style.display = 'block';
    } else {
      alert('Capture notice: ' + result.error);
      btn.disabled = false;
      btn.textContent = 'Dispatch Executive Report →';
    }
  } catch (err) {
    console.error('Submission error:', err);
    alert('Failed to connect to lead dispatch server.');
    btn.disabled = false;
    btn.textContent = 'Dispatch Executive Report →';
  }
}
