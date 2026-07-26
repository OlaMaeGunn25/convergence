/**
 * Vertical Registry + Compliance Overlays (Phase 6, VRT)
 * ======================================================
 * The canonical 14 business verticals (mirrors the deployment hub's 14-vertical
 * lock). Everything in the agentic layer — the 13-agent roster, comprehension,
 * knowledge/practice, and the governance gates — instantiates per vertical upon
 * connection to that vertical's tools (VRT-01). Each vertical carries a
 * compliance overlay that constrains its destructive actions (VRT-02).
 */

const VERTICALS = [
  { id: 'medical', name: 'Medical & Healthcare', compliance: ['HIPAA', 'BAA'] },
  { id: 'legal', name: 'Legal Services', compliance: ['IOLTA', 'ABA-Model-1.15'] },
  { id: 'realestate', name: 'Real Estate', compliance: ['Fair-Housing-Act'], regionalSources: 'MLS (RESO Web API)' },
  { id: 'retail', name: 'Retail & E-commerce', compliance: ['PCI-DSS'] },
  { id: 'hospitality', name: 'Hospitality & Leisure', compliance: [] },
  { id: 'finance', name: 'Financial & Bookkeeping', compliance: ['GLBA-Safeguards', 'PCI-DSS'] },
  { id: 'construction', name: 'Construction & Contracting', compliance: [] },
  { id: 'logistics', name: 'Logistics & Supply Chain', compliance: [] },
  { id: 'education', name: 'Education & Tutoring', compliance: ['FERPA'] },
  { id: 'tech', name: 'SaaS & Tech Startups', compliance: [] },
  { id: 'professional', name: 'Professional Services', compliance: [] },
  { id: 'nonprofit', name: 'Non-Profit Organizations', compliance: [] },
  { id: 'events', name: 'Event Planning & Management', compliance: [] },
  { id: 'event_rental', name: 'Event Rental & Equipment', compliance: [] }
];

const byId = new Map(VERTICALS.map(v => [v.id, v]));

function list() { return VERTICALS; }
function get(id) { return byId.get(String(id || '').toLowerCase()) || null; }
function has(id) { return byId.has(String(id || '').toLowerCase()); }
function complianceOverlay(id) { const v = get(id); return v ? v.compliance : []; }

module.exports = { VERTICALS, list, get, has, complianceOverlay };
