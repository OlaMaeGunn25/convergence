// traffic_agent.js - Extracted simulated audience agent & engagement charts logic

function toggleSimulatedTrafficAgent() {
      const btn = document.getElementById('btnToggleSimTraffic');
      const logs = document.getElementById('simTrafficLogs');
      
      if (simTrafficAgentActive) {
        simTrafficAgentActive = false;
        clearInterval(simTrafficTimer);
        btn.innerText = 'Start Traffic Agent';
        btn.style.background = 'linear-gradient(135deg, var(--accent-color), #00e5ff)';
        logs.innerText += `\n[Traffic Agent] Stopped. Live metrics paused.`;
        logs.scrollTop = logs.scrollHeight;
      } else {
        simTrafficAgentActive = true;
        btn.innerText = 'Stop Traffic Agent';
        btn.style.background = 'linear-gradient(135deg, var(--danger-color), #ff5252)';
        logs.innerText += `\n[Traffic Agent] Activated. Listening on UTM links...\n`;
        logs.scrollTop = logs.scrollHeight;
        
        simTrafficTimer = setInterval(() => {
          const addImp = 2 + Math.floor(Math.random() * 5);
          const clickRegistered = Math.random() > 0.65;
          const convRegistered = clickRegistered && Math.random() > 0.85;
          
          simMetrics.impressions += addImp;
          if (clickRegistered) {
            simMetrics.clicks += 1;
            const plats = ['linkedin', 'threads', 'instagram', 'facebook'];
            const p = plats[Math.floor(Math.random() * plats.length)];
            
            const lastIdx = simMetrics.dailyClicks[p].length - 1;
            if (lastIdx >= 0) {
              simMetrics.dailyClicks[p][lastIdx] += 1;
            }
            
            const logLines = [
              `[Traffic Agent] Guest clicked ${p.toUpperCase()} UTM link (Post ${1 + Math.floor(Math.random()*6)}) from New York. Clicks +1`,
              `[Traffic Agent] Organic visit from ${p.toUpperCase()} content bridge redirecting to /services. Clicks +1`,
              `[Traffic Agent] Mobile user followed ${p.toUpperCase()} post visual to scoping page. Clicks +1`
            ];
            logs.innerText += `\n${logLines[Math.floor(Math.random() * logLines.length)]}`;
          }
          
          if (convRegistered) {
            simMetrics.conversions += 1;
            const lastIdx = simMetrics.dailyConversions.length - 1;
            if (lastIdx >= 0) {
              simMetrics.dailyConversions[lastIdx] += 1;
            }
            logs.innerText += `\n🎯 [CONVERSION] Free Operations Diagnostics Scoping session booked! Conversions +1`;
            playAlertSound();
          }
          
          simMetrics.ctr = ((simMetrics.clicks / simMetrics.impressions) * 100).toFixed(2) + "%";
          
          const valImp = document.getElementById('valImpressions');
          const valClk = document.getElementById('valClicks');
          const valCtr = document.getElementById('valCtr');
          const valConv = document.getElementById('valConversions');
          if (valImp) valImp.innerText = simMetrics.impressions.toLocaleString();
          if (valClk) valClk.innerText = simMetrics.clicks.toLocaleString();
          if (valCtr) valCtr.innerText = simMetrics.ctr;
          if (valConv) valConv.innerText = simMetrics.conversions.toLocaleString();
          
          logs.scrollTop = logs.scrollHeight;
          renderSimulatedCharts();
        }, 3000);
      }
    }

