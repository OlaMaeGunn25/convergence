/*
   CONVERGENCE-Ai™ Process Mapping & Pipeline Simulation Module
   Defines industrial Six Sigma templates and controls pipeline step traversals.
*/

import { STATE, saveLocalState } from './state.js';
import { logConsole } from './components.js';
import { updateAgentBadgeState } from './agent_badge.js';

export const PROCESS_TEMPLATES = {
    p2p: {
        title: "Procure-to-Pay Invoice Mapping (Six Sigma Swimlane)",
        type: "swimlane",
        nodes: [
            { id: 0, label: "Start: Invoice Input", x: 60, y: 70, shape: "circle", type: "standard" },
            { id: 1, label: "Data Extraction (OCR)", x: 190, y: 70, shape: "rect", type: "standard" },
            { id: 2, label: "Invoice-PO Match Check", x: 320, y: 70, shape: "rect", type: "standard" },
            { id: 3, label: "Tolerance OK?", x: 450, y: 70, shape: "diamond", type: "decision" },
            { id: 4, label: "Human Admin Review", x: 450, y: 220, shape: "rect", type: "hitl" },
            { id: 5, label: "Post to QuickBooks Ledger", x: 600, y: 70, shape: "rect", type: "standard" },
            { id: 6, label: "End: Release ACH & Record", x: 740, y: 70, shape: "circle", type: "standard" }
        ],
        links: [
            { from: 0, to: 1 },
            { from: 1, to: 2 },
            { from: 2, to: 3 },
            { from: 3, to: 5, label: "Yes" },
            { from: 3, to: 4, label: "No" },
            { from: 4, to: 5, label: "Approved" },
            { from: 5, to: 6 }
        ]
    },
    voice: {
        title: "Inbound Customer/Patient Call Routing (Basic Flowchart)",
        type: "flowchart",
        nodes: [
            { id: 0, label: "Incoming Phone Call", x: 60, y: 150, shape: "circle", type: "standard" },
            { id: 1, label: "Speech-to-Text (Twilio)", x: 190, y: 150, shape: "rect", type: "standard" },
            { id: 2, label: "Intent Classification", x: 320, y: 150, shape: "rect", type: "standard" },
            { id: 3, label: "Is General Inquiry?", x: 450, y: 150, shape: "diamond", type: "decision" },
            { id: 4, label: "HITL Emergency Escalation", x: 450, y: 290, shape: "rect", type: "hitl" },
            { id: 5, label: "Auto-Answer from Knowledge Base", x: 600, y: 150, shape: "rect", type: "standard" },
            { id: 6, label: "End: Log Call in CRM", x: 740, y: 150, shape: "circle", type: "standard" }
        ],
        links: [
            { from: 0, to: 1 },
            { from: 1, to: 2 },
            { from: 2, to: 3 },
            { from: 3, to: 5, label: "Yes" },
            { from: 3, to: 4, label: "No" },
            { from: 4, to: 6 },
            { from: 5, to: 6 }
        ]
    },
    travel: {
        title: "Logistics: Corporate Travel Booking (SIPOC Map)",
        type: "sipoc",
        nodes: [
            { id: 0, label: "Travel Request (Supplier)", x: 60, y: 120, shape: "circle", type: "standard" },
            { id: 1, label: "Route Cost Opt (Input)", x: 190, y: 120, shape: "rect", type: "standard" },
            { id: 2, label: "Policy Compliance check", x: 320, y: 120, shape: "rect", type: "standard" },
            { id: 3, label: "Within Budget?", x: 450, y: 120, shape: "diamond", type: "decision" },
            { id: 4, label: "HITL Flight Override", x: 450, y: 260, shape: "rect", type: "hitl" },
            { id: 5, label: "Confirm Booking & Travel Insurance", x: 600, y: 120, shape: "rect", type: "standard" },
            { id: 6, label: "End: Send Itinerary (Customer)", x: 740, y: 120, shape: "circle", type: "standard" }
        ],
        links: [
            { from: 0, to: 1 },
            { from: 1, to: 2 },
            { from: 2, to: 3 },
            { from: 3, to: 5, label: "Yes" },
            { from: 3, to: 4, label: "No" },
            { from: 4, to: 5 },
            { from: 5, to: 6 }
        ]
    },
    legal_deposition: {
        title: "Legal: Deposition Scheduling & Filing Pipeline",
        type: "swimlane",
        nodes: [
            { id: 0, label: "Start: Deposition Request", x: 60, y: 70, shape: "circle", type: "standard" },
            { id: 1, label: "Roster Court Reporters", x: 190, y: 70, shape: "rect", type: "standard" },
            { id: 2, label: "Witness & Counsel Availability", x: 320, y: 70, shape: "rect", type: "standard" },
            { id: 3, label: "Schedule Conflict?", x: 450, y: 70, shape: "diamond", type: "decision" },
            { id: 4, label: "HITL Manual Call", x: 450, y: 220, shape: "rect", type: "hitl" },
            { id: 5, label: "Auto-Draft Notice Layout", x: 600, y: 70, shape: "rect", type: "standard" },
            { id: 6, label: "End: File in Portal", x: 740, y: 70, shape: "circle", type: "standard" }
        ],
        links: [
            { from: 0, to: 1 },
            { from: 1, to: 2 },
            { from: 2, to: 3 },
            { from: 3, to: 5, label: "No" },
            { from: 3, to: 4, label: "Yes" },
            { from: 4, to: 5, label: "Resolved" },
            { from: 5, to: 6 }
        ]
    },
    realestate_lead: {
        title: "Real Estate: Buyer Lead Nurturing & Contracts",
        type: "swimlane",
        nodes: [
            { id: 0, label: "Start: New Lead Form", x: 60, y: 70, shape: "circle", type: "standard" },
            { id: 1, label: "Contact CRM Enrichment", x: 190, y: 70, shape: "rect", type: "standard" },
            { id: 2, label: "Generate Showing Slots", x: 320, y: 70, shape: "rect", type: "standard" },
            { id: 3, label: "Under Budget limit?", x: 450, y: 70, shape: "diamond", type: "decision" },
            { id: 4, label: "HITL Broker Approval", x: 450, y: 220, shape: "rect", type: "hitl" },
            { id: 5, label: "Auto-Draft Maple Contract", x: 600, y: 70, shape: "rect", type: "standard" },
            { id: 6, label: "End: Complete DocuSign", x: 740, y: 70, shape: "circle", type: "standard" }
        ],
        links: [
            { from: 0, to: 1 },
            { from: 1, to: 2 },
            { from: 2, to: 3 },
            { from: 3, to: 5, label: "Yes" },
            { from: 3, to: 4, label: "No" },
            { from: 4, to: 5, label: "Verified" },
            { from: 5, to: 6 }
        ]
    },
    retail_order: {
        title: "Retail: Order Dispatch & Automated Re-Stocking",
        type: "flowchart",
        nodes: [
            { id: 0, label: "Order Received (Shopify)", x: 60, y: 150, shape: "circle", type: "standard" },
            { id: 1, label: "Warehouse Stock Scan", x: 190, y: 150, shape: "rect", type: "standard" },
            { id: 2, label: "Address Verification", x: 320, y: 150, shape: "rect", type: "standard" },
            { id: 3, label: "Is Inventory Low?", x: 450, y: 150, shape: "diamond", type: "decision" },
            { id: 4, label: "HITL Supply Authorization", x: 450, y: 290, shape: "rect", type: "hitl" },
            { id: 5, label: "Auto-Trigger Factory Wire", x: 600, y: 150, shape: "rect", type: "standard" },
            { id: 6, label: "End: Carrier Dispatch Label", x: 740, y: 150, shape: "circle", type: "standard" }
        ],
        links: [
            { from: 0, to: 1 },
            { from: 1, to: 2 },
            { from: 2, to: 3 },
            { from: 3, to: 6, label: "No" },
            { from: 3, to: 4, label: "Yes" },
            { from: 4, to: 5 },
            { from: 5, to: 6 }
        ]
    },
    hospitality_guest: {
        title: "Hospitality: Guest Booking & Concierge Routing",
        type: "swimlane",
        nodes: [
            { id: 0, label: "Start: Guest Reservation", x: 60, y: 70, shape: "circle", type: "standard" },
            { id: 1, label: "Room Allocation Script", x: 190, y: 70, shape: "rect", type: "standard" },
            { id: 2, label: "Pre-Auth CC Validation", x: 320, y: 70, shape: "rect", type: "standard" },
            { id: 3, label: "Special VIP Request?", x: 450, y: 70, shape: "diamond", type: "decision" },
            { id: 4, label: "HITL Suite Customization", x: 450, y: 220, shape: "rect", type: "hitl" },
            { id: 5, label: "Electronic Room-Key Load", x: 600, y: 70, shape: "rect", type: "standard" },
            { id: 6, label: "End: Dispatch Check-in PDF", x: 740, y: 70, shape: "circle", type: "standard" }
        ],
        links: [
            { from: 0, to: 1 },
            { from: 1, to: 2 },
            { from: 2, to: 3 },
            { from: 3, to: 5, label: "No" },
            { from: 3, to: 4, label: "Yes" },
            { from: 4, to: 5, label: "Ready" },
            { from: 5, to: 6 }
        ]
    },
    construction_permit: {
        title: "Construction: Permit Filing & Materials Dispatch",
        type: "swimlane",
        nodes: [
            { id: 0, label: "Start: Milestones Plan", x: 60, y: 70, shape: "circle", type: "standard" },
            { id: 1, label: "Draft Building Submissions", x: 190, y: 70, shape: "rect", type: "standard" },
            { id: 2, label: "County Zoning Auto-Check", x: 320, y: 70, shape: "rect", type: "standard" },
            { id: 3, label: "Permit Flagged/Refused?", x: 450, y: 70, shape: "diamond", type: "decision" },
            { id: 4, label: "HITL Site Plan Override", x: 450, y: 220, shape: "rect", type: "hitl" },
            { id: 5, label: "Dispatch Materials Order", x: 600, y: 70, shape: "rect", type: "standard" },
            { id: 6, label: "End: Phase 2 Logistics Release", x: 740, y: 70, shape: "circle", type: "standard" }
        ],
        links: [
            { from: 0, to: 1 },
            { from: 1, to: 2 },
            { from: 2, to: 3 },
            { from: 3, to: 5, label: "No" },
            { from: 3, to: 4, label: "Yes" },
            { from: 4, to: 5, label: "Resolved" },
            { from: 5, to: 6 }
        ]
    },
    education_schedule: {
        title: "Education: Tutor Rostering & Course Billing",
        type: "flowchart",
        nodes: [
            { id: 0, label: "Enrollment Form Submission", x: 60, y: 150, shape: "circle", type: "standard" },
            { id: 1, label: "Match Tutor Criteria", x: 190, y: 150, shape: "rect", type: "standard" },
            { id: 2, label: "Roster Schedule Alignment", x: 320, y: 150, shape: "rect", type: "standard" },
            { id: 3, label: "Tuition Balance Flag?", x: 450, y: 150, shape: "diamond", type: "decision" },
            { id: 4, label: "HITL Billing Exemption", x: 450, y: 290, shape: "rect", type: "hitl" },
            { id: 5, label: "Automated Course Wire", x: 600, y: 150, shape: "rect", type: "standard" },
            { id: 6, label: "End: Send Roster Confirmation", x: 740, y: 150, shape: "circle", type: "standard" }
        ],
        links: [
            { from: 0, to: 1 },
            { from: 1, to: 2 },
            { from: 2, to: 3 },
            { from: 3, to: 6, label: "No" },
            { from: 3, to: 4, label: "Yes" },
            { from: 4, to: 5 },
            { from: 5, to: 6 }
        ]
    },
    tech_bug: {
        title: "SaaS/Tech: Support Ticket & Bug Triaging",
        type: "swimlane",
        nodes: [
            { id: 0, label: "Start: Support Ticket", x: 60, y: 70, shape: "circle", type: "standard" },
            { id: 1, label: "Error Log Vector Extraction", x: 190, y: 70, shape: "rect", type: "standard" },
            { id: 2, label: "Severity Classification", x: 320, y: 70, shape: "rect", type: "standard" },
            { id: 3, label: "SLA Severity Level > 3?", x: 450, y: 70, shape: "diamond", type: "decision" },
            { id: 4, label: "HITL Core Developer Override", x: 450, y: 220, shape: "rect", type: "hitl" },
            { id: 5, label: "Generate Boilerplate Patch", x: 600, y: 70, shape: "rect", type: "standard" },
            { id: 6, label: "End: Close Ticket & Sync CRM", x: 740, y: 70, shape: "circle", type: "standard" }
        ],
        links: [
            { from: 0, to: 1 },
            { from: 1, to: 2 },
            { from: 2, to: 3 },
            { from: 3, to: 5, label: "No" },
            { from: 3, to: 4, label: "Yes" },
            { from: 4, to: 5, label: "Patched" },
            { from: 5, to: 6 }
        ]
    },
    professional_retainer: {
        title: "Professional Services: Monthly Client Retainer Audit",
        type: "swimlane",
        nodes: [
            { id: 0, label: "Start: Retainer Review", x: 60, y: 70, shape: "circle", type: "standard" },
            { id: 1, label: "Harvest Retainer Hours Log", x: 190, y: 70, shape: "rect", type: "standard" },
            { id: 2, label: "Assess Scope Exceeding", x: 320, y: 70, shape: "rect", type: "standard" },
            { id: 3, label: "Overage Deviation > 15%?", x: 450, y: 70, shape: "diamond", type: "decision" },
            { id: 4, label: "HITL Executive Override", x: 450, y: 220, shape: "rect", type: "hitl" },
            { id: 5, label: "Auto-Draft Invoice & Memo", x: 600, y: 70, shape: "rect", type: "standard" },
            { id: 6, label: "End: File Retainer in Ledger", x: 740, y: 70, shape: "circle", type: "standard" }
        ],
        links: [
            { from: 0, to: 1 },
            { from: 1, to: 2 },
            { from: 2, to: 3 },
            { from: 3, to: 5, label: "No" },
            { from: 3, to: 4, label: "Yes" },
            { from: 4, to: 5, label: "Approved" },
            { from: 5, to: 6 }
        ]
    },
    nonprofit_donor: {
        title: "Non-Profit: Donor Outreach & Receipt Dispatch",
        type: "swimlane",
        nodes: [
            { id: 0, label: "Start: Gift Contribution", x: 60, y: 70, shape: "circle", type: "standard" },
            { id: 1, label: "Tax-Exempt ID Verification", x: 190, y: 70, shape: "rect", type: "standard" },
            { id: 2, label: "Match Volunteer Records", x: 320, y: 70, shape: "rect", type: "standard" },
            { id: 3, label: "Is Large Donation?", x: 450, y: 70, shape: "diamond", type: "decision" },
            { id: 4, label: "HITL Personalized Letter", x: 450, y: 220, shape: "rect", type: "hitl" },
            { id: 5, label: "Send Auto Receipt Tax PDF", x: 600, y: 70, shape: "rect", type: "standard" },
            { id: 6, label: "End: Update Donor CRM Fields", x: 740, y: 70, shape: "circle", type: "standard" }
        ],
        links: [
            { from: 0, to: 1 },
            { from: 1, to: 2 },
            { from: 2, to: 3 },
            { from: 3, to: 5, label: "No" },
            { from: 3, to: 4, label: "Yes" },
            { from: 4, to: 5, label: "Penned" },
            { from: 5, to: 6 }
        ]
    },
    events_vendor: {
        title: "Event Planning: Vendor Booking & Roster Planning",
        type: "swimlane",
        nodes: [
            { id: 0, label: "Start: Client RSVP List", x: 60, y: 70, shape: "circle", type: "standard" },
            { id: 1, label: "Auto-Roster Audio Engineers", x: 190, y: 70, shape: "rect", type: "standard" },
            { id: 2, label: "Verify Caterer Deposits", x: 320, y: 70, shape: "rect", type: "standard" },
            { id: 3, label: "Headcount Exceeded?", x: 450, y: 70, shape: "diamond", type: "decision" },
            { id: 4, label: "HITL Client Escalation", x: 450, y: 220, shape: "rect", type: "hitl" },
            { id: 5, label: "Wire Automatic Bank Funds", x: 600, y: 70, shape: "rect", type: "standard" },
            { id: 6, label: "End: Print VIP Event Badges", x: 740, y: 70, shape: "circle", type: "standard" }
        ],
        links: [
            { from: 0, to: 1 },
            { from: 1, to: 2 },
            { from: 2, to: 3 },
            { from: 3, to: 5, label: "No" },
            { from: 3, to: 4, label: "Yes" },
            { from: 4, to: 5, label: "Resolved" },
            { from: 5, to: 6 }
        ]
    },
    recorded_rental: {
        title: "Recorded: Event Rental Order & Invoicing Pipeline (Observer Ingested)",
        type: "swimlane",
        nodes: [
            { id: 0, label: "Start: Squarespace Booking Request", x: 60, y: 70, shape: "circle", type: "standard" },
            { id: 1, label: "Query GoodShuffle Inventory", x: 190, y: 70, shape: "rect", type: "standard" },
            { id: 2, label: "Verify Availability & Rates", x: 320, y: 70, shape: "rect", type: "standard" },
            { id: 3, label: "Is Deposit Paid? (PayPal)", x: 450, y: 70, shape: "diamond", type: "decision" },
            { id: 4, label: "HITL Manual Review", x: 450, y: 220, shape: "rect", type: "hitl" },
            { id: 5, label: "Draft Invoice in QuickBooks", x: 600, y: 70, shape: "rect", type: "standard" },
            { id: 6, label: "End: Send Confirmation SMS", x: 740, y: 70, shape: "circle", type: "standard" }
        ],
        links: [
            { from: 0, to: 1 },
            { from: 1, to: 2 },
            { from: 2, to: 3 },
            { from: 3, to: 5, label: "Yes" },
            { from: 3, to: 4, label: "No" },
            { from: 4, to: 5, label: "Approved" },
            { from: 5, to: 6 }
        ]
    }
};

