// Fails the build if any vertical in the hub lacks a security-guardrail declaration.
//
// Ported from the aiworxmiths-ai-consultants repo, where the hub lived at
// public/admin/convergence/. In the canonical repo it lives at aiwx-convergence-ai/,
// so the two read paths below are the only thing that changed.
// Enforces SGoT-5: no vertical may run with a partial defense stack. Text-parses the
// browser ES modules (they reference the DOM and can't be imported under Node).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const appJs = readFileSync(join(root, "aiwx-convergence-ai/app.js"), "utf8");
const guardJs = readFileSync(join(root, "aiwx-convergence-ai/js/security_guardrails.js"), "utf8");

// VERTICALS = { medical: {...}, legal: {...}, ... } — grab the keys of that object literal.
const vertBlock = appJs.match(/const VERTICALS\s*=\s*\{([\s\S]*?)\n\};/);
if (!vertBlock) { console.error("Could not locate VERTICALS in app.js"); process.exit(2); }
const verticals = [...vertBlock[1].matchAll(/^\s*([a-z_]+)\s*:/gm)].map((m) => m[1]);

// SECURITY_GUARDRAILS = { medical: {...}, ... } — grab its keys.
const guardBlock = guardJs.match(/export const SECURITY_GUARDRAILS\s*=\s*\{([\s\S]*?)\n\};/);
if (!guardBlock) { console.error("Could not locate SECURITY_GUARDRAILS in security_guardrails.js"); process.exit(2); }
// Each vertical is declared as `  <key>: tier(...)` — match the key of every tier() call.
const covered = new Set([...guardBlock[1].matchAll(/^\s+([a-z_]+):\s*tier\(/gm)].map((m) => m[1]));

const missing = verticals.filter((v) => !covered.has(v));
if (missing.length) {
  console.error(`SECURITY GAP — verticals without a guardrail declaration: ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`OK — all ${verticals.length} verticals have a security-guardrail declaration.`);
