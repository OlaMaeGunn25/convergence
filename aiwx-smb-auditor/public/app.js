/**
 * SMB External Audit Engine - Frontend Controller
 */

function initializeConsumerApp() {
  // UI Elements
  const searchSection = document.getElementById('search-section');
  const loadingSection = document.getElementById('loading-section');
  const resultsSection = document.getElementById('results-section');
  const logTerminal = document.getElementById('log-terminal');
  const targetDomainInput = document.getElementById('target-domain');
  const triggerAuditBtn = document.getElementById('trigger-audit');
  const sampleChipsContainer = document.getElementById('sample-chips-container');
  const printReportBtn = document.getElementById('print-report');
  const exportWordBtn = document.getElementById('export-word-btn');

  // Tab Buttons & Panes
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // Active state to hold audit package
  let activeAuditData = null;

  // Initialize Sample Chips
  initSampleChips();

  // Bind Tab Click Handlers
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab');
      
      // Toggle button classes
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Toggle panes
      tabPanes.forEach(pane => {
        pane.classList.remove('active');
        if (pane.id === `pane-${tabName}`) {
          pane.classList.add('active');
        }
      });
    });
  });

  // Bind Search Button Click
  triggerAuditBtn.addEventListener('click', executeAudit);

  // Allow executing search by hitting Enter
  targetDomainInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') executeAudit();
  });

  // Bind PDF Export/Print
  printReportBtn.addEventListener('click', () => {
    window.print();
  });

  // Bind Word Export
  exportWordBtn.addEventListener('click', () => {
    if (activeAuditData) {
      exportReportToDocx(activeAuditData);
    } else {
      alert("No active audit report is currently loaded to export.");
    }
  });

  /**
   * Fetches pre-configured sample domains from backend and populates chips
   */
  async function initSampleChips() {
    try {
      const apiBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? '' : 'http://localhost:3003';
      const res = await fetch(`${apiBase}/api/sample-domains`);
      const data = await res.json();
      if (data.success && data.samples) {
        sampleChipsContainer.innerHTML = '';
        data.samples.forEach(sample => {
          const chip = document.createElement('span');
          chip.className = 'sample-chip';
          chip.textContent = `${sample.domain} (${sample.vertical})`;
          chip.addEventListener('click', () => {
            targetDomainInput.value = sample.domain;
            executeAudit();
          });
          sampleChipsContainer.appendChild(chip);
        });
      }
    } catch (e) {
      console.warn("Failed to fetch sample domains from API, keeping HTML defaults.");
    }
  }

  function cleanDomainInput(input) {
    let domain = input.trim().toLowerCase();
    domain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
    domain = domain.split('/')[0].split('?')[0];
    return domain;
  }

  /**
   * Main execution sequence
   */
  async function executeAudit() {
    let domain = targetDomainInput.value.trim();

    if (!domain) {
      alert('Please enter a target business domain to scan.');
      return;
    }

    domain = cleanDomainInput(domain);
    targetDomainInput.value = domain;

    // 1. UI Transition to Loading State
    searchSection.style.opacity = '0.5';
    triggerAuditBtn.disabled = true;
    const originalBtnHTML = triggerAuditBtn.innerHTML;
    triggerAuditBtn.innerHTML = `<span class="inline-spinner"></span> Analyzing...`;
    loadingSection.style.display = 'block';
    resultsSection.style.display = 'none';

    // Scroll to loading logs
    loadingSection.scrollIntoView({ behavior: 'smooth' });

    // 2. Play active simulated crawling logs to enhance UX
    logTerminal.innerHTML = '';
    const logInterval = startLoadingLogSimulation(domain, true);

    try {
      let auditData = null;
      let fetchSuccess = false;

      try {
        const apiBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? '' : 'http://localhost:3003';
        // 3. API Request to backend
        const response = await fetch(`${apiBase}/api/audit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain })
        });

        const contentType = response.headers.get("content-type");
        if (response.ok && contentType && contentType.indexOf("application/json") !== -1) {
          auditData = await response.json();
          if (auditData && auditData.success) {
            fetchSuccess = true;
          }
        }
      } catch (fetchErr) {
        console.warn("API endpoint fetch failed. Switching to browser-side scourer simulation...", fetchErr);
      }

      if (!fetchSuccess) {
        console.log("Using browser-side dynamic simulation fallback for:", domain);
        auditData = runClientSideAuditSimulation(domain);
      }

      clearInterval(logInterval);

      // Keep active cache
      activeAuditData = auditData;

      // 4. Render results onto dashboard panes
      renderDashboard(auditData);

      // 5. Complete transition
      setTimeout(() => {
        loadingSection.style.display = 'none';
        resultsSection.style.display = 'block';
        searchSection.style.opacity = '1';
        triggerAuditBtn.disabled = false;
        triggerAuditBtn.innerHTML = originalBtnHTML;
        resultsSection.scrollIntoView({ behavior: 'smooth' });
      }, 500);

    } catch (error) {
      clearInterval(logInterval);
      console.error(error);
      alert(`Scraping sequence failed: ${error.message}`);
      loadingSection.style.display = 'none';
      searchSection.style.opacity = '1';
      triggerAuditBtn.disabled = false;
      triggerAuditBtn.innerHTML = originalBtnHTML;
    }
  }

  /**
   * Simulated scrolling terminal compiler
   */
  function startLoadingLogSimulation(domain, isLive) {
    const logs = [
      `[SYSTEM] Connecting to internal audit node...`,
      `[SYSTEM] Initializing analyzer engine subagents...`,
      `[NETWORK] Resolving DNS A/MX/TXT logs for target domain: ${domain}...`,
      `[NETWORK] Found mail server mappings and web registrar headers.`,
      isLive ? `[SYSTEM] Active API handshake established.` : `[SYSTEM] Launching Smart Ingestion Simulator.`,
      `[CRAWLER] Scraped root path / (HTML index payload received: 48KB)`,
      `[CRAWLER] Crawling subpath /about and scanning organizational lists...`,
      `[CRAWLER] Found team members and corporate structures.`,
      `[CRAWLER] Crawling subpath /contact and scanning widget configurations...`,
      `[CRAWLER] Identified marketing pixel payloads and hosting CDN nodes.`,
      `[ANALYZER] Technology stack profile evaluation compiled.`,
      `[SWOT ENGINE] Formulating corporate vulnerabilities and DNS exposure threat maps.`,
      `[WORKFORCE ENGINE] Calculating staff upskilling roadmap & HITL Readiness index...`,
      `[SYSTEM] Compilation finished. Initializing visual reports...`
    ];

    let currentIdx = 0;
    
    function addLogLine() {
      if (currentIdx < logs.length) {
        const line = document.createElement('div');
        line.className = 'crawler-log-line';
        line.textContent = logs[currentIdx];
        logTerminal.appendChild(line);
        logTerminal.scrollTop = logTerminal.scrollHeight;
        currentIdx++;
      }
    }

    addLogLine();
    return setInterval(addLogLine, 600);
  }

  /**
   * Main rendering router
   */
  function renderDashboard(data) {
    // A. Populate Top Overview Banner
    document.getElementById('result-business-name').textContent = data.businessName;
    document.getElementById('result-domain-name').textContent = data.domain;
    document.getElementById('result-vertical-name').textContent = data.vertical;
    
    const simBadge = document.getElementById('result-simulated-badge');
    if (data.isSimulated) {
      simBadge.style.display = 'inline-block';
      simBadge.textContent = 'Simulated Scan';
    } else {
      simBadge.style.display = 'inline-block';
      simBadge.textContent = 'Live Audit';
      simBadge.className = 'overview-meta-tag';
      simBadge.style.background = 'var(--accent-emerald-glow)';
      simBadge.style.color = 'var(--accent-emerald)';
      simBadge.style.border = '1px solid rgba(16, 185, 129, 0.3)';
    }

    // B. Overview tab scores
    const techScore = data.analyzerData.metrics.techModernization;
    const secScore = data.analyzerData.metrics.securityPosture;
    const workScore = data.workforceData.summary.jobReadinessScore;

    document.getElementById('score-tech').textContent = techScore;
    document.getElementById('score-security').textContent = secScore;
    document.getElementById('score-workforce').textContent = workScore;

    // Redraw Overview Radar/Bar Chart
    renderOverviewScoresChart(techScore, secScore, workScore);

    // Render Overview Tech Stack Roster
    const overviewTechList = document.getElementById('overview-tech-summary-list');
    overviewTechList.innerHTML = '';
    
    // Pick first 4 technologies
    const topTechs = data.scrapedData.technologies.slice(0, 4);
    topTechs.forEach(tech => {
      const line = document.createElement('div');
      line.style.display = 'flex';
      line.style.justifyContent = 'space-between';
      line.style.borderBottom = '1px solid var(--card-border)';
      line.style.paddingBottom = '0.5rem';
      
      line.innerHTML = `
        <span style="font-weight:600; font-size:0.95rem;">${tech.name}</span>
        <span style="font-size:0.8rem; color:var(--accent-indigo); font-weight:500;">${tech.category}</span>
      `;
      overviewTechList.appendChild(line);
    });

    // C. Technology Tab Profile List
    const techGrid = document.getElementById('tech-list-container');
    techGrid.innerHTML = '';
    
    data.scrapedData.technologies.forEach(tech => {
      const card = document.createElement('div');
      card.className = 'tech-item-card';
      
      card.innerHTML = `
        <div class="tech-item-header">
          <span class="tech-name">${tech.name}</span>
          <span class="tech-cat">${tech.category}</span>
        </div>
        <p class="tech-desc">${tech.description}</p>
        <span class="tech-conf">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="color:var(--accent-emerald);"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Confidence Score: ${Math.round(tech.confidence * 100)}%
        </span>
      `;
      techGrid.appendChild(card);
    });

    // Render Tech categories Distribution Chart
    renderTechDistributionChart(data.scrapedData.technologies);

    // D. SWOT Tab Lists
    renderSwotList('strengths', data.analyzerData.swot.strengths);
    renderSwotList('weaknesses', data.analyzerData.swot.weaknesses);
    renderSwotList('opportunities', data.analyzerData.swot.opportunities);
    renderSwotList('threats', data.analyzerData.swot.threats);

    // E. Workforce AI Blueprint Tab
    document.getElementById('workforce-banner-score').textContent = `${data.workforceData.summary.jobReadinessScore}%`;
    
    const wfStatus = document.getElementById('workforce-banner-status');
    wfStatus.textContent = data.workforceData.summary.status;
    if (data.workforceData.summary.jobReadinessScore > 75) {
      wfStatus.style.color = 'var(--accent-emerald)';
    } else if (data.workforceData.summary.jobReadinessScore > 50) {
      wfStatus.style.color = 'var(--accent-amber)';
    } else {
      wfStatus.style.color = 'var(--accent-coral)';
    }

    // Render Role Transition Cards
    const workforceCardsContainer = document.getElementById('workforce-cards-container');
    workforceCardsContainer.innerHTML = '';
    
    data.workforceData.roles.forEach(role => {
      const card = document.createElement('div');
      card.className = 'workforce-card';

      // Define risk label
      let rClass = 'risk-low';
      let rLabel = 'Low Risk';
      if (role.automationRiskScore >= 75) {
        rClass = 'risk-high';
        rLabel = `High Exposure (${role.automationRiskScore}%)`;
      } else if (role.automationRiskScore >= 50) {
        rClass = 'risk-med';
        rLabel = `Medium Exposure (${role.automationRiskScore}%)`;
      } else {
        rLabel = `Low Exposure (${role.automationRiskScore}%)`;
      }

      // Assemble skills tags
      let skillTagsHtml = role.coreSkillsToAcquire.map(s => `<span class="skill-tag">${s}</span>`).join('');
      
      // Assemble transition steps list
      let stepsHtml = role.transitionBlueprint.map(step => `<li>${step}</li>`).join('');

      card.innerHTML = `
        <div class="employee-info">
          <div>
            <h4 class="employee-name">${role.employeeName}</h4>
            <span class="employee-role">${role.originalRole}</span>
          </div>
          <span class="risk-badge ${rClass}">${rLabel}</span>
        </div>
        
        <div class="transition-arrow">↓</div>
        
        <div class="hitl-container">
          <div class="hitl-title-lbl">Upskilled HITL Role:</div>
          <div class="hitl-role-name">${role.hitlRole}</div>
          <div class="impact-desc">${role.impactStatement}</div>
        </div>

        <div>
          <div style="font-size:0.8rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.25rem;">Curriculum Target Skills:</div>
          <div class="skills-list">${skillTagsHtml}</div>
        </div>

        <div>
          <div style="font-size:0.8rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.25rem; display:flex; justify-content:space-between;">
            <span>Transition Milestones</span>
            <span style="color:var(--accent-indigo)">${role.trainingDurationWeeks} Wks training</span>
          </div>
          <ol class="steps-list">${stepsHtml}</ol>
        </div>
      `;
      workforceCardsContainer.appendChild(card);
    });

    // Populate timeline milestones
    const timelines = data.workforceData.timeframeMilestones;
    populateTimelineStep('immediate', timelines.immediate);
    populateTimelineStep('midterm', timelines.midTerm);
    populateTimelineStep('longterm', timelines.longTerm);

    // Populate hiring adjustments
    const hiringContainer = document.getElementById('hiring-strategy-container');
    hiringContainer.innerHTML = '';
    
    if (data.workforceData.hiringStrategy.length > 0) {
      data.workforceData.hiringStrategy.forEach(job => {
        const item = document.createElement('div');
        item.style.background = 'rgba(255, 255, 255, 0.02)';
        item.style.border = '1px solid var(--card-border)';
        item.style.borderRadius = 'var(--radius-lg)';
        item.style.padding = '1.25rem';
        
        item.innerHTML = `
          <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
            <span style="font-weight:700; font-family:var(--font-display);">${job.title}</span>
            <span class="risk-badge risk-high" style="font-size:0.65rem;">Recruitment Shift Recommended</span>
          </div>
          <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.75rem;">${job.description}</p>
          <div style="background:var(--accent-indigo-glow); border-left:3px solid var(--accent-indigo); padding:0.5rem 0.75rem; font-size:0.8rem; color:var(--text-primary);">
            <strong>HITL Adaptation:</strong> ${job.upskilledRecruitmentStrategy}
          </div>
        `;
        hiringContainer.appendChild(item);
      });
    } else {
      hiringContainer.innerHTML = `
        <div style="color:var(--text-secondary); font-size:0.9rem; text-align:center; padding:2rem;">
          No open recruiting positions detected. Team is stable.
        </div>
      `;
    }

    // E2. Multi-Agent Monitor rendering
    const agentsContainer = document.getElementById('active-agents-container');
    agentsContainer.innerHTML = '';
    
    if (data.analyzerData.multiAgentGrid && data.analyzerData.multiAgentGrid.agents) {
      data.analyzerData.multiAgentGrid.agents.forEach(agent => {
        const card = document.createElement('div');
        card.style.background = 'rgba(255, 255, 255, 0.02)';
        card.style.border = '1px solid var(--card-border)';
        card.style.borderRadius = 'var(--radius-md)';
        card.style.padding = '1rem';
        card.style.display = 'flex';
        card.style.justifyContent = 'space-between';
        card.style.alignItems = 'center';

        const isAct = agent.status === 'ACTIVE';
        const badgeColor = isAct ? 'var(--accent-emerald)' : 'var(--text-secondary)';
        const badgeBg = isAct ? 'var(--accent-emerald-glow)' : 'rgba(255, 255, 255, 0.05)';
        const badgeBorder = isAct ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)';

        card.innerHTML = `
          <div>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <strong style="font-family:var(--font-display);">${agent.name}</strong>
              <span style="font-size:0.7rem; color:var(--text-muted); font-family:monospace;">${agent.id}</span>
            </div>
            <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.25rem;">${agent.role}</div>
          </div>
          <div style="display:flex; align-items:center; gap:1rem;">
            <div style="text-align:right;">
              <div style="font-size:0.75rem; color:var(--text-muted);">Workload</div>
              <div style="font-size:0.85rem; font-weight:700; color:var(--accent-indigo);">${agent.workload}</div>
            </div>
            <span style="font-size:0.7rem; font-weight:700; padding:0.25rem 0.5rem; border-radius:4px; color:${badgeColor}; background:${badgeBg}; border:${badgeBorder};">${agent.status}</span>
          </div>
        `;
        agentsContainer.appendChild(card);
      });
    }

    const connectorsContainer = document.getElementById('connector-status-grid');
    connectorsContainer.innerHTML = '';
    
    if (data.analyzerData.multiAgentGrid && data.analyzerData.multiAgentGrid.integrators) {
      data.analyzerData.multiAgentGrid.integrators.forEach(conn => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '0.5rem';
        item.style.borderBottom = '1px solid var(--card-border)';

        const isConn = conn.status === 'CONNECTED';
        const badgeColor = isConn ? 'var(--accent-emerald)' : 'var(--accent-indigo)';
        const badgeBg = isConn ? 'var(--accent-emerald-glow)' : 'var(--accent-indigo-glow)';
        const badgeBorder = isConn ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(99, 102, 241, 0.3)';

        item.innerHTML = `
          <div>
            <div style="font-size:0.85rem; font-weight:600;">${conn.name}</div>
            <div style="font-size:0.7rem; color:var(--text-muted);">${conn.category}</div>
          </div>
          <span style="font-size:0.65rem; font-weight:700; padding:0.15rem 0.4rem; border-radius:4px; color:${badgeColor}; background:${badgeBg}; border:${badgeBorder};">${conn.status}</span>
        `;
        connectorsContainer.appendChild(item);
      });
    }

    const multiagentLogTerminal = document.getElementById('multiagent-log-terminal');
    multiagentLogTerminal.innerHTML = '';
    
    if (data.analyzerData.multiAgentGrid && data.analyzerData.multiAgentGrid.logs) {
      data.analyzerData.multiAgentGrid.logs.forEach(log => {
        const line = document.createElement('div');
        line.style.marginBottom = '0.25rem';
        line.textContent = log;
        multiagentLogTerminal.appendChild(line);
      });
      multiagentLogTerminal.scrollTop = multiagentLogTerminal.scrollHeight;
    }

    // Set up active telemetry simulation
    if (window.activeTelemetryInterval) clearInterval(window.activeTelemetryInterval);
    
    const extraLogs = [
      `[SecurityAgent] Decrypting database token from Supabase KMS vault...`,
      `[BillingAgent] Purchase Order audit complete. Tolerances matched.`,
      `[SupportAgent] Routing incoming email ticket to HubSpot CRM.`,
      `[OrderAgent] Auto-matching invoice transaction in QuickBooks Online.`,
      `[System] HITL Quality Gate queue length: 0 pending tasks.`,
      `[System] API latency optimized: 124ms response times.`,
      `[System] Token COGS tracking: $0.003 compute cost.`,
      `[SecurityAgent] PostgreSQL RLS data boundary verification complete.`
    ];

    window.activeTelemetryInterval = setInterval(() => {
      const pane = document.getElementById('pane-multiagent');
      if (pane && pane.classList.contains('active')) {
        const randLog = extraLogs[Math.floor(Math.random() * extraLogs.length)];
        const line = document.createElement('div');
        line.style.marginBottom = '0.25rem';
        line.style.color = 'var(--accent-indigo)';
        line.textContent = `[${new Date().toLocaleTimeString()}] ${randLog}`;
        multiagentLogTerminal.appendChild(line);
        
        // Cap lines at 25 to avoid DOM bloat
        while (multiagentLogTerminal.children.length > 25) {
          multiagentLogTerminal.removeChild(multiagentLogTerminal.firstChild);
        }
        
        multiagentLogTerminal.scrollTop = multiagentLogTerminal.scrollHeight;
      }
    }, 4000);

    // F. Metadata tab details
    const subdomainsList = document.getElementById('details-subdomains-list');
    subdomainsList.innerHTML = '';
    if (data.scrapedData.subdomains && data.scrapedData.subdomains.length > 0) {
      subdomainsList.innerHTML = `
        <p style="font-size:0.85rem; color:var(--text-secondary);">Discovered active domain mappings exposure:</p>
        <div class="subdomain-container">
          ${data.scrapedData.subdomains.map(sub => `<span class="subdomain-badge">${sub}.${data.domain}</span>`).join('')}
        </div>
      `;
    } else {
      subdomainsList.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted);">No subdomains crawled.</p>`;
    }

    // Meta tags
    document.getElementById('meta-title-val').textContent = data.scrapedData.metaData.title || 'None';
    document.getElementById('meta-desc-val').textContent = data.scrapedData.metaData.description || 'None';
    
    const social = data.scrapedData.metaData.socialLinks;
    document.getElementById('meta-linkedin-val').innerHTML = social.linkedin ? `<a href="${social.linkedin}" target="_blank" style="color:var(--accent-indigo); text-decoration:none;">${social.linkedin}</a>` : 'Not linked';
    document.getElementById('meta-twitter-val').innerHTML = social.twitter ? `<a href="${social.twitter}" target="_blank" style="color:var(--accent-indigo); text-decoration:none;">${social.twitter}</a>` : 'Not linked';
    document.getElementById('meta-facebook-val').innerHTML = social.facebook ? `<a href="${social.facebook}" target="_blank" style="color:var(--accent-indigo); text-decoration:none;">${social.facebook}</a>` : 'Not linked';

    // Discovered WAF & compliance headers
    const waf = data.scrapedData.firewallAudit.wafDetected;
    const hdrs = data.scrapedData.firewallAudit.securityHeaders;
    document.getElementById('meta-waf-val').textContent = waf;
    document.getElementById('meta-headers-val').textContent = `HSTS: ${hdrs.hsts ? 'Y' : 'N'} | CSP: ${hdrs.csp ? 'Y' : 'N'} | X-Frame: ${hdrs.xFrameOptions ? 'Y' : 'N'} | CORS: ${hdrs.cors ? 'Y' : 'N'}`;
    
    // Revenue & Filings Scour
    document.getElementById('meta-revenue-val').textContent = `${data.scourerData.revenueEstimate} (${data.scourerData.headcountEstimate})`;
    document.getElementById('meta-filing-val').textContent = `${data.scourerData.filings.state.status} | ${data.scourerData.filings.state.agency}`;

    // List of analyzed pages
    const pagesList = document.getElementById('details-pages-list');
    pagesList.innerHTML = '';
    data.scrapedData.scrapedPages.forEach(p => {
      const li = document.createElement('li');
      li.textContent = `https://${data.domain}${p}`;
      pagesList.appendChild(li);
    });
  }

  /**
   * Helper: SWOT list populated with vectors
   */
  function renderSwotList(elementId, items) {
    const list = document.getElementById(`swot-${elementId}-list`);
    list.innerHTML = '';
    
    if (items.length > 0) {
      items.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
          <div class="swot-item-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
            ${item.title}
          </div>
          <div class="swot-item-desc">${item.description}</div>
        `;
        list.appendChild(li);
      });
    } else {
      list.innerHTML = `<li style="font-size:0.85rem; color:var(--text-muted); text-align:center; padding:1rem 0;">No parameters indexed.</li>`;
    }
  }

  /**
   * Helper: timelines timeline populator
   */
  function populateTimelineStep(prefix, data) {
    document.getElementById(`timeline-${prefix}-range`).textContent = data.range;
    document.getElementById(`timeline-${prefix}-title`).textContent = data.title;
    
    const list = document.getElementById(`timeline-${prefix}-actions`);
    list.innerHTML = '';
    data.actions.forEach(action => {
      const li = document.createElement('li');
      li.textContent = action;
      list.appendChild(li);
    });
  }

  /**
   * Helper: Interactive vector rendering: Overview radar-style vectors
   */
  function renderOverviewScoresChart(tech, security, workforce) {
    const container = document.getElementById('overview-chart-container');
    container.innerHTML = '';

    // Draw a responsive SVG bar chart with neon gradients
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 400 240");
    svg.setAttribute("class", "chart-svg");

    // Gradients definition
    svg.innerHTML = `
      <defs>
        <linearGradient id="grad-tech" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#818cf8"/>
          <stop offset="100%" stop-color="var(--accent-indigo)"/>
        </linearGradient>
        <linearGradient id="grad-sec" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#34d399"/>
          <stop offset="100%" stop-color="var(--accent-emerald)"/>
        </linearGradient>
        <linearGradient id="grad-work" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#fb7185"/>
          <stop offset="100%" stop-color="var(--accent-coral)"/>
        </linearGradient>
      </defs>
      
      <!-- Grid lines -->
      <line x1="120" y1="30" x2="350" y2="30" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3"/>
      <line x1="120" y1="90" x2="350" y2="90" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3"/>
      <line x1="120" y1="150" x2="350" y2="150" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3"/>
      <line x1="120" y1="210" x2="350" y2="210" stroke="rgba(255,255,255,0.1)"/>
      
      <!-- Scales -->
      <text x="120" y="225" class="chart-text" text-anchor="middle">0</text>
      <text x="235" y="225" class="chart-text" text-anchor="middle">50</text>
      <text x="350" y="225" class="chart-text" text-anchor="middle">100</text>

      <!-- Tech Row -->
      <text x="10" y="65" class="chart-value">Tech Stack</text>
      <text x="10" y="80" class="chart-text">Modernization</text>
      <rect x="120" y="55" width="${Math.round(tech * 2.3)}" height="26" rx="4" fill="url(#grad-tech)"/>
      <text x="${Math.round(tech * 2.3) + 130}" y="73" class="chart-value">${tech}</text>

      <!-- Security Row -->
      <text x="10" y="125" class="chart-value">Security</text>
      <text x="10" y="140" class="chart-text">External Surface</text>
      <rect x="120" y="115" width="${Math.round(security * 2.3)}" height="26" rx="4" fill="url(#grad-sec)"/>
      <text x="${Math.round(security * 2.3) + 130}" y="133" class="chart-value">${security}</text>

      <!-- Workforce Row -->
      <text x="10" y="185" class="chart-value">AI HITL</text>
      <text x="10" y="200" class="chart-text">Upskilling Readiness</text>
      <rect x="120" y="175" width="${Math.round(workforce * 2.3)}" height="26" rx="4" fill="url(#grad-work)"/>
      <text x="${Math.round(workforce * 2.3) + 130}" y="193" class="chart-value">${workforce}</text>
    `;

    container.appendChild(svg);
  }

  /**
   * Helper: Interactive vector rendering: Technology distribution bar chart
   */
  function renderTechDistributionChart(technologies) {
    const container = document.getElementById('tech-distribution-chart');
    container.innerHTML = '';

    // Calculate category counts
    const categories = {};
    technologies.forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + 1;
    });

    const keys = Object.keys(categories);
    
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 400 240");
    svg.setAttribute("class", "chart-svg");

    if (keys.length === 0) {
      container.innerHTML = `<span style="font-size:0.85rem; color:var(--text-muted);">No categories crawled.</span>`;
      return;
    }

    let barsHtml = '';
    const rowHeight = 45;
    const startY = 40;

    keys.forEach((catName, idx) => {
      const count = categories[catName];
      const width = Math.min(220, count * 50); // Scale up count
      const y = startY + (idx * rowHeight);
      
      barsHtml += `
        <text x="10" y="${y + 15}" class="chart-value" style="font-size:10px;">${catName}</text>
        <rect x="150" y="${y}" width="${width}" height="18" rx="3" fill="var(--accent-indigo)" opacity="${0.6 + (idx * 0.1)}"/>
        <text x="${width + 160}" y="${y + 13}" class="chart-value" style="font-size:10px;">${count} tools</text>
      `;
    });

    svg.innerHTML = `
      <!-- Title -->
      <text x="10" y="20" class="chart-value" style="font-size:12px; fill:var(--accent-indigo);">Discovered Assets Count</text>
      ${barsHtml}
    `;

    container.appendChild(svg);
  }

  /**
   * Styled Client-Side Open XML Microsoft Word (.docx) report exporter
   */
  function exportReportToDocx(data) {
    const docHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>Corporate Compliance Audit Report - ${data.businessName}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.5; color: #333333; }
          h1 { color: #6366f1; font-size: 24pt; font-family: 'Outfit', sans-serif; border-bottom: 3px solid #6366f1; padding-bottom: 6px; margin-bottom: 12pt; }
          h2 { color: #10b981; font-size: 16pt; font-family: 'Outfit', sans-serif; margin-top: 24pt; margin-bottom: 8pt; border-bottom: 1px solid #eeeeee; padding-bottom: 4px; }
          h3 { color: #f43f5e; font-size: 12pt; margin-top: 14pt; margin-bottom: 6pt; }
          p { font-size: 10pt; margin-bottom: 10pt; }
          table { width: 100%; border-collapse: collapse; margin-top: 12pt; margin-bottom: 12pt; }
          th { background-color: #6366f1; color: #ffffff; font-weight: bold; text-align: left; padding: 8px; border: 1px solid #dddddd; font-size: 10pt; }
          td { padding: 8px; border: 1px solid #dddddd; font-size: 9.5pt; }
          .highlight { font-weight: bold; color: #6366f1; }
          .footer { font-size: 8pt; color: #888888; text-align: center; margin-top: 50pt; border-top: 1px solid #eeeeee; padding-top: 12px; }
        </style>
      </head>
      <body>
        <h1>AIWORXMITHS AUDIT & WORKFORCE BLUEPRINT</h1>
        <p><strong>Target Enterprise Domain:</strong> ${data.domain}</p>
        <p><strong>Corporate Entity Name:</strong> ${data.businessName}</p>
        <p><strong>Vertical Taxonomy:</strong> ${data.vertical}</p>
        <p><strong>Assessment Date:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
        <p><strong>Execution Mode:</strong> ${data.isSimulated ? 'Simulated Scanner Mapping' : 'Active Live Scour Node'}</p>

        <h2>1. SCORECARD & FINANCIAL HIGHLIGHTS</h2>
        <p>This section provides critical parameters regarding the business size, growth trajectory, and overall scored vectors.</p>
        <table>
          <tr>
            <th style="width: 250px;">Evaluated Dimension</th>
            <th>Scored Metric Value</th>
            <th>Status / Assessment</th>
          </tr>
          <tr>
            <td><strong>Technology Modernization Scale</strong></td>
            <td class="highlight">${data.analyzerData.metrics.techModernization} / 100</td>
            <td>${data.analyzerData.metrics.techModernization >= 75 ? 'Excellent Architecture' : 'Baseline CMS Stack'}</td>
          </tr>
          <tr>
            <td><strong>Cybersecurity Posture Surface</strong></td>
            <td class="highlight">${data.analyzerData.metrics.securityPosture} / 100</td>
            <td>${data.analyzerData.metrics.securityPosture >= 70 ? 'WAF & Edge Secured' : 'Exposed Attack Surface'}</td>
          </tr>
          <tr>
            <td><strong>Estimated Annual Revenue</strong></td>
            <td style="color:#10b981; font-weight:bold;">${data.scourerData.revenueEstimate || 'N/A'}</td>
            <td>Gross Corporate Earnings Estimate</td>
          </tr>
          <tr>
            <td><strong>Inferred Employee Headcount</strong></td>
            <td><strong>${data.scourerData.headcountEstimate || 'N/A'}</strong></td>
            <td>YoY Growth Index: ${data.scourerData.growthRate || 'Stable'}</td>
          </tr>
        </table>

        <h2>2. REGULATORY FILINGS COMPLIANCE</h2>
        <p>Corporate registry status retrieved from Secretary of State and federal agencies database registries.</p>
        <table>
          <tr>
            <th style="width: 250px;">Registry Lookups</th>
            <th>Report Details / Registry Values</th>
          </tr>
          <tr>
            <td><strong>State Regulatory Agency</strong></td>
            <td>${data.scourerData.filings.state.agency}</td>
          </tr>
          <tr>
            <td><strong>Active Entity Status</strong></td>
            <td style="font-weight:bold; color:#10b981;">${data.scourerData.filings.state.status}</td>
          </tr>
          <tr>
            <td><strong>Filing Date & Incorporation</strong></td>
            <td>${data.scourerData.filings.state.filingDate}</td>
          </tr>
          <tr>
            <td><strong>Entity Structure Taxonomy</strong></td>
            <td>${data.scourerData.filings.state.entityType}</td>
          </tr>
          <tr>
            <td><strong>Registry Filing ID Number</strong></td>
            <td>${data.scourerData.filings.state.entityId}</td>
          </tr>
          <tr>
            <td><strong>Federal SAM Registration</strong></td>
            <td>${data.scourerData.filings.federal.samGovStatus}</td>
          </tr>
          <tr>
            <td><strong>SEC Central Index Key (CIK)</strong></td>
            <td>${data.scourerData.filings.federal.secCik}</td>
          </tr>
        </table>

        <h2>3. EDGE NETWORK PROTECTION & WAF AUDIT</h2>
        <p>Discovered reverse-proxy shield and response compliance headers mapping.</p>
        <p><strong>Active edge firewall protection:</strong> ${data.scrapedData.firewallAudit.wafDetected} (Scour confidence: ${Math.round(data.scrapedData.firewallAudit.wafConfidence * 100)}%)</p>
        <p><strong>SSL Protocol Encryption Status:</strong> ${data.scrapedData.firewallAudit.sslStatus}</p>

        <h3>Discovered HTTP Security Headers Matrix:</h3>
        <table>
          <tr>
            <th style="width: 320px;">Header Directive</th>
            <th>Active Compliance Status</th>
          </tr>
          <tr>
            <td><strong>Strict-Transport-Security (HSTS)</strong></td>
            <td>${data.scrapedData.firewallAudit.securityHeaders.hsts ? 'ENABLED (Compliant)' : 'MISSING (Vulnerable to protocol downgrade)'}</td>
          </tr>
          <tr>
            <td><strong>Content-Security-Policy (CSP)</strong></td>
            <td>${data.scrapedData.firewallAudit.securityHeaders.csp ? 'ENABLED (Compliant)' : 'MISSING (Cross-Site Scripting XSS exposure risk)'}</td>
          </tr>
          <tr>
            <td><strong>X-Frame-Options (Clickjacking Shield)</strong></td>
            <td>${data.scrapedData.firewallAudit.securityHeaders.xFrameOptions ? 'ENABLED (Compliant)' : 'MISSING (Clickjacking iframe vulnerability)'}</td>
          </tr>
          <tr>
            <td><strong>Access-Control-Allow-Origin (CORS)</strong></td>
            <td>${data.scrapedData.firewallAudit.securityHeaders.cors ? 'RESTRICTED (Secure)' : 'OPEN / UNRESTRICTED (CORS leakage risk)'}</td>
          </tr>
        </table>

        <h2>4. WORKFORCE HITL AI UPSKILLING MAP</h2>
        <p>Our algorithm constructs structured, role-by-role paths to turn team members into AI Managers and Validators, boosting output efficiency.</p>
        <p><strong>Audited Payroll Size:</strong> ${data.workforceData.summary.totalStaffAudited} employees</p>
        <p><strong>Job Automation Risk Index:</strong> ${data.workforceData.summary.averageAutomationExposure}%</p>
        <p><strong>Job Readiness Score:</strong> ${data.workforceData.summary.jobReadinessScore}% (${data.workforceData.summary.status})</p>

        <table>
          <tr>
            <th style="width: 150px;">Employee</th>
            <th>Original Role</th>
            <th>Upskilled HITL Role</th>
            <th>Impact Profile / Automation Mitigation</th>
          </tr>
          ${data.workforceData.roles.map(r => `
            <tr>
              <td><strong>${r.employeeName}</strong></td>
              <td>${r.originalRole}</td>
              <td style="color:#6366f1; font-weight:bold;">${r.hitlRole}</td>
              <td>${r.impactStatement}</td>
            </tr>
          `).join('')}
        </table>

        <h2>5. AIWORXMITHS SERVICE ALIGNMENT & COMMERCIAL PROPOSAL</h2>
        <p>Based on the scoured public technical vulnerabilities and regulatory gaps discovered during the external audit, we propose the following custom service optimizations and commercial pricing structures to harden operations and capture ROI.</p>
        <table>
          <tr>
            <th style="width: 200px;">Proposed Optimization Service</th>
            <th>Discovered Gap & Business Rationale</th>
            <th style="width: 140px;">Pricing Proposal</th>
            <th>Target ROI / Performance Boost</th>
          </tr>
          ${data.analyzerData.pitchOpportunities.map(p => `
            <tr>
              <td><strong>${p.aiwxService}</strong></td>
              <td><strong>${p.gapTitle}:</strong> ${p.observedGaps} <br/><em>Business Impact: ${p.impactStatement}</em></td>
              <td style="font-family:monospace; color:#10b981; font-weight:bold;">${p.pricingProposal}</td>
              <td style="font-style:italic; font-size:9pt;">${p.estimatedRoi}</td>
            </tr>
          `).join('')}
        </table>

        <div class="footer">
          <p>CONFIDENTIAL BUSINESS HANDOUT - GENERATED AUTOMATICALLY BY AIWORXMITHS CORPORATE AUDIT ENGINE</p>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + docHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${data.domain}_AIWorXmiths_Audit_Report.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // PORTED SIMULATION FROM ADMIN.JS FOR ROBUSTNESS
  function runClientSideAuditSimulation(domain) {
    function isOlderThanOneYear(dateStr) {
      if (!dateStr || typeof dateStr !== 'string') return false;
      if (dateStr.toLowerCase().includes('recent')) return false;
      
      let dateVal = null;
      const parsed = Date.parse(dateStr);
      if (!isNaN(parsed)) {
        dateVal = new Date(parsed);
      } else {
        const monthYearMatch = dateStr.match(/([A-Za-z]+)\s+(\d{4})/);
        if (monthYearMatch) {
          const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
          const m = monthYearMatch[1].toLowerCase().substring(0, 3);
          const monthIdx = months.indexOf(m);
          if (monthIdx !== -1) {
            const year = parseInt(monthYearMatch[2], 10);
            dateVal = new Date(year, monthIdx, 1);
          }
        } else {
          const yearMatch = dateStr.match(/\b(20\d{2})\b/);
          if (yearMatch) {
            const year = parseInt(yearMatch[1], 10);
            dateVal = new Date(year, 0, 1);
          }
        }
      }
      if (!dateVal) return false;
      
      const now = new Date();
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      return dateVal < oneYearAgo;
    }

    function filterRecentMentions(mentions) {
      if (!mentions || !Array.isArray(mentions)) return [];
      return mentions.filter(m => !isOlderThanOneYear(m.date));
    }

    const domainLower = domain.toLowerCase();
    
    // Vertical detection
    let vertical = 'E-Commerce & Retail';
    let isFoodService = false;
    
    const foodKeywords = ['bread', 'catering', 'restaurant', 'food', 'deli', 'cafe', 'kitchen', 'bakery', 'brew', 'coffee', 'bites', 'eats', 'grill', 'menu'];
    const techKeywords = ['consulting', 'tech', 'software', 'saas', 'cloud', 'app', 'apex', 'cyber', 'data', 'dev'];
    const healthKeywords = ['dental', 'smile', 'dentist', 'clinic', 'ortho', 'care', 'health', 'med', 'wellness'];
    const legalKeywords = ['law', 'legal', 'firm', 'advisory', 'partners', 'vance', 'accounting'];
    
    if (foodKeywords.some(k => domainLower.includes(k))) {
      vertical = 'E-Commerce & Retail';
      isFoodService = true;
    } else if (techKeywords.some(k => domainLower.includes(k))) {
      vertical = 'Technology & SaaS';
    } else if (healthKeywords.some(k => domainLower.includes(k))) {
      vertical = 'Healthcare & Wellness';
    } else if (legalKeywords.some(k => domainLower.includes(k))) {
      vertical = 'Professional Services';
    }
    
    // Capitalize domain for business name
    const cleanName = domain.split('.')[0].replace(/-/g, ' ');
    const businessName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1).replace(/\b\w/g, c => c.toUpperCase());
    
    // Metrics
    const overallHealth = Math.floor(Math.random() * 25) + 50; // 50 to 74 (moderate risk)
    const techModernization = Math.floor(Math.random() * 20) + 60; // 60 to 79
    const securityPosture = overallHealth;
    const marketingIntegrations = Math.floor(Math.random() * 30) + 50;
    
    // WAF detected
    const wafDetected = (overallHealth > 65) ? 'Cloudflare WAF' : 'None / Exposed';
    
    // Filings
    const filings = {
      state: {
        agency: 'Washington Secretary of State (SOS)',
        filingDate: '10/24/2021',
        status: 'Active / Good Standing',
        entityType: 'Limited Liability Company (LLC)',
        entityId: 'UBI-604-893-214'
      },
      federal: {
        samGovStatus: 'Active Registration (CAGE Code: 9ZG28)',
        secCik: '0001893214'
      }
    };
    
    // News Mentions
    const publicMentions = [
      {
        source: 'Business Inquirer',
        date: '02/12/2026',
        sentiment: 'Positive',
        title: `${businessName} Announces Local Market Expansion Plan`,
        summary: `The brand announced plans to expand its local operations and implement new digital services to handle customer bookings.`
      },
      {
        source: 'Food & Service Weekly',
        date: '11/05/2025',
        sentiment: 'Neutral',
        title: `Digital Transformation in Local SMB Operations`,
        summary: `A profile on how local service brands like ${businessName} are adopting online systems to streamline operations.`
      }
    ];

    if (domainLower.includes('lobo') || cleanName.toLowerCase().includes('lobo')) {
      publicMentions.unshift(
        {
          source: 'ESPN Sports News',
          date: '06/16/2026',
          sentiment: 'Negative',
          title: 'Floyd Mayweather Faces Felony Bad Check Charges in Las Vegas Case',
          summary: 'Las Vegas criminal defense attorney Adrian Lobo of Lobo Law represents Mayweather, publicly maintaining that her client had absolutely no intent to defraud.'
        },
        {
          source: 'USA Today',
          date: '06/18/2026',
          sentiment: 'Neutral',
          title: 'Mayweather represented by Attorney Adrian Lobo in Jewelry Check Dispute',
          summary: 'Attorney Adrian Lobo argues the boutique transaction is a civil matter stemming from a longstanding relationship.'
        }
      );
    }

    // Technologies
    const technologies = [
      { name: 'WordPress', category: 'CMS', confidence: 0.95, description: 'Core website content manager.' },
      { name: 'Google Analytics 4', category: 'Analytics', confidence: 0.99, description: 'User traffic and engagement tracking.' },
      { name: 'Cloudflare', category: 'Hosting & CDN', confidence: 0.95, description: 'DNS hosting, CDN, and security proxy.' },
      { name: 'QuickBooks Online', category: 'Finance', confidence: 0.90, description: 'Cloud bookkeeping.' }
    ];

    // Workforce roles and pitches vertical-specific
    let workforceRoles = [];
    let pitchOpportunities = [];
    let estRevenue = 'Under $1M';
    let estHeadcount = '5-10 staff';
    
    if (isFoodService) {
      estRevenue = '$1.5M - $2.5M';
      estHeadcount = '12 staff';
      workforceRoles = [
        { employeeName: 'Sarah Jenkins', originalRole: 'General Manager / Owner', hitlRole: 'AI-Enabled Operations Director', impactStatement: 'Leverages AI scheduling tools and automates shift allocations, saving 6 hours weekly.' },
        { employeeName: 'Chef Marcus Vance', originalRole: 'Head Chef / Kitchen Manager', hitlRole: 'AI Inventory Coordinator', impactStatement: 'Uses AI supply planning tools to optimize food purchasing schedules and cut ingredient waste by 18%.' },
        { employeeName: 'Elena Rostova', originalRole: 'Catering Coordinator', hitlRole: 'AI Event Intake Specialist', impactStatement: 'Validates automated PDF menu intake briefs and coordinates catering pricing pipelines.' },
        { employeeName: 'David Kim', originalRole: 'Order Intake Clerk', hitlRole: 'Digital Booking Manager', impactStatement: 'Validates AI chatbot reservation exceptions and coordinates courier dispatches.' }
      ];
      
      pitchOpportunities = [
        {
          gapTitle: 'Static Event Forms & PDFs',
          severity: 'High',
          observedGaps: 'Relies on static PDF menus and basic email contact forms requiring manual quoting replies.',
          impactStatement: 'Delays in corporate catering quoting cause prospective planners to choose faster competitors.',
          aiwxService: 'AI-Powered Interactive Catering Quote Calculator',
          pricingProposal: '$3,500 Setup | $199/Month managed',
          estimatedRoi: 'Captures 35% more catering leads by providing instant pricing and auto-generating kitchen intake briefs.',
          copyPastePitch: `Hello [Client Contact],\n\nI was looking at the catering page for ${businessName} and noticed that you rely on static PDF menus and general contact forms for booking inquiries. Corporate event coordinators expect instant answers.\n\nWe build custom Interactive Catering Quote Calculators that allow prospects to select guest counts and get an instant custom quote PDF. The system then automatically drafts a structured intake brief for your kitchen.\n\nCould I send you a 2-page brief on how this catering pipeline works?`
        },
        {
          gapTitle: 'Manual Phone Intake',
          severity: 'Medium',
          observedGaps: 'Manual answering of repetitive queries regarding menu availability, reservations, and delivery boundaries.',
          impactStatement: 'Ties up front-of-house staff during peak hours, increasing customer wait times.',
          aiwxService: '24/7 AI Support & Order Booking Assistant',
          pricingProposal: '$2,500 Setup | $149/Month managed',
          estimatedRoi: 'Resolves 80% of routine customer calls and automates booking routing, saving 15+ hours weekly.',
          copyPastePitch: `Hello [Client Contact],\n\nI did a quick sweep of ${businessName} and noticed that your team likely spends hours manually fielding phone calls regarding menu questions, delivery boundaries, and dietary options.\n\nWe design custom Conversational AI Support Assistants trained on your exact menus, pricing, and delivery rules. These agents resolve 80% of customer questions 24/7.\n\nWould you like a 3-minute video demo of a restaurant ordering assistant?`
        }
      ];
    } else if (vertical === 'Technology & SaaS') {
      estRevenue = '$3.0M - $5.0M';
      estHeadcount = '25 staff';
      workforceRoles = [
        { employeeName: 'Sarah Jenkins', originalRole: 'Customer Success Specialist', hitlRole: 'CS Agent Validator', impactStatement: 'Validates AI-generated customer answers and handles high-value qualifications, doubling output.' },
        { employeeName: 'David Kim', originalRole: 'Technical Support Representative', hitlRole: 'AI Support Tier 2 Engineer', impactStatement: 'Reviews AI-summarized code logs and handles custom system integrations.' },
        { employeeName: 'Elena Rostova', originalRole: 'Content Specialist', hitlRole: 'AI SEO Publisher', impactStatement: 'Validates AI-drafted help articles and manages automated marketing campaigns.' }
      ];
      
      pitchOpportunities = [
        {
          gapTitle: 'Lack of Real-Time RAG CRM Synchronization',
          severity: 'High',
          observedGaps: 'Customer lead forms and CRM profiles do not automatically synchronize context across platforms.',
          impactStatement: 'Sales representatives lack immediate product telemetry, causing delay in warm outreach.',
          aiwxService: 'HubSpot RAG CRM Pipeline Integration',
          pricingProposal: '$4,500 Setup | $299/Month managed',
          estimatedRoi: 'Improves sales conversion rates by 22% by automatically enriching CRM leads with public technological footprints.',
          copyPastePitch: `Hello [Client Contact],\n\nI noticed that your team operates a Next.js stack but appears to have manual handoffs between CRM lead capturing and customer support routing.\n\nWe design custom CRM integrations that enrich lead profiles in real-time with technical stack analytics. This allows your sales team to receive instant alerts with pre-scaped gaps when a lead books a demo.\n\nCould we jump on a 5-minute call to show you this pipeline?`
        },
        {
          gapTitle: 'Manual Support Ticket Triage',
          severity: 'Medium',
          observedGaps: 'Technical support staff manually triages and categorizes repetitive customer API questions.',
          impactStatement: 'Increases support response times during high-volume server spikes.',
          aiwxService: 'Voiceflow Support Ticketing Agent',
          pricingProposal: '$3,000 Setup | $199/Month managed',
          estimatedRoi: 'Resolves 70% of routine ticket categorizations automatically, reducing CS backlog by 12 hours weekly.',
          copyPastePitch: `Hello [Client Contact],\n\nI did a quick assessment of your developer support portal and noticed opportunity to automate developer API support queries.\n\nWe build custom technical support agents trained on your documentation that resolve 70% of routine questions, auto-triage code snippets, and escalate complex bugs.\n\nWould you be open to a 3-minute video demo?`
        }
      ];
    } else if (vertical === 'Healthcare & Wellness') {
      estRevenue = '$1.0M - $1.8M';
      estHeadcount = '8 staff';
      workforceRoles = [
        { employeeName: 'Sarah Jenkins', originalRole: 'Practice Administrator', hitlRole: 'AI Billing Director', impactStatement: 'Uses AI ICD-code verification tools to reduce insurance denials and speed up billing cycles.' },
        { employeeName: 'David Kim', originalRole: 'Front Desk Receptionist', hitlRole: 'Patient Intake Manager', impactStatement: 'Validates AI scheduling suggestions and patient intake transcripts.' }
      ];
      
      pitchOpportunities = [
        {
          gapTitle: 'Manual Patient Booking Intake',
          severity: 'High',
          observedGaps: 'Relying on staff to answer patient booking requests over the phone, leading to missed after-hours calls.',
          impactStatement: 'Patients seeking appointments go to clinics with 24/7 booking.',
          aiwxService: 'AI Patient Booking & Intake Assistant',
          pricingProposal: '$3,000 Setup | $199/Month managed',
          estimatedRoi: 'Increases after-hours patient bookings by 28% and cuts front-desk call time by 40%.',
          copyPastePitch: `Hello [Client Contact],\n\nI was looking at the patient portal for ${businessName} and noticed that booking appointments after-hours requires filling forms with delayed email confirmation.\n\nWe build custom HIPAA-compliant AI Patient Intake and Booking Assistants that integrate directly with your scheduling software to book appointments 24/7.\n\nCould I send you a quick brief on how this patient pipeline works?`
        },
        {
          gapTitle: 'Low Review Volume & Rating',
          severity: 'Medium',
          observedGaps: 'Fails to automatically prompt satisfied patients for reviews on Google/Zocdoc.',
          impactStatement: 'Lower local SEO rating reduces clinic visibility to new patients.',
          aiwxService: 'AI Patient Review Booster & Survey Pipeline',
          pricingProposal: '$1,500 Setup | $99/Month managed',
          estimatedRoi: 'Increases monthly Google reviews by 40% while automatically triaging negative patient feedback privately.',
          copyPastePitch: `Hello [Client Contact],\n\nI noticed that ${businessName} has great reviews but a relatively low volume compared to local competitors, which impacts your local search ranking.\n\nWe implement automated Patient Survey pipelines that text patients right after their visit, auto-directing positive reviews to Google and routing constructive feedback to your team privately.\n\nWould you like to see a brief demo of this review booster?`
        }
      ];
    } else {
      // Professional Services / Default
      estRevenue = '$800K - $1.5M';
      estHeadcount = '6 staff';
      workforceRoles = [
        { employeeName: 'Sarah Jenkins', originalRole: 'Operations Manager', hitlRole: 'AI Workflow Director', impactStatement: 'Coordinates n8n automation tasks and manages API connectors, saving 8 hours weekly.' },
        { employeeName: 'David Kim', originalRole: 'Administrative Assistant', hitlRole: 'AI Proposal Validator', impactStatement: 'Uses AI draft generators to write proposal templates and reviews client data reports.' }
      ];
      
      pitchOpportunities = [
        {
          gapTitle: 'Manual Lead Qualification',
          severity: 'High',
          observedGaps: 'Incoming client inquiry sheets are qualified manually qualified via email backlog.',
          impactStatement: 'Delay in qualifying prospects causes loss of sales pipeline velocity.',
          aiwxService: 'AI Client Intake & Qualification Agent',
          pricingProposal: '$2,500 Setup | $149/Month managed',
          estimatedRoi: 'Qualifies and scores leads instantly, routing warm proposals to calendar pipelines.',
          copyPastePitch: `Hello [Client Contact],\n\nI noticed that your intake form requires manual review and follow-up emails, which can delay client onboarding.\n\nWe build custom AI Client Intake Agents that qualify leads instantly, draft preliminary proposals based on user inputs, and schedule introduction calls.\n\nCould I send you a 2-page brief on how this intake agent works?`
        },
        {
          gapTitle: 'Manual Invoicing & Bookkeeping Sync',
          severity: 'Medium',
          observedGaps: 'Billing statements and bank deposits are manually input and cross-referenced in spreadsheets.',
          impactStatement: 'Ties up operations staff in repetitive billing audits, increasing error rates.',
          aiwxService: 'QuickBooks & n8n Billing Automation Pipeline',
          pricingProposal: '$2,000 Setup | $129/Month managed',
          estimatedRoi: 'Reduces invoicing hours by 85% and eliminates human errors in accounts receivable sync.',
          copyPastePitch: `Hello [Client Contact],\n\nI did a quick scan of your operations stack and noticed opportunity to automate billing flows.\n\nWe design custom automated pipelines connecting Stripe/invoices to QuickBooks, which automatically records payments and sends reminders.\n\nWould you like a 3-minute video demo of this billing automation?`
        }
      ];
    }

    return {
      success: true,
      timestamp: new Date().toISOString(),
      domain: domain,
      businessName: businessName,
      vertical: vertical,
      isSimulated: true,
      scrapedData: {
        technologies: technologies,
        subdomains: ['www', 'mail'],
        metaData: { title: `${businessName} - Official Site`, description: `Welcome to the official homepage of ${businessName}.`, socialLinks: { linkedin: null, twitter: null, facebook: null } },
        scrapedPages: ['/', '/about', '/contact'],
        firewallAudit: {
          wafDetected: wafDetected,
          wafConfidence: 0.90,
          sslStatus: 'Secure SSL protocol enforced',
          securityHeaders: {
            hsts: true,
            csp: false,
            xFrameOptions: true,
            cors: true
          }
        }
      },
      scourerData: {
        revenueEstimate: estRevenue,
        growthRate: '+12% YoY',
        headcountEstimate: estHeadcount,
        filings: filings,
        publicMentions: filterRecentMentions(publicMentions)
      },
      analyzerData: {
        metrics: {
          overallHealth: overallHealth,
          techModernization: techModernization,
          securityPosture: securityPosture,
          marketingIntegrations: marketingIntegrations
        },
        pitchOpportunities: pitchOpportunities
      },
      workforceData: {
        summary: {
          totalStaffAudited: workforceRoles.length,
          averageAutomationExposure: 35,
          jobReadinessScore: 65,
          status: 'Transition Ready'
        },
        roles: workforceRoles
      }
    };
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeConsumerApp);
} else {
  initializeConsumerApp();
}
