// outreach_ui.js - Modular Outreach Form Controllers & Supabase Sync

let scoutedProspects = [];

async function loadSupabaseCreds() {
  const statusText = document.getElementById('sbStatusText');
  statusText.textContent = "Loading configuration...";
  try {
    const response = await fetch(getApiUrl('/api/supabase-credentials'));
    const res = await response.json();
    if (res.success) {
      document.getElementById('sbUrl').value = res.supabaseUrl || '';
      if (res.hasKey) {
        statusText.innerHTML = "🟢 Connected (Service Key Vaulted)";
      } else {
        statusText.innerHTML = "⚪ Keys missing (Configure below)";
      }
    }
  } catch (err) {
    statusText.textContent = "Error loading Supabase config";
  }
}

async function saveSupabaseCreds() {
  const url = document.getElementById('sbUrl').value.trim();
  const key = document.getElementById('sbKey').value.trim();
  const statusText = document.getElementById('sbStatusText');
  
  if (!url || !key) {
    alert('Supabase URL and Service Role Key are required.');
    return;
  }

  statusText.textContent = "Saving credentials...";
  try {
    const response = await fetch(getApiUrl('/api/supabase-credentials'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supabaseUrl: url, supabaseKey: key })
    });
    const res = await response.json();
    if (res.success) {
      statusText.innerHTML = "🟢 Connected (Service Key Vaulted)";
      document.getElementById('sbKey').value = ''; // clear key field
      alert('Supabase credentials successfully saved & masked.');
    } else {
      statusText.innerHTML = "❌ Save failed: " + res.error;
      alert('Failed to save Supabase credentials: ' + res.error);
    }
  } catch (err) {
    statusText.innerHTML = "❌ Connection error";
    alert('Failed to connect to backend configuration server.');
  }
}

async function scoutLeads() {
  const niche = document.getElementById('outreachNiche').value.trim();
  const location = document.getElementById('outreachLocation').value.trim();
  const apiKey = document.getElementById('outreachApiKey').value.trim();
  const grid = document.getElementById('prospectsGrid');
  const logsText = document.getElementById('scoutingLogs');
  const logsContainer = document.getElementById('scoutingLogsContainer');

  if (!niche || !location) {
    alert('Please fill out both target niche and location.');
    return;
  }

  logsContainer.style.display = 'block';
  logsText.textContent = `[Agent] Initializing local scouting run for vertical: ${niche} in ${location}...\n`;

  const progressSteps = [
    `[Agent] Querying Firecrawl local search index for candidates...\n`,
    `[Agent] Found 4 candidate domains. Initiating technical auditing loop...\n`,
    `[System] Crawling subdomains, headers, and SSL records...\n`,
    `[System] Scouring public registrations and workforce indicators...\n`,
    `[System] Running SWOT model & B2B capability upskilling transition analysis...\n`
  ];

  let stepIdx = 0;
  const logInterval = setInterval(() => {
    if (stepIdx < progressSteps.length) {
      logsText.textContent += progressSteps[stepIdx++];
      logsText.scrollTop = logsText.scrollHeight;
    }
  }, 1800);

  // Render skeleton loaders inside the grid
  renderProspectsSkeletons();

  try {
    const response = await fetch(getApiUrl('/api/scout-prospects'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ niche, location, apiKey })
    });
    const res = await response.json();
    
    clearInterval(logInterval);
    
    if (res.success && res.prospects && res.prospects.length > 0) {
      scoutedProspects = res.prospects;
      logsText.textContent += `[Agent] SUCCESS: Compiled ${res.prospects.length} detailed lead profiles!\n`;
      renderProspectsGrid();
    } else {
      logsText.textContent += "[Agent] Failed: No candidate domains found or audit failed.\n";
      grid.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--danger-color);">No prospects found. Verify your Firecrawl API key.</div>`;
    }
  } catch (err) {
    clearInterval(logInterval);
    logsText.textContent += "[-] Error: " + err.message + "\n";
    grid.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--danger-color);">Failed to connect to backend auditor server.</div>`;
  }
}

