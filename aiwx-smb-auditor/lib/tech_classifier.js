/**
 * Tech Classifier — BuiltWith-Parity Technology Detection Engine
 * 120+ signatures across 20 categories, multi-vector detection.
 * Vectors: HTML source, HTTP response headers, cookie names, DNS CNAME patterns.
 */

const TECH_SIGNATURES = [
  // ─── CMS ──────────────────────────────────────────────────────────────────
  { name: 'WordPress',       category: 'CMS',                isPaid: false, vectors: { html: /wp-content|wp-includes|wp-json/i,            header: null, cookie: /wordpress_logged_in/i } },
  { name: 'Joomla',          category: 'CMS',                isPaid: false, vectors: { html: /\/components\/com_|joomla/i,                 header: null, cookie: null } },
  { name: 'Drupal',          category: 'CMS',                isPaid: false, vectors: { html: /drupal\.js|Drupal\.settings/i,               header: null, cookie: /SESS[a-f0-9]+/i } },
  { name: 'Webflow',         category: 'CMS',                isPaid: true,  vectors: { html: /webflow\.com|\.wf-/i,                        header: null, cookie: null } },
  { name: 'Wix',             category: 'CMS',                isPaid: true,  vectors: { html: /wixstatic\.com|parastorage\.com/i,           header: null, cookie: /wixSession/i } },
  { name: 'Squarespace',     category: 'CMS',                isPaid: true,  vectors: { html: /squarespace\.com|static1\.squarespace/i,     header: null, cookie: null } },
  { name: 'Ghost',           category: 'CMS',                isPaid: false, vectors: { html: /ghost\.io|content\.ghost\.org/i,            header: /x-ghost-cache/i, cookie: null } },
  { name: 'Shopify',         category: 'E-Commerce',         isPaid: true,  vectors: { html: /cdn\.shopify\.com|Shopify\.theme/i,         header: /x-shopify-stage/i, cookie: /_shopify_s|cart/i } },
  { name: 'WooCommerce',     category: 'E-Commerce',         isPaid: false, vectors: { html: /woocommerce|wc-cart|add-to-cart/i,           header: null, cookie: /woocommerce_/i } },
  { name: 'BigCommerce',     category: 'E-Commerce',         isPaid: true,  vectors: { html: /bigcommerce\.com|cdn\.bigcommerce/i,        header: null, cookie: null } },
  { name: 'Magento',         category: 'E-Commerce',         isPaid: false, vectors: { html: /mage\/|Mage\.Cookies/i,                    header: /x-magento-/i, cookie: /PHPSESSID/i } },
  { name: 'Next.js',         category: 'Web Framework',      isPaid: false, vectors: { html: /_next\/static|__NEXT_DATA__|next\.js/i,      header: /x-nextjs-/i, cookie: null } },
  { name: 'Nuxt.js',         category: 'Web Framework',      isPaid: false, vectors: { html: /__nuxt__|_nuxt\//i,                         header: null, cookie: null } },
  { name: 'Gatsby',          category: 'Web Framework',      isPaid: false, vectors: { html: /gatsby-image|gatsby-runtime/i,              header: null, cookie: null } },
  { name: 'React',           category: 'JavaScript Library', isPaid: false, vectors: { html: /react(?:\.min)?\.js|react-dom|__reactFiber/i, header: null, cookie: null } },
  { name: 'Vue.js',          category: 'JavaScript Library', isPaid: false, vectors: { html: /vue(?:\.min)?\.js|__vue__|vue-router/i,      header: null, cookie: null } },
  { name: 'Angular',         category: 'JavaScript Library', isPaid: false, vectors: { html: /angular(?:\.min)?\.js|ng-version=|ng-app/i, header: null, cookie: null } },
  { name: 'Alpine.js',       category: 'JavaScript Library', isPaid: false, vectors: { html: /alpinejs|x-data=|x-bind:/i,                header: null, cookie: null } },
  { name: 'jQuery',          category: 'JavaScript Library', isPaid: false, vectors: { html: /jquery(?:\.min)?\.js|jquery-\d\.\d/i,       header: null, cookie: null } },
  { name: 'Bootstrap',       category: 'UI Framework',       isPaid: false, vectors: { html: /bootstrap(?:\.min)?\.css|bootstrap(?:\.min)?\.js/i, header: null, cookie: null } },
  { name: 'Tailwind CSS',    category: 'UI Framework',       isPaid: false, vectors: { html: /tailwindcss|tailwind\.css|class="[^"]*(?:flex|grid|text-|bg-|p-\d|m-\d)/i, header: null, cookie: null } },
  { name: 'Material UI',     category: 'UI Framework',       isPaid: false, vectors: { html: /MuiButton|MuiTypography|@mui/i,             header: null, cookie: null } },

  // ─── Analytics ────────────────────────────────────────────────────────────
  { name: 'Google Analytics 4',   category: 'Analytics',  isPaid: false, vectors: { html: /gtag\('config',\s*'G-|google-analytics\.com\/g\/collect/i, header: null, cookie: /_ga\b/i } },
  { name: 'Universal Analytics',  category: 'Analytics',  isPaid: false, vectors: { html: /ua-[\d]+-[\d]+|analytics\.js/i,               header: null, cookie: /_ga\b|_gid/i } },
  { name: 'Mixpanel',             category: 'Analytics',  isPaid: true,  vectors: { html: /cdn\.mxpnl\.com|mixpanel\.track/i,           header: null, cookie: /mp_/i } },
  { name: 'Segment',              category: 'Analytics',  isPaid: true,  vectors: { html: /cdn\.segment\.com|analytics\.load/i,         header: null, cookie: /ajs_user_id/i } },
  { name: 'Amplitude',            category: 'Analytics',  isPaid: true,  vectors: { html: /cdn\.amplitude\.com|amplitude\.init/i,       header: null, cookie: /amplitude/i } },
  { name: 'Hotjar',               category: 'Analytics',  isPaid: true,  vectors: { html: /static\.hotjar\.com|hjid/i,                 header: null, cookie: /_hjSession/i } },
  { name: 'Microsoft Clarity',    category: 'Analytics',  isPaid: false, vectors: { html: /clarity\.ms|microsoft clarity/i,            header: null, cookie: /_clsk/i } },
  { name: 'FullStory',            category: 'Analytics',  isPaid: true,  vectors: { html: /fullstory\.com\/s\/fs\.js|_fs_org/i,        header: null, cookie: /fs_uid/i } },
  { name: 'Crazy Egg',            category: 'Analytics',  isPaid: true,  vectors: { html: /crazyegg\.com\/pages\/embed\/crazyegg/i,    header: null, cookie: /cebs/i } },
  { name: 'PostHog',              category: 'Analytics',  isPaid: false, vectors: { html: /posthog\.js|app\.posthog\.com/i,            header: null, cookie: /ph_/i } },
  { name: 'Plausible Analytics',  category: 'Analytics',  isPaid: true,  vectors: { html: /plausible\.io\/js/i,                       header: null, cookie: null } },

  // ─── Tag Management ────────────────────────────────────────────────────────
  { name: 'Google Tag Manager',   category: 'Tag Management', isPaid: false, vectors: { html: /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/i, header: null, cookie: null } },
  { name: 'Tealium',              category: 'Tag Management', isPaid: true,  vectors: { html: /tags\.tiqcdn\.com|tealium/i,            header: null, cookie: /utag_main/i } },
  { name: 'Adobe Launch',         category: 'Tag Management', isPaid: true,  vectors: { html: /assets\.adobedtm\.com|_satellite/i,     header: null, cookie: null } },

  // ─── Marketing Automation ─────────────────────────────────────────────────
  { name: 'HubSpot',         category: 'CRM & Marketing',          isPaid: true,  vectors: { html: /js\.hs-scripts\.com|hs-banner|hubspot/i,   header: null, cookie: /hubspotutk/i } },
  { name: 'Salesforce CRM',  category: 'CRM & Marketing',          isPaid: true,  vectors: { html: /salesforce|force\.com|pardot/i,            header: null, cookie: /sid|sfdc_lv/i } },
  { name: 'Klaviyo',         category: 'Marketing Automation',     isPaid: true,  vectors: { html: /klaviyo\.com\/media|klaviyo\.init/i,       header: null, cookie: /__kla_id/i } },
  { name: 'Mailchimp',       category: 'Marketing Automation',     isPaid: false, vectors: { html: /mailchimp\.com|list-manage\.com|mc\.js/i,  header: null, cookie: null } },
  { name: 'ActiveCampaign',  category: 'Marketing Automation',     isPaid: true,  vectors: { html: /activecampaign|ac-for-stripe/i,            header: null, cookie: /ac_enable_tracking/i } },
  { name: 'ConvertKit',      category: 'Marketing Automation',     isPaid: true,  vectors: { html: /convertkit\.com|ck\.js/i,                  header: null, cookie: null } },
  { name: 'Drip',            category: 'Marketing Automation',     isPaid: true,  vectors: { html: /drip\.com\/e\//i,                          header: null, cookie: /__dc_gtm/i } },
  { name: 'Omnisend',        category: 'Marketing Automation',     isPaid: true,  vectors: { html: /omnisend\.com/i,                           header: null, cookie: null } },
  { name: 'Zoho CRM',        category: 'CRM & Marketing',          isPaid: true,  vectors: { html: /zoho\.com|salesiq\.zohopublic/i,           header: null, cookie: null } },
  { name: 'Pipedrive',       category: 'CRM & Marketing',          isPaid: true,  vectors: { html: /pipedrive/i,                               header: null, cookie: null } },
  { name: 'Freshsales',      category: 'CRM & Marketing',          isPaid: true,  vectors: { html: /freshsales|freshworks/i,                   header: null, cookie: null } },

  // ─── Ad Pixels & Social Tags ──────────────────────────────────────────────
  { name: 'Meta Pixel',            category: 'Marketing Tags', isPaid: false, vectors: { html: /connect\.facebook\.net|fbq\('init'/i,           header: null, cookie: /_fbp/i } },
  { name: 'Google Ads Tag',        category: 'Marketing Tags', isPaid: false, vectors: { html: /googleadservices|AW-\d{9,}/i,                   header: null, cookie: null } },
  { name: 'LinkedIn Insight Tag',  category: 'Marketing Tags', isPaid: false, vectors: { html: /snap\.licdn\.com|linkedin-insights|_linkedin_/i, header: null, cookie: /li_fat_id|bcookie/i } },
  { name: 'TikTok Pixel',          category: 'Marketing Tags', isPaid: false, vectors: { html: /analytics\.tiktok\.com|tiktok-pixel|ttq\.load/i, header: null, cookie: null } },
  { name: 'Pinterest Tag',         category: 'Marketing Tags', isPaid: false, vectors: { html: /ct\.pinterest\.com|pintrk/i,                   header: null, cookie: /_pinterest_sess/i } },
  { name: 'Twitter/X Pixel',       category: 'Marketing Tags', isPaid: false, vectors: { html: /static\.ads-twitter\.com|twq\(/i,              header: null, cookie: null } },
  { name: 'Snapchat Pixel',        category: 'Marketing Tags', isPaid: false, vectors: { html: /sc-static\.net\/scevent|snaptr/i,              header: null, cookie: null } },

  // ─── CDN & Hosting ────────────────────────────────────────────────────────
  { name: 'Cloudflare',    category: 'CDN & Hosting', isPaid: false, vectors: { html: /cloudflare/i, header: /cf-ray|cf-cache-status|cloudflare/i, cookie: /__cfduid|cf_clearance/i, cname: /cloudflare\.com/i } },
  { name: 'AWS CloudFront', category: 'CDN & Hosting', isPaid: true,  vectors: { html: /cloudfront\.net/i, header: /x-amz-cf-id|x-amz-cf-pop/i, cookie: null, cname: /cloudfront\.net/i } },
  { name: 'Fastly',        category: 'CDN & Hosting', isPaid: true,  vectors: { html: null, header: /x-fastly-/i, cookie: null, cname: /fastly\.net/i } },
  { name: 'Akamai',        category: 'CDN & Hosting', isPaid: true,  vectors: { html: null, header: /x-akamai-|akamaized/i, cookie: null, cname: /akamai\.net/i } },
  { name: 'Vercel',        category: 'CDN & Hosting', isPaid: true,  vectors: { html: /_vercel/i, header: /x-vercel-/i, cookie: null, cname: /vercel\.app/i } },
  { name: 'Netlify',       category: 'CDN & Hosting', isPaid: false, vectors: { html: /netlify\.app/i, header: /x-nf-request-id/i, cookie: null, cname: /netlify\.app/i } },
  { name: 'GitHub Pages',  category: 'CDN & Hosting', isPaid: false, vectors: { html: /github\.io/i, header: null, cookie: null, cname: /github\.io/i } },

  // ─── Security & SSL ───────────────────────────────────────────────────────
  { name: "Let's Encrypt", category: 'SSL & Security', isPaid: false, vectors: { html: /letsencrypt/i, header: null, cookie: null } },
  { name: 'Sucuri WAF',    category: 'SSL & Security', isPaid: true,  vectors: { html: /sucuri/i, header: /x-sucuri-id/i, cookie: null } },
  { name: 'Imperva',       category: 'SSL & Security', isPaid: true,  vectors: { html: /imperva/i, header: /x-iinfo|visid_incap/i, cookie: /visid_incap/i } },

  // ─── Payment Processing ───────────────────────────────────────────────────
  { name: 'Stripe',    category: 'Payment Processing', isPaid: true, vectors: { html: /js\.stripe\.com|Stripe\(/i, header: null, cookie: /__stripe_mid/i } },
  { name: 'PayPal',    category: 'Payment Processing', isPaid: true, vectors: { html: /paypal\.com\/sdk|paypalobjects\.com/i, header: null, cookie: /paypal/i } },
  { name: 'Square',    category: 'Payment Processing', isPaid: true, vectors: { html: /squareup\.com|square-payment|squarejs/i, header: null, cookie: null } },
  { name: 'Klarna',    category: 'Payment Processing', isPaid: true, vectors: { html: /klarna\.com\/v1\/api\.js|klarna-on-site/i, header: null, cookie: null } },
  { name: 'Affirm',    category: 'Payment Processing', isPaid: true, vectors: { html: /cdn1\.affirm\.com|affirm\.checkout/i, header: null, cookie: null } },
  { name: 'Braintree', category: 'Payment Processing', isPaid: true, vectors: { html: /braintreepayments|braintree\.com\/v3/i, header: null, cookie: null } },

  // ─── Customer Support & Chat ──────────────────────────────────────────────
  { name: 'Intercom',    category: 'Customer Support', isPaid: true, vectors: { html: /intercom\.io|intercomSettings/i, header: null, cookie: /intercom/i } },
  { name: 'Zendesk',     category: 'Customer Support', isPaid: true, vectors: { html: /zendesk|zopim|z-index.*zendesk/i, header: null, cookie: /__zlcid/i } },
  { name: 'Drift',       category: 'Customer Support', isPaid: true, vectors: { html: /js\.driftt\.com|drift\.load/i, header: null, cookie: /drift_aid/i } },
  { name: 'Crisp',       category: 'Customer Support', isPaid: false, vectors: { html: /client\.crisp\.chat|CRISP_WEBSITE_ID/i, header: null, cookie: /crisp-client/i } },
  { name: 'Freshdesk',   category: 'Customer Support', isPaid: true, vectors: { html: /freshdesk\.com|freshchat/i, header: null, cookie: null } },
  { name: 'LiveChat',    category: 'Customer Support', isPaid: true, vectors: { html: /livechatinc\.com\/tracking\.js|__lc/i, header: null, cookie: /__lc2_cid/i } },
  { name: 'Gorgias',     category: 'Customer Support', isPaid: true, vectors: { html: /gorgias\.com\/api\/chat/i, header: null, cookie: null } },
  { name: 'HubSpot Chat', category: 'Customer Support', isPaid: true, vectors: { html: /js\.usemessages\.com|hs-messages/i, header: null, cookie: null } },
  { name: 'Tawk.to',     category: 'Customer Support', isPaid: false, vectors: { html: /tawk\.to|embed\.tawk\.to/i, header: null, cookie: /TawkConnectionTime/i } },

  // ─── Scheduling & Booking ─────────────────────────────────────────────────
  { name: 'Calendly',          category: 'Scheduling & Booking', isPaid: true,  vectors: { html: /calendly\.com\/assets|calendly\.com\/d\//i, header: null, cookie: null } },
  { name: 'Cal.com',           category: 'Scheduling & Booking', isPaid: false, vectors: { html: /cal\.com|cal-embed/i, header: null, cookie: null } },
  { name: 'Acuity Scheduling', category: 'Scheduling & Booking', isPaid: true,  vectors: { html: /acuityscheduling\.com/i, header: null, cookie: null } },
  { name: 'Zocdoc',            category: 'Scheduling & Booking', isPaid: false, vectors: { html: /zocdoc\.com\/widget/i, header: null, cookie: null } },
  { name: 'Booksy',            category: 'Scheduling & Booking', isPaid: true,  vectors: { html: /booksy\.com/i, header: null, cookie: null } },
  { name: 'SimplyBook.me',     category: 'Scheduling & Booking', isPaid: true,  vectors: { html: /simplybook\.me/i, header: null, cookie: null } },

  // ─── Video & Media ────────────────────────────────────────────────────────
  { name: 'YouTube Embed', category: 'Video & Media', isPaid: false, vectors: { html: /youtube\.com\/embed|youtu\.be|yt-player/i, header: null, cookie: /YSC|VISITOR_INFO/i } },
  { name: 'Vimeo',         category: 'Video & Media', isPaid: true,  vectors: { html: /player\.vimeo\.com|vimeo\.com\/video/i, header: null, cookie: /vuid/i } },
  { name: 'Wistia',        category: 'Video & Media', isPaid: true,  vectors: { html: /wistia\.com|wistia\.net|wistiaApi/i, header: null, cookie: null } },
  { name: 'Loom',          category: 'Video & Media', isPaid: true,  vectors: { html: /loom\.com\/embed/i, header: null, cookie: null } },

  // ─── SEO & Structured Data ────────────────────────────────────────────────
  { name: 'Yoast SEO',       category: 'SEO & Schema', isPaid: false, vectors: { html: /yoast\.com|wpseo_|yoast seo/i, header: null, cookie: null } },
  { name: 'RankMath',        category: 'SEO & Schema', isPaid: false, vectors: { html: /rank-math|rankmath/i, header: null, cookie: null } },
  { name: 'Schema.org',      category: 'SEO & Schema', isPaid: false, vectors: { html: /"@context"\s*:\s*"https?:\/\/schema\.org/i, header: null, cookie: null } },
  { name: 'Open Graph',      category: 'SEO & Schema', isPaid: false, vectors: { html: /property="og:title"|property="og:image"/i, header: null, cookie: null } },
  { name: 'Twitter Cards',   category: 'SEO & Schema', isPaid: false, vectors: { html: /name="twitter:card"|name="twitter:title"/i, header: null, cookie: null } },

  // ─── Typography / Fonts ───────────────────────────────────────────────────
  { name: 'Google Fonts',  category: 'Fonts', isPaid: false, vectors: { html: /fonts\.googleapis\.com|fonts\.gstatic\.com/i, header: null, cookie: null } },
  { name: 'Adobe Fonts',   category: 'Fonts', isPaid: true,  vectors: { html: /use\.typekit\.net|use\.fonts\.com/i, header: null, cookie: null } },
  { name: 'Font Awesome',  category: 'Fonts', isPaid: false, vectors: { html: /fontawesome\.com|fa-solid|fas fa-/i, header: null, cookie: null } },

  // ─── Customer Reviews & Ratings ───────────────────────────────────────────
  { name: 'Trustpilot',     category: 'Reviews & Ratings', isPaid: true,  vectors: { html: /trustpilot\.com|trustpilot-widget|tp-widget/i, header: null, cookie: null } },
  { name: 'Birdeye',        category: 'Reviews & Ratings', isPaid: true,  vectors: { html: /birdeye\.com\/widget/i, header: null, cookie: null } },
  { name: 'Podium',         category: 'Reviews & Ratings', isPaid: true,  vectors: { html: /podium\.com\/widget|podiumlite/i, header: null, cookie: null } },
  { name: 'Google Reviews', category: 'Reviews & Ratings', isPaid: false, vectors: { html: /maps\.googleapis\.com.*place.*review|g\.page\/r\//i, header: null, cookie: null } },

  // ─── Finance, Bookkeeping & ERP ───────────────────────────────────────────
  { name: 'QuickBooks Online', category: 'Finance & ERP', isPaid: true, vectors: { html: /quickbooks|intuit/i, header: null, cookie: null } },
  { name: 'Xero',             category: 'Finance & ERP', isPaid: true, vectors: { html: /xero\.com/i, header: null, cookie: null } },
  { name: 'FreshBooks',       category: 'Finance & ERP', isPaid: true, vectors: { html: /freshbooks\.com/i, header: null, cookie: null } },
  { name: 'SAP Commerce',     category: 'Finance & ERP', isPaid: true, vectors: { html: /sap\.com|sapcommercecloud/i, header: null, cookie: null } },

  // ─── Communications ───────────────────────────────────────────────────────
  { name: 'Twilio',          category: 'Communications', isPaid: true, vectors: { html: /twilio/i, header: null, cookie: null } },
  { name: 'Sendbird',        category: 'Communications', isPaid: true, vectors: { html: /sendbird\.com/i, header: null, cookie: null } },
  { name: 'SendGrid',        category: 'Communications', isPaid: true, vectors: { html: /sendgrid\.com/i, header: null, cookie: null } },
  { name: 'Mailgun',         category: 'Communications', isPaid: true, vectors: { html: /mailgun\.com/i, header: null, cookie: null } },

  // ─── Business Productivity ────────────────────────────────────────────────
  { name: 'Google Workspace',  category: 'Business Productivity', isPaid: true,  vectors: { html: /accounts\.google\.com|google-site-verification/i, header: null, cookie: null } },
  { name: 'Microsoft 365',     category: 'Business Productivity', isPaid: true,  vectors: { html: /microsoftonline\.com|office365/i, header: null, cookie: null } },
  { name: 'Slack',             category: 'Business Productivity', isPaid: true,  vectors: { html: /slack\.com|slack-edge/i, header: null, cookie: null } },
  { name: 'Notion',            category: 'Project Management',   isPaid: false, vectors: { html: /notion\.so|notion-embed/i, header: null, cookie: null } },
  { name: 'Monday.com',        category: 'Project Management',   isPaid: true,  vectors: { html: /monday\.com/i, header: null, cookie: null } },
  { name: 'ClickUp',           category: 'Project Management',   isPaid: true,  vectors: { html: /clickup\.com/i, header: null, cookie: null } },
  { name: 'Asana',             category: 'Project Management',   isPaid: true,  vectors: { html: /asana\.com/i, header: null, cookie: null } },
  { name: 'Airtable',          category: 'Project Management',   isPaid: true,  vectors: { html: /airtable\.com/i, header: null, cookie: null } },

  // ─── Automation & AI Orchestration ───────────────────────────────────────
  { name: 'n8n',          category: 'Automation Engine',    isPaid: false, vectors: { html: /n8n\.io|n8n/i, header: null, cookie: null } },
  { name: 'Zapier',       category: 'Automation Engine',    isPaid: true,  vectors: { html: /zapier\.com/i, header: null, cookie: null } },
  { name: 'Make.com',     category: 'Automation Engine',    isPaid: true,  vectors: { html: /make\.com|integromat/i, header: null, cookie: null } },
  { name: 'Dify.ai',      category: 'Agent Orchestration',  isPaid: false, vectors: { html: /dify\.ai|dify/i, header: null, cookie: null } },
  { name: 'Voiceflow',    category: 'Agent Orchestration',  isPaid: true,  vectors: { html: /voiceflow\.com/i, header: null, cookie: null } },
  { name: 'Botpress',     category: 'Agent Orchestration',  isPaid: false, vectors: { html: /botpress\.com/i, header: null, cookie: null } },

  // ─── Maps & Location ─────────────────────────────────────────────────────
  { name: 'Google Maps API',  category: 'Maps & Location', isPaid: true,  vectors: { html: /maps\.googleapis\.com|google-map-embed/i, header: null, cookie: null } },
  { name: 'Mapbox',           category: 'Maps & Location', isPaid: true,  vectors: { html: /mapbox\.com\/mapbox-gl/i, header: null, cookie: null } },

  // ─── A/B Testing & Personalization ───────────────────────────────────────
  { name: 'Optimizely', category: 'A/B Testing', isPaid: true, vectors: { html: /optimizely\.com\/js/i, header: null, cookie: /optimizelyEndUserId/i } },
  { name: 'VWO',        category: 'A/B Testing', isPaid: true, vectors: { html: /vwo\.com|vis_opt_exp/i, header: null, cookie: /_vwo_uuid/i } },
];

/**
 * Primary detection function — runs all signatures against HTML, headers, cookies.
 * @param {string} html — Raw HTML/markdown content of the page
 * @param {Object} headers — HTTP response headers object (key: value)
 * @param {string} cookies — Cookie header string
 * @param {string} cname — Resolved DNS CNAME value for the domain
 * @returns {Array} — Detected technologies with confidence scores
 */
function detectTechnologies(html = '', headers = {}, cookies = '', cname = '') {
  const detected = [];
  const headerStr = JSON.stringify(headers).toLowerCase();
  const detectedNames = new Set();

  for (const sig of TECH_SIGNATURES) {
    let hits = 0;
    const maxVectors = Object.values(sig.vectors).filter(v => v !== null).length;
    if (maxVectors === 0) continue;

    // Test each vector
    if (sig.vectors.html   && html      && sig.vectors.html.test(html))       hits++;
    if (sig.vectors.header && headerStr && sig.vectors.header.test(headerStr)) hits++;
    if (sig.vectors.cookie && cookies   && sig.vectors.cookie.test(cookies))   hits++;
    if (sig.vectors.cname  && cname     && sig.vectors.cname.test(cname))      hits++;

    if (hits > 0 && !detectedNames.has(sig.name)) {
      const confidence = parseFloat((hits / Math.min(maxVectors, 2)).toFixed(2));
      detected.push({
        name:        sig.name,
        category:    sig.category,
        isPaid:      sig.isPaid,
        confidence:  Math.min(0.99, confidence),
        description: buildDescription(sig.name, sig.category),
        detectedAt:  new Date().toISOString().split('T')[0]
      });
      detectedNames.add(sig.name);
    }
  }

  return detected;
}

/**
 * Groups a flat technology array by category for display
 * @param {Array} techs
 * @returns {Object} — { 'Analytics': [...], 'CMS': [...], ... }
 */
function groupByCategory(techs) {
  return techs.reduce((groups, tech) => {
    const cat = tech.category || 'General';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(tech);
    return groups;
  }, {});
}

/**
 * Produces a human-readable description for a detected technology
 */
function buildDescription(name, category) {
  const descriptions = {
    'WordPress':           'Open-source CMS powering 43% of the web. Plugin ecosystem for blogs, e-commerce, and business sites.',
    'Shopify':             'Leading cloud-based e-commerce platform with checkout, inventory, and shipping built in.',
    'WooCommerce':         'WordPress e-commerce plugin enabling product catalogs, carts, and payment gateways.',
    'Next.js':             'React framework with server-side rendering, static generation, and edge routing.',
    'React':               'Facebook\'s declarative UI component library for building interactive interfaces.',
    'Vue.js':              'Progressive JavaScript framework for building reactive user interfaces.',
    'Google Analytics 4':  'Google\'s event-based analytics platform with cross-device tracking and ML insights.',
    'Google Tag Manager':  'Tag management system enabling non-technical teams to add/update tracking scripts.',
    'Meta Pixel':          'Facebook ad conversion tracking pixel for retargeting and audience building.',
    'LinkedIn Insight Tag':'LinkedIn ad conversion and audience tracking tag for B2B lead targeting.',
    'Cloudflare':          'Global edge network providing CDN, DDoS protection, and DNS management.',
    'Stripe':              'Developer-first payment processing API supporting subscriptions and one-time charges.',
    'HubSpot':             'All-in-one CRM, marketing automation, and sales pipeline management platform.',
    'Klaviyo':             'E-commerce-focused email and SMS automation platform with behavioral segmentation.',
    'Calendly':            'Scheduling automation platform for booking meetings and appointments online.',
    'Intercom':            'Customer messaging platform with live chat, bots, and onboarding sequences.',
    'Trustpilot':          'Review aggregation platform used to display verified customer ratings and feedback.',
    'Schema.org':          'Structured data markup enabling rich results in Google Search (ratings, FAQs, events).',
    'Google Fonts':        'Google\'s free web font hosting CDN, serving 1,000+ typefaces.',
    'YouTube Embed':       'Embedded YouTube video player for showcasing demo, promo, or tutorial content.',
    'QuickBooks Online':   'Cloud-based bookkeeping, invoicing, and expense tracking for SMBs.',
    'Optimizely':          'Enterprise A/B testing and feature experimentation platform.',
    'Hotjar':              'Heatmap, session recording, and user feedback tool for UX research.',
  };
  return descriptions[name] || `${name} — detected ${category} solution on this domain.`;
}

/**
 * Extracts contact intelligence from scraped HTML/markdown
 * @param {string} html
 * @param {string} markdown
 * @returns {Object} — { phones, emails, socialProfiles }
 */
function extractContactIntel(html = '', markdown = '') {
  const combined = html + ' ' + markdown;
  const emails   = new Set();
  const phones   = new Set();
  const socials  = {};

  // Emails (exclude common no-reply patterns)
  const emailRegex = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;
  const emailMatches = combined.match(emailRegex) || [];
  emailMatches.forEach(e => {
    const lower = e.toLowerCase();
    if (!lower.startsWith('noreply') && !lower.startsWith('no-reply') &&
        !lower.includes('example.com') && !lower.includes('sentry.io') &&
        !lower.includes('@w3.org') && !lower.includes('@schema.org')) {
      emails.add(lower);
    }
  });

  // US/Canadian phone numbers
  const phoneRegex = /(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const phoneMatches = combined.match(phoneRegex) || [];
  phoneMatches.forEach(p => phones.add(p.trim()));

  // Social profiles
  const socialPatterns = [
    { platform: 'LinkedIn',   regex: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/([a-z0-9\-_.]+)/gi },
    { platform: 'Facebook',   regex: /https?:\/\/(?:www\.)?facebook\.com\/([a-z0-9.\-_]+)/gi },
    { platform: 'Instagram',  regex: /https?:\/\/(?:www\.)?instagram\.com\/([a-z0-9.\-_]+)/gi },
    { platform: 'Twitter',    regex: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/([a-z0-9_]+)/gi },
    { platform: 'YouTube',    regex: /https?:\/\/(?:www\.)?youtube\.com\/(?:channel|@)([a-z0-9.\-_]+)/gi },
  ];

  socialPatterns.forEach(({ platform, regex }) => {
    const urlMatch = combined.match(regex);
    if (urlMatch && urlMatch.length > 0) {
      // Deduplicate and take the first clean URL
      const cleanUrl = urlMatch[0].trim();
      if (!cleanUrl.includes('share') && !cleanUrl.includes('sharer')) {
        socials[platform] = cleanUrl;
      }
    }
  });

  return {
    phones:         Array.from(phones).slice(0, 3),
    emails:         Array.from(emails).slice(0, 3),
    socialProfiles: socials
  };
}

/**
 * Infers traffic tier and signals from domain metadata
 * @param {string} domain
 * @param {Array} scrapedPages
 * @param {string} dnsProvider — detected from WAF/CDN
 * @returns {Object} — trafficSignals
 */
function inferTrafficSignals(domain, scrapedPages = [], dnsProvider = 'Unknown') {
  const pageCount = scrapedPages.length;

  // Heuristic tier assignment based on page count and domain structure
  let tier = 'Local Business';
  let estimatedMonthlyVisits = '500 – 2,000';

  if (pageCount >= 20) {
    tier = 'Regional SMB';
    estimatedMonthlyVisits = '2,000 – 15,000';
  }
  if (pageCount >= 50) {
    tier = 'National SMB';
    estimatedMonthlyVisits = '15,000 – 80,000';
  }

  // Boost tier if the domain has a CDN (signals investment)
  const hasCDN = dnsProvider !== 'Unknown' && dnsProvider !== 'None detected';
  if (hasCDN && tier === 'Local Business') {
    tier = 'Regional SMB';
    estimatedMonthlyVisits = '1,500 – 8,000';
  }

  return {
    estimatedMonthlyVisits,
    trafficTier: tier,
    sitemapPageCount: pageCount,
    dnsProvider
  };
}

module.exports = {
  detectTechnologies,
  groupByCategory,
  extractContactIntel,
  inferTrafficSignals,
  TECH_SIGNATURES
};
