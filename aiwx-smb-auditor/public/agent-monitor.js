/**
 * Floating Agent Monitor (Phase 4, MON-02/03)
 * ===========================================
 * A self-contained, dependency-free floating panel (sits above the connection
 * monitor) showing the live agent roster states and the most recent agent/task
 * telemetry events — the HITL's real-time window into what the agents are doing.
 * Short-interval polling (no SSE/WS), theme-aware, fails quietly when
 * unauthorized/offline.
 *
 * Drop-in: <script src="/agent-monitor.js" defer></script>
 */
(function () {
  'use strict';
  if (window.__aiwxAgentMonitorLoaded) return;
  window.__aiwxAgentMonitorLoaded = true;

  var AGENTS_EP = window.AIWX_AGENTS_ENDPOINT || '/api/agents';
  var TELEM_EP = window.AIWX_TELEMETRY_ENDPOINT || '/api/agents/telemetry';
  var POLL_MS = window.AIWX_AGENTS_POLL_MS || 5000;
  var TENANT = window.AIWX_TENANT_ID || '';

  var STATUS_COLOR = {
    active: '#10b981', ready: '#22d3ee', training: '#f59e0b', configuring: '#f59e0b',
    provisioned: '#94a3b8', paused: '#f97316', shutdown: '#64748b'
  };
  var EVENT_COLOR = { failed: '#f43f5e', blocked: '#f97316', completed: '#10b981' };

  var css = ''
    + '.aiwx-am{position:fixed;right:20px;bottom:76px;z-index:2147482900;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}'
    + '.aiwx-am *{box-sizing:border-box;}'
    + '.aiwx-am-btn{display:flex;align-items:center;gap:8px;cursor:pointer;border:1px solid rgba(148,163,184,.35);background:#0f172a;color:#e2e8f0;'
    + 'padding:8px 12px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.28);font-size:13px;font-weight:600;}'
    + '.aiwx-am-dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto;background:#64748b;}'
    + '.aiwx-am-count{opacity:.75;font-weight:500;}'
    + '.aiwx-am-panel{position:absolute;right:0;bottom:52px;width:340px;max-height:64vh;overflow:hidden;display:none;flex-direction:column;'
    + 'background:#0f172a;color:#e2e8f0;border:1px solid rgba(148,163,184,.28);border-radius:14px;box-shadow:0 16px 44px rgba(0,0,0,.42);}'
    + '.aiwx-am.open .aiwx-am-panel{display:flex;}'
    + '.aiwx-am-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(148,163,184,.2);font-size:13px;font-weight:700;}'
    + '.aiwx-am-refresh{cursor:pointer;background:none;border:none;color:#94a3b8;font-size:12px;padding:4px 6px;border-radius:6px;}'
    + '.aiwx-am-sec{font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#94a3b8;padding:10px 14px 4px;}'
    + '.aiwx-am-agents{display:flex;flex-wrap:wrap;gap:6px;padding:2px 12px 8px;}'
    + '.aiwx-am-chip{display:flex;align-items:center;gap:5px;font-size:10.5px;padding:3px 8px;border-radius:999px;background:rgba(148,163,184,.10);}'
    + '.aiwx-am-feed{overflow-y:auto;padding:0 8px 8px;}'
    + '.aiwx-am-ev{display:flex;gap:8px;padding:6px 8px;border-radius:8px;font-size:11.5px;}'
    + '.aiwx-am-ev:hover{background:rgba(148,163,184,.08);}'
    + '.aiwx-am-ev b{font-weight:600;}'
    + '.aiwx-am-ev span{color:#94a3b8;margin-left:auto;font-size:10px;white-space:nowrap;}'
    + '.aiwx-am-empty{padding:16px 14px;font-size:12px;color:#94a3b8;text-align:center;}'
    + '@media (prefers-color-scheme:light){.aiwx-am-btn,.aiwx-am-panel{background:#fff;color:#0f172a;border-color:rgba(15,23,42,.14);}.aiwx-am-sec,.aiwx-am-refresh,.aiwx-am-ev span,.aiwx-am-empty{color:#64748b;}}';

  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function q(ep) { return ep + (TENANT ? (ep.indexOf('?') >= 0 ? '&' : '?') + 'tenantId=' + encodeURIComponent(TENANT) : ''); }

  var root, agentsEl, feedEl, btnDot, btnCount;

  function build() {
    var style = el('style'); style.textContent = css; document.head.appendChild(style);
    root = el('div', 'aiwx-am');
    var btn = el('div', 'aiwx-am-btn');
    btnDot = el('span', 'aiwx-am-dot'); btnCount = el('span', 'aiwx-am-count', '—');
    btn.appendChild(btnDot); btn.appendChild(el('span', null, 'Agents')); btn.appendChild(btnCount);
    btn.addEventListener('click', function () { root.classList.toggle('open'); });
    var panel = el('div', 'aiwx-am-panel');
    var head = el('div', 'aiwx-am-head'); head.appendChild(el('span', null, 'Agent Monitor'));
    var refresh = el('button', 'aiwx-am-refresh', '↻'); refresh.addEventListener('click', function (e) { e.stopPropagation(); poll(); });
    head.appendChild(refresh);
    agentsEl = el('div', 'aiwx-am-agents');
    feedEl = el('div', 'aiwx-am-feed');
    panel.appendChild(head);
    panel.appendChild(el('div', 'aiwx-am-sec', 'Roster'));
    panel.appendChild(agentsEl);
    panel.appendChild(el('div', 'aiwx-am-sec', 'Live activity'));
    panel.appendChild(feedEl);
    root.appendChild(panel); root.appendChild(btn);
    document.body.appendChild(root);
  }

  function renderAgents(agents) {
    agentsEl.innerHTML = '';
    if (!agents || !agents.length) { agentsEl.appendChild(el('div', 'aiwx-am-empty', 'No agents provisioned.')); btnCount.textContent = '0'; return; }
    var active = agents.filter(function (a) { return a.status === 'active'; }).length;
    btnCount.textContent = active + '/' + agents.length;
    btnDot.style.background = active > 0 ? STATUS_COLOR.active : '#64748b';
    agents.forEach(function (a) {
      var chip = el('div', 'aiwx-am-chip');
      var d = el('span', 'aiwx-am-dot'); d.style.background = STATUS_COLOR[a.status] || '#94a3b8';
      chip.appendChild(d); chip.appendChild(el('span', null, (a.role || '').replace(/_/g, ' ')));
      chip.title = a.role + ' — ' + a.status;
      agentsEl.appendChild(chip);
    });
  }

  function renderFeed(events) {
    feedEl.innerHTML = '';
    if (!events || !events.length) { feedEl.appendChild(el('div', 'aiwx-am-empty', 'No recent activity.')); return; }
    events.slice(0, 40).forEach(function (e) {
      var row = el('div', 'aiwx-am-ev');
      var label = el('b', null, e.event || 'event');
      if (EVENT_COLOR[e.status]) label.style.color = EVENT_COLOR[e.status];
      row.appendChild(label);
      if (e.taskId) row.appendChild(el('span', null, String(e.taskId).slice(-6)));
      else if (e.agentId) row.appendChild(el('span', null, String(e.agentId).slice(-6)));
      feedEl.appendChild(row);
    });
  }

  function headers() { var h = {}; if (window.AIWX_API_KEY) h['x-api-key'] = window.AIWX_API_KEY; return h; }
  function getJson(ep) { return fetch(q(ep), { headers: headers(), credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }

  function poll() {
    getJson(AGENTS_EP).then(function (d) { if (d && d.success) renderAgents(d.agents); else if (d === null) { btnCount.textContent = '—'; } });
    getJson(TELEM_EP).then(function (d) { if (d && d.success) renderFeed(d.events); });
  }

  function init() { build(); poll(); setInterval(poll, POLL_MS); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
