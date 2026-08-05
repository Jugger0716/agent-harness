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
// SECOND AND THIRD CHECKS — CR guards. Claude Code's permission layer rejects a `Workflow`
// invocation whose scriptPath file contains carriage returns ("script contains control
// characters that would be hidden in the approval dialog"), so CRLF silently disables the
// workflow path of every multi-path skill. Reproduced 2026-08-03: the same script rejected as
// CRLF launched successfully as a byte-identical LF copy.
//
// Both guards live HERE and not in verify_meta_literal.py because that script reads via
// `path.read_text()`, whose universal-newline translation strips \r during the read — no regex
// added there could ever see a CR.
//
// They cover two DIFFERENT failure surfaces, which is why both exist:
//
//   (2) WORKING TREE — this is the surface that actually breaks the tool. A CRLF file on disk
//       is what the permission layer refuses to launch. Note that `.gitattributes` does NOT
//       protect this: a tool or script that writes the file with CRLF leaves `git status`
//       clean (the clean filter normalizes on staging), so the blob check below stays green
//       while the local workflow path is broken. This guard caught exactly that accident.
//
//   (3) INDEX BLOB (`git ls-files --eol`, `i/` field) — the surface that ships. Honest scope
//       note: while `.gitattributes` carries `*.workflow.js text eol=lf`, a CRLF blob cannot
//       normally be created at all (verified: `git add` of a CRLF file still produces an LF
//       blob), so this is a backstop for when that rule is absent, altered, or stops matching
//       a renamed path — NOT an independent second line of defence under normal operation.
//
// Exit codes: 0 all parse + no CR anywhere, 1 syntax error or CR found, 2 no scripts found.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

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
// ---- working-tree CR guard ----------------------------------------------
// The surface that actually breaks the Workflow tool. Checked from the bytes already read
// above, so it costs nothing extra and needs no git.
let wtBad = 0;
for (const f of files) {
  const raw = readFileSync(join(WF, f));
  const cr = raw.reduce((n, b) => (b === 13 ? n + 1 : n), 0);
  if (cr > 0) {
    wtBad += 1;
    console.error(
      `[check_workflow_syntax] FAIL workflows/${f}: working tree contains ${cr} carriage return(s) — ` +
        'Claude Code refuses to launch a Workflow whose script file has CR. Fix: rewrite the file ' +
        'with LF endings, or `rm` it and `git checkout -- workflows/` (.gitattributes forces LF).',
    );
  }
}

// ---- index-blob CR guard -------------------------------------------------
// Skipped (not failed) when git is unavailable or this is not a work tree — the syntax
// check above must stay usable outside a repo. A skip is reported so it is never silent.
let crBad = 0;
let crChecked = 0;
let crSkip = '';
const git = spawnSync('git', ['ls-files', '--eol', '--', 'workflows'], {
  cwd: ROOT,
  encoding: 'utf-8',
});
if (git.error || git.status !== 0) {
  crSkip = 'git unavailable or not a work tree';
} else {
  for (const line of git.stdout.split('\n')) {
    if (!line.trim() || !line.endsWith('.workflow.js')) continue;
    // Format: "i/<eol>\tw/<eol>\tattr/<attrs>\t<path>"
    const idx = line.match(/(?:^|\s)i\/(\S+)/);
    if (!idx) continue;
    crChecked += 1;
    if (idx[1] !== 'lf') {
      crBad += 1;
      const path = line.split('\t').pop().trim();
      console.error(
        `[check_workflow_syntax] FAIL ${path}: index blob eol is "${idx[1]}", expected "lf" — ` +
          'a CRLF blob makes Claude Code reject the Workflow invocation. Fix: ' +
          'git rm --cached <file> && git add <file> (with .gitattributes eol=lf in place).',
      );
    }
  }
  if (crChecked === 0) crSkip = 'no tracked *.workflow.js reported by git';
}

if (bad || wtBad || crBad) process.exit(1);
console.log(`[check_workflow_syntax] OK: ${files.length} scripts parse in engine dialect`);
console.log(`[check_workflow_syntax] OK: ${files.length} working-tree files are LF (no CR)`);
console.log(
  crSkip
    ? `[check_workflow_syntax] SKIP index-blob CR guard: ${crSkip}`
    : `[check_workflow_syntax] OK: ${crChecked} index blobs are LF (no CR)`,
);
