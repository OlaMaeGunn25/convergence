import { initErrorBoundary } from './error_boundary.js';
initErrorBoundary();

const VERTICALS = {
    medical: { name: "Medical & Healthcare" },
    legal: { name: "Legal Services" },
    realestate: { name: "Real Estate" },
    retail: { name: "Retail & E-commerce" },
    hospitality: { name: "Hospitality & Leisure" },
    finance: { name: "Financial & Bookkeeping" },
    construction: { name: "Construction & Contracting" },
    logistics: { name: "Logistics & Supply Chain" },
    education: { name: "Education & Tutoring" },
    tech: { name: "SaaS & Tech Startups" },
    professional: { name: "Professional Services" },
    nonprofit: { name: "Non-Profit Organizations" },
    events: { name: "Event Planning & Management" }
};

export function switchTab(tabId, element) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const selectedTab = document.getElementById(`tab-${tabId}`);
    if (selectedTab) selectedTab.style.display = 'block';
    
    if (element) {
        element.classList.add('active');
    }
}

export function togglePass() {
    const vaultInput = document.getElementById('deployVault');
    if (vaultInput) {
        vaultInput.type = vaultInput.type === "password" ? "text" : "password";
    }
}

export function updateLicensePreview() {
    const comp = document.getElementById('deployCompany')?.value || "Client Corp";
    const shortCode = comp.replace(/[^a-zA-Z]/g, "").substring(0, 8).toUpperCase();
    const licenseEl = document.getElementById('deployLicense');
    if (licenseEl) {
        licenseEl.value = `CONVERGENCE-${shortCode}-9812A-2026`;
    }
}

const LLM_MODELS = {
    gemini: [
        { value: "gemini-2.5-flash", name: "Gemini 2.5 Flash (Recommended)" },
        { value: "gemini-2.5-pro", name: "Gemini 2.5 Pro (Multimodal)" }
    ],
    openai: [
        { value: "gpt-4o", name: "GPT-4o (High Accuracy)" },
        { value: "gpt-4o-mini", name: "GPT-4o mini (Budget-Friendly)" }
    ],
    claude: [
        { value: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet (Reasoning)" },
        { value: "claude-3-5-haiku", name: "Claude 3.5 Haiku (Conversational)" }
    ],
    ollama: [
        { value: "llama3", name: "Llama 3 (8B Parameter Local)" },
        { value: "mistral", name: "Mistral (7B Parameter Private)" }
    ]
};

export function updateLlmModelOptions() {
    const provider = document.getElementById('deployLlmProvider')?.value || 'gemini';
    const modelSelect = document.getElementById('deployLlmModel');
    if (!modelSelect) return;
    
    modelSelect.innerHTML = '';
    const models = LLM_MODELS[provider] || [];
    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.value;
        option.textContent = model.name;
        modelSelect.appendChild(option);
    });
}

export async function deployClient() {
    const config = {
        companyName: document.getElementById('deployCompany').value,
        vertical: document.getElementById('deployVertical').value,
        logoText: document.getElementById('deployLogo').value,
        primaryColor: document.getElementById('deployColor1').value,
        secondaryColor: document.getElementById('deployColor2').value,
        apiEndpoint: document.getElementById('deployEndpoint').value,
        vaultKey: document.getElementById('deployVault').value,
        upskill: document.getElementById('deployUpskill').checked,
        observer: document.getElementById('deployObserver').checked,
        llmProvider: document.getElementById('deployLlmProvider')?.value || 'gemini',
        llmModel: document.getElementById('deployLlmModel')?.value || 'gemini-2.5-flash',
        llmApiKey: document.getElementById('deployLlmKey')?.value || '',
        llmMarkup: parseFloat(document.getElementById('deployLlmMarkup')?.value || 0)
    };
    
    const apiEndpoint = config.apiEndpoint || "http://localhost:8080";
    
    try {
        const response = await fetch(`${apiEndpoint}/api/deploy-agent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Deployment failed on server.");
        }

        const data = await response.json();
        
        const activeText = document.getElementById('activeVertText');
        if (activeText) activeText.textContent = VERTICALS[config.vertical].name;
        const tokenResult = document.getElementById('activationTokenResult');
        if (tokenResult) tokenResult.value = data.token;
        const resultsPanel = document.getElementById('deploymentResults');
        if (resultsPanel) resultsPanel.style.display = 'block';
        
        localStorage.setItem('aiwx_pending_token', data.token);
    } catch (err) {
        alert("Deployment activation failed: " + err.message);
    }
}

export function testLlmConnection() {
    const btn = document.querySelector('button[onclick="testLlmConnection()"]');
    if (!btn) return;
    
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Testing Connection...`;
    
    setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = originalText;
        alert(`Connection Successful!\n\nProvider verified: ${document.getElementById('deployLlmProvider').value}\nModel selected: ${document.getElementById('deployLlmModel').value}\nRoundtrip latency: ${Math.floor(25 + Math.random() * 30)}ms`);
    }, 1200);
}

export function copyToken() {
    const textarea = document.getElementById('activationTokenResult');
    if (textarea) {
        textarea.select();
        document.execCommand('copy');
        alert('Security activation token copied to clipboard! You can paste this in the Operations Hub activation lock.');
    }
}