function loadSimulatedAnalytics() {
      try {
        const res = await fetch(getApiUrl('/api/simulated-analytics'));
        const data = await res.json();
        if (data.success) {
          simMetrics.dailyLabels = data.labels || [];
          simMetrics.dailyClicks = data.clicks || { linkedin: [], threads: [], instagram: [], facebook: [] };
          simMetrics.dailyConversions = data.conversions || [];
          
          let totalClicks = 0;
          for (let p in simMetrics.dailyClicks) {
            totalClicks += simMetrics.dailyClicks[p].reduce((a, b) => a + b, 0);
          }
          simMetrics.clicks = totalClicks;
          simMetrics.conversions = simMetrics.dailyConversions.reduce((a, b) => a + b, 0);
          simMetrics.impressions = Math.floor(totalClicks * 38.5);
          simMetrics.ctr = ((simMetrics.clicks / simMetrics.impressions) * 100).toFixed(2) + "%";

          const valImp = document.getElementById('valImpressions');
          const valClk = document.getElementById('valClicks');
          const valCtr = document.getElementById('valCtr');
          const valConv = document.getElementById('valConversions');
          if (valImp) valImp.innerText = simMetrics.impressions.toLocaleString();
          if (valClk) valClk.innerText = simMetrics.clicks.toLocaleString();
          if (valCtr) valCtr.innerText = simMetrics.ctr;
          if (valConv) valConv.innerText = simMetrics.conversions.toLocaleString();

          renderSimulatedCharts();
        }
      } catch (err) {
        console.warn('Failed to load initial simulated analytics, falling back to local simulation data:', err);
        simMetrics.dailyLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        simMetrics.dailyClicks = {
          linkedin: [12, 18, 15, 24, 20, 28, 32],
          threads: [8, 12, 9, 15, 14, 22, 25],
          instagram: [10, 14, 11, 19, 18, 25, 29],
          facebook: [5, 9, 7, 12, 10, 16, 18]
        };
        simMetrics.dailyConversions = [2, 3, 2, 4, 3, 5, 6];
        
        let totalClicks = 0;
        for (let p in simMetrics.dailyClicks) {
          totalClicks += simMetrics.dailyClicks[p].reduce((a, b) => a + b, 0);
        }
        simMetrics.clicks = totalClicks;
        simMetrics.conversions = simMetrics.dailyConversions.reduce((a, b) => a + b, 0);
        simMetrics.impressions = Math.floor(totalClicks * 38.5);
        simMetrics.ctr = ((simMetrics.clicks / simMetrics.impressions) * 100).toFixed(2) + "%";

        const valImp = document.getElementById('valImpressions');
        const valClk = document.getElementById('valClicks');
        const valCtr = document.getElementById('valCtr');
        const valConv = document.getElementById('valConversions');
        if (valImp) valImp.innerText = simMetrics.impressions.toLocaleString();
        if (valClk) valClk.innerText = simMetrics.clicks.toLocaleString();
        if (valCtr) valCtr.innerText = simMetrics.ctr;
        if (valConv) valConv.innerText = simMetrics.conversions.toLocaleString();

        renderSimulatedCharts();
      }
    }

