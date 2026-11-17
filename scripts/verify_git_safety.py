#!/usr/bin/env python3
"""
Forbid destructive git commands in contracts, templates and segment scripts.

A SKILL.md, a template or a workflow script is text a model follows. A sentence that
tells it to run one of the commands below is a data-loss path, because each of them
discards or moves work the user has not committed:

  git checkout -- <path>   discards uncommitted edits; cannot restore an untracked file.
                           Matched with a <ref> before the `--` as well
  git checkout .           the same, without the `--`
  git restore <path>       the same (a `git restore` whose first argument is `--staged`, which
                           unstages, is let through -- unless `--worktree` / `-W` follows)
  git checkout -f / --force, git switch -f / --force / --discard-changes
                           throw local changes away to reach the target
  git stash                bare or `push`: moves the uncommitted implementation OUT of the
                           working tree. `drop`: destroys a stash entry
  reset ... --hard         discards uncommitted and, with a ref, committed work
  clean -f / --force       deletes untracked files (any flag cluster containing `f`)

`git stash` followed by pop / apply / list / show is not matched: those bring work back or
only look. The hazard this lint exists for is the stash used as a "snapshot", which is what
the auto-fix step did until v9 (appendix A defect K1 of design/v9-subtraction/SPEC.md) and
what md-optimize's recovery advice relied on (W3).

What this does not check:
  * It reads text, not intent. A sentence that describes the hazard in order to warn
    against it matches exactly like an instruction to run it. Such a line goes in
    ALLOW with the reason; ALLOW is zero-slack, so an entry that no longer matches
    anything is itself a failure.
  * It scans skills/, templates/ and workflows/ only. README.md, CLAUDE.md, design/
    and .gitattributes are documentation about this repository, not text a skill
    executes, and are not scanned.
  * It matches one line at a time: a command broken across two lines is not seen.
  * It cannot see a command assembled at run time, an alias, or another tool that does
    the same thing (`rm -rf`, a script that calls git). `git checkout <ref>` (a branch
    switch) is not matched, and should not be.
  * Two destructive forms pass, because each pattern looks only at what directly follows
    the subcommand: `git checkout <ref> -- <path>` (the `--` is matched only right after
    `checkout`) and `git restore --staged --worktree <path>` (only the first argument is
    tested for `--staged`). Correction, 2026-11-17: an earlier revision of this docstring
    said the first form "is matched through its `-- `". It is not.
    Correction, v9.0.1: both forms are matched now, and so is every command above when
    `-C <path>` or `-c <key=value>` sits between `git` and the subcommand -- until then
    `git -C <dir> checkout -- <path>` was not seen at all. This paragraph is kept as the
    record of what 9.0.0 let through.

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

# `git`, then any number of `-C <path>` / `-c <key=value>` options, up to the subcommand. Without
# this a command anchored to another directory (`git -C <dir> checkout -- .`) was not seen at all.
GIT = r"git\s+(?:-[Cc]\s+\S+\s+)*"

FORBIDDEN = [
    # `git checkout -- <path>` with or without a <ref> in front of the `--`, and `git checkout .`
    # which is the same thing without the `--`
    ("git checkout -- ", re.compile(GIT + r"checkout\s+(?:[^\s-]\S*\s+)?(?:--\s|\.(?![\w/]))")),
    # a worktree restore discards uncommitted edits; `--staged` alone only unstages ...
    ("git restore (worktree)", re.compile(GIT + r"restore\s+(?!--staged\b)")),
    # ... but not once `--worktree` / `-W` rides along with it
    ("git restore --worktree", re.compile(GIT + r"restore\b[^\n`]*(?:--worktree\b|\s-W\b)")),
    # a forced checkout or switch throws local changes away to reach its target
    ("forced checkout / switch", re.compile(
        GIT + r"(?:checkout\s+(?:-f\b|--force\b)|switch\b[^\n`]*(?:\s-f\b|--force\b|--discard-changes\b))")),
    # bare, `push` (the same command spelled out) and `drop` (destroys a stash entry)
    ("git stash (bare / push / drop)", re.compile(GIT + r"stash(?!\s+(?:pop|apply|list|show)\b)")),
    ("reset --hard", re.compile(r"\breset\b[^\n`]*--hard\b")),
    ("clean -f", re.compile(r"\bclean\b(?:\s+-{1,2}[A-Za-z-]+)*?\s+(?:-[A-Za-z]*f[A-Za-z]*|--force)\b")),
]

# (repo-relative path, literal the line must contain) -> why the line is not an instruction.
ALLOW = {
    ("skills/handoff/SKILL.md", "git clean -fdx"): (
        "warns the user what destroys a gitignored handoff document; nothing here runs it"
    ),
    ("templates/harness/doctor.md", "git -C <location> checkout -- workflows/"): (
        "the repair for CR-contaminated segment scripts in the plugin's own install copy: the "
        "same line has just removed those tracked files, the checkout brings them back, and "
        "both halves are anchored to <location> -- never the caller's project"
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
