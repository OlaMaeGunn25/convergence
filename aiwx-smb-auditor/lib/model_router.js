/**
 * Model-Cascade Router (MCR) — the LLM cost lever
 * ===============================================
 * Routes each LLM call to the cheapest CAPABLE model tier by confidence + risk,
 * escalating to a premium model only when confidence is low or the action is
 * high-risk/destructive. High-confidence, low-risk work — the majority — runs on a
 * cheap or local model. Honors the tenant token's `llmProvider`
 * (Gemini | OpenAI | Claude | Ollama) so the reseller markup + provider choice
 * still apply.
 *
 * This is advisory: it recommends the tier/model; the LLM gateway performs the
 * call. It pairs with the reranker (which cuts input tokens) to reduce cost from
 * both directions — fewer tokens AND a cheaper model where safe.
 */

const TIERS = {
  local: { rank: 0, providers: { ollama: 'llama3' } },
  cheap: { rank: 1, providers: { gemini: 'gemini-2.5-flash', openai: 'gpt-4o-mini', claude: 'claude-3-5-haiku', ollama: 'llama3' } },
  standard: { rank: 2, providers: { gemini: 'gemini-2.5-flash', openai: 'gpt-4o', claude: 'claude-3-5-sonnet', ollama: 'mistral' } },
  premium: { rank: 3, providers: { gemini: 'gemini-2.5-pro', openai: 'gpt-4o', claude: 'claude-3-5-sonnet', ollama: 'mistral' } }
};

function modelFor(tier, provider) {
  const t = TIERS[tier] || TIERS.standard;
  return t.providers[provider] || Object.values(t.providers)[0];
}

/**
 * route({ confidence, risk, destructive, provider, localPreferred })
 * @param confidence 0..1 (e.g. the interpreter/rerank confidence).
 * @param risk 'low' | 'medium' | 'high' (e.g. vertical compliance sensitivity).
 * @returns { tier, model, provider, escalated, routeToHitl, rationale }
 */
function route({ confidence = 1, risk = 'low', destructive = false, provider = 'gemini', localPreferred = false } = {}) {
  const p = String(provider || 'gemini').toLowerCase();
  let tier;
  let routeToHitl = false;
  let rationale;

  if (destructive || risk === 'high') {
    tier = 'premium';
    rationale = 'High-risk/destructive action — use the strongest model (and the HITL gates still apply).';
  } else if (confidence >= 0.8) {
    tier = localPreferred ? 'local' : 'cheap';
    rationale = `High confidence (${confidence}) + low risk — route to the ${tier} tier to save cost.`;
  } else if (confidence >= 0.5) {
    tier = 'standard';
    rationale = `Moderate confidence (${confidence}) — standard tier.`;
  } else {
    tier = 'premium';
    routeToHitl = true;
    rationale = `Low confidence (${confidence}) — escalate to premium and flag for human review.`;
  }

  return { tier, model: modelFor(tier, p), provider: p, escalated: tier === 'premium', routeToHitl, rationale };
}

module.exports = { route, TIERS, modelFor };
