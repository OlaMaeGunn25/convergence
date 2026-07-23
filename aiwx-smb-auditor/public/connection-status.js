/**
 * Floating Connection-Status Component
 * ====================================
 * A self-contained, dependency-free widget that shows the live connection state
 * of every system CONVERGENCE-Ai can wire into the governed MCP layer. Polls
 * GET /api/connections and renders a floating, collapsible panel (bottom-right).
 *
 * Drop-in: <script src="/connection-status.js" defer></script>
 * No build step, no globals leaked (IIFE), theme-aware (light/dark), and it fails
 * quietly if the endpoint is unauthorized or unavailable.
 */
(function () {
  'use strict';
  if (window.__aiwxConnStatusLoaded) return;
  window.__aiwxConnStatusLoaded = true;

  var ENDPOINT = (window.AIWX_CONNECTIONS_ENDPOINT) || '/api/connections';
  var POLL_MS = (window.AIWX_CONNECTIONS_POLL_MS) || 15000;

  var STATUS_META = {
    connected:     { color: '#10b981', label: 'Connected' },
    configuring:   { color: '#f59e0b', label: 'Configuring' },
    error:         { color: '#f43f5e', label: 'Error' },
    disconnected:  { color: '#94a3b8', label: 'Disconnected' },
    not_connected: { color: '#64748b', label: 'Not connected' }
  };

  var css = ''
    + '.aiwx-cs{position:fixed;right:20px;bottom:20px;z-index:2147483000;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}'
    + '.aiwx-cs *{box-sizing:border-box;}'
    + '.aiwx-cs-btn{display:flex;align-items:center;gap:8px;cursor:pointer;border:1px solid rgba(148,163,184,.35);background:#0f172a;color:#e2e8f0;'
    + 'padding:8px 12px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.28);font-size:13px;font-weight:600;transition:transform .12s ease;}'
    + '.aiwx-cs-btn:hover{transform:translateY(-1px);}'
    + '.aiwx-cs-dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto;}'
    + '.aiwx-cs-count{opacity:.75;font-weight:500;}'
    + '.aiwx-cs-panel{position:absolute;right:0;bottom:52px;width:320px;max-height:60vh;overflow:hidden;display:none;flex-direction:column;'
    + 'background:#0f172a;color:#e2e8f0;border:1px solid rgba(148,163,184,.28);border-radius:14px;box-shadow:0 16px 44px rgba(0,0,0,.42);}'
    + '.aiwx-cs.open .aiwx-cs-panel{display:flex;}'
    + '.aiwx-cs-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(148,163,184,.2);}'
    + '.aiwx-cs-title{font-size:13px;font-weight:700;letter-spacing:.02em;}'
    + '.aiwx-cs-refresh{cursor:pointer;background:none;border:none;color:#94a3b8;font-size:12px;padding:4px 6px;border-radius:6px;}'
    + '.aiwx-cs-refresh:hover{color:#e2e8f0;background:rgba(148,163,184,.14);}'
    + '.aiwx-cs-list{overflow-y:auto;padding:6px;}'
    + '.aiwx-cs-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:9px;}'
    + '.aiwx-cs-row:hover{background:rgba(148,163,184,.10);}'
    + '.aiwx-cs-name{flex:1;min-width:0;}'
    + '.aiwx-cs-name b{display:block;font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
    + '.aiwx-cs-name span{font-size:10.5px;color:#94a3b8;}'
    + '.aiwx-cs-badge{font-size:10px;font-weight:700;padding:3px 8px;border-radius:999px;white-space:nowrap;}'
    + '.aiwx-cs-empty{padding:18px 14px;font-size:12px;color:#94a3b8;text-align:center;}'
    + '.aiwx-cs-foot{padding:8px 14px;border-top:1px solid rgba(148,163,184,.2);font-size:10.5px;color:#94a3b8;display:flex;justify-content:space-between;}'
    + '@media (prefers-color-scheme:light){'
    + '.aiwx-cs-btn,.aiwx-cs-panel{background:#ffffff;color:#0f172a;border-color:rgba(15,23,42,.14);}'
    + '.aiwx-cs-name span,.aiwx-cs-refresh,.aiwx-cs-empty,.aiwx-cs-foot{color:#64748b;}'
    + '}';

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  var root, listEl, btnDot, btnCount, footEl;

  function build() {
    var style = el('style'); style.textContent = css; document.head.appendChild(style);

    root = el('div', 'aiwx-cs');

    var btn = el('div', 'aiwx-cs-btn');
    btnDot = el('span', 'aiwx-cs-dot'); btnDot.style.background = '#64748b';
    var btnLabel = el('span', null, 'Systems');
    btnCount = el('span', 'aiwx-cs-count', '—');
    btn.appendChild(btnDot); btn.appendChild(btnLabel); btn.appendChild(btnCount);
    btn.addEventListener('click', function () { root.classList.toggle('open'); });

    var panel = el('div', 'aiwx-cs-panel');
    var head = el('div', 'aiwx-cs-head');
    head.appendChild(el('div', 'aiwx-cs-title', 'MCP Connection Status'));
    var refresh = el('button', 'aiwx-cs-refresh', '↻ Refresh');
    refresh.addEventListener('click', function (e) { e.stopPropagation(); poll(); });
    head.appendChild(refresh);

    listEl = el('div', 'aiwx-cs-list');
    footEl = el('div', 'aiwx-cs-foot');

    panel.appendChild(head); panel.appendChild(listEl); panel.appendChild(footEl);
    root.appendChild(panel); root.appendChild(btn);
    document.body.appendChild(root);
  }

  function render(systems) {
    listEl.innerHTML = '';
    if (!systems || !systems.length) {
      listEl.appendChild(el('div', 'aiwx-cs-empty', 'No connectors reported.'));
    } else {
      // Connected first, then configuring/error, then the rest.
      var order = { connected: 0, configuring: 1, error: 2, disconnected: 3, not_connected: 4 };
      systems.slice().sort(function (a, b) {
        return (order[a.status] - order[b.status]) || a.name.localeCompare(b.name);
      }).forEach(function (s) {
        var meta = STATUS_META[s.status] || STATUS_META.not_connected;
        var row = el('div', 'aiwx-cs-row');
        var dot = el('span', 'aiwx-cs-dot'); dot.style.background = meta.color;
        var name = el('div', 'aiwx-cs-name');
        var b = el('b', null, s.name);
        var sub = el('span', null, s.category + ' · ' + (s.kind || '').toUpperCase());
        name.appendChild(b); name.appendChild(sub);
        var badge = el('span', 'aiwx-cs-badge', meta.label);
        badge.style.color = meta.color;
        badge.style.background = meta.color + '22';
        row.appendChild(dot); row.appendChild(name); row.appendChild(badge);
        row.title = s.credentialsConfigured ? 'Credentials configured' : 'Credentials not set';
        listEl.appendChild(row);
      });
    }
    var connected = (systems || []).filter(function (s) { return s.status === 'connected'; }).length;
    var total = (systems || []).length;
    btnCount.textContent = connected + '/' + total;
    btnDot.style.background = connected > 0 ? STATUS_META.connected.color
      : (systems || []).some(function (s) { return s.status === 'error'; }) ? STATUS_META.error.color : '#64748b';
    footEl.textContent = '';
    footEl.appendChild(el('span', null, connected + ' connected'));
    footEl.appendChild(el('span', null, 'Updated ' + new Date().toLocaleTimeString()));
  }

  function renderMessage(msg) {
    listEl.innerHTML = '';
    listEl.appendChild(el('div', 'aiwx-cs-empty', msg));
    btnCount.textContent = '—';
  }

  function poll() {
    if (typeof fetch !== 'function') return;
    var headers = {};
    if (window.AIWX_API_KEY) headers['x-api-key'] = window.AIWX_API_KEY;
    fetch(ENDPOINT, { headers: headers, credentials: 'same-origin' })
      .then(function (r) {
        if (r.status === 401 || r.status === 403) { renderMessage('Sign in to view connection status.'); return null; }
        if (!r.ok) { renderMessage('Status unavailable (' + r.status + ').'); return null; }
        return r.json();
      })
      .then(function (data) { if (data && data.success) render(data.systems); })
      .catch(function () { renderMessage('Status unavailable (offline).'); });
  }

  function init() {
    build();
    poll();
    setInterval(poll, POLL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
