/*
   CONVERGENCE-Ai™ Analytics and Performance Intelligence Module
   Tracks task metrics, SLA compliance, vertical distributions, and renders high-fidelity custom CSS dashboards.
*/

import { STATE, saveLocalState } from './state.js';
import { logConsole } from './components.js';

export function initAnalytics() {
    if (!STATE.analytics) {
        STATE.analytics = {
            taskLog: [],
            sessionStart: new Date().toISOString(),
            metrics: {
                totalTasksProcessed: 0,
                totalApproved: 0,
                totalRejected: 0,
                totalAutoResolved: 0,
                avgResolutionTimeMs: 0,
                slaBreaches: 0,
                byVertical: {},
                byIntegration: {},
                hourlyThroughput: []
            }
        };
    }
}

export function recordTaskEvent(taskId, action, vertical, integration, durationMs = 0) {
    initAnalytics();
    
    const event = {
        id: taskId,
        action: action, // 'approved', 'rejected', 'auto_resolved'
        vertical: vertical || 'unknown',
        integration: integration || 'none',
        durationMs: durationMs || 0,
        timestamp: new Date().toISOString()
    };
    
    STATE.analytics.taskLog.push(event);
    
    // Recalculate metrics
    const m = STATE.analytics.metrics;
    m.totalTasksProcessed++;
    
    if (action === 'approved') m.totalApproved++;
    else if (action === 'rejected') m.totalRejected++;
    else if (action === 'auto_resolved') m.totalAutoResolved++;
    
    // Calculate new average duration
    const totalWithDuration = STATE.analytics.taskLog.filter(e => e.durationMs > 0);
    if (totalWithDuration.length > 0) {
        const sum = totalWithDuration.reduce((acc, curr) => acc + curr.durationMs, 0);
        m.avgResolutionTimeMs = Math.round(sum / totalWithDuration.length);
    }
    
    // SLA breach check (> 5000ms is default threshold)
    if (durationMs > 5000) {
        m.slaBreaches++;
    }
    
    // Group by vertical
    if (!m.byVertical[event.vertical]) {
        m.byVertical[event.vertical] = { processed: 0, approved: 0, rejected: 0 };
    }
    m.byVertical[event.vertical].processed++;
    if (action === 'approved') m.byVertical[event.vertical].approved++;
    if (action === 'rejected') m.byVertical[event.vertical].rejected++;
    
    // Group by integration
    if (!m.byIntegration[event.integration]) {
        m.byIntegration[event.integration] = { calls: 0, successes: 0, failures: 0, avgLatencyMs: 0, totalMs: 0 };
    }
    const integrationRecord = m.byIntegration[event.integration];
    integrationRecord.calls++;
    integrationRecord.totalMs += durationMs;
    integrationRecord.avgLatencyMs = Math.round(integrationRecord.totalMs / integrationRecord.calls);
    if (action !== 'rejected') {
        integrationRecord.successes++;
    } else {
        integrationRecord.failures++;
    }
    
    // Track hourly throughput
    const hourKey = new Date().toISOString().substring(0, 13) + ":00";
    let hourlyEntry = m.hourlyThroughput.find(h => h.hour === hourKey);
    if (!hourlyEntry) {
        hourlyEntry = { hour: hourKey, count: 0 };
        m.hourlyThroughput.push(hourlyEntry);
    }
    hourlyEntry.count++;
    
    saveLocalState();
    logConsole(`[ANALYTICS] Task event logged: ${action} for ${taskId} (${durationMs}ms)`, 'info');
}

export function calculateResolutionRate() {
    initAnalytics();
    const m = STATE.analytics.metrics;
    if (m.totalTasksProcessed === 0) return 100;
    return Math.round(((m.totalApproved + m.totalAutoResolved) / m.totalTasksProcessed) * 100);
}

export function calculateSLACompliance(slaTargetMs = 5000) {
    initAnalytics();
    const log = STATE.analytics.taskLog;
    const totalWithDuration = log.filter(e => e.durationMs > 0);
    if (totalWithDuration.length === 0) return 100;
    const withinSLA = totalWithDuration.filter(e => e.durationMs <= slaTargetMs).length;
    return Math.round((withinSLA / totalWithDuration.length) * 100);
}

