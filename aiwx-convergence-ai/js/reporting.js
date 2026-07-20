/*
   CONVERGENCE-Ai™ KPI Registry & Printable Reporting Module
   Maps systems integration metrics and handles high-contrast black-and-white printing layout conversions.
*/

export const KPI_REGISTRY = {
    medical: {
        epic: {
            kpis: [
                { name: "HL7 Consent Matching Rate", target: "> 99.9%", desc: "Ensures legal HL7 signature segments correlate to correct patient EHR." },
                { name: "Patient Triage Dispatch SLA", target: "< 15 sec", desc: "SLA target for incoming triage categorization speed." },
                { name: "HIPAA Fields Masking Audit", target: "100.0%", desc: "Percentage of encrypted PII elements in logs." }
            ],
            tasks: [
                { id: "T-2001", type: "Epic Patient Intake", quality: "99.8%", status: "SUCCESS", issue: "None", performance: "Completed in 420ms" },
                { id: "T-2002", type: "Triage Alert Route", quality: "94.5%", status: "WARNING", issue: "SMS Latency (+120ms)", performance: "Completed in 940ms" }
            ]
        },
        twilio: {
            kpis: [
                { name: "SMS Delivery Success SLA", target: "> 99.5%", desc: "Percentage of successfully acknowledged SMS receipts." },
                { name: "Voice Stream Connection Speed", target: "< 1.5s", desc: "Time to establish call stream interface." }
            ],
            tasks: [
                { id: "T-2003", type: "Patient Call Dispatch", quality: "100.0%", status: "SUCCESS", issue: "None", performance: "Completed in 150ms" }
            ]
        }
    },
    legal: {
        salesforce: {
            kpis: [
                { name: "Conflict Search Integrity Check", target: "100.0%", desc: "Ensures automated client conflict validation has zero omissions." },
                { name: "Filing Doc Generation Speed", target: "< 30 sec", desc: "Automated generation of client intake briefs." }
            ],
            tasks: [
                { id: "T-3001", type: "Conflict Clearance Check", quality: "100.0%", status: "SUCCESS", issue: "None", performance: "Completed in 310ms" }
            ]
        }
    },
    finance: {
        quickbooks: {
            kpis: [
                { name: "PO-to-Ledger Matching SLA", target: "> 99.8%", desc: "Accuracy of matching purchase orders with QuickBooks accounts." },
                { name: "Double-Entry Balance Verification", target: "100.0%", desc: "System-wide validation of debits and credits." }
            ],
            tasks: [
                { id: "T-4001", type: "QuickBooks Ledger Post", quality: "99.9%", status: "SUCCESS", issue: "None", performance: "Completed in 210ms" },
                { id: "T-4002", type: "Ledger Reconciliation", quality: "92.1%", status: "ESCALATED", issue: "PO #8893 Mismatch", performance: "Flagged in 850ms" }
            ]
        },
        paypal: {
            kpis: [
                { name: "Settlement Sync Latency", target: "< 5 mins", desc: "Time taken to post settled transactions to bank feed." },
                { name: "Payment Auth Success Rate", target: "> 99.9%", desc: "Percentage of clean auth approvals." }
            ],
            tasks: [
                { id: "T-4003", type: "PayPal Settlement Sync", quality: "100.0%", status: "SUCCESS", issue: "None", performance: "Completed in 120ms" }
            ]
        }
    },
    retail: {
        squarespace: {
            kpis: [
                { name: "Checkout Webhook Handshake", target: "< 1.5s", desc: "SLA response time for e-commerce checkouts." },
                { name: "Inventory Database Update Speed", target: "< 2.0s", desc: "Database write completion speed." }
            ],
            tasks: [
                { id: "T-5001", type: "Squarespace Inventory Sync", quality: "99.5%", status: "SUCCESS", issue: "None", performance: "Completed in 180ms" }
            ]
        }
    },
    event_rental: {
        goodshuffle: {
            kpis: [
                { name: "Rental Inventory Check SLA", target: "< 5 sec", desc: "Cross-referencing GoodShuffle Pro inventory availability." },
                { name: "Double-Booking Overlap Rate", target: "0.0%", desc: "Percentage of accidental overbookings." }
            ],
            tasks: [
                { id: "T-6001", type: "GoodShuffle Inventory Query", quality: "100.0%", status: "SUCCESS", issue: "None", performance: "Completed in 1200ms" },
                { id: "T-6002", type: "Tent Availability Double-Check", quality: "94.2%", status: "WARNING", issue: "GSP API Rate limit near limit", performance: "Completed in 3500ms" }
            ]
        },
        squarespace: {
            kpis: [
                { name: "Checkout Webhook Handshake", target: "< 1.5s", desc: "Time to receive checkout event from Squarespace." }
            ],
            tasks: [
                { id: "T-6003", type: "Squarespace Order Process", quality: "99.8%", status: "SUCCESS", issue: "None", performance: "Completed in 450ms" }
            ]
        },
        paypal: {
            kpis: [
                { name: "Payment Sync Accuracy", target: "100.0%", desc: "Matches invoice amounts with PayPal transactions." }
            ],
            tasks: [
                { id: "T-6004", type: "PayPal Invoicing Sync", quality: "100.0%", status: "SUCCESS", issue: "None", performance: "Completed in 310ms" }
            ]
        }
    }
};

