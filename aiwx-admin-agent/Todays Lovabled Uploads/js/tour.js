/*
   CONVERGENCE-Ai™ guided interactive product tour walkthrough module.
   Coordinates floating highlighted panels relative to DOM layout vectors.
*/

import { STATE } from './state.js';
import { logConsole } from './components.js';

let currentTourStep = 0;
const tourSteps = [
    {
        target: '#activeVerticalBadge',
        title: "🔒 Industry Vertical Lock",
        content: "To guarantee tenant isolation, your sandbox is programmatically locked strictly to this vertical. Super Admins can toggle between all 12 industries using this menu."
    },
    {
        target: '.sidebar-menu li:nth-child(2)',
        title: "📊 Mission Operations Panel",
        content: "Your main dashboard cockpit. Monitors agent heartbeat, tracks active container CPU metrics, and streams live back-office execution logs."
    },
    {
        target: '#pendingCountText',
        title: "🚦 Human-in-the-Loop Queue",
        content: "The core quality gate. The agent pauses high-risk drafts here. Review and click 'Approve & Release' to authorize ledger posts or flight wire transfers."
    },
    {
        target: '.sidebar-menu li:nth-child(3)',
        title: "📐 Six Sigma Process Mapping",
        content: "Visualize operations using standard Six Sigma Swimlanes and SIPOC canvases. Watch the nodes flash and pulse in real-time as tasks execute!"
    },
    {
        target: '.sidebar-menu li:nth-child(4)',
        title: "🧠 Agent Persona & SOP Training",
        content: "Onboard your digital employee here. Upload custom client SOP files, write job descriptions, and activate autonomous background running duties."
    },
    {
        target: '#navDocsItem',
        title: "📖 System Documentation Hub",
        content: "Need backend code sheets? Access unified reference schemas, REST API endpoints, docker-compose manifests, and Lovable handover scripts here."
    }
];

export function startProductTour() {
    currentTourStep = 0;
    
    let backdrop = document.getElementById('aiwxTourBackdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'aiwxTourBackdrop';
        backdrop.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(3,7,18,0.75);backdrop-filter:blur(3px);z-index:99999;transition:all 0.3s ease;pointer-events:auto;';
        document.body.appendChild(backdrop);
    }
    
    let highlight = document.getElementById('aiwxTourHighlight');
    if (!highlight) {
        highlight = document.createElement('div');
        highlight.id = 'aiwxTourHighlight';
        highlight.style.cssText = 'position:absolute;border:2px solid var(--secondary-color);box-shadow:0 0 25px var(--secondary-glow), inset 0 0 15px var(--secondary-glow);border-radius:8px;z-index:100000;transition:all 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);pointer-events:none;background:rgba(0,198,255,0.05);';
        document.body.appendChild(highlight);
    }
    
    let card = document.getElementById('aiwxTourCard');
    if (!card) {
        card = document.createElement('div');
        card.id = 'aiwxTourCard';
        card.style.cssText = 'position:fixed;background:rgba(15,23,42,0.95);border:1px solid rgba(255,255,255,0.15);box-shadow:0 20px 50px rgba(0,0,0,0.5);border-radius:12px;padding:1.5rem;width:340px;z-index:100001;transition:all 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);color:#ffffff;font-family:var(--font-body);display:flex;flex-direction:column;gap:12px;backdrop-filter:blur(10px);';
        document.body.appendChild(card);
    }
    
    renderTourStep();
}

export function renderTourStep() {
    const step = tourSteps[currentTourStep];
    const targetNode = document.querySelector(step.target);
    const highlight = document.getElementById('aiwxTourHighlight');
    const card = document.getElementById('aiwxTourCard');
    
    if (targetNode && highlight && card) {
        const rect = targetNode.getBoundingClientRect();
        const scrollY = window.scrollY || window.pageYOffset;
        const scrollX = window.scrollX || window.pageXOffset;
        
        targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        highlight.style.top = (rect.top + scrollY - 6) + 'px';
        highlight.style.left = (rect.left + scrollX - 6) + 'px';
        highlight.style.width = (rect.width + 12) + 'px';
        highlight.style.height = (rect.height + 12) + 'px';
        
        let cardTop = rect.bottom + 20;
        let cardLeft = rect.left;
        
        if (cardTop + 220 > window.innerHeight) {
            cardTop = rect.top - 200;
        }
        if (cardLeft + 340 > window.innerWidth) {
            cardLeft = window.innerWidth - 360;
        }
        if (cardLeft < 20) cardLeft = 20;
        
        card.style.top = cardTop + 'px';
        card.style.left = cardLeft + 'px';
        
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-weight:700; color:var(--secondary-color); font-family:var(--font-heading); font-size:0.95rem; display:flex; align-items:center; gap:6px;">
                    ${step.title}
                </div>
                <div style="font-size:0.7rem; color:var(--text-muted); font-weight:600;">
                    Step ${currentTourStep + 1} of ${tourSteps.length}
                </div>
            </div>
            <p style="font-size:0.8rem; color:var(--text-dim); line-height:1.55; margin:0;">
                ${step.content}
            </p>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                <button class="btn btn-secondary btn-small" id="tourSkipBtn" style="font-size:0.7rem; padding:4px 10px; cursor:pointer;">Skip Tour</button>
                <button class="btn btn-primary btn-small" id="tourNextBtn" style="font-size:0.7rem; padding:4px 12px; background:linear-gradient(135deg, var(--primary-color), var(--secondary-color)); border:none; box-shadow:0 0 10px var(--primary-glow); cursor:pointer;">
                    ${currentTourStep === tourSteps.length - 1 ? 'Finish Tour' : 'Next Step <i class="fa-solid fa-arrow-right" style="margin-left:4px;"></i>'}
                </button>
            </div>
        `;

        document.getElementById('tourSkipBtn').addEventListener('click', endTour);
        document.getElementById('tourNextBtn').addEventListener('click', nextTourStep);
    } else {
        console.warn(`[TOUR] Target node ${step.target} not found, advancing...`);
        nextTourStep();
    }
}

export function nextTourStep() {
    currentTourStep++;
    if (currentTourStep < tourSteps.length) {
        renderTourStep();
    } else {
        endTour();
    }
}

export function endTour() {
    ['aiwxTourBackdrop', 'aiwxTourHighlight', 'aiwxTourCard'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });
    logConsole("Product Tour completed successfully. Ready for full back-office operations!", "success");
}
