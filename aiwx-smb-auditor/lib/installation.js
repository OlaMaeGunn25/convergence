/**
 * Installation Orchestration (Phase 3, INS + ORC-01)
 * ==================================================
 * Ties a tenant install together: select the systems to connect, provision the
 * full 13-agent roster scoped to the locked vertical (the isolated team-per-
 * instance), and gate "install complete" on every selected system reaching
 * agent_ready with the roster deployed (INS-01/02/03).
 *
 * Store: Supabase table `installations` + JSON fallback. Composes AgentRegistry
 * (roster) + the system evaluator's onboarding readiness (per selected system).
 */

const path = require('path');
const { isSupabaseConfigured, insertRow, selectRows } = require('./supabase');
const jsonFile = require('./stores/json_file');
const { AgentRegistry } = require('./agent_model');
const { KnowledgeBase } = require('./knowledge_ingest');
const businessOnboarding = require('./business_onboarding');
const systemEvaluator = require('./system_evaluator');

const EMPTY = { installations: [] };

class Installation {
  constructor(options = {}) {
    this.usingSupabase = isSupabaseConfigured();
    this.file = options.file || path.join(__dirname, '..', 'config', 'installations.json');
    this.agents = options.agentRegistry || new AgentRegistry(options.agentOptions || {});
    this.connections = options.connectionRegistry || null;
    this.knowledgeBase = options.knowledgeBase || new KnowledgeBase(options.knowledgeOptions || {});
    // HITL onboarding (assignment + role-keyed upskilling enrolment) at install.
    this.hitlOnboarding = options.hitlOnboarding || null;
  }

  /**
   * Install: provision the roster scoped to the vertical, record the selection,
   * and AUTO-CREATE the company knowledge base from the onboarding business
   * intelligence (ONB-KB-01/02).
   */
  async install({ tenantId, vertical, selectedConnectors = [], businessName = null, businessProfile = {}, seedDocs = [], auditPackage = null, hitls = [], tenantDomain = null, actor = null }) {
    if (!tenantId) throw new Error('tenantId is required to install.');
    if (!vertical) throw new Error('vertical is required (the locked vertical).');
    const roster = await this.agents.provisionRoster({ tenantId, vertical, scopeConnectors: selectedConnectors });
    const now = new Date().toISOString();
    const record = { tenantId, vertical, selectedConnectors, installedAt: now, actor };
    if (this.usingSupabase) {
      await insertRow('installations', { tenant_id: tenantId, vertical, selected_connectors: selectedConnectors, installed_at: now, actor });
    } else {
      await jsonFile.mutate(this.file, EMPTY, (store) => {
        const arr = Array.isArray(store.installations) ? store.installations : [];
        const i = arr.findIndex(x => x.tenantId === tenantId);
        if (i >= 0) arr[i] = record; else arr.push(record);
        return { value: { installations: arr }, result: record };
      });
    }

    // Auto-create the company KB from the onboarding business intelligence.
    let knowledge = null;
    try {
      knowledge = await businessOnboarding.onboard({
        tenantId, vertical, businessName: businessName || tenantId,
        profile: businessProfile || {}, seedDocs: seedDocs || [], systems: selectedConnectors,
        auditPackage: auditPackage || null, knowledgeBase: this.knowledgeBase, actor
      });
    } catch (kbErr) {
      knowledge = { error: kbErr.message };
    }

    // Assign HITLs at onboarding (HLC-01) + enrol each in their ROLE curriculum.
    let hitlOnboarding = null;
    if (this.hitlOnboarding && Array.isArray(hitls) && hitls.length) {
      try {
        hitlOnboarding = await this.hitlOnboarding.onboardHitls({
          tenantId, hitls, tenantDomain, source: 'installation', actor
        });
      } catch (e) {
        hitlOnboarding = { error: e.message };
      }
    }

    return { install: record, roster: roster.length, knowledge, hitlOnboarding };
  }

  async getInstall(tenantId) {
    if (this.usingSupabase) {
      const rows = await selectRows('installations', `tenant_id=eq.${encodeURIComponent(tenantId)}&limit=1`);
      const r = rows && rows[0];
      return r ? { tenantId: r.tenant_id, vertical: r.vertical, selectedConnectors: r.selected_connectors || [], installedAt: r.installed_at } : null;
    }
    const store = jsonFile.readSync(this.file, EMPTY);
    return (store.installations || []).find(x => x.tenantId === tenantId) || null;
  }

  /**
   * INS-03: install is complete only when the roster is deployed AND every
   * selected system is agent_ready.
   */
  async status({ tenantId }) {
    const install = await this.getInstall(tenantId);
    if (!install) return { tenantId, installed: false, complete: false };
    const roster = await this.agents.list({ tenantId });
    let readiness = { systems: [] };
    if (this.connections) readiness = await systemEvaluator.onboardingStatus({ tenantId, connectionRegistry: this.connections });
    const selected = install.selectedConnectors || [];
    const perSelected = selected.map(cid => {
      const row = (readiness.systems || []).find(s => s.connectorId === cid);
      return { connectorId: cid, readiness: row ? row.readiness : 'not_ready' };
    });
    const readyCount = perSelected.filter(s => s.readiness === 'ready').length;
    const systemsReady = selected.length > 0 && readyCount === selected.length;
    const activeAgents = roster.filter(a => a.status === 'active').length;
    const kb = await this.knowledgeBase.compile({ tenantId });
    const knowledgeReady = kb.ready === true;
    return {
      tenantId, installed: true, vertical: install.vertical,
      selectedConnectors: selected, perSelected,
      rosterSize: roster.length, activeAgents, systemsReady,
      knowledgeReady, knowledgeChunks: kb.totalChunks,
      readyPct: selected.length ? Math.round((100 * readyCount) / selected.length) : 0,
      complete: roster.length >= 13 && systemsReady && knowledgeReady,
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = { Installation };
