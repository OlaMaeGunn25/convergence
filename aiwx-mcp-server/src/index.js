#!/usr/bin/env node
/**
 * CONVERGENCE-Ai MCP Orchestration Server
 * =======================================
 * Exposes the governed CONVERGENCE-Ai gateway (and the admin HITL queue) as
 * Model Context Protocol tools, so Claude and other agents can drive the hub
 * through the SAME authenticated, audit-logged surface a human uses — never a
 * back door.
 *
 * Governance model (this is the whole point):
 *   - Every tool call authenticates to the gateway with GATEWAY_API_KEY. If the
 *     gateway has governance enabled, unauthenticated calls are impossible.
 *   - Read tools (audit, scholar, analytics, scheduler, hitl list) are annotated
 *     readOnlyHint: true.
 *   - Side-effectful tools default to SAFE mode: `publish_post` defaults to
 *     dry-run, and the human-in-the-loop is preserved by routing real approvals
 *     through `list_hitl_queue` + `action_hitl_task` rather than letting an agent
 *     publish unilaterally. Direct publish requires explicit confirm: true.
 *
 * Transport: stdio (local). Configure via environment:
 *   GATEWAY_URL       default http://localhost:3003
 *   ADMIN_URL         default http://localhost:8080
 *   GATEWAY_API_KEY   operator key (required in production; matches the gateway)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const GATEWAY_URL = (process.env.GATEWAY_URL || 'http://localhost:3003').replace(/\/+$/, '');
const ADMIN_URL = (process.env.ADMIN_URL || 'http://localhost:8080').replace(/\/+$/, '');
const API_KEY = process.env.GATEWAY_API_KEY || '';

/** Call a governed endpoint. Attaches the operator API key so the gateway's
 *  auth + audit trail apply. Returns parsed JSON or throws an actionable error. */
