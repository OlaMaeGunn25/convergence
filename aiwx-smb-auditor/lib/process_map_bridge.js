/**
 * Process-Map Bridge — Six Sigma maps that emit REAL governed tasks (ADD-ON)
 * =========================================================================
 * The hub (`aiwx-convergence-ai/js/process_maps.js`) draws Six Sigma swimlane and
 * SIPOC maps whose steps include HITL checkpoints. Those were a VISUALIZATION: the
 * "HITL Broker Approval" box in a diagram was not connected to the gateway's task
 * model, so nothing governed existed behind it.
 *
 * This bridge closes that gap. Instantiating a map creates a governed task per
 * step, chained by `dependsOn`, where a step of type `hitl` becomes a task in
 * **pending_approval** — i.e. the checkpoint drawn on the map IS the approval gate
 * the human actually sees, not a picture of one.
 *
 * Add-on module: `process_mapping`.
 *
 * Step types:  system (automated) · agent (agent-executed) · hitl (human gate)
 * Map types:   swimlane (Six Sigma) · sipoc
 */

const { copy } = require('./immutable');

const PROCESS_MAPS = {
  procure_to_pay: {
    key: 'procure_to_pay',
    title: 'Procure-to-Pay Invoice Mapping (Six Sigma Swimlane)',
    type: 'swimlane',
    vertical: 'finance',
    steps: [
      { id: 1, label: 'Invoice received', type: 'system', capability: 'list_invoices' },
      { id: 2, label: 'Extract + validate line items', type: 'agent', capability: 'list_invoices' },
      { id: 3, label: 'Variance check against PO', type: 'agent', capability: 'list_invoices' },
      { id: 4, label: 'Human Admin Review', type: 'hitl' },
      { id: 5, label: 'Post payment', type: 'agent', capability: 'record_payment', destructive: true }
    ]
  },
  corporate_travel: {
    key: 'corporate_travel',
    title: 'Logistics: Corporate Travel Booking (SIPOC Map)',
    type: 'sipoc',
    vertical: 'logistics',
    steps: [
      { id: 1, label: 'Travel request intake', type: 'system' },
      { id: 2, label: 'Policy + budget check', type: 'agent' },
      { id: 3, label: 'Itinerary options assembled', type: 'agent' },
      { id: 4, label: 'HITL Flight Override', type: 'hitl' },
      { id: 5, label: 'Book + confirm', type: 'agent', destructive: true }
    ]
  },
  realestate_buyer_lead: {
    key: 'realestate_buyer_lead',
    title: 'Real Estate: Buyer Lead to Showing (Six Sigma Swimlane)',
    type: 'swimlane',
    vertical: 'realestate',
    steps: [
      { id: 1, label: 'Buyer enquiry received', type: 'system' },
      // Region resolution comes first: MLS access is board-specific, so the
      // brokerage's covering board must be known before any listing is searched.
      { id: 2, label: 'Resolve covering MLS board for the buyer\'s region', type: 'agent', capability: 'realestate_mls_board_coverage' },
      { id: 3, label: 'Search listings against buyer criteria', type: 'agent', capability: 'realestate_search_listings' },
      { id: 4, label: 'Enrich shortlist with public property records', type: 'agent', capability: 'realestate_search_properties' },
      { id: 5, label: 'HITL Broker Review of shortlist', type: 'hitl' },
      // Contacting an owner is regulated, not routine: its own gate, and the
      // underlying tool is on the compliance floor regardless of this map.
      { id: 6, label: 'HITL approval to contact owner (compliance floor)', type: 'hitl' },
      { id: 7, label: 'Schedule showing and record the engagement', type: 'agent', destructive: true }
    ]
  },
  client_intake_legal: {
    key: 'client_intake_legal',
    title: 'Legal: Client Intake to Matter (Six Sigma Swimlane)',
    type: 'swimlane',
    vertical: 'legal',
    steps: [
      { id: 1, label: 'Intake enquiry received', type: 'system', capability: 'list_contacts' },
      { id: 2, label: 'Conflict-of-interest check', type: 'agent', capability: 'list_matters' },
      { id: 3, label: 'HITL Attorney Review', type: 'hitl' },
      { id: 4, label: 'Open matter', type: 'agent', capability: 'create_matter', destructive: true }
    ]
  }
};

function listMaps() {
  return Object.values(PROCESS_MAPS).map(m => copy({
    key: m.key, title: m.title, type: m.type, vertical: m.vertical,
    stepCount: m.steps.length,
    hitlCheckpoints: m.steps.filter(s => s.type === 'hitl').length
  }));
}

function getMap(key) {
  return copy(PROCESS_MAPS[key]) || null;
}

/**
 * Instantiate a map as a governed task chain.
 *
 * Each step becomes a task; step N+1 `dependsOn` step N, so the chain cannot run
 * out of order. A `hitl` step is created directly in **pending_approval** — the
 * human gate is a real governed object with a real approval, and every downstream
 * step is blocked behind it by the dependency edge.
 *
 * @returns { mapKey, title, tasks[], hitlCheckpoints }
 */
async function instantiate({ mapKey, tenantId = null, actor = null, taskModel }) {
  const map = PROCESS_MAPS[mapKey];
  if (!map) throw new Error(`Unknown process map "${mapKey}".`);
  if (!taskModel) throw new Error('A taskModel is required to instantiate a process map.');

  const tasks = [];
  let previousId = null;
  for (const step of map.steps) {
    const isHitl = step.type === 'hitl';
    const task = await taskModel.create({
      type: `processmap.${map.key}.step${step.id}`,
      // A HITL checkpoint is born pending_approval — it IS the gate.
      status: isHitl ? 'pending_approval' : 'proposed',
      payload: {
        source: 'process_map', mapKey: map.key, mapTitle: map.title, mapType: map.type,
        stepId: step.id, stepLabel: step.label, stepType: step.type,
        capability: step.capability || null, destructive: !!step.destructive,
        requiresHumanApproval: isHitl || !!step.destructive
      },
      dependsOn: previousId ? [previousId] : [],
      tenantId, actor,
      provenance: { source: 'process_map_bridge', map: map.key, step: step.id }
    });
    tasks.push({ id: task.id, stepId: step.id, label: step.label, type: step.type, status: task.status, dependsOn: task.dependsOn });
    previousId = task.id;
  }

  return {
    mapKey: map.key, title: map.title, vertical: map.vertical,
    tasks, hitlCheckpoints: tasks.filter(t => t.type === 'hitl').length
  };
}

module.exports = { PROCESS_MAPS, listMaps, getMap, instantiate };