export function renderProcessMap(templateKey) {
    const template = PROCESS_TEMPLATES[templateKey];
    if (!template) return;
    
    const svg = document.getElementById('processSvg');
    if (!svg) return;
    
    svg.innerHTML = '';
    
    const titleText = document.getElementById('processMapTitle');
    if (titleText) titleText.textContent = template.title;
    
    template.links.forEach(link => {
        const fromNode = template.nodes.find(n => n.id === link.from);
        const toNode = template.nodes.find(n => n.id === link.to);
        if (!fromNode || !toNode) return;
        
        let x1 = fromNode.x;
        let y1 = fromNode.y;
        let x2 = toNode.x;
        let y2 = toNode.y;
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        let d = `M ${x1} ${y1} L ${x2} ${y2}`;
        
        if (x1 !== x2 && y1 !== y2) {
            d = `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2}`;
        }
        
        path.setAttribute('d', d);
        path.setAttribute('class', 'process-link');
        path.setAttribute('id', `link-${link.from}-${link.to}`);
        path.setAttribute('marker-end', 'url(#arrow)');
        svg.appendChild(path);
        
        if (link.label) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', (x1 + x2) / 2);
            text.setAttribute('y', y1 - 8);
            text.setAttribute('fill', 'var(--text-muted)');
            text.setAttribute('font-size', '10px');
            text.textContent = link.label;
            svg.appendChild(text);
        }
    });
    
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrow');
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '6');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '6');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('orient', 'auto-start-reverse');
    const pathArrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathArrow.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    pathArrow.setAttribute('fill', 'var(--border-hover)');
    marker.appendChild(pathArrow);
    defs.appendChild(marker);
    svg.appendChild(defs);
    
    template.nodes.forEach(node => {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', `process-node ${node.type === 'hitl' ? 'hitl' : ''}`);
        group.setAttribute('id', `node-${node.id}`);
        group.setAttribute('tabindex', '0');
        
        let shape;
        if (node.shape === 'circle') {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            shape.setAttribute('cx', node.x);
            shape.setAttribute('cy', node.y);
            shape.setAttribute('r', '28');
        } else if (node.shape === 'diamond') {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const pts = `${node.x},${node.y - 32} ${node.x + 35},${node.y} ${node.x},${node.y + 32} ${node.x - 35},${node.y}`;
            shape.setAttribute('points', pts);
        } else {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            shape.setAttribute('x', node.x - 65);
            shape.setAttribute('y', node.y - 25);
            shape.setAttribute('width', '130');
            shape.setAttribute('height', '50');
            shape.setAttribute('rx', '8');
        }
        
        group.appendChild(shape);
        
        const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        labelText.setAttribute('x', node.x);
        labelText.setAttribute('y', node.y + 4);
        labelText.setAttribute('font-size', '10px');
        
        const words = node.label.split(' ');
        if (words.length > 2) {
            const tspan1 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
            tspan1.setAttribute('x', node.x);
            tspan1.setAttribute('dy', '-4');
            tspan1.textContent = words.slice(0, Math.ceil(words.length / 2)).join(' ');
            
            const tspan2 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
            tspan2.setAttribute('x', node.x);
            tspan2.setAttribute('dy', '11');
            tspan2.textContent = words.slice(Math.ceil(words.length / 2)).join(' ');
            
            labelText.appendChild(tspan1);
            labelText.appendChild(tspan2);
        } else {
            labelText.textContent = node.label;
        }
        
        group.appendChild(labelText);
        svg.appendChild(group);
    });
}

