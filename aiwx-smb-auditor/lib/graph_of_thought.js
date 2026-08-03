/**
 * Graph-of-Thought (GoT) Prompt Re-engineering — CHT-02
 * =====================================================
 * EVERY prompt entered by ANY company running CONVERGENCE-Ai is re-engineered
 * through this framework before anything is planned, previewed, or executed. It
 * replaces the earlier tree-of-thought: a tree forces each line of reasoning into
 * an isolated branch, whereas a GRAPH lets thoughts cross-inform, contradict,
 * aggregate, and refine — which is what governed planning actually requires.
 *
 * What a graph buys us over a tree:
 *   - CROSS-LINKING  — the company KB, the industry practice, and each candidate
 *     capability inform one another instead of sitting in separate branches.
 *   - CONTRADICTION  — an SOP that forbids an action is a first-class `contradicts`
 *     edge that measurably lowers the plan score (a tree can only note it).
 *   - AGGREGATION    — supporting thoughts merge into ONE synthesized plan node.
 *   - REFINEMENT     — the risk/compliance verdict feeds BACK into the plan node
 *     (a cycle a tree cannot express), producing the final refined plan.
 *   - SCORING        — every node carries a support score; the graph yields a
 *     confidence for the whole plan, not just the top candidate.
 *
 * Node types: request | understanding | candidate | knowledge | practice | risk |
 *             aggregate | refinement | outcome
 * Edge types: derives | informs | supports | contradicts | aggregates | refines
 *
 * Deterministic + offline, so it is fully testable and adds no LLM cost.
 */

const injectionGuard = require('./injection_guard');

const EDGE = { DERIVES: 'derives', INFORMS: 'informs', SUPPORTS: 'supports', CONTRADICTS: 'contradicts', AGGREGATES: 'aggregates', REFINES: 'refines' };

function clamp(n) { return Math.max(0, Math.min(1, Number(n) || 0)); }
function round(n) { return Number(Number(n).toFixed(3)); }

/**
 * Re-engineer a prompt into a graph of thought.
 *
 * @param query        the raw prompt as the human typed/spoke it.
 * @param top          the best-matching executable capability (or null).
 * @param candidates   all ranked capability candidates (cross-linked).
 * @param vertical     the tenant's locked vertical.
 * @param knowledgeRefs company-KB hits grounding the request.
 * @param correlation  practice ↔ SOP correlation (may flag a conflict).
 * @returns { root, nodes[], edges[], aggregate, refinement, confidence, verdict, summary }
 */
