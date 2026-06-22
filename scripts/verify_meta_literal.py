#!/usr/bin/env python3
"""
Lint workflows/*.workflow.js for native-Workflow-engine safety invariants.

Checks per script (spec: phase1 plan Task 1, corrected by the engine spike
docs/superpowers/specs/2026-06-05-ultracode-phase1-engine-spike.md SPIKE-F1/F2/F5):

  1. meta-pure-literal: the first non-comment statement is `export const meta = {`
     and the literal (up to the first column-0 `}` / `};` line) contains:
       - `name:` and `description:` string-literal values
       - `phases:` an ARRAY of OBJECT literals, each with a `title:` string
         (SPIKE-F5: the engine's working shape is [{title, detail?}], NOT strings)
       - no call tokens, spreads, template literals, or bare-identifier values
         (string-literal contents are masked before token scanning, so prose
         parentheses inside descriptions do not false-positive)
  2. module-syntax ban (SPIKE-F2): the engine accepts ONLY the leading
     `export const meta` special-case. Any other `export`, and any `import`
     (static or dynamic), is a launch-time SyntaxError that `node --check`
     does NOT catch (false-green) -- so it is rejected here.
  3. non-deterministic-API ban: Date.now / new Date / Math.random break
     cached-prefix resume (engine throws at runtime; rejected at lint time).
  4. HARD-GATE leak ban: the <HARD-GATE> tag form, AskUserQuestion, and the
     "Apply patch" option label -- gates live only in the orchestrator
     (SKILL.md), never in a segment script. The hyphenated/tag form is matched
     deliberately; the spaced prose "HARD GATE #N" is NOT matched, because
     segment scripts legitimately reference it in comments (e.g. "Runs AFTER
     HARD GATE #1") to document that gates live in the orchestrator.
  5. defensive-args-parse (SPIKE-F1): `args` reaches the script as a JSON
     STRING, not an object. Every script must contain the canonical guard
     `typeof args === 'string'` before reading fields.

Exit codes:
  0  all scripts pass
  1  at least one violation
  2  workflows/ missing or contains no *.workflow.js (tripwire once Phase 1+
     has shipped scripts), or a file is unreadable

Usage:
  python scripts/verify_meta_literal.py

Intended invocation: run manually (pre-commit/CI wiring is a later-phase TODO).
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WF = ROOT / "workflows"

BANNED_NONDET = [r"\bDate\.now\b", r"\bnew\s+Date\b", r"\bMath\.random\b"]
# Gate-marker tripwire tokens. "HARD-GATE" matches the <HARD-GATE> tag form (the
# real gate-leak signature in SKILL.md). The spaced prose "HARD GATE #N" is
# INTENTIONALLY not matched: segment-script comments legitimately reference the
# gates that live in the orchestrator (e.g. "Runs AFTER HARD GATE #1"), so a
# HARD[\s-]*GATE regex would false-positive on every such comment and break the
# green baseline. Keep this hyphen/tag-targeted.
BANNED_GATE = ["AskUserQuestion", "HARD-GATE", "Apply patch"]
ARGS_GUARD = re.compile(r"typeof\s+args\s*===\s*['\"]string['\"]")


def first_statement(src: str) -> str:
    """First non-blank, non-comment line (handles // and /* ... */ leaders)."""
    in_block_comment = False
    for line in src.splitlines():
        s = line.strip()
        if in_block_comment:
            if "*/" in s:
                in_block_comment = False
            continue
        if not s or s.startswith("//"):
            continue
        if s.startswith("/*"):
            if "*/" not in s:
                in_block_comment = True
            continue
        return s
    return ""


def extract_meta(src: str) -> str | None:
    """Return the meta object body between `export const meta = {` and the
    first column-0 `}` or `};` line. None if not found."""
    m = re.search(r"^export const meta = \{\s*$", src, re.MULTILINE)
    if not m:
        return None
    rest = src[m.end():]
    end = re.search(r"^\};?\s*$", rest, re.MULTILINE)
    if not end:
        return None
    return rest[: end.start()]


def mask_strings(body: str) -> str:
    """Replace single/double-quoted string contents with a placeholder so
    token scanning ignores prose. Quotes themselves are kept."""
    body = re.sub(r"'(?:[^'\\]|\\.)*'", "'S'", body)
    body = re.sub(r'"(?:[^"\\]|\\.)*"', '"S"', body)
    return body


def check_meta(src: str) -> list[str]:
    errs: list[str] = []
    if not first_statement(src).startswith("export const meta = {"):
        errs.append("first statement is not 'export const meta = {'")
    body = extract_meta(src)
    if body is None:
        errs.append("no parseable 'export const meta = { ... }' literal "
                    "(open brace on its own line end, close brace at column 0)")
        return errs

    masked = mask_strings(body)

    for key in ("name", "description"):
        if not re.search(rf"\b{key}\s*:\s*['\"]", body):
            errs.append(f"meta missing string-literal key '{key}'")

    phases_m = re.search(r"phases\s*:\s*\[", masked)
    if not phases_m:
        errs.append("meta.phases is missing or not an array literal")
    else:
        # SPIKE-F5: entries must be object literals with a title: string.
        phases_chunk = masked[phases_m.end():]
        bracket_end = phases_chunk.find("]")
        chunk = phases_chunk[:bracket_end] if bracket_end != -1 else phases_chunk
        if "{" not in chunk:
            errs.append("meta.phases entries must be object literals "
                        "[{title, detail?}] (SPIKE-F5), not strings")
        if not re.search(r"title\s*:\s*['\"]", chunk):
            errs.append("meta.phases entries lack a title: string literal")

    if "..." in masked:
        errs.append("meta literal contains spread '...'")
    if "`" in body:
        errs.append("meta literal contains a template literal (not pure-literal)")
    if "(" in masked:
        errs.append("meta literal contains a call token '(' (not pure-literal)")
    # Value positions must be literals: quote, digit, array, or object only.
    if re.search(r":\s*[A-Za-z_$]", masked):
        errs.append("meta literal has a bare-identifier value (must be literal)")
    return errs


def check_module_syntax(src: str) -> list[str]:
    errs: list[str] = []
    exports = re.findall(r"^\s*export\b", src, re.MULTILINE)
    if len(exports) > 1:
        errs.append(f"{len(exports)} 'export' statements -- only the leading "
                    "'export const meta' is accepted by the engine (SPIKE-F2)")
    if re.search(r"^\s*import[\s(]", src, re.MULTILINE) or re.search(r"\bimport\s*\(", src):
        errs.append("'import' present -- scripts are self-contained plain JS, "
                    "no module imports (SPIKE-F2 / C1)")
    return errs


def check(path: Path) -> list[str]:
    errs: list[str] = []
    src = path.read_text(encoding="utf-8")
    errs += check_meta(src)
    errs += check_module_syntax(src)
    for pat in BANNED_NONDET:
        if re.search(pat, src):
            errs.append(f"non-deterministic API present: {pat} (breaks resume)")
    for token in BANNED_GATE:
        if token in src:
            errs.append(f"HARD-GATE leak token present: '{token}' "
                        "(gates live in the orchestrator only)")
    if not ARGS_GUARD.search(src):
        errs.append("missing defensive args parse -- args arrives as a JSON "
                    "string (SPIKE-F1); guard with: "
                    "const A = typeof args === 'string' ? JSON.parse(args) : (args || {})")
    return errs


def main() -> int:
    files = sorted(WF.glob("*.workflow.js")) if WF.exists() else []
    if not files:
        print("[verify_meta_literal] no workflow scripts found "
              "(workflows/*.workflow.js expected from Phase 1 on)", file=sys.stderr)
        return 2
    bad = 0
    for f in files:
        errs = check(f)
        if errs:
            bad += 1
            for e in errs:
                print(f"[verify_meta_literal] FAIL {f.relative_to(ROOT)}: {e}",
                      file=sys.stderr)
    if bad:
        return 1
    print(f"[verify_meta_literal] OK: {len(files)} scripts")
    return 0


if __name__ == "__main__":
    sys.exit(main())