export function getSystemKpis(vertical, system) {
    if (KPI_REGISTRY[vertical] && KPI_REGISTRY[vertical][system]) {
        return KPI_REGISTRY[vertical][system];
    }
    // Universal production fallback mapping for non-seeded systems
    return {
        kpis: [
            { name: "API Response Handshake Latency", target: "< 2.0s", desc: "Standard REST API response turnaround." },
            { name: "Data Sync Verification Integrity", target: "100.0%", desc: "Percentage of audited files with zero sync errors." }
        ],
        tasks: [
            { id: "T-GEN01", type: `${system.toUpperCase()} Data Sync`, quality: "99.4%", status: "SUCCESS", issue: "None", performance: "Completed in 480ms" }
        ]
    };
}

export function changeReportFilters() {
    const vertical = document.getElementById('reportVerticalSelect')?.value || 'medical';
    const systemSelect = document.getElementById('reportSystemSelect');
    if (!systemSelect) return;

    const systemsMap = {
        medical: [['epic', 'Epic Systems EHR'], ['twilio', 'Twilio Gateway']],
        legal: [['salesforce', 'Salesforce Client Intake'], ['twilio', 'Twilio Gateway']],
        finance: [['quickbooks', 'QuickBooks Ledger'], ['paypal', 'PayPal Gateway']],
        retail: [['squarespace', 'Squarespace Storefront'], ['paypal', 'PayPal Gateway']],
        event_rental: [['goodshuffle', 'GoodShuffle Pro API'], ['squarespace', 'Squarespace Storefront'], ['paypal', 'PayPal Gateway']]
    };

    const activeSystems = systemsMap[vertical] || [['rest', 'REST Webhook Connector'], ['salesforce', 'Salesforce CRM']];

    const oldVal = systemSelect.value;
    systemSelect.innerHTML = '';
    activeSystems.forEach(sys => {
        const opt = document.createElement('option');
        opt.value = sys[0];
        opt.textContent = sys[1];
        systemSelect.appendChild(opt);
    });

    if (activeSystems.some(sys => sys[0] === oldVal)) {
        systemSelect.value = oldVal;
    }

    const system = systemSelect.value;
    const data = getSystemKpis(vertical, system);
    
    const kpiBox = document.getElementById('reportKpisBox');
    if (kpiBox) {
        kpiBox.innerHTML = data.kpis.map(kpi => `
            <div style="padding: 1rem; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px;">
                <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
                    <strong style="color: #ffffff; font-size: 0.85rem;">${kpi.name}</strong>
                    <span style="color: var(--secondary-color); font-weight:700; font-size: 0.85rem;">Target: ${kpi.target}</span>
                </div>
                <div style="font-size: 0.72rem; color: var(--text-muted); line-height: 1.4;">${kpi.desc}</div>
            </div>
        `).join('');
    }

    const vertSpan = document.getElementById('reportVertSpan');
    if (vertSpan) vertSpan.textContent = vertical.toUpperCase().replace('_', ' ');
    const systemSpan = document.getElementById('reportSystemSpan');
    if (systemSpan) systemSpan.textContent = system.toUpperCase();

    const tableBody = document.getElementById('reportTableBody');
    if (tableBody) {
        tableBody.innerHTML = data.tasks.map(t => {
            let badgeClass = 'success';
            if (t.status === 'WARNING') badgeClass = 'warning';
            else if (t.status === 'ESCALATED' || t.status === 'ERROR') badgeClass = 'error';

            return `
                <tr class="task-queue-row">
                    <td><strong style="color:#60a5fa">${t.id}</strong></td>
                    <td>${t.type}</td>
                    <td><span class="status-badge ${badgeClass.toLowerCase()}">${t.status}</span></td>
                    <td>${t.quality}</td>
                    <td><span style="font-size:0.75rem; color:${t.issue !== 'None' ? 'var(--status-error)' : 'var(--text-muted)'};">${t.issue}</span></td>
                    <td><code style="font-size:0.75rem; color:#a78bfa;">${t.performance}</code></td>
                </tr>
            `;
        }).join('');
    }
}

export function printReport() {
    window.print();
}
