/**
 * Connector Catalog
 * =================
 * The canonical list of systems CONVERGENCE-Ai can connect to the governed MCP
 * layer. This is the reference set the integration-matcher scores a company's
 * detected systems against, and the set the connection-registry can build a
 * connection for.
 *
 * A connector declares:
 *   - kind        'mcp' (spoken to over Model Context Protocol) | 'api' (REST)
 *   - auth        how credentials are obtained ('oauth2' | 'api_key' | 'none')
 *   - envKeys     the env / Secret-Manager variables that hold credentials.
 *                 CREDENTIALS ARE NEVER ACCEPTED OVER HTTP — the connection
 *                 builder only references these keys (same rule as Supabase).
 *   - matchSignals substrings matched (case-insensitively) against a company's
 *                 detected technologies, vertical, domain, and business name.
 *   - vertical    affinity ('universal' or a list of verticals) used to surface
 *                 connectors even when no exact tech signature is detected.
 *   - capabilities        read-ish operations exposed once connected.
 *   - destructiveCapabilities  operations that mutate the external system and so
 *                 route through the HITL approval gate (AI TRiSM "WHO may act").
 *   - status      'available' | 'beta' | 'planned'
 *
 * Adding a connector here makes it discoverable (`GET /api/connectors`,
 * `list_connectors`), matchable (audit `integrationReadiness`), and connectable
 * (`connect_system`) without touching the engine.
 */