export function runAgentProcessMap(templateKey, resume = false) {
    if (STATE.processTimer) clearInterval(STATE.processTimer);
    
    if (STATE.killSwitchActive) {
        logConsole('Cannot execute process. Agent is currently Offline (Kill Switch Active).', 'error');
        return;
    }
    
    updateAgentBadgeState('executing');
    renderProcessMap(templateKey);
    const template = PROCESS_TEMPLATES[templateKey];
    STATE.activeProcessKey = templateKey;
    
    if (!resume) {
        STATE.activeProcessNode = 0;
    } else {
        for (let i = 0; i < STATE.activeProcessNode; i++) {
            const el = document.getElementById(`node-${i}`);
            if (el) {
                el.classList.remove('active');
                el.classList.add('completed');
            }
        }
    }
    
    logConsole(`${resume ? 'Resuming' : 'Initializing'} Agent Pipeline workflow for: ${template.title}`, 'info');
    
    STATE.processTimer = setInterval(() => {
        const allNodes = document.querySelectorAll('.process-node');
        allNodes.forEach(n => n.classList.remove('active'));
        
        if (STATE.activeProcessNode >= template.nodes.length) {
            clearInterval(STATE.processTimer);
            logConsole(`Finished Agent Pipeline execution successfully. Task complete!`, 'success');
            updateAgentBadgeState('complete');
            setTimeout(() => {
                if (STATE.agentBadgeState === 'complete') {
                    updateAgentBadgeState('ready');
                }
            }, 30000);
            return;
        }
        
        if (STATE.activeProcessNode === template.nodes.length - 1) {
            updateAgentBadgeState('nearly_complete');
        }
        
        const currentNodeObj = template.nodes[STATE.activeProcessNode];
        const currentNode = document.getElementById(`node-${STATE.activeProcessNode}`);
        
        if (currentNode) {
            currentNode.classList.add('active');
            
            if (currentNodeObj.type === 'hitl') {
                currentNode.classList.add('hitl');
                logConsole(`Flow enters Human-in-the-Loop Node [${currentNodeObj.label}]. Execution paused waiting for Admin verification.`, 'warn');
                clearInterval(STATE.processTimer);
                updateAgentBadgeState('paused');
            } else if (currentNodeObj.type === 'decision') {
                logConsole(`Decision node evaluated [${currentNodeObj.label}]. Match threshold met. Continuing to automated release...`, 'info');
                STATE.activeProcessNode++;
            } else {
                logConsole(`Agent executing autonomous block: [${currentNodeObj.label}]`, 'info');
                STATE.activeProcessNode++;
            }
        } else {
            STATE.activeProcessNode++;
        }
    }, 2500);
}
