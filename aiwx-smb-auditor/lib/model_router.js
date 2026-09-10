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

const PROVIDERS = ['gemini', 'openai', 'claude', 'ollama'];

const TIERS = {
  local: { rank: 0, providers: { ollama: 'llama3' } },
  cheap: { rank: 1, providers: { gemini: 'gemini-2.5-flash', openai: 'gpt-4o-mini', claude: 'claude-haiku-4-5', ollama: 'llama3' } },
  standard: { rank: 2, providers: { gemini: 'gemini-2.5-flash', openai: 'gpt-4o', claude: 'claude-sonnet-5', ollama: 'mistral' } },
  premium: { rank: 3, providers: { gemini: 'gemini-2.5-pro', openai: 'gpt-4o', claude: 'claude-opus-5', ollama: 'mistral' } }
};

/**
 * The provider/model choice offered to a tenant, as data.
 *
 * Served to the operations hub so a reseller can present the decision to a
 * client rather than making it silently on their behalf. `sovereign` marks the
 * option where inference never leaves the client's own infrastructure — the
 * question a regulated client asks first, and the reason a local tier exists at
 * all.
 */
function providerChoices() {
  return PROVIDERS.map(id => ({
    id,
    label: { gemini: 'Google Gemini', openai: 'OpenAI', claude: 'Anthropic Claude', ollama: 'Self-hosted (Ollama)' }[id],
    sovereign: id === 'ollama',
    tiers: Object.entries(TIERS).reduce((acc, [tier, def]) => {
      if (def.providers[id]) acc[tier] = def.providers[id];
      return acc;
    }, {}),
    note: id === 'ollama'
      ? 'Runs on infrastructure you control; no prompt or client data leaves it. Available at every tier the local model can serve.'
      : 'Hosted provider. Its terms and sub-processor status must be disclosed to the client before their data reaches it.'
  }));
}

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

module.exports = { route, TIERS, modelFor, providerChoices, PROVIDERS };
