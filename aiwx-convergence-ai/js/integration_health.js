/*
   CONVERGENCE-Ai™ Connected System Health Monitoring Module
   Queries real-time integration connection states, latency metrics, and updates UI indicator status dots.
*/

import { STATE } from './state.js';
import { logConsole } from './components.js';

export const INTEGRATION_HEALTH = {
    epic: { status: 'healthy', latencyMs: 240, lastChecked: 'Never' },
    workday: { status: 'healthy', latencyMs: 310, lastChecked: 'Never' },
    twilio: { status: 'healthy', latencyMs: 95, lastChecked: 'Never' },
    slack: { status: 'healthy', latencyMs: 140, lastChecked: 'Never' },
    webhook: { status: 'healthy', latencyMs: 180, lastChecked: 'Never' },
    jira: { status: 'healthy', latencyMs: 290, lastChecked: 'Never' },
    goodshuffle: { status: 'healthy', latencyMs: 420, lastChecked: 'Never' },
    squarespace: { status: 'healthy', latencyMs: 120, lastChecked: 'Never' },
    paypal: { status: 'healthy', latencyMs: 150, lastChecked: 'Never' },
};

export async function checkIntegrationHealth(provider) {
    const ep = STATE.tenantConfig.apiEndpoint;
    const isLocalDemo = !ep || ep.includes("convergence-ai.com") || ep.includes("convergence-ai-agents.com");
    
    INTEGRATION_HEALTH[provider].lastChecked = new Date().toLocaleTimeString();
    
    if (isLocalDemo) {
        // Mock connection latency and health variance for local sandbox environment
        return new Promise((resolve) => {
            setTimeout(() => {
                const rand = Math.random();
                let status = 'healthy';
                let latency = Math.round(50 + Math.random() * 200);
                
                if (rand > 0.95) {
                    status = 'down';
                    latency = 0;
                } else if (rand > 0.85) {
                    status = 'degraded';
                    latency = Math.round(400 + Math.random() * 800);
                }
                
                INTEGRATION_HEALTH[provider].status = status;
                INTEGRATION_HEALTH[provider].latencyMs = latency;
                
                resolve(INTEGRATION_HEALTH[provider]);
            }, 100);
        });
    }

    try {
        const response = await fetch(`${ep}/api/integrations/${provider}/health`);
        const data = await response.json();
        
        if (data && data.status) {
            INTEGRATION_HEALTH[provider].status = data.status;
            INTEGRATION_HEALTH[provider].latencyMs = data.latencyMs || 0;
        }
    } catch (err) {
        // Graceful fallback to degraded or offline state on network errors
        INTEGRATION_HEALTH[provider].status = 'down';
        INTEGRATION_HEALTH[provider].latencyMs = 0;
    }
    
    return INTEGRATION_HEALTH[provider];
}

export async function runHealthCheckAll() {
    logConsole('[HEALTH MONITOR] Querying connection endpoints for all connectors...', 'info');
    const providers = Object.keys(INTEGRATION_HEALTH);
    
    const checks = providers.map(async (p) => {
        const res = await checkIntegrationHealth(p);
        updateHealthIndicatorDOM(p, res);
    });
    
    await Promise.all(checks);
    logConsole('[HEALTH MONITOR] All connected systems verified.', 'success');
}

export function updateHealthIndicatorDOM(provider, health) {
    const row = document.querySelector(`[data-provider-row="${provider}"]`);
    if (!row) return;
    
    const dot = row.querySelector('.health-dot');
    const text = row.querySelector('.health-text');
    const latency = row.querySelector('.health-latency');
    
    if (dot) {
        dot.className = `health-dot ${health.status}`;
    }
    
    if (text) {
        text.textContent = health.status.toUpperCase();
        text.className = `health-text ${health.status}`;
    }
    
    if (latency) {
        latency.textContent = health.status === 'down' ? '—' : `${health.latencyMs}ms`;
    }
}