export function renderAnalyticsDashboard() {
    initAnalytics();
    const m = STATE.analytics.metrics;
    const container = document.getElementById('analyticsDashboardPanel');
    if (!container) return;
    
    const resolutionRate = calculateResolutionRate();
    const slaCompliance = calculateSLACompliance(5000);
    const avgSeconds = m.avgResolutionTimeMs > 0 ? (m.avgResolutionTimeMs / 1000).toFixed(2) : "0.00";
    
    // Generate vertical rows
    let verticalRowsHTML = '';
    const activeVerticals = Object.keys(m.byVertical);
    if (activeVerticals.length === 0) {
        verticalRowsHTML = `<div class="empty-state-text" style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:1.5rem;">No tasks processed in this session.</div>`;
    } else {
        activeVerticals.forEach(v => {
            const data = m.byVertical[v];
            const rate = data.processed > 0 ? Math.round((data.approved / data.processed) * 100) : 0;
            verticalRowsHTML += `
                <div style="margin-bottom: 1.25rem;">
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:4px; color:#ffffff;">
                        <span style="text-transform: capitalize; font-weight:500;">${v}</span>
                        <span style="color:var(--secondary-color);">${rate}% Rate (${data.processed} tasks)</span>
                    </div>
                    <div class="progress-track" style="height:6px; background:rgba(255,255,255,0.05); border-radius:3px;">
                        <div class="progress-bar" style="width:${rate}%; height:100%; background:linear-gradient(to right, var(--primary-color), var(--secondary-color)); border-radius:3px; box-shadow:0 0 8px var(--primary-color);"></div>
                    </div>
                </div>
            `;
        });
    }

    // Generate integration rows
    let integrationRowsHTML = '';
    const activeIntegrations = Object.keys(m.byIntegration);
    if (activeIntegrations.length === 0) {
        integrationRowsHTML = `
            <tr>
                <td colspan="4" style="text-align:center; color:var(--text-muted); font-size:0.8rem; padding:1.5rem;">No integrations queried.</td>
            </tr>
        `;
    } else {
        activeIntegrations.forEach(intg => {
            const data = m.byIntegration[intg];
            const successRate = data.calls > 0 ? Math.round((data.successes / data.calls) * 100) : 0;
            const statusClass = successRate >= 95 ? 'status-active' : (successRate >= 80 ? 'status-warning' : 'status-danger');
            const statusLabel = successRate >= 95 ? 'HEALTHY' : (successRate >= 80 ? 'DEGRADED' : 'CRITICAL');
            
            integrationRowsHTML += `
                <tr style="border-bottom:1px solid var(--border-color);">
                    <td style="padding:12px; font-size:0.8rem; color:#ffffff; font-weight:500;">${intg.toUpperCase()}</td>
                    <td style="padding:12px; font-size:0.8rem; color:var(--text-muted);">${data.calls}</td>
                    <td style="padding:12px; font-size:0.8rem; color:var(--text-muted);">${data.avgLatencyMs}ms</td>
                    <td style="padding:12px;">
                        <span class="status-indicator-badge ${statusClass}" style="font-size:0.65rem; padding:2px 6px; border-radius:4px; font-weight:700;">${statusLabel} (${successRate}%)</span>
                    </td>
                </tr>
            `;
        });
    }

    container.innerHTML = `
        <div class="grid-container" style="gap: 1.5rem;">
            <!-- Key Metric: Resolution Rate -->
            <div class="card card-glow" style="grid-column: span 4; text-align: center; padding: 1.5rem;">
                <div style="font-size: 0.75rem; font-weight: 700; color: var(--secondary-color); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px; display: flex; justify-content: center; align-items: center; gap: 4px;">
                    <span>Autonomous Resolution Rate</span>
                    <span class="tooltip-trigger" data-tooltip="Percentage of incoming client tasks resolved automatically by agent workers without manual HITL intervention."><i class="fa-regular fa-circle-question"></i></span>
                </div>
                <div style="font-size: 2.5rem; font-weight: 700; font-family: var(--font-heading); color: #ffffff; text-shadow: 0 0 10px rgba(0, 198, 255, 0.4);">${resolutionRate}%</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 6px;">Total Processed: ${m.totalTasksProcessed}</div>
            </div>

            <!-- Key Metric: SLA Compliance -->
            <div class="card card-glow" style="grid-column: span 4; text-align: center; padding: 1.5rem;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #10b981; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px; display: flex; justify-content: center; align-items: center; gap: 4px;">
                    <span>SLA Compliance (&lt; 5s)</span>
                    <span class="tooltip-trigger" data-tooltip="Percentage of task lifecycle transactions completing under the default 5,000ms SLA response threshold."><i class="fa-regular fa-circle-question"></i></span>
                </div>
                <div style="font-size: 2.5rem; font-weight: 700; font-family: var(--font-heading); color: #ffffff; text-shadow: 0 0 10px rgba(16, 185, 129, 0.4);">${slaCompliance}%</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 6px;">SLA Breaches: ${m.slaBreaches}</div>
            </div>

            <!-- Key Metric: Avg Latency -->
            <div class="card card-glow" style="grid-column: span 4; text-align: center; padding: 1.5rem;">
                <div style="font-size: 0.75rem; font-weight: 700; color: var(--primary-color); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px; display: flex; justify-content: center; align-items: center; gap: 4px;">
                    <span>Avg Resolution Speed</span>
                    <span class="tooltip-trigger" data-tooltip="Mean transaction roundtrip latency including API roundtrips and local execution."><i class="fa-regular fa-circle-question"></i></span>
                </div>
                <div style="font-size: 2.5rem; font-weight: 700; font-family: var(--font-heading); color: #ffffff; text-shadow: 0 0 10px rgba(0, 132, 255, 0.4);">${avgSeconds}s</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 6px;">Avg ms: ${m.avgResolutionTimeMs}ms</div>
            </div>

            <!-- Left Panel: Volumetric Breakdown by Vertical -->
            <div class="card" style="grid-column: span 6; padding: 1.5rem;">
                <div class="card-title" style="margin-bottom: 1.25rem;">
                    <span><i class="fa-solid fa-folder-tree" style="color:var(--primary-color); margin-right:8px;"></i> Vertical Load & Performance</span>
                </div>
                <div>${verticalRowsHTML}</div>
            </div>

            <!-- Right Panel: Integration Latency & Calls -->
            <div class="card" style="grid-column: span 6; padding: 1.5rem;">
                <div class="card-title" style="margin-bottom: 1.25rem;">
                    <span><i class="fa-solid fa-server" style="color:var(--secondary-color); margin-right:8px;"></i> Connected System Integrity Registry</span>
                </div>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border-color); color:var(--text-muted); font-size:0.75rem; font-weight:700;">
                                <th style="padding:8px 12px;">SYSTEM</th>
                                <th style="padding:8px 12px;">CALLS</th>
                                <th style="padding:8px 12px;">AVG LATENCY</th>
                                <th style="padding:8px 12px;">INTEGRITY STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${integrationRowsHTML}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}
