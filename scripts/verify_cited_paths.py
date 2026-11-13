#!/usr/bin/env python3
"""
Every repository path a contract cites must exist.

Skills, templates and segment scripts point at each other by path
(`templates/harness/converge.md`, `workflows/harness.plan.workflow.js`, ...). When a
file is moved or removed, a citation left behind sends a model to read a file that is
not there, and nothing else in the lint layer notices: verify_sync_markers.py checks
marker targets and `§Step` ids, not ordinary path mentions. This lint was added with
the v9 removal of thirteen skill directories, where that risk is at its largest.

What is checked: in every `.md` / `.js` file under skills/, templates/ and workflows/,
and in CLAUDE.md and README.md, each token of the form

    (skills|templates|workflows|scripts)/<path>.<md|js|mjs|py|json>

must name an existing file, resolved against the repository root. A token is read as a
citation when it starts a path (nothing path-like precedes it) or follows
`{CLAUDE_PLUGIN_ROOT}/`, the prefix dispatch sites use for the plugin root.

What this does not check:
  * Placeholder paths. `templates/<skill>/<role>.md`, `skills/harness{,-gate}/SKILL.md`
    and `workflows/*.workflow.js` contain characters outside the path alphabet, so the
    pattern never matches them. That is deliberate, and it also means a typo that
    introduces such a character goes unseen.
  * Paths under other roots: `docs/` (gitignored runtime output), `design/`, `tests/`,
    `.harness/`, `.github/`, `.claude-plugin/`.
  * Directory citations (`templates/_shared/`) and `§Section` names inside a file.
  * Whether the cited file still says what the citing sentence claims.

ALLOW lists citations that are meant to name a missing file (an example of a wrong
path, say). It is zero-slack: an entry that matches no citation is itself a failure.

Exit codes:
  0  every cited path exists
  1  a cited path is missing, or an ALLOW entry matched nothing
  2  a scan root is missing (the tree is not this repository)

Usage:
  python scripts/verify_cited_paths.py

Intended invocation: run manually and on push/PR via .github/workflows/lint.yml
(pre-commit hook wiring is still a later-phase TODO).
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SCAN_DIRS = ["skills", "templates", "workflows"]
SCAN_FILES = ["CLAUDE.md", "README.md"]
SCAN_SUFFIXES = {".md", ".js"}

# The lookbehind keeps a longer path (`docs/harness/x/templates/y.md`,
# `.harness/wf/...`) from being read as a repository-root citation. The second
# alternative lets through the one prefix that IS the repository root at run time:
# `{CLAUDE_PLUGIN_ROOT}/` and `${CLAUDE_PLUGIN_ROOT}/`, the form every dispatch site uses.
PATH_RE = re.compile(
    r"(?:(?<![A-Za-z0-9_./-])|(?<=PLUGIN_ROOT\}/))(?:skills|templates|workflows|scripts)/[A-Za-z0-9_./-]+\.(?:md|js|mjs|py|json)(?![A-Za-z0-9_-])"
)

# (citing file, cited path) -> why a missing file is cited on purpose.
ALLOW: dict[tuple[str, str], str] = {}


def iter_files():
    for d in SCAN_DIRS:
        for path in sorted((ROOT / d).rglob("*")):
            if path.is_file() and path.suffix in SCAN_SUFFIXES:
                yield path
    for name in SCAN_FILES:
        yield ROOT / name


def main() -> int:
    missing_roots = [d for d in SCAN_DIRS if not (ROOT / d).is_dir()]
    missing_roots += [f for f in SCAN_FILES if not (ROOT / f).is_file()]
    if missing_roots:
        print("[verify_cited_paths] MISSING scan root: %s" % ", ".join(missing_roots))
        return 2

    problems = []
    used = set()
    files = 0
    citations = 0
    for path in iter_files():
        files += 1
        rel = path.relative_to(ROOT).as_posix()
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            for m in PATH_RE.finditer(line):
                cited = m.group(0)
                citations += 1
                if (ROOT / cited).is_file():
                    continue
                key = (rel, cited)
                if key in ALLOW:
                    used.add(key)
                else:
                    problems.append("%s:%d: %s" % (rel, lineno, cited))

    for key in ALLOW:
        if key not in used:
            problems.append(
                "ALLOW entry (%s, %s) matched nothing -- remove it rather than leaving a stale allowlist entry"
                % key
            )

    if problems:
        for p in problems:
            print("[verify_cited_paths] FAIL %s" % p)
        return 1
    print(
        "[verify_cited_paths] OK: %d citation(s) in %d file(s), every cited path exists (%d allowlisted)"
        % (citations, files, len(used))
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