function renderProspectsSkeletons() {
  const grid = document.getElementById('prospectsGrid');
  grid.innerHTML = `
    <div class="card skeleton-card" style="padding: 1.25rem; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:1rem;">
      <div class="skeleton-shimmer" style="height: 1.5rem; width: 60%; border-radius: 4px;"></div>
      <div class="skeleton-shimmer" style="height: 1rem; width: 40%; border-radius: 4px;"></div>
      <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.5rem;">
        <div class="skeleton-shimmer" style="height: 4rem; width: 100%; border-radius: 4px;"></div>
      </div>
    </div>
    <div class="card skeleton-card" style="padding: 1.25rem; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:1rem;">
      <div class="skeleton-shimmer" style="height: 1.5rem; width: 50%; border-radius: 4px;"></div>
      <div class="skeleton-shimmer" style="height: 1rem; width: 30%; border-radius: 4px;"></div>
      <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.5rem;">
        <div class="skeleton-shimmer" style="height: 4rem; width: 100%; border-radius: 4px;"></div>
      </div>
    </div>
  `;
}

function renderProspectsGrid() {
  const grid = document.getElementById('prospectsGrid');
  grid.innerHTML = '';

  scoutedProspects.forEach((prospect, idx) => {
    const gapsHtml = prospect.gaps.map(g => `
      <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:0.6rem; border-radius:4px; font-size:0.75rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
          <strong style="color:var(--accent-color);">${g.title}</strong>
          <span class="severity-badge ${g.severity.toLowerCase()}" style="font-size:0.6rem; padding:1px 4px; border-radius:2px; font-weight:700;">${g.severity}</span>
        </div>
        <p style="color:var(--text-primary); margin:0.25rem 0;">${g.observed}</p>
        <p style="color:var(--text-secondary); margin:0; font-size:0.7rem;"><strong>Solution:</strong> ${g.service} (ROI: ${g.roi})</p>
      </div>
    `).join('');

    const status = prospect.outreachStatus || 'PENDING';
    let badgeColor = 'rgba(255,255,255,0.05)';
    let badgeTextColor = 'var(--text-secondary)';
    
    if (status === 'SENT') {
      badgeColor = 'rgba(59,130,246,0.1)';
      badgeTextColor = '#3b82f6';
    } else if (status === 'CONNECTED') {
      badgeColor = 'rgba(16,185,129,0.1)';
      badgeTextColor = 'var(--success-color)';
    } else if (status === 'INQUIRY') {
      badgeColor = 'rgba(245,158,11,0.1)';
      badgeTextColor = 'var(--warning-color)';
    }

    const card = document.createElement('div');
    card.className = 'card';
    card.style = 'padding: 1.25rem; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:1rem; position:relative; background:var(--bg-surface);';
    
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:start; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:0.75rem;">
        <div>
          <h3 style="font-family:'Outfit', sans-serif; font-size:1.1rem; font-weight:600; color:var(--text-primary); margin:0;">${prospect.businessName}</h3>
          <a href="https://${prospect.domain}" target="_blank" style="font-size:0.75rem; color:#00e5ff; text-decoration:none; margin-top:0.2rem; display:inline-block;">🌐 ${prospect.domain}</a>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.25rem;">
          <span class="post-indicator" style="background:rgba(0,158,230,0.1); color:var(--accent-color); font-size:0.7rem; font-weight:700; padding:0.25rem 0.5rem; border-radius:4px;">${prospect.vertical}</span>
          <span id="outreachBadge_${idx}" title="Click to cycle stages (Simulation)" style="background:${badgeColor}; color:${badgeTextColor}; font-size:0.65rem; font-weight:700; padding:0.15rem 0.4rem; border-radius:4px; text-transform:uppercase; cursor:pointer;" onclick="cycleOutreachStatus(${idx})">${status}</span>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:0.5rem;">
        <div style="font-size:0.8rem; font-weight:600; color:var(--text-secondary);">Audited Technical Vulnerabilities:</div>
        ${gapsHtml}
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto; padding-top:0.75rem; border-top:1px solid rgba(255,255,255,0.05);">
        <div style="display:flex; gap:0.5rem;">
          <button class="primary-btn" style="padding:0.4rem 0.8rem; font-size:0.75rem; background:linear-gradient(135deg, #009ee6, #0056b3); color:#fff; border:none; border-radius:4px; font-weight:600; cursor:pointer;" onclick="triggerOutreachModal(${idx})">📢 Outreach DM</button>
          <button id="btnExportCRM_${idx}" class="primary-btn" style="padding:0.4rem 0.8rem; font-size:0.75rem; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:var(--text-primary); border-radius:4px; font-weight:600; cursor:pointer;" onclick="exportLead(${idx})">📤 Sync CRM</button>
        </div>
        <span id="syncBadge_${idx}" style="font-size:0.7rem; font-weight:600; color:var(--text-secondary);">Not Synced</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

function cycleOutreachStatus(index) {
  const prospect = scoutedProspects[index];
  const stages = ['PENDING', 'SENT', 'CONNECTED', 'INQUIRY'];
  const current = prospect.outreachStatus || 'PENDING';
  const nextIdx = (stages.indexOf(current) + 1) % stages.length;
  prospect.outreachStatus = stages[nextIdx];
  renderProspectsGrid();
}

function triggerOutreachModal(index) {
  const prospect = scoutedProspects[index];
  const selectedGap = prospect.gaps[0];
  if (!selectedGap) return;

  document.getElementById('modalProspectIdx').value = index;
  document.getElementById('modalProspectTitle').innerText = `📢 Outreach to ${prospect.businessName}`;
  document.getElementById('modalPitchText').value = selectedGap.pitch;
  
  const modal = document.getElementById('outreachModal');
  modal.style.display = 'flex';
}

function closeOutreachModal() {
  document.getElementById('outreachModal').style.display = 'none';
}

function submitModalOutreach() {
  const idx = document.getElementById('modalProspectIdx').value;
  const prospect = scoutedProspects[idx];
  const platform = document.getElementById('modalPlatform').value;
  const text = document.getElementById('modalPitchText').value.trim();

  if (!text) {
    alert('Please enter a pitch first.');
    return;
  }

  sendOutreach(prospect.domain, platform, text);
  closeOutreachModal();
}

async function sendOutreach(domain, platform, text) {
  console.log(`Sending outreach to ${domain} on ${platform}...`);
  try {
    const response = await fetch(getApiUrl('/api/outreach-send'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, platform, text })
    });
    const res = await response.json();
    if (res.success) {
      alert(`Outreach message successfully sent via ${platform} API/headless fallback!`);
      const prospect = scoutedProspects.find(p => p.domain === domain);
      if (prospect) {
        prospect.outreachStatus = 'SENT';
        renderProspectsGrid();
      }
    } else {
      alert("Outreach failed: " + res.error);
    }
  } catch (err) {
    alert("Failed to communicate with outreach backend.");
  }
}

async function exportLead(index) {
  const prospect = scoutedProspects[index];
  const btn = document.getElementById(`btnExportCRM_${index}`);
  const badge = document.getElementById(`syncBadge_${index}`);
  
  btn.disabled = true;
  btn.textContent = "Syncing...";

  try {
    const response = await fetch(getApiUrl('/api/export-crm'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospect })
    });
    const res = await response.json();
    if (res.success) {
      btn.textContent = "Synced ✓";
      badge.textContent = "Synced to Sales CC";
      badge.style.color = "var(--success-color)";
    } else {
      alert("CRM sync failed: " + res.error);
      btn.disabled = false;
      btn.textContent = "Sync CRM";
    }
  } catch (err) {
    alert("Failed to connect to local CRM export endpoint.");
    btn.disabled = false;
    btn.textContent = "Sync CRM";
  }
}
