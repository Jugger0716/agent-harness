#!/usr/bin/env node
// Syntax-check workflows/*.workflow.js against the native Workflow engine's dialect.
//
// Why this exists: `node --check` is a TOTAL false-green for these files — when a file
// contains ESM `export` syntax, Node (v24) silently exits 0 even on grossly invalid
// source (verified: `function {{{` passes). And the engine dialect is NOT a module:
// only the leading `export const meta` is special-cased; the body runs in an async
// context (top-level `await`/`return` are legal, imports are not).
//
// Emulation: strip the leading `export ` of the meta statement, then COMPILE (never run)
//   new AsyncFunction(args..., source)
// which surfaces SyntaxErrors (unterminated template literals, stray export/import,
// unbalanced braces) under the same top-level-await/return rules as the engine.
// Policy checks (meta purity, banned APIs, gate leaks) live in scripts/verify_meta_literal.py.
//
// Exit codes: 0 all parse, 1 syntax error, 2 no scripts found.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WF = join(ROOT, 'workflows');

if (!existsSync(WF)) {
  console.error('[check_workflow_syntax] workflows/ missing');
  process.exit(2);
}
const files = readdirSync(WF).filter((f) => f.endsWith('.workflow.js')).sort();
if (files.length === 0) {
  console.error('[check_workflow_syntax] no *.workflow.js found');
  process.exit(2);
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
let bad = 0;
for (const f of files) {
  const src = readFileSync(join(WF, f), 'utf-8');
  // Engine special-case: leading `export const meta = {...}` — make it plain `const`.
  const body = src.replace(/^export const meta\b/m, 'const meta');
  try {
    // Compile only — never invoked, so nothing executes.
    new AsyncFunction('args', 'agent', 'parallel', 'pipeline', 'phase', 'log', 'workflow', 'budget', `"use strict";\n${body}`);
  } catch (e) {
    bad += 1;
    console.error(`[check_workflow_syntax] FAIL ${f}: ${e.name}: ${e.message}`);
  }
}
if (bad) process.exit(1);
console.log(`[check_workflow_syntax] OK: ${files.length} scripts parse in engine dialect`);
