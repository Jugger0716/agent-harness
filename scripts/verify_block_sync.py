#!/usr/bin/env python3
"""
Verify byte-identical BLOCK content sync across marker-delimited template copies
and their canonical single-source file under templates/_shared/.

Each group is `(tag, [marker-delimited files], shared-source-file | None)`:
  - Every file in `[marker-delimited files]` must carry
    `<!-- BLOCK-START:<tag> v1 ... -->` / `<!-- BLOCK-END:<tag> v1 -->` markers.
    The content BETWEEN the markers (exclusive of the marker comments) is hashed.
  - The shared-source file has NO markers; its WHOLE content is hashed.
  - Both sides are `.strip()`-normalized before hashing so a leading/trailing
    newline difference (marker-delimited vs whole-file) is not false drift.
  - All hashes in a group MUST match.

Groups:
  - spec-context-block : 4 planner templates + templates/_shared/spec_context_block.md
  - input-trust-model  : 4 planner templates + templates/_shared/input_trust_model.md

Exit codes:
  0  All groups' BLOCK contents are byte-identical (after strip-normalization).
  1  Hash mismatch detected (drift) in at least one group.
  2  A file is missing or its BLOCK markers are absent/malformed.

Usage:
  python scripts/verify_block_sync.py

Intended invocation: pre-commit hook OR CI job.

Defined contract: see skills/spec/SKILL.md §M5 BLOCK sync mechanism +
templates/planner/*.md `<!-- BLOCK-START:<tag> v1 ... -->` header comments +
templates/_shared/{spec_context_block,input_trust_model}.md.
"""

from __future__ import annotations

import hashlib
import re
import sys
from pathlib import Path

PLANNERS = [
    "templates/planner/architect.md",
    "templates/planner/planner_single.md",
    "templates/planner/qa_specialist.md",
    "templates/planner/senior_developer.md",
]

# (tag, marker-delimited files, shared-source file without markers or None)
GROUPS: list[tuple[str, list[str], str | None]] = [
    ("spec-context-block", PLANNERS, "templates/_shared/spec_context_block.md"),
    ("input-trust-model", PLANNERS, "templates/_shared/input_trust_model.md"),
]


def markers(tag: str) -> tuple[re.Pattern[str], re.Pattern[str]]:
    start = re.compile(rf"<!--\s*BLOCK-START:{re.escape(tag)}\s+v1.*?-->", re.DOTALL)
    end = re.compile(rf"<!--\s*BLOCK-END:{re.escape(tag)}\s+v1\s*-->")
    return start, end


def extract_block(path: Path, tag: str) -> str:
    start_re, end_re = markers(tag)
    text = path.read_text(encoding="utf-8")
    start_match = start_re.search(text)
    end_match = end_re.search(text)
    if not start_match or not end_match:
        print(
            f"[verify_block_sync] {path} [{tag}]: BLOCK-START or BLOCK-END marker missing",
            file=sys.stderr,
        )
        sys.exit(2)
    if end_match.start() <= start_match.end():
        print(
            f"[verify_block_sync] {path} [{tag}]: BLOCK-END appears before BLOCK-START",
            file=sys.stderr,
        )
        sys.exit(2)
    return text[start_match.end() : end_match.start()]


def sha(content: str) -> str:
    # strip-normalize both ends so marker-delimited vs whole-file newlines don't drift.
    return hashlib.sha256(content.strip().encode("utf-8")).hexdigest()


def check_group(repo_root: Path, tag: str, files: list[str], source: str | None) -> int:
    hashes: dict[str, str] = {}
    for rel in files:
        path = repo_root / rel
        if not path.exists():
            print(f"[verify_block_sync] {rel}: file does not exist", file=sys.stderr)
            return 2
        hashes[rel] = sha(extract_block(path, tag))

    if source is not None:
        spath = repo_root / source
        if not spath.exists():
            print(
                f"[verify_block_sync] {source}: shared source file does not exist",
                file=sys.stderr,
            )
            return 2
        hashes[f"{source} (shared source)"] = sha(spath.read_text(encoding="utf-8"))

    unique = set(hashes.values())
    if len(unique) == 1:
        print(
            f"[verify_block_sync] OK [{tag}]: {len(hashes)} copies match "
            f"(sha256={next(iter(unique))[:16]}...)"
        )
        return 0

    print(f"[verify_block_sync] FAIL [{tag}]: content drift detected", file=sys.stderr)
    for rel, h in hashes.items():
        print(f"  {h[:16]}...  {rel}", file=sys.stderr)
    return 1


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    rc = 0
    for tag, files, source in GROUPS:
        result = check_group(repo_root, tag, files, source)
        if result == 2:
            return 2
        if result == 1:
            rc = 1
    return rc


if __name__ == "__main__":
    sys.exit(main())