const CONNECTORS = [
  {
    id: 'clio', name: 'Clio', category: 'Legal Practice Management',
    kind: 'api', auth: 'oauth2', envKeys: ['CLIO_CLIENT_ID', 'CLIO_CLIENT_SECRET', 'CLIO_ACCESS_TOKEN'],
    vertical: ['Legal Services', 'Law', 'Professional Services'],
    matchSignals: ['clio', 'clio grow', 'lawpay', 'legal', 'law firm', 'attorney', 'esq'],
    capabilities: ['list_matters', 'list_contacts', 'list_activities', 'list_tasks'],
    destructiveCapabilities: ['create_matter', 'create_activity', 'record_trust_transaction'],
    status: 'available',
    docs: 'https://docs.developers.clio.com'
  },
  {
    id: 'hubspot', name: 'HubSpot', category: 'CRM & Marketing',
    kind: 'api', auth: 'oauth2', envKeys: ['HUBSPOT_ACCESS_TOKEN'],
    vertical: 'universal',
    matchSignals: ['hubspot', 'hs-scripts', 'hs-analytics', 'hsforms'],
    capabilities: ['list_contacts', 'list_deals', 'list_companies'],
    destructiveCapabilities: ['create_contact', 'update_deal'],
    status: 'available',
    docs: 'https://developers.hubspot.com'
  },
  {
    id: 'salesforce', name: 'Salesforce', category: 'CRM',
    kind: 'api', auth: 'oauth2', envKeys: ['SALESFORCE_CLIENT_ID', 'SALESFORCE_CLIENT_SECRET', 'SALESFORCE_ACCESS_TOKEN'],
    vertical: 'universal',
    matchSignals: ['salesforce', 'force.com', 'pardot', 'lightning'],
    capabilities: ['list_leads', 'list_opportunities', 'list_accounts'],
    destructiveCapabilities: ['create_lead', 'update_opportunity'],
    status: 'beta',
    docs: 'https://developer.salesforce.com'
  },
  {
    id: 'quickbooks', name: 'QuickBooks Online', category: 'Accounting & Finance',
    kind: 'api', auth: 'oauth2', envKeys: ['QUICKBOOKS_CLIENT_ID', 'QUICKBOOKS_CLIENT_SECRET', 'QUICKBOOKS_ACCESS_TOKEN'],
    vertical: 'universal',
    matchSignals: ['quickbooks', 'intuit', 'qbo'],
    capabilities: ['list_invoices', 'list_customers', 'list_payments'],
    destructiveCapabilities: ['create_invoice', 'record_payment'],
    status: 'available',
    docs: 'https://developer.intuit.com'
  },
  {
    id: 'xero', name: 'Xero', category: 'Accounting & Finance',
    kind: 'api', auth: 'oauth2', envKeys: ['XERO_CLIENT_ID', 'XERO_CLIENT_SECRET', 'XERO_ACCESS_TOKEN'],
    vertical: 'universal',
    matchSignals: ['xero'],
    capabilities: ['list_invoices', 'list_contacts', 'list_bank_transactions'],
    destructiveCapabilities: ['create_invoice'],
    status: 'beta',
    docs: 'https://developer.xero.com'
  },
  {
    id: 'stripe', name: 'Stripe', category: 'Payments',
    kind: 'api', auth: 'api_key', envKeys: ['STRIPE_SECRET_KEY'],
    vertical: 'universal',
    matchSignals: ['stripe', 'js.stripe.com', 'checkout.stripe'],
    capabilities: ['list_charges', 'list_customers', 'list_subscriptions'],
    destructiveCapabilities: ['create_refund'],
    status: 'available',
    docs: 'https://stripe.com/docs/api'
  },
  {
    id: 'shopify', name: 'Shopify', category: 'E-Commerce',
    kind: 'api', auth: 'api_key', envKeys: ['SHOPIFY_ADMIN_TOKEN', 'SHOPIFY_STORE_DOMAIN'],
    vertical: ['E-Commerce & Retail', 'Retail'],
    matchSignals: ['shopify', 'cdn.shopify', 'myshopify'],
    capabilities: ['list_orders', 'list_products', 'list_customers'],
    destructiveCapabilities: ['update_inventory', 'create_discount'],
    status: 'available',
    docs: 'https://shopify.dev/docs/api'
  },
  {
    id: 'google_calendar', name: 'Google Calendar', category: 'Scheduling',
    kind: 'mcp', auth: 'oauth2', envKeys: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_CALENDAR_TOKEN'],
    vertical: 'universal',
    matchSignals: ['google calendar', 'calendar.google', 'gcal'],
    capabilities: ['list_events', 'list_calendars', 'suggest_time'],
    destructiveCapabilities: ['create_event', 'delete_event'],
    status: 'available',
    docs: 'https://developers.google.com/calendar'
  },
  {
    id: 'calendly', name: 'Calendly', category: 'Scheduling',
    kind: 'api', auth: 'oauth2', envKeys: ['CALENDLY_ACCESS_TOKEN'],
    vertical: 'universal',
    matchSignals: ['calendly', 'assets.calendly'],
    capabilities: ['list_events', 'list_event_types', 'list_invitees'],
    destructiveCapabilities: ['cancel_event'],
    status: 'beta',
    docs: 'https://developer.calendly.com'
  },
  {
    id: 'google_workspace', name: 'Google Workspace (Gmail/Drive)', category: 'Email & Documents',
    kind: 'mcp', auth: 'oauth2', envKeys: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_WORKSPACE_TOKEN'],
    vertical: 'universal',
    matchSignals: ['google workspace', 'gmail', 'gsuite', 'workspace.google', 'aspmx.l.google'],
    capabilities: ['search_files', 'read_file', 'list_recent_files'],
    destructiveCapabilities: ['create_file', 'send_email'],
    status: 'available',
    docs: 'https://developers.google.com/workspace'
  },
  {
    id: 'microsoft365', name: 'Microsoft 365', category: 'Email & Documents',
    kind: 'api', auth: 'oauth2', envKeys: ['MS_CLIENT_ID', 'MS_CLIENT_SECRET', 'MS_GRAPH_TOKEN'],
    vertical: 'universal',
    matchSignals: ['office365', 'outlook', 'microsoft 365', 'sharepoint', 'onmicrosoft'],
    capabilities: ['list_messages', 'list_events', 'search_files'],
    destructiveCapabilities: ['send_email', 'create_event'],
    status: 'beta',
    docs: 'https://learn.microsoft.com/graph'
  },
  {
    id: 'slack', name: 'Slack', category: 'Team Communication',
    kind: 'mcp', auth: 'oauth2', envKeys: ['SLACK_BOT_TOKEN'],
    vertical: 'universal',
    matchSignals: ['slack', 'slack.com'],
    capabilities: ['list_channels', 'read_messages'],
    destructiveCapabilities: ['post_message'],
    status: 'available',
    docs: 'https://api.slack.com'
  },
  {
    id: 'zendesk', name: 'Zendesk', category: 'Customer Support',
    kind: 'api', auth: 'api_key', envKeys: ['ZENDESK_SUBDOMAIN', 'ZENDESK_API_TOKEN', 'ZENDESK_EMAIL'],
    vertical: 'universal',
    matchSignals: ['zendesk', 'zdassets', 'zendesk.com'],
    capabilities: ['list_tickets', 'list_users'],
    destructiveCapabilities: ['create_ticket', 'update_ticket'],
    status: 'beta',
    docs: 'https://developer.zendesk.com'
  },
  {
    id: 'twilio', name: 'Twilio', category: 'Messaging & Voice',
    kind: 'api', auth: 'api_key', envKeys: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
    vertical: 'universal',
    matchSignals: ['twilio'],
    capabilities: ['list_messages', 'list_calls'],
    destructiveCapabilities: ['send_sms', 'place_call'],
    status: 'beta',
    docs: 'https://www.twilio.com/docs'
  }
];

const byId = new Map(CONNECTORS.map(c => [c.id, c]));

/** Full catalog (optionally filtered to available/beta only). */
function list({ includePlanned = true } = {}) {
  return CONNECTORS.filter(c => includePlanned || c.status !== 'planned');
}

function get(id) {
  return byId.get(id) || null;
}

function has(id) {
  return byId.has(id);
}

/** Connectors whose vertical affinity includes `vertical` (plus all universals). */
function byVertical(vertical) {
  const v = (vertical || '').toLowerCase();
  return CONNECTORS.filter(c =>
    c.vertical === 'universal' ||
    (Array.isArray(c.vertical) && c.vertical.some(x => x.toLowerCase() === v)));
}

/**
 * Public-safe view of a connector (never leaks the actual credential values —
 * only which env keys are expected, and whether they are currently populated).
 */
function publicView(c) {
  if (!c) return null;
  return {
    id: c.id, name: c.name, category: c.category, kind: c.kind, auth: c.auth,
    vertical: c.vertical, status: c.status, docs: c.docs,
    capabilities: c.capabilities, destructiveCapabilities: c.destructiveCapabilities,
    credentialsConfigured: (c.envKeys || []).every(k => !!process.env[k]),
    requiredEnvKeys: c.envKeys || []
  };
}

module.exports = { list, get, has, byVertical, publicView, CONNECTORS };
