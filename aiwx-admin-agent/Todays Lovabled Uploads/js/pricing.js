/*
   CONVERGENCE-Ai™ Client Pricing & TCO Calculation Module
   Handles tiered licensing recommendations and dynamic add-on margins calculations.
*/

export function calculatePricing() {
    const baseLicense = parseFloat(document.getElementById('licTypeSelect')?.value || 249);
    const volume = parseInt(document.getElementById('volSelect')?.value || 10);
    const hasUpskill = document.getElementById('calcUpskillCheck')?.checked || false;
    const hasObserver = document.getElementById('calcObserverCheck')?.checked || false;
    const itemPrice = baseLicense + (hasUpskill ? 49 : 0) + (hasObserver ? 99 : 0);
    const total = itemPrice * volume;
    
    let modelDesc = "Licensed under: Starter Team / SMB Model. Margin: 82%";
    if (baseLicense === 99) {
        modelDesc = "Licensed under: Solopreneur / Freelance Model. Margin: 80%";
    } else if (baseLicense === 249) {
        modelDesc = "Licensed under: Starter Team / SMB Model. Margin: 82%";
    } else if (baseLicense === 499) {
        modelDesc = "Licensed under: Growth Office Model. Margin: 85%";
    } else if (baseLicense === 1200) {
        modelDesc = "Licensed under: Enterprise Elite Model (Private Cloud). Margin: 90%";
    }
    
    if (hasUpskill || hasObserver) {
        const addons = [];
        if (hasUpskill) addons.push("Workforce Upskilling Matrix Add-On");
        if (hasObserver) addons.push("Workflow Recording Observer Agent Add-On");
        modelDesc += " (+ " + addons.join(" & ") + ")";
    }
    
    const output = document.getElementById('pricingResult');
    if (output) {
        output.innerHTML = `
            <div style="font-size:1.5rem; font-weight:700; color:var(--secondary-color); font-family:var(--font-heading)">$${total.toLocaleString()}/month</div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">${modelDesc}</div>
        `;
    }
}