async function callApi(baseUrl, method, path, { body, query } = {}) {
  const url = new URL(baseUrl + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  const headers = { 'Content-Type': 'application/json' };
  if (API_KEY) headers['x-api-key'] = API_KEY;

  let res;
  try {
    res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (err) {
    throw new Error(`Cannot reach CONVERGENCE-Ai at ${url.origin} (${err.message}). Is the gateway running and GATEWAY_URL correct?`);
  }

  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (res.status === 401 || res.status === 403) {
    throw new Error(`Authorization failed (${res.status}). Set GATEWAY_API_KEY to a valid operator key that matches the gateway.`);
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} failed (${res.status}): ${data.error || text}`);
  }
  return data;
}

/** Wrap a handler so thrown errors become MCP tool errors with useful text. */
function toolResult(obj) {
  return {
    content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }],
    structuredContent: obj
  };
}
function toolError(message) {
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

const server = new McpServer({ name: 'convergence-ai', version: '1.0.0' });

// --- READ TOOLS --------------------------------------------------------------

server.registerTool(
  'run_audit',
  {
    title: 'Run SMB readiness audit',
    description: 'Run a full CONVERGENCE-Ai external audit on a domain (technology, security/WAF, SWOT, workforce). For the Legal vertical, Google Scholar case-law and expert-witness vetting are attached automatically. Returns the audit package.',
    inputSchema: {
      domain: z.string().describe('Target domain, e.g. "lobolaw.com".'),
      vertical: z.string().optional().describe('Optional vertical hint (e.g. "legal") to force the legal Scholar cross-reference.')
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  },
  async ({ domain, vertical }) => {
    try {
      const data = await callApi(GATEWAY_URL, 'POST', '/api/audit', { body: { domain, vertical } });
      return toolResult(data);
    } catch (e) { return toolError(e.message); }
  }
);

server.registerTool(
  'search_scholar',
  {
    title: 'Search Google Scholar (legal)',
    description: 'Search Google Scholar for case-law citations, expert-witness publications, and scientific precedent. Falls back to a labeled simulated dataset when no SerpApi key is configured.',
    inputSchema: {
      q: z.string().describe('Search query, e.g. \'"Lobo Law" case law precedent\'.'),
      num: z.number().int().min(1).max(20).optional().describe('Max results (default 10).')
    },
    annotations: { readOnlyHint: true, openWorldHint: true }
  },
  async ({ q, num }) => {
    try {
      const data = await callApi(GATEWAY_URL, 'GET', '/api/scholar/search', { query: { q, num } });
      return toolResult(data);
    } catch (e) { return toolError(e.message); }
  }
);

server.registerTool(
  'get_analytics',
  {
    title: 'Get campaign analytics',
    description: 'Return merged local + GA4 campaign analytics (impressions, clicks, CTR, conversions, per-platform breakdown).',
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: true }
  },
  async () => {
    try { return toolResult(await callApi(GATEWAY_URL, 'GET', '/api/analytics')); }
    catch (e) { return toolError(e.message); }
  }
);

server.registerTool(
  'get_scheduler_status',
  {
    title: 'Get campaign scheduler status',
    description: 'Return the current campaign schedule and post queue (statuses: PENDING/APPROVED/PUBLISHING/PUBLISHED/FAILED).',
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  async () => {
    try { return toolResult(await callApi(GATEWAY_URL, 'GET', '/api/scheduler-status')); }
    catch (e) { return toolError(e.message); }
  }
);

server.registerTool(
  'list_hitl_queue',
  {
    title: 'List HITL approval queue',
    description: 'List Human-in-the-Loop tasks awaiting approval in the admin orchestrator. Use this before approving anything so a human/agent reviews pending high-risk actions.',
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: true }
  },
  async () => {
    try { return toolResult(await callApi(ADMIN_URL, 'GET', '/api/hitl')); }
    catch (e) { return toolError(e.message); }
  }
);

// --- SIDE-EFFECTFUL TOOLS (HITL-gated) --------------------------------------

server.registerTool(
  'action_hitl_task',
  {
    title: 'Approve or revise a HITL task',
    description: 'Approve or request revision on a specific Human-in-the-Loop task. Approving triggers the downstream automation (n8n). This is the audited bridge that keeps a human/agent decision on record — the actor is stamped into audit_log.',
    inputSchema: {
      taskId: z.string().describe('The HITL task id, e.g. "T-1002".'),
      action: z.enum(['approve', 'reject']).describe('"approve" releases the automation; "reject" requests a revision.')
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }
  },
  async ({ taskId, action }) => {
    try {
      const data = await callApi(ADMIN_URL, 'POST', '/api/hitl/action', { body: { taskId, action } });
      return toolResult(data);
    } catch (e) { return toolError(e.message); }
  }
);

server.registerTool(
  'publish_post',
  {
    title: 'Publish a social post (dry-run by default)',
    description: 'Publish a social post via the gateway. SAFE BY DEFAULT: runs as a dry-run unless confirm=true. Human-in-the-loop policy: prefer staging posts through the campaign scheduler / HITL queue and approving with action_hitl_task, rather than publishing unilaterally. Only pass confirm=true when a human has explicitly approved this exact post.',
    inputSchema: {
      platform: z.enum(['linkedin', 'facebook', 'instagram', 'threads']).describe('Target platform.'),
      text: z.string().describe('Post text.'),
      image: z.string().optional().describe('Optional image filename or URL.'),
      confirm: z.boolean().optional().describe('Must be true to actually publish. Omit or false = dry-run.')
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }
  },
  async ({ platform, text, image, confirm }) => {
    try {
      const dryRun = confirm !== true;
      const data = await callApi(GATEWAY_URL, 'POST', '/api/publish-post', { body: { platform, text, image, dryRun } });
      return toolResult({ dryRun, note: dryRun ? 'Dry-run only — no post was published. Pass confirm:true after human approval to publish.' : 'Published.', result: data });
    } catch (e) { return toolError(e.message); }
  }
);

server.registerTool(
  'export_crm',
  {
    title: 'Export a prospect to the CRM (Supabase)',
    description: 'Write an audited prospect record into the Sales Command Center (Supabase inbound_leads + discoveries). Requires Supabase to be configured on the gateway.',
    inputSchema: {
      prospect: z.object({ domain: z.string() }).passthrough().describe('Prospect object; must include at least a "domain".')
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  },
  async ({ prospect }) => {
    try { return toolResult(await callApi(GATEWAY_URL, 'POST', '/api/export-crm', { body: { prospect } })); }
    catch (e) { return toolError(e.message); }
  }
);

// --- BOOT --------------------------------------------------------------------

async function main() {
  if (!API_KEY) {
    // Not fatal (the gateway may be running open in dev), but warn on stderr.
    process.stderr.write('[aiwx-mcp] WARNING: GATEWAY_API_KEY is not set. Tool calls will be unauthenticated; set it to match the gateway in production.\n');
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`[aiwx-mcp] CONVERGENCE-Ai MCP server ready (gateway=${GATEWAY_URL}, admin=${ADMIN_URL}).\n`);
}

main().catch((err) => {
  process.stderr.write(`[aiwx-mcp] Fatal: ${err.message}\n`);
  process.exit(1);
});