function renderSimulatedCharts() {
      const lineContainer = document.getElementById('clicksLineChartContainer');
      const barContainer = document.getElementById('clicksBarChartContainer');
      if (!lineContainer || !barContainer) return;

      const lineRect = lineContainer.getBoundingClientRect();
      const lineWidth = lineRect.width || 300;
      const lineHeight = 190;
      const padding = 25;
      
      const dailyTotals = [];
      const numDays = simMetrics.dailyLabels.length;
      for (let i = 0; i < numDays; i++) {
        let daySum = 0;
        for (let p in simMetrics.dailyClicks) {
          daySum += simMetrics.dailyClicks[p][i] || 0;
        }
        dailyTotals.push(daySum);
      }
      
      const maxVal = Math.max(...dailyTotals, 10);
      
      const points = [];
      for (let i = 0; i < numDays; i++) {
        const x = padding + (i * (lineWidth - padding * 2)) / (numDays - 1);
        const y = lineHeight - padding - ((dailyTotals[i] / maxVal) * (lineHeight - padding * 2));
        points.push(`${x},${y}`);
      }
      
      let labelsMarkup = '';
      simMetrics.dailyLabels.forEach((label, i) => {
        const x = padding + (i * (lineWidth - padding * 2)) / (numDays - 1);
        labelsMarkup += `<text x="${x}" y="${lineHeight - 5}" fill="var(--text-secondary)" font-size="8" text-anchor="middle">${label}</text>`;
      });

      lineContainer.innerHTML = `
        <svg width="100%" height="100%" viewBox="0 0 ${lineWidth} ${lineHeight}" style="overflow:visible;">
          <line x1="${padding}" y1="${padding}" x2="${lineWidth - padding}" y2="${padding}" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
          <line x1="${padding}" y1="${lineHeight/2}" x2="${lineWidth - padding}" y2="${lineHeight/2}" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
          <line x1="${padding}" y1="${lineHeight - padding}" x2="${lineWidth - padding}" y2="${lineHeight - padding}" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
          <path d="M ${padding},${lineHeight - padding} L ${points.map(p=>p).join(' L ')} L ${lineWidth - padding},${lineHeight - padding} Z" fill="url(#lineGrad)" opacity="0.15" />
          <path d="M ${points.join(' L ')}" fill="none" stroke="var(--accent-color)" stroke-width="2.5" />
          ${points.map((p, i) => {
            const [cx, cy] = p.split(',');
            return `<circle cx="${cx}" cy="${cy}" r="3.5" fill="#00e5ff" stroke="#0a0c10" stroke-width="1" />
                    <text x="${cx}" y="${cy - 8}" fill="var(--text-primary)" font-size="8" font-weight="700" text-anchor="middle">${dailyTotals[i]}</text>`;
          }).join('')}
          ${labelsMarkup}
          <defs>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#00e5ff" />
              <stop offset="100%" stop-color="#00e5ff" stop-opacity="0" />
            </linearGradient>
          </defs>
        </svg>
      `;

      const barRect = barContainer.getBoundingClientRect();
      const barWidth = barRect.width || 250;
      const barHeight = 190;
      const barPadding = 30;

      const platformTotals = {
        linkedin: simMetrics.dailyClicks.linkedin.reduce((a,b)=>a+b, 0),
        threads: simMetrics.dailyClicks.threads.reduce((a,b)=>a+b, 0),
        instagram: simMetrics.dailyClicks.instagram.reduce((a,b)=>a+b, 0),
        facebook: simMetrics.dailyClicks.facebook.reduce((a,b)=>a+b, 0)
      };

      const maxPlatVal = Math.max(...Object.values(platformTotals), 10);
      const platforms = ['linkedin', 'threads', 'instagram', 'facebook'];
      const platformColors = {
        linkedin: '#009ee6',
        threads: '#ffffff',
        instagram: '#e1306c',
        facebook: '#1877f2'
      };

      let barsMarkup = '';
      platforms.forEach((plat, i) => {
        const x = barPadding + (i * (barWidth - barPadding * 1.5)) / platforms.length;
        const val = platformTotals[plat];
        const h = ((val / maxPlatVal) * (barHeight - barPadding * 2));
        const y = barHeight - barPadding - h;
        const color = platformColors[plat];
        
        barsMarkup += `
          <rect x="${x}" y="${y}" width="22" height="${h}" fill="${color}" rx="3" opacity="0.85" />
          <text x="${x + 11}" y="${y - 6}" fill="var(--text-primary)" font-size="8" font-weight="700" text-anchor="middle">${val}</text>
          <text x="${x + 11}" y="${barHeight - 12}" fill="var(--text-secondary)" font-size="8" font-weight="600" text-anchor="middle">${plat.toUpperCase().substring(0,4)}</text>
        `;
      });

      barContainer.innerHTML = `
        <svg width="100%" height="100%" viewBox="0 0 ${barWidth} ${barHeight}">
          <line x1="${barPadding}" y1="${barHeight - barPadding}" x2="${barWidth - 10}" y2="${barHeight - barPadding}" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
          ${barsMarkup}
        </svg>
      `;
    }

