#!/usr/bin/env python3
"""Phase 0 stub: meta-pure-literal / non-deterministic-API / HARD-GATE-leak checks.

No workflows/ dir exists yet (created in a later phase). Until then this is a no-op
that exits 0 so the verification harness command list is runnable end-to-end.

Later phases replace this stub with the real checks over workflows/*.workflow.js:
  - first statement is a pure-literal `export const meta = { ... }`
    (no variables / function calls / spreads; name+description+phases keys present;
     phases is a string-array literal)
  - no resume-breaking non-deterministic APIs (Date.now / new Date / Math.random)
  - no HARD-GATE leak (AskUserQuestion / "HARD-GATE" / "Apply patch" tokens) —
    gates live only in the orchestrator, never in a segment script
"""
import sys
import pathlib

wf = pathlib.Path(__file__).resolve().parent.parent / "workflows"
if not wf.exists():
    print("[verify_meta_literal] no workflows/ dir yet (Phase 0) -- OK")
    sys.exit(0)
print("[verify_meta_literal] workflows/ exists but checks not implemented in Phase 0 stub")
sys.exit(0)