function graphOfThought({ query, top = null, candidates = [], vertical = null, knowledgeRefs = [], correlation = null } = {}) {
  const nodes = [];
  const edges = [];
  const add = (id, type, label, detail, score) => { nodes.push({ id, type, label, detail, score: round(clamp(score)) }); return id; };
  const link = (from, to, type, weight = 1) => { edges.push({ from, to, type, weight: round(weight) }); };

  // 1. The request itself.
  add('request', 'request', 'Request', `"${query}"`, 1);

  // 2. Understanding derived from the request.
  add('understanding', 'understanding', 'Interpreted intent',
    top ? `Interpreted as: ${top.action}.` : 'Intent is unclear — human disambiguation is required.',
    top ? clamp(top.score != null ? top.score : 0.5) : 0.2);
  link('request', 'understanding', EDGE.DERIVES);

  // 3. Candidate capabilities as PARALLEL nodes that cross-link to each other —
  //    the graph can compare alternatives instead of committing to one branch.
  const candIds = [];
  (candidates.length ? candidates : (top ? [top] : [])).slice(0, 4).forEach((c, i) => {
    const id = `candidate_${i + 1}`;
    add(id, 'candidate', c.action || c.capability,
      `${c.capability} on ${c.system} (${c.type === 'write' ? 'write' : 'read'}), match ${c.score != null ? c.score : 'n/a'}.`,
      clamp(c.score != null ? c.score : 0.4));
    link('understanding', id, EDGE.DERIVES);
    candIds.forEach(prev => link(prev, id, EDGE.INFORMS, 0.3)); // alternatives inform each other
    candIds.push(id);
  });
  const chosen = candIds[0] || 'understanding';

  // 4. Company knowledge — grounds (supports) the chosen candidate.
  //    Retrieved document text is UNTRUSTED data. If any of it matched an
  //    injection pattern it must not silently strengthen the plan (CHT/SEC).
  const evidence = injectionGuard.assessRetrieved(knowledgeRefs);
  const kbScore = knowledgeRefs.length
    ? clamp((0.4 + 0.2 * knowledgeRefs.length) * (evidence.trustworthy ? 1 : 0.3))
    : 0;
  add('knowledge', 'knowledge', 'Company knowledge base',
    knowledgeRefs.length
      ? `Grounded in ${knowledgeRefs.length} company KB reference(s): ${knowledgeRefs.map(r => r.sourceRef || '(doc)').join(', ')}.`
        + (evidence.suspect ? ` ⚠ ${evidence.suspect} reference(s) matched a prompt-injection pattern — treated as data only.` : '')
      : 'No matching company knowledge found — proceeding on general practice.',
    kbScore);
  link('request', 'knowledge', EDGE.INFORMS);
  if (knowledgeRefs.length) {
    // Suspect evidence CONTRADICTS rather than supports: it may be adversarial.
    link('knowledge', chosen, evidence.trustworthy ? EDGE.SUPPORTS : EDGE.CONTRADICTS, evidence.trustworthy ? kbScore : 0.8);
  }

  // 5. Industry practice + governing SOP. A conflict is a CONTRADICTS edge — the
  //    structural advantage of a graph over a tree.
  const conflict = !!(correlation && correlation.conflictFlaggedToHitl);
  const practiceDetail = correlation
    ? (conflict
      ? 'Company SOP conflicts with the planned action — the SOP governs; routed to HITL.'
      : `Aligned with ${vertical || 'general'} industry practice${correlation.governingSop ? ' + the governing company SOP' : ''}.`)
    : `Governed by ${vertical || 'general'} industry practice.`;
  add('practice', 'practice', 'Industry practice + company SOP', practiceDetail, conflict ? 0.1 : 0.7);
  link('knowledge', 'practice', EDGE.INFORMS);
  link('practice', chosen, conflict ? EDGE.CONTRADICTS : EDGE.SUPPORTS, conflict ? 0.9 : 0.7);

  // 6. Risk assessment.
  const destructive = !!(top && top.type === 'write');
  add('risk', 'risk', 'Risk assessment',
    top
      ? (destructive
        ? 'Write/destructive action — requires HITL confirmation (or an autonomy grant, subject to the compliance floor).'
        : 'Read-only action — low risk.')
      : 'Not assessable until a capability is identified.',
    destructive ? 0.35 : 0.85);
  link(chosen, 'risk', EDGE.DERIVES);

  // 7. AGGREGATION — merge the supporting thoughts into one synthesized plan.
  const supports = edges.filter(e => e.type === EDGE.SUPPORTS);
  const contradicts = edges.filter(e => e.type === EDGE.CONTRADICTS);
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const support = supports.reduce((s, e) => s + e.weight * (byId[e.from] ? byId[e.from].score : 0), 0);
  const against = contradicts.reduce((s, e) => s + e.weight * 0.8, 0);
  const base = top ? clamp(top.score != null ? top.score : 0.4) : 0.15;
  const aggScore = clamp(base + 0.25 * support - against);
  add('aggregate', 'aggregate', 'Synthesized plan',
    top
      ? `Perform "${top.capability}" via ${top.system}${knowledgeRefs.length ? ', grounded in company knowledge' : ''}${conflict ? ' — BLOCKED by a governing SOP' : ''}.`
      : 'No executable plan — the request needs human disambiguation.',
    aggScore);
  [chosen, 'knowledge', 'practice', 'risk'].forEach(id => { if (byId[id] || id === chosen) link(id, 'aggregate', EDGE.AGGREGATES); });

  // 8. REFINEMENT — the risk/compliance verdict feeds BACK into the plan (a cycle
  //    a tree cannot express), yielding the final refined plan.
  // A high-severity injection attempt in the grounding evidence ALWAYS reaches a
  // human, regardless of how confident the rest of the plan looks.
  const needsHuman = conflict || destructive || !top || aggScore < 0.34 || evidence.routeToHitl;
  add('refinement', 'refinement', 'Refined plan (governance feedback)',
    needsHuman
      ? `Refined: hold for human confirmation${conflict ? ' (SOP conflict)' : destructive ? ' (destructive action)' : !top ? ' (unclear intent)' : ' (low confidence)'}.`
      : 'Refined: plan is grounded, low-risk and consistent with company SOP.',
    needsHuman ? clamp(aggScore * 0.8) : aggScore);
  link('aggregate', 'refinement', EDGE.REFINES);
  link('risk', 'aggregate', EDGE.REFINES, 0.5); // feedback edge (cycle)

  // 9. Projected outcome.
  add('outcome', 'outcome', 'Projected outcome',
    top ? `Will ${top.action}.` : 'Cannot proceed until a valid capability is identified.',
    needsHuman ? 0.5 : aggScore);
  link('refinement', 'outcome', EDGE.DERIVES);

  const confidence = round(clamp(needsHuman ? aggScore * 0.8 : aggScore));
  return {
    framework: 'graph-of-thought',
    root: `Fulfill the request: "${query}"`,
    nodes, edges,
    aggregate: byId.aggregate || nodes.find(n => n.id === 'aggregate'),
    refinement: nodes.find(n => n.id === 'refinement'),
    confidence,
    requiresHumanConfirmation: needsHuman,
    contradictions: contradicts.length,
    evidenceTrust: evidence, // { suspect, highSeverity, routeToHitl, trustworthy }
    verdict: conflict ? 'blocked_by_sop' : (!top ? 'needs_disambiguation' : needsHuman ? 'hold_for_confirmation' : 'ready'),
    summary: {
      nodeCount: nodes.length, edgeCount: edges.length,
      candidates: candIds.length, knowledgeRefs: knowledgeRefs.length,
      supports: supports.length, contradicts: contradicts.length
    }
  };
}

/**
 * The single entry point every prompt path uses (chat + task request + MCP), so
 * no prompt reaches planning or execution without GoT re-engineering.
 */
function reengineerPrompt(input) {
  return graphOfThought(input);
}

module.exports = { graphOfThought, reengineerPrompt, EDGE };
