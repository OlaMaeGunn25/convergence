/*
   CONVERGENCE-Ai™ Shared Layout Components Module
   Dynamically injects repeating UI assets (Sidebars, Headers, Terminal logs) to eliminate file duplication.
*/

import { STATE } from './state.js';

export function logConsole(message, type = 'info') {
    const term = document.getElementById('logTerminal');
    if (!term) return;
    const time = new Date().toLocaleTimeString();
    const div = document.createElement('div');
    div.className = `log-entry ${type}`;
    div.innerHTML = `<span style="color: var(--text-dim)">[${time}]</span> <span style="font-weight: 600">${type.toUpperCase()}:</span> ${message}`;
    term.appendChild(div);
    term.scrollTop = term.scrollHeight;
}

export function injectLayout(switchTabCallback) {
    // 1. Sidebar Injection
    const sidebarContainer = document.querySelector('aside.sidebar');
    if (sidebarContainer) {
        sidebarContainer.innerHTML = `
            <div class="brand-section" style="flex-direction: column; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 1.5rem; gap: 8px;">
                <div class="brand-logo" style="width: 100%; display: flex; justify-content: center; min-height: 48px;">
                    <img src="convergence-ai_logo_light.png" alt="CONVERGENCE-Ai" style="height: 44px; max-width: 100%; object-fit: contain; display: block; margin: 0 auto;">
                </div>
                <div>
                    <div class="brand-name" style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted); text-align: center;">CONVERGENCE-Ai Client</div>
                    <div style="font-size: 0.65rem; color: var(--secondary-color); font-weight: 700; letter-spacing: 0.05em; text-align: center; text-transform: uppercase; margin-top: 2px;">A Cloud Native AI Automation Hub</div>
                </div>
            </div>
            
            <ul class="sidebar-menu">
                <li class="menu-item active" data-tab="dashboard">
                    <i class="fa-solid fa-gauge-high"></i>
                    <span>Operations Panel</span>
                </li>
                <li class="menu-item" data-tab="process">
                    <i class="fa-solid fa-diagram-project"></i>
                    <span>Process Mapping</span>
                </li>
                <li class="menu-item" data-tab="training">
                    <i class="fa-solid fa-user-gear"></i>
                    <span>Agent Training</span>
                </li>
                <li class="menu-item" data-tab="whitelabel">
                    <i class="fa-solid fa-palette"></i>
                    <span>Rebranding Panel</span>
                </li>
                <li class="menu-item" data-tab="campaigns">
                    <i class="fa-solid fa-share-nodes"></i>
                    <span>Social Campaigns</span>
                </li>
                <li class="menu-item" data-tab="analytics">
                    <i class="fa-solid fa-chart-simple"></i>
                    <span>Analytics Dashboard</span>
                </li>
                <li class="menu-item" data-tab="reports">
                    <i class="fa-solid fa-chart-line"></i>
                    <span>Reports & KPIs</span>
                </li>
                <li class="menu-item" id="navDocsItem" data-tab="docs">
                    <i class="fa-solid fa-book"></i>
                    <span>Documentation</span>
                </li>
                <li class="menu-item" id="navTrainingPortal">
                    <i class="fa-solid fa-graduation-cap"></i>
                    <span>Training Portal</span>
                </li>
                <li class="menu-item" id="navDeploymentHub">
                    <i class="fa-solid fa-server"></i>
                    <span>Deployment Hub</span>
                </li>
            </ul>

            <div class="sidebar-footer">
                <div class="client-tag">
                    <div class="client-status-indicator"></div>
                    <span style="font-size:0.75rem; color:var(--text-muted);">Secure SSL Vault Locked</span>
                </div>
            </div>
        `;

        // Attach listeners
        sidebarContainer.querySelectorAll('.sidebar-menu .menu-item').forEach(item => {
            const tabName = item.getAttribute('data-tab');
            if (tabName) {
                item.addEventListener('click', (e) => {
                    sidebarContainer.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                    switchTabCallback(tabName);
                });
            }
        });

        // External links
        const trnPortal = document.getElementById('navTrainingPortal');
        if (trnPortal) trnPortal.addEventListener('click', () => window.open('training_hub.html', '_blank'));
        const depHub = document.getElementById('navDeploymentHub');
        if (depHub) depHub.addEventListener('click', () => window.open('deployment_hub.html', '_blank'));
    }

    // 2. Header Actions Injection
    const headerContainer = document.querySelector('header.header');
    if (headerContainer) {
        headerContainer.innerHTML = `
            <div class="header-title-area">
                <h2 style="font-family: var(--font-heading); color: #ffffff;">Operational Hub</h2>
                <div id="activeVerticalBadge" class="vertical-badge">MEDICAL</div>
            </div>
            
            <div class="header-actions">
                <button class="btn btn-secondary btn-small" id="runTourBtn" title="Launch product tour walkthrough"><i class="fa-solid fa-compass"></i> Guided Tour</button>
                <button class="btn btn-secondary btn-small" id="killSwitchBtn" title="Immediately halt all background automation loops" style="border-color: rgba(239,68,68,0.3); color: var(--status-error);"><i class="fa-solid fa-power-off"></i> Shut Off Agent</button>
                <button class="btn btn-primary btn-small" id="vaultToggleBtn" title="Configure connection tokens and credentials vault" style="background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));"><i class="fa-solid fa-vault"></i> Connection Vault</button>
            </div>
        `;
    }

    // 3. Dynamic Terminal Output Injection (If container is present but blank)
    const logsConsole = document.querySelector('.console-logs-container');
    if (logsConsole && logsConsole.innerHTML.trim() === '') {
        logsConsole.innerHTML = `
            <div class="card-header" style="justify-content: space-between;">
                <h3 style="font-family: var(--font-heading); font-size: 0.95rem; font-weight: 700; color: #ffffff;"><i class="fa-solid fa-terminal" style="color:var(--primary-color)"></i> Runtime Operations Stream</h3>
                <span class="status-badge" style="background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.3); font-size: 0.65rem; font-weight: 700;">STREAM ACTIVE</span>
            </div>
            <div class="log-terminal" id="logTerminal">
                <div class="log-entry system"><span style="color: var(--text-dim)">[System Boot]</span> Establishing secure SSL bridge connection to container...</div>
            </div>
        `;
    }
}
