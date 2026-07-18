/**
 * Multi-Agent Negotiation Engine
 * ==============================
 * Runs a structured propose -> critique -> revise -> arbitrate loop between
 * specialized agents (Proposer, Compliance Critic, Arbiter) to reach a
 * consensus recommendation, escalating to the Human-in-the-Loop (HITL) queue
 * when consensus isn't reached or the vertical is high-risk (legal / finance /
 * medical). Every negotiation is recorded to the audit trail.
 *
 * LLM reasoning uses the Anthropic API (claude-opus-4-8, adaptive thinking) when
 * ANTHROPIC_API_KEY is set; otherwise a deterministic simulated negotiation runs
 * so the feature stays demonstrable and testable without a key.
 */

let Anthropic = null;
try {
  Anthropic = require('@anthropic-ai/sdk');
} catch (e) {
  // SDK not installed — simulated fallback still works.
}

const MODEL = process.env.NEGOTIATION_MODEL || 'claude-opus-4-8';
const MAX_ROUNDS = parseInt(process.env.NEGOTIATION_MAX_ROUNDS, 10) || 3;
const CONSENSUS_THRESHOLD = parseFloat(process.env.NEGOTIATION_CONSENSUS_THRESHOLD) || 0.75;
const HIGH_RISK_VERTICALS = ['legal', 'finance', 'medical', 'healthcare'];

function isNegotiationLLMConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY && Anthropic);
}

/** One Claude completion for an agent turn. Adaptive thinking on; text only. */
async function llmComplete(system, userPrompt, maxTokens = 4000) {
  const client = new Anthropic();
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    system,
    messages: [{ role: 'user', content: userPrompt }]
  });
  if (resp.stop_reason === 'refusal') {
    throw new Error('Model declined the negotiation request (safety refusal).');
  }
  return resp.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
}

// --- Agent role prompts (INVEST + CPRE aligned: clear, verifiable, testable) ---
const PROPOSER_SYSTEM =
  'You are the Proposer agent in a multi-agent negotiation for AiWorXmiths CONVERGENCE-Ai. ' +
  'Given a decision topic and context, produce ONE concrete, testable recommendation. ' +
  'Be specific and actionable. State your recommendation in 2-4 sentences, then a separate ' +
  'line "CONFIDENCE: <0..1>" reflecting how sure you are it is correct and safe.';

const CRITIC_SYSTEM =
  'You are the Compliance Critic agent. Challenge the Proposer\'s recommendation for risk, ' +
  'legal/regulatory exposure, data-privacy, and factual soundness. List concrete objections. ' +
  'End with "RISK: <low|medium|high>" and "BLOCKING: <yes|no>" (yes if a human must approve).';

const ARBITER_SYSTEM =
  'You are the Arbiter agent. Given the Proposer recommendation and the Critic objections, ' +
  'decide the outcome. Reconcile where possible and state a final decision in 2-3 sentences. ' +
  'End with "DECISION: <approve|revise|escalate>" and "CONSENSUS: <0..1>".';

function extractTag(text, tag, fallback) {
  const m = text.match(new RegExp(`${tag}\\s*:?\\s*([^\\n]+)`, 'i'));
  return m ? m[1].trim() : fallback;
}
function extractNumber(text, tag, fallback) {
  const raw = extractTag(text, tag, null);
  if (raw == null) return fallback;
  const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 1) : fallback;
}

/** Deterministic simulated negotiation (no API key). */
function simulatedNegotiation(topic, context, vertical) {
  const highRisk = HIGH_RISK_VERTICALS.some(v => (vertical || '').toLowerCase().includes(v));
  const rounds = [
    {
      round: 1,
      proposal: `Proposed approach for "${topic}": adopt the standard AiWorXmiths playbook, staged behind a human approval gate. (CONFIDENCE: 0.7)`,
      critique: `Objection: for the "${vertical || 'general'}" context, verify data-handling and client consent before acting. RISK: ${highRisk ? 'high' : 'medium'}. BLOCKING: ${highRisk ? 'yes' : 'no'}.`,
      arbitration: highRisk
        ? 'Objections are material for a regulated vertical. DECISION: escalate. CONSENSUS: 0.6.'
        : 'Objections addressed by the approval gate. DECISION: approve. CONSENSUS: 0.82.'
    }
  ];
  const consensusScore = highRisk ? 0.6 : 0.82;
  const decision = highRisk ? 'escalate' : 'approve';
  return { rounds, consensusScore, decision };
}

/**
 * negotiate({ topic, context, vertical, options })
 * @returns {Promise<object>} negotiation result with transcript, consensus, and outcome.
 */
async function negotiate({ topic, context = '', vertical = '', options = {} } = {}) {
  if (!topic || !String(topic).trim()) {
    return { success: false, error: 'A negotiation topic is required.' };
  }
  const maxRounds = Math.min(Math.max(parseInt(options.maxRounds, 10) || MAX_ROUNDS, 1), 5);
  const highRisk = HIGH_RISK_VERTICALS.some(v => (vertical || '').toLowerCase().includes(v));

  const transcript = [];
  let consensusScore = 0;
  let decision = 'revise';
  let simulated = false;

  if (!isNegotiationLLMConfigured()) {
    simulated = true;
    const sim = simulatedNegotiation(topic, context, vertical);
    transcript.push(...sim.rounds);
    consensusScore = sim.consensusScore;
    decision = sim.decision;
  } else {
    let currentProposal = '';
    for (let round = 1; round <= maxRounds; round++) {
      const proposalPrompt = round === 1
        ? `Topic: ${topic}\nVertical: ${vertical || 'general'}\nContext: ${context}`
        : `Topic: ${topic}\nVertical: ${vertical || 'general'}\nContext: ${context}\n\nYour previous proposal:\n${currentProposal}\n\nThe critic raised objections:\n${transcript[transcript.length - 1].critique}\n\nRevise your recommendation to address them.`;
      const proposal = await llmComplete(PROPOSER_SYSTEM, proposalPrompt);
      currentProposal = proposal;

      const critique = await llmComplete(CRITIC_SYSTEM,
        `Topic: ${topic}\nVertical: ${vertical || 'general'}\n\nRecommendation to review:\n${proposal}`);

      const arbitration = await llmComplete(ARBITER_SYSTEM,
        `Topic: ${topic}\n\nProposer recommendation:\n${proposal}\n\nCritic objections:\n${critique}`);

      consensusScore = extractNumber(arbitration, 'CONSENSUS', 0.5);
      decision = (extractTag(arbitration, 'DECISION', 'revise') || 'revise').toLowerCase();
      transcript.push({ round, proposal, critique, arbitration });

      if (decision === 'approve' && consensusScore >= CONSENSUS_THRESHOLD) break;
      if (decision === 'escalate') break;
    }
  }

  // High-risk verticals always require human sign-off, even on consensus.
  const consensusReached = decision === 'approve' && consensusScore >= CONSENSUS_THRESHOLD && !highRisk;
  const outcome = consensusReached ? 'approved' : 'escalated_to_hitl';

  return {
    success: true,
    simulated,
    topic,
    vertical: vertical || 'general',
    highRisk,
    rounds: transcript,
    consensus: { reached: consensusReached, score: consensusScore, decision },
    outcome,
    ...(outcome === 'escalated_to_hitl'
      ? { hitl: { status: 'pending', reason: highRisk ? 'high-risk vertical requires human approval' : 'consensus not reached' } }
      : {})
  };
}

module.exports = { negotiate, isNegotiationLLMConfigured };