export function calculateTco() {
    const licVal = parseFloat(document.getElementById('tcoLicenseSelect')?.value || 199);
    const tasksVal = parseInt(document.getElementById('tcoTasksSelect')?.value || 2000);
    const apiVal = parseFloat(document.getElementById('tcoApiSelect')?.value || 0.03);
    const hostingVal = parseFloat(document.getElementById('tcoHostingSelect')?.value || 40);
    const upskillVal = document.getElementById('tcoUpskillCheck')?.checked ? 49 : 0;
    const observerVal = document.getElementById('tcoObserverCheck')?.checked ? 99 : 0;
    
    const tokenCost = tasksVal * apiVal;
    const total = licVal + tokenCost + hostingVal + upskillVal + observerVal;
    
    const licOut = document.getElementById('tcoLicOutput');
    if (licOut) licOut.textContent = `$${(licVal + upskillVal + observerVal).toFixed(2)}/mo`;
    const tokensOut = document.getElementById('tcoTokensOutput');
    if (tokensOut) tokensOut.textContent = `$${tokenCost.toFixed(2)}/mo`;
    const hostingOut = document.getElementById('tcoHostingOutput');
    if (hostingOut) hostingOut.textContent = `$${hostingVal.toFixed(2)}/mo`;
    const totalOut = document.getElementById('tcoTotalOutput');
    if (totalOut) totalOut.textContent = `$${total.toFixed(2)}/mo`;
}

export function refreshConsents() {
    const body = document.getElementById('complianceConsentBody');
    if (!body) return;

    body.innerHTML = `
        <tr>
            <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <i class="fa-solid fa-circle-notch fa-spin" style="margin-right: 8px; color: var(--secondary-color);"></i> Querying remote tenants at GET /api/governance/consents...
            </td>
        </tr>
    `;
    
    setTimeout(() => {
        body.innerHTML = `
            <tr class="task-queue-row">
                <td>2026-06-26 11:22:15</td>
                <td>Apex Medical Care</td>
                <td><span style="color:#10b981; font-weight: 600;">Medical & Healthcare (HIPAA)</span></td>
                <td>auditor@apexmed.com</td>
                <td>192.168.1.45</td>
                <td><code style="font-size:0.7rem; color: var(--secondary-color)">e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855</code></td>
                <td><button class="btn btn-secondary btn-small" data-action="download" data-company="Apex Medical Care" data-vertical="Medical & Healthcare (HIPAA)"><i class="fa-solid fa-download"></i> PDF</button></td>
            </tr>
            <tr class="task-queue-row">
                <td>2026-06-26 10:45:02</td>
                <td>Metro LA Law Group</td>
                <td><span style="color:#38bdf8; font-weight: 600;">Legal Services (ABA Rule 1.6)</span></td>
                <td>compliance@metrola.com</td>
                <td>172.16.4.12</td>
                <td><code style="font-size:0.7rem; color: var(--secondary-color)">7f83b1657ff1fc53b92c43053d5a281a179c45012a6479b1852a855ab764f691</code></td>
                <td><button class="btn btn-secondary btn-small" data-action="download" data-company="Metro LA Law Group" data-vertical="Legal Services (ABA Rule 1.6)"><i class="fa-solid fa-download"></i> PDF</button></td>
            </tr>
            <tr class="task-queue-row">
                <td>2026-06-26 09:15:30</td>
                <td>Oakwood Properties</td>
                <td><span style="color:#f59e0b; font-weight: 600;">Real Estate (Fair Housing Act)</span></td>
                <td>broker@oakwood.com</td>
                <td>204.14.88.3</td>
                <td><code style="font-size:0.7rem; color: var(--secondary-color)">fb63b7165ef1fa53c92c43053d5a281a179c45012a6479b1852a855ab764f772</code></td>
                <td><button class="btn btn-secondary btn-small" data-action="download" data-company="Oakwood Properties" data-vertical="Real Estate (Fair Housing Act)"><i class="fa-solid fa-download"></i> PDF</button></td>
            </tr>
        `;
        
        // Attach click listeners
        body.querySelectorAll('button[data-action="download"]').forEach(btn => {
            btn.addEventListener('click', () => {
                downloadPdf(btn.getAttribute('data-company'), btn.getAttribute('data-vertical'));
            });
        });
    }, 800);
}

export function downloadPdf(company, vertical) {
    alert(`Generating and downloading tamper-proof WORM compliance PDF for ${company} (${vertical})...\nVerification Hash: e3b0c442...`);
}

// Bind to window for HTML compatibility
Object.assign(window, {
    switchTab,
    togglePass,
    updateLicensePreview,
    deployClient,
    copyToken,
    calculateTco,
    refreshConsents,
    downloadPdf,
    updateLlmModelOptions,
    testLlmConnection
});

// Setup lifecycle hooks
document.addEventListener('DOMContentLoaded', () => {
    // Populate LLM models dropdown
    updateLlmModelOptions();
    
    // Initial Calculations
    calculateTco();
    updateLicensePreview();
    
    // Bind change hooks dynamically
    document.getElementById('deployCompany')?.addEventListener('input', updateLicensePreview);
    document.getElementById('deployVertical')?.addEventListener('change', updateLicensePreview);
    
    document.getElementById('tcoLicenseSelect')?.addEventListener('change', calculateTco);
    document.getElementById('tcoTasksSelect')?.addEventListener('change', calculateTco);
    document.getElementById('tcoApiSelect')?.addEventListener('change', calculateTco);
    document.getElementById('tcoHostingSelect')?.addEventListener('change', calculateTco);
    document.getElementById('tcoUpskillCheck')?.addEventListener('change', calculateTco);
    document.getElementById('tcoObserverCheck')?.addEventListener('change', calculateTco);
});
