#!/usr/bin/env python3
"""
Verify SYNC-WITH marker integrity across skill/template/workflow docs.

A `<!-- SYNC-WITH: <target_file> §<section> -->` HTML comment marks a doc site
whose declared values must stay consistent with a canonical section elsewhere.
This fulfills the lint promise in skills/spec/SKILL.md §Step 1.5 conventions
field contract ("a CI lint pass can grep the marker and verify all sites declare
the same enum"), which previously had no implementation.

For each known sync group:
  1. referential integrity -- the target file exists and contains the group's
     canonical-anchor substring (the section the marker points at).
  2. site discovery -- the marker is found in at least `min_sites` files.
  3. value consistency -- every file carrying the marker declares ALL of the
     group's canonical tokens, so a doc site cannot silently drift from the SSOT.

This is a marker-and-token consistency check, not a semantic diff: it proves the
enum tokens co-exist in each marked file, not that surrounding prose is identical.
Add a SYNC_GROUPS entry whenever a new SYNC-WITH contract is introduced.

Exit codes:
  0  all known groups consistent
  1  a referential break, too-few sites, or a missing token
  2  a known group's marker was not found anywhere (the SSOT lost its sync sites)

Usage:
  python scripts/verify_sync_markers.py

Intended invocation: run manually (pre-commit/CI wiring is a later-phase TODO).
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Directories scanned for markers (skip vendored / VCS / cache trees).
SCAN_DIRS = ["skills", "templates", "workflows"]
SKIP_PARTS = {".venv", ".git", "node_modules", "__pycache__"}
SCAN_SUFFIXES = {".md", ".js"}

# `<!-- SYNC-WITH: <target> §<section> -->` (also matches the marker text when it
# appears inside a backtick code-span used as a documented example).
MARKER_RE = re.compile(
    r"SYNC-WITH:\s*(?P<target>[^\s§]+)\s*§\s*(?P<section>[^\n>]+?)\s*-->"
)

# Known sync groups. One entry per SYNC-WITH contract.
SYNC_GROUPS = [
    {
        "id": "conventions-field-contract",
        "target_file": "skills/spec/SKILL.md",
        "section": "Step 1.5 conventions field contract",
        # a substring that must exist in the target file = the canonical anchor
        "target_anchor": "conventions` field contract",
        # canonical enum tokens every marked site must declare (literal substrings)
        "tokens": ["`null`", '"skipped"', '"file:.harness/conventions.md"'],
        "min_sites": 2,
    },
]


def iter_files():
    for d in SCAN_DIRS:
        base = ROOT / d
        if not base.exists():
            continue
        for p in base.rglob("*"):
            if (
                p.is_file()
                and p.suffix in SCAN_SUFFIXES
                and not (SKIP_PARTS & set(p.parts))
            ):
                yield p


def collect_markers():
    """Return list of (path, target, section, full_text)."""
    out = []
    for p in iter_files():
        try:
            text = p.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as e:
            print(
                f"[verify_sync_markers] WARN unreadable: {p.relative_to(ROOT)}: {e}",
                file=sys.stderr,
            )
            continue
        for m in MARKER_RE.finditer(text):
            out.append((p, m.group("target").strip(), m.group("section").strip(), text))
    return out


def main() -> int:
    markers = collect_markers()
    bad = 0
    missing_group = False
    total_sites = 0

    for g in SYNC_GROUPS:
        # 1. referential integrity
        target = ROOT / g["target_file"]
        if not target.exists():
            print(
                f"[verify_sync_markers] FAIL {g['id']}: target file missing: {g['target_file']}",
                file=sys.stderr,
            )
            bad += 1
        else:
            ttext = target.read_text(encoding="utf-8")
            if g["target_anchor"] not in ttext:
                print(
                    f"[verify_sync_markers] FAIL {g['id']}: target anchor not found in "
                    f"{g['target_file']}: {g['target_anchor']!r}",
                    file=sys.stderr,
                )
                bad += 1

        # 2. site discovery
        sites = [
            (p, text)
            for (p, tgt, sec, text) in markers
            if tgt == g["target_file"] and sec == g["section"]
        ]
        total_sites += len(sites)
        if len(sites) < g["min_sites"]:
            if not sites:
                missing_group = True
                print(
                    f"[verify_sync_markers] MISSING {g['id']}: no marker site found "
                    f"(expected >= {g['min_sites']})",
                    file=sys.stderr,
                )
            else:
                bad += 1
                print(
                    f"[verify_sync_markers] FAIL {g['id']}: {len(sites)} marker site(s), "
                    f"expected >= {g['min_sites']}",
                    file=sys.stderr,
                )

        # 3. value consistency
        for (p, text) in sites:
            missing = [tok for tok in g["tokens"] if tok not in text]
            if missing:
                bad += 1
                print(
                    f"[verify_sync_markers] FAIL {g['id']}: {p.relative_to(ROOT)} "
                    f"missing token(s): {missing}",
                    file=sys.stderr,
                )

    if missing_group:
        return 2
    if bad:
        return 1
    print(
        f"[verify_sync_markers] OK: {len(SYNC_GROUPS)} sync group(s), "
        f"{total_sites} marker site(s)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
