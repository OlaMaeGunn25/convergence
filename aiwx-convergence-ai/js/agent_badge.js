/*
   CONVERGENCE-Ai™ Floating Agent Starburst Badge Module
   Orchestrates visual status changes, badge minimized layouts, and the safety Kill Switch.
*/

import { STATE, saveLocalState } from './state.js';
import { logConsole } from './components.js';

export function hexToRgba(hex, alpha) {
    if (!hex) return '';
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function updateAgentBadgeState(state) {
    STATE.agentBadgeState = state;
    const badge = document.getElementById('agentBadge');
    if (!badge) return;

    badge.className = 'agent-badge';
    if (localStorage.getItem('aiwx_badge_minimized') === 'true') {
        badge.classList.add('minimized');
    }
    badge.classList.add(`agent-${state}`);

    const statusTextEl = badge.querySelector('.status-text');
    if (statusTextEl) {
        if (state === 'idle') statusTextEl.textContent = 'AWAITING';
        else if (state === 'ready') statusTextEl.textContent = 'READY';
        else if (state === 'executing') statusTextEl.textContent = 'ACTIVE';
        else if (state === 'nearly_complete') statusTextEl.textContent = 'COMPLETING';
        else if (state === 'paused') statusTextEl.textContent = 'PAUSED';
        else if (state === 'complete') statusTextEl.textContent = 'COMPLETE';
        else if (state === 'offline') statusTextEl.textContent = 'OFFLINE';
    }

    const config = STATE.tenantConfig;
    if (config && config.primaryColor) {
        if (state === 'executing') {
            const c1 = hexToRgba(config.primaryColor, 0.9);
            const c2 = config.secondaryColor ? hexToRgba(config.secondaryColor, 0.9) : hexToRgba(config.primaryColor, 0.7);
            badge.style.background = `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
            badge.style.borderColor = 'rgba(255, 255, 255, 0.25)';
        } else if (state === 'ready') {
            badge.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(5, 150, 105, 0.8) 100%)';
            badge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        } else if (state === 'nearly_complete') {
            badge.style.background = 'linear-gradient(135deg, rgba(234, 179, 8, 0.95) 0%, rgba(202, 138, 4, 0.8) 100%)';
            badge.style.borderColor = 'rgba(234, 179, 8, 0.4)';
        } else if (state === 'complete') {
            badge.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.95) 0%, rgba(37, 99, 235, 0.8) 100%)';
            badge.style.borderColor = 'rgba(59, 130, 246, 0.4)';
        } else if (state === 'paused' || state === 'offline') {
            badge.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(220, 38, 38, 0.8) 100%)';
            badge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        } else if (state === 'idle') {
            badge.style.background = 'rgba(15, 23, 42, 0.85)';
            badge.style.borderColor = 'rgba(255, 255, 255, 0.22)';
        } else {
            badge.style.background = '';
            badge.style.borderColor = '';
        }
    }
}

export function toggleMinimizeBadge(e) {
    if (e) e.stopPropagation();
    const badge = document.getElementById('agentBadge');
    if (!badge) return;

    const isMinimized = badge.classList.contains('minimized');
    if (isMinimized) {
        badge.classList.remove('minimized');
        localStorage.setItem('aiwx_badge_minimized', 'false');
    } else {
        badge.classList.add('minimized');
        localStorage.setItem('aiwx_badge_minimized', 'true');
    }
}

export function dismissBadge(e) {
    if (e) e.stopPropagation();
    const badge = document.getElementById('agentBadge');
    const restoreBtn = document.getElementById('agentBadgeRestoreBtn');
    if (badge) badge.style.display = 'none';
    if (restoreBtn) restoreBtn.style.display = 'flex';
    localStorage.setItem('aiwx_badge_dismissed', 'true');
}

export function restoreBadge() {
    const badge = document.getElementById('agentBadge');
    const restoreBtn = document.getElementById('agentBadgeRestoreBtn');
    if (badge) badge.style.display = 'inline-flex';
    if (restoreBtn) restoreBtn.style.display = 'none';
    localStorage.setItem('aiwx_badge_dismissed', 'false');
}

export function toggleKillSwitch() {
    STATE.killSwitchActive = !STATE.killSwitchActive;
    const killBtn = document.getElementById('killSwitchBtn');
    
    if (STATE.killSwitchActive) {
        if (STATE.processTimer) clearInterval(STATE.processTimer);
        updateAgentBadgeState('offline');
        logConsole('[KILL SWITCH ACTIVATED] Operations supervisor thread shut down. All automated processes suspended.', 'error');
        if (killBtn) {
            killBtn.className = 'btn btn-success btn-small';
            killBtn.innerHTML = '<i class="fa-solid fa-play"></i> Reactivate Agent';
        }
    } else {
        updateAgentBadgeState('idle');
        logConsole('[KILL SWITCH DEACTIVATED] Operations supervisor thread reactivated. Ready for tasks.', 'success');
        if (killBtn) {
            killBtn.className = 'btn btn-danger btn-small';
            killBtn.innerHTML = '<i class="fa-solid fa-power-off"></i> Shut Off Agent';
        }
    }
    saveLocalState();
}

export function injectBadge() {
    if (typeof document === 'undefined' || !document.body || document.getElementById('agentBadge')) return;

    const starburstSrc = 'agent_starburst.png';
    const badgeHtml = `
        <div id="agentBadge" class="agent-badge agent-idle" tabindex="0">
            <div class="icon">
                <img src="${starburstSrc}" class="agent-starburst-image" alt="Starburst badge icon">
            </div>
            <div class="agent-badge-content">
                <div class="agent-badge-title">AI Agent</div>
                <div class="agent-badge-subtitle">Monitoring • Responding • Optimizing</div>
            </div>
            <div class="agent-badge-divider">|</div>
            <div class="agent-badge-status">
                <span class="status-dot"></span>
                <span class="status-text">IDLE</span>
            </div>
            <div class="agent-badge-actions">
                <button class="agent-badge-btn" id="badgeMinimizeBtn" title="Minimize/Expand">
                    <i class="fa-solid fa-compress"></i>
                </button>
                <button class="agent-badge-btn" id="badgeDismissBtn" title="Dismiss">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        </div>
        <div id="agentBadgeRestoreBtn" class="agent-badge-restore" style="display: none;" title="Restore Agent Badge">
            <img src="${starburstSrc}" alt="Restore Agent Badge icon">
        </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = badgeHtml.trim();
    document.body.appendChild(wrapper.firstElementChild);
    document.body.appendChild(wrapper.lastElementChild);

    // Event bindings
    document.getElementById('agentBadge').addEventListener('click', (e) => {
        const badge = document.getElementById('agentBadge');
        if (badge.classList.contains('minimized')) {
            toggleMinimizeBadge(e);
        }
    });
    document.getElementById('badgeMinimizeBtn').addEventListener('click', toggleMinimizeBadge);
    document.getElementById('badgeDismissBtn').addEventListener('click', dismissBadge);
    document.getElementById('agentBadgeRestoreBtn').addEventListener('click', restoreBadge);

    const dismissed = localStorage.getItem('aiwx_badge_dismissed') === 'true';
    const minimized = localStorage.getItem('aiwx_badge_minimized') === 'true';
    
    if (dismissed) {
        dismissBadge();
    } else if (minimized) {
        const badge = document.getElementById('agentBadge');
        if (badge) badge.classList.add('minimized');
    }

    if (STATE.isActivated) {
        updateAgentBadgeState('idle');
    } else {
        updateAgentBadgeState('offline');
    }
}
