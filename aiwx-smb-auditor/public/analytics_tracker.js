// analytics_tracker.js - Modular client-side GA4 tracker for pageviews and CTA conversion click-throughs

(function() {
  // Helper to safely get base API path matching client setup
  function getApiUrl(endpoint) {
    if (window.location.port === '3003' || window.location.port === '3000') {
      return endpoint;
    }
    return 'http://localhost:3003' + endpoint;
  }

  // Parse UTM Campaign parameters from query string
  function getUtmParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      campaign: params.get('utm_campaign') || '(not set)',
      source: params.get('utm_source') || '(not set)',
      medium: params.get('utm_medium') || '(not set)'
    };
  }

  // Event queue for offline-resilient analytics
  const eventQueue = [];
  let flushTimer = null;

  function logEventToServer(type, label, value = 1) {
    const utm = getUtmParams();
    eventQueue.push({
      type, label, value,
      campaign: utm.campaign,
      source: utm.source,
      medium: utm.medium,
      timestamp: new Date().toISOString()
    });
    if (!flushTimer) {
      flushTimer = setTimeout(flushEventQueue, 2000); // batch flush every 2s
    }
  }

  async function flushEventQueue(attempt = 0) {
    flushTimer = null;
    if (eventQueue.length === 0) return;

    const batch = eventQueue.splice(0, eventQueue.length);
    try {
      const res = await fetch(getApiUrl('/api/track-events-batch'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (attempt < 3) {
        // Exponential backoff: 2s, 4s, 8s
        const delay = Math.pow(2, attempt + 1) * 1000;
        console.debug(`[Analytics] Retry ${attempt + 1}/3 in ${delay}ms...`);
        eventQueue.unshift(...batch); // re-queue failed events
        setTimeout(() => flushEventQueue(attempt + 1), delay);
      } else {
        console.debug('[Analytics] Max retries reached. Events dropped:', batch.length);
      }
    }
  }

  // Flush remaining events on page unload
  window.addEventListener('beforeunload', () => {
    if (eventQueue.length > 0) {
      navigator.sendBeacon(getApiUrl('/api/track-events-batch'),
        JSON.stringify({ events: eventQueue }));
    }
  });

  // Initialize dynamic GA4 ingestion
  async function initGA4() {
    // 1. Log the pageview landing event locally first (independent of GA4 connection)
    logEventToServer('pageview', window.location.pathname);

    try {
      const response = await fetch(getApiUrl('/api/analytics-config'));
      const res = await response.json();
      if (res.success && res.measurementId) {
        const measurementId = res.measurementId;
        
        // Dynamically insert gtag.js script
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
        document.head.appendChild(script);
        
        // Setup gtag data layer
        window.dataLayer = window.dataLayer || [];
        window.gtag = function() { window.dataLayer.push(arguments); };
        gtag('js', new Date());
        
        // Config pageview tracking
        gtag('config', measurementId, {
          page_path: window.location.pathname,
          send_page_view: true
        });
        
        console.log(`[GA4] Connected successfully. Ingesting views on ID: ${measurementId}`);
      }
    } catch (err) {
      console.warn('[GA4] Google Analytics client blocked/unreachable, running local tracking mode.');
    }

    // Bind trackers once DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindCtaTracking);
    } else {
      bindCtaTracking();
    }
  }

  // Bind CTA Conversion Events
  function bindCtaTracking() {
    console.log('[GA4] Mapping conversion events to CTA clickthroughs...');
    
    // Page: index.html (Audit Engine Home)
    const auditBtn = document.getElementById('trigger-audit');
    if (auditBtn) {
      auditBtn.addEventListener('click', () => {
        const domainVal = document.getElementById('target-domain')?.value || '';
        
        // GA4 Client Send
        if (window.gtag) {
          gtag('event', 'cta_click_audit', {
            event_category: 'Engagement',
            event_label: 'Analyze Footprint',
            target_domain: domainVal
          });
        }
        // Local Server Send
        logEventToServer('cta_click_audit', domainVal);
        console.log(`[GA4 Event] Tracked cta_click_audit for: ${domainVal}`);
      });
    }

    // Preset Domain Chips
    const chips = document.querySelectorAll('.sample-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const domainVal = chip.getAttribute('data-domain') || chip.textContent;
        if (window.gtag) {
          gtag('event', 'preset_domain_click', {
            event_category: 'Engagement',
            event_label: domainVal
          });
        }
        logEventToServer('preset_domain_click', domainVal);
      });
    });

    // Page: product.html (Pricing & Calculator)
    const proposalBtn = document.querySelector('.calc-output-sec .search-btn');
    if (proposalBtn) {
      proposalBtn.addEventListener('click', () => {
        const staff = document.getElementById('slider-staff')?.value || '10';
        const wage = document.getElementById('slider-wage')?.value || '30';
        const saving = document.getElementById('slider-saving')?.value || '20';
        
        if (window.gtag) {
          gtag('event', 'cta_click_proposal', {
            event_category: 'Sales',
            event_label: 'Generate Client Proposal',
            config_headcount: staff,
            config_wage: wage,
            config_efficiency: saving
          });
        }
        logEventToServer('cta_click_proposal', `Headcount: ${staff}, Saving: ${saving}%`);
        console.log('[GA4 Event] Tracked cta_click_proposal');
      });
    }

    // Export PDF/Word Buttons
    const wordExport = document.getElementById('export-word-btn');
    if (wordExport) {
      wordExport.addEventListener('click', () => {
        if (window.gtag) {
          gtag('event', 'export_report', {
            event_category: 'Engagement',
            event_label: 'Word Exporter'
          });
        }
        logEventToServer('export_report', 'Word Exporter');
      });
    }

    const pdfExport = document.getElementById('print-report');
    if (pdfExport) {
      pdfExport.addEventListener('click', () => {
        if (window.gtag) {
          gtag('event', 'export_report', {
            event_category: 'Engagement',
            event_label: 'PDF Print Exporter'
          });
        }
        logEventToServer('export_report', 'PDF Exporter');
      });
    }
  }

  // Trigger loading process
  initGA4();
})();
