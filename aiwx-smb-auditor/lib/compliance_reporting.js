/**
 * Reporting Agent — Compliance Evidence (Phase 9, RPT)
 * ====================================================
 * Turns the Compliance agent's determinations into visual, immutable,
 * record-keeping, EXPORTABLE evidence (RPT-01/02/03). The store is append-only
 * (never updated/deleted) so the evidence is audit-defensible; export renders it
 * as JSON, CSV, or a self-contained HTML summary for auditors/regulators.
 *
 * Store: Supabase table `compliance_evidence` + JSON fallback.
 */

const path = require('path');
const { isSupabaseConfigured, insertRow, selectRows } = require('./supabase');
const jsonFile = require('./stores/json_file');

const EMPTY = { evidence: [] };

function csvEscape(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

class ComplianceReporting {
  constructor(options = {}) {
    this.usingSupabase = isSupabaseConfigured();
    this.file = options.file || path.join(__dirname, '..', 'config', 'compliance_evidence.json');
  }

  /** Append an immutable evidence record (the Compliance→Reporting handoff). */
  async record(determination) {
    if (!determination || !determination.id) throw new Error('A compliance determination (with an id) is required.');
    const rec = { ...determination, recordedAt: new Date().toISOString() };
    if (this.usingSupabase) {
      await insertRow('compliance_evidence', {
        id: rec.id, tenant_id: rec.tenantId || null, vertical: rec.vertical || null,
        capability: rec.capability || null, verdict: rec.verdict, citations: rec.citations || [],
        io_flags: rec.ioFlags || [], confidence: rec.confidence, provenance: rec.provenance || {},
        determined_at: rec.at, recorded_at: rec.recordedAt
      });
      return rec;
    }
    return jsonFile.mutate(this.file, EMPTY, (store) => {
      const arr = Array.isArray(store.evidence) ? store.evidence : [];
      arr.push(rec); // append-only
      return { value: { evidence: arr }, result: rec };
    });
  }

  async list({ tenantId } = {}) {
    if (this.usingSupabase) {
      const q = tenantId ? `tenant_id=eq.${encodeURIComponent(tenantId)}&order=recorded_at.asc` : 'select=*';
      return (await selectRows('compliance_evidence', q)) || [];
    }
    const store = jsonFile.readSync(this.file, EMPTY);
    return (store.evidence || []).filter(e => tenantId === undefined || e.tenantId === tenantId);
  }

  /** Visual compliance report: counts by verdict, level, and cited rules (RPT-01). */
  async report({ tenantId = null } = {}) {
    const ev = await this.list({ tenantId: tenantId || undefined });
    const byVerdict = { pass: 0, flag: 0, block: 0 };
    const byLevel = { local: 0, state: 0, federal: 0 };
    const rules = {};
    for (const e of ev) {
      byVerdict[e.verdict] = (byVerdict[e.verdict] || 0) + 1;
      for (const c of e.citations || []) {
        byLevel[c.level] = (byLevel[c.level] || 0) + 1;
        rules[c.code] = (rules[c.code] || 0) + 1;
      }
    }
    const attention = byVerdict.block + byVerdict.flag;
    return {
      tenantId, total: ev.length, byVerdict, byLevel, citedRules: rules,
      headline: byVerdict.block > 0 ? 'blocked' : attention > 0 ? 'attention' : 'clear',
      generatedAt: new Date().toISOString()
    };
  }

  /** Exportable evidence: json | csv | html (RPT-03). */
  async export({ tenantId = null, format = 'json' } = {}) {
    const ev = await this.list({ tenantId: tenantId || undefined });
    if (format === 'csv') {
      const header = ['id', 'tenantId', 'vertical', 'capability', 'verdict', 'citations', 'confidence', 'source', 'determinedAt'];
      const rows = ev.map(e => [
        e.id, e.tenantId, e.vertical, e.capability, e.verdict,
        (e.citations || []).map(c => c.code).join('|'), e.confidence, (e.provenance || {}).source, e.at
      ].map(csvEscape).join(','));
      return { format: 'csv', content: [header.join(','), ...rows].join('\n'), count: ev.length };
    }
    if (format === 'html') {
      const rep = await this.report({ tenantId });
      const rows = ev.map(e => `<tr><td>${e.vertical || ''}</td><td>${e.capability || ''}</td><td>${e.verdict}</td><td>${(e.citations || []).map(c => c.code).join(', ')}</td><td>${e.at}</td></tr>`).join('');
      const content = `<section><h2>Compliance Evidence — ${tenantId || 'all tenants'}</h2>`
        + `<p>Total: ${rep.total} · pass ${rep.byVerdict.pass} · flag ${rep.byVerdict.flag} · block ${rep.byVerdict.block} · headline: ${rep.headline}</p>`
        + `<table border="1" cellpadding="4"><thead><tr><th>Vertical</th><th>Capability</th><th>Verdict</th><th>Citations</th><th>Determined</th></tr></thead><tbody>${rows}</tbody></table></section>`;
      return { format: 'html', content, count: ev.length };
    }
    return { format: 'json', content: ev, count: ev.length };
  }
}

module.exports = { ComplianceReporting };
