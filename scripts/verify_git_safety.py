#!/usr/bin/env python3
"""
Forbid destructive git commands in contracts, templates and segment scripts.

A SKILL.md, a template or a workflow script is text a model follows. A sentence that
tells it to run one of the commands below is a data-loss path, because each of them
discards or moves work the user has not committed:

  git checkout -- <path>   discards uncommitted edits; cannot restore an untracked file
  git stash  (bare)        moves the uncommitted implementation OUT of the working tree
  reset --hard             discards uncommitted and, with a ref, committed work
  clean -f                 deletes untracked files

`git stash` followed by an explicit sub-command (push / pop / apply / list / show / drop)
is not matched: the hazard this lint exists for is the bare form used as a "snapshot",
which is what the auto-fix step did until v9 (appendix A defect K1 of
design/v9-subtraction/SPEC.md) and what md-optimize's recovery advice relied on (W3).

What this does not check:
  * It reads text, not intent. A sentence that describes the hazard in order to warn
    against it matches exactly like an instruction to run it. Such a line goes in
    ALLOW with the reason; ALLOW is zero-slack, so an entry that no longer matches
    anything is itself a failure.
  * It scans skills/, templates/ and workflows/ only. README.md, CLAUDE.md, design/
    and .gitattributes are documentation about this repository, not text a skill
    executes, and are not scanned.
  * It cannot see a command assembled at run time or spelled another way
    (`git restore --source`, `git checkout HEAD -- .` with different spacing).

Exit codes:
  0  no forbidden command found
  1  a forbidden command, or an ALLOW entry that matched nothing
  2  a scan directory is missing (the tree is not this repository)

Usage:
  python scripts/verify_git_safety.py

Intended invocation: run manually and on push/PR via .github/workflows/lint.yml
(pre-commit hook wiring is still a later-phase TODO).
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SCAN_DIRS = ["skills", "templates", "workflows"]
SCAN_SUFFIXES = {".md", ".js"}

FORBIDDEN = [
    ("git checkout -- ", re.compile(r"git checkout -- ")),
    ("bare git stash", re.compile(r"git stash(?!\s+(?:push|pop|apply|list|show|drop)\b)")),
    ("reset --hard", re.compile(r"reset --hard")),
    ("clean -f", re.compile(r"clean -f")),
]

# (repo-relative path, literal the line must contain) -> why the line is not an instruction.
ALLOW = {
    ("skills/handoff/SKILL.md", "git clean -fdx"): (
        "warns the user what destroys a gitignored handoff document; nothing here runs it"
    ),
}


def main() -> int:
    missing = [d for d in SCAN_DIRS if not (ROOT / d).is_dir()]
    if missing:
        print("[verify_git_safety] MISSING scan directory: %s" % ", ".join(missing))
        return 2

    problems = []
    used = set()
    scanned = 0
    for d in SCAN_DIRS:
        for path in sorted((ROOT / d).rglob("*")):
            if not path.is_file() or path.suffix not in SCAN_SUFFIXES:
                continue
            scanned += 1
            rel = path.relative_to(ROOT).as_posix()
            for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                for name, pattern in FORBIDDEN:
                    if not pattern.search(line):
                        continue
                    allowed = [key for key in ALLOW if key[0] == rel and key[1] in line]
                    if allowed:
                        used.update(allowed)
                    else:
                        problems.append("%s:%d: %s" % (rel, lineno, name))

    for key in ALLOW:
        if key not in used:
            problems.append(
                "ALLOW entry (%s, %r) matched nothing -- remove it rather than leaving a stale allowlist entry"
                % key
            )

    if problems:
        for p in problems:
            print("[verify_git_safety] FAIL %s" % p)
        return 1
    print(
        "[verify_git_safety] OK: %d file(s) scanned, %d forbidden pattern(s), %d allowlisted line(s)"
        % (scanned, len(FORBIDDEN), len(used))
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
