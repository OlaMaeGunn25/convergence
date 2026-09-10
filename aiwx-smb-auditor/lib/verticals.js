/**
 * Vertical Registry + Compliance Overlays (Phase 6, VRT)
 * ======================================================
 * The canonical 15 business verticals (mirrors the deployment hub's vertical
 * lock). Everything in the agentic layer — the 13-agent roster, comprehension,
 * knowledge/practice, and the governance gates — instantiates per vertical upon
 * connection to that vertical's tools (VRT-01). Each vertical carries a
 * compliance overlay that constrains its destructive actions (VRT-02).
 */

const { copy } = require('./immutable');

const VERTICALS = [
  { id: 'medical', name: 'Medical & Healthcare', compliance: ['HIPAA', 'BAA'] },
  { id: 'legal', name: 'Legal Services', compliance: ['IOLTA', 'ABA-Model-1.15'] },
  { id: 'realestate', name: 'Real Estate', compliance: ['Fair-Housing-Act'], regionalSources: 'MLS (RESO Web API)' },
  { id: 'retail', name: 'Retail & E-commerce', compliance: ['PCI-DSS'] },
  { id: 'hospitality', name: 'Hospitality & Leisure', compliance: ['ADA-Title-III', 'Alcohol-Licensing', 'FDA-Food-Code'] },
  { id: 'finance', name: 'Financial & Bookkeeping', compliance: ['GLBA-Safeguards', 'PCI-DSS'] },
  { id: 'construction', name: 'Construction & Contracting', compliance: ['OSHA-1926', 'Contractor-Licensing', 'Davis-Bacon', 'Mechanics-Lien', 'EPA-RRP'] },
  { id: 'logistics', name: 'Logistics & Supply Chain', compliance: ['FMCSA-HOS', '49-CFR-Hazmat', 'Carmack', 'CBP-Customs'] },
  { id: 'education', name: 'Education & Tutoring', compliance: ['FERPA-99.30', 'FERPA-99.31', 'COPPA', 'SOPIPA-like'] },
  { id: 'tech', name: 'SaaS & Tech Startups', compliance: ['State-Privacy', 'DMCA', 'WCAG-ADA'] },
  { id: 'professional', name: 'Professional Services', compliance: ['Professional-Licensing', 'FTC-Act-5', 'Client-Confidentiality'] },
  { id: 'nonprofit', name: 'Non-Profit Organizations', compliance: ['Charitable-Solicitation', 'IRC-501c3', 'IRS-Form-990', 'Substantiation-170f'] },
  { id: 'events', name: 'Event Planning & Management', compliance: ['ADA-Title-III', 'BOTS-Act', 'Alcohol-Licensing', 'Liability-Waiver'] },
  { id: 'event_rental', name: 'Event Rental & Equipment', compliance: ['CPSC-Product-Safety', 'Amusement-Device', 'Rental-Deposit', 'ADA-Title-III'] },
  // The reseller vertical. Structurally unlike the other fourteen: its clients
  // are themselves Convergence tenants, so this consultancy acts as a PROCESSOR
  // of its clients' data and as a DEPLOYER of AI systems into other people's
  // businesses. Both of those carry duties the operating verticals do not have.
  {
    id: 'ai_consultancy',
    name: 'AI Strategy & Automation Consultancy',
    compliance: ['Client-Confidentiality', 'DPA-Subprocessor', 'FTC-Act-5-AI-Claims', 'State-Privacy', 'AI-Deployer-Duty'],
    reseller: true
  }
];

const byId = new Map(VERTICALS.map(v => [v.id, v]));

// Accessors return DETACHED copies so a caller cannot mutate the canonical
// vertical registry (or a vertical's compliance overlay) process-wide.
function list() { return copy(VERTICALS); }
function get(id) { return copy(byId.get(String(id || '').toLowerCase())) || null; }
function has(id) { return byId.has(String(id || '').toLowerCase()); }
function complianceOverlay(id) { const v = get(id); return v ? v.compliance : []; }

module.exports = { VERTICALS, list, get, has, complianceOverlay };
