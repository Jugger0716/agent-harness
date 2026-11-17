#!/usr/bin/env python3
"""
Verify byte-identical BLOCK content sync across marker-delimited template copies
and their canonical single-source file under templates/_shared/.

Each group is `(tag, version, [marker-delimited files], shared-source-file | None)`:
  - Every file in `[marker-delimited files]` must carry
    `<!-- BLOCK-START:<tag> <version> ... -->` / `<!-- BLOCK-END:<tag> <version> -->`
    markers. The content BETWEEN the markers (exclusive of the marker comments) is
    hashed. The version is per-group (bumped on intentional content change — e.g.
    input-trust-model went v1 -> v2 in Phase 1 when the literal {placeholder} mentions
    and the dangling '## Output Contract' section name were removed).
  - The shared-source file has NO markers; its WHOLE content is hashed.
  - Both sides are `.strip()`-normalized before hashing so a leading/trailing
    newline difference (marker-delimited vs whole-file) is not false drift.
  - All hashes in a group MUST match.

Groups:
  - spec-context-block (v1) : 4 planner templates + templates/_shared/spec_context_block.md
  - input-trust-model  (v2) : 4 planner templates + templates/_shared/input_trust_model.md
  - wf-prelude (v1)         : the five workflows/*.workflow.js scripts -- single-pass render(),
                              requireArgs() and must(); no shared source
  - hx-* (v1)               : 16 groups across skills/harness{,-gate,-build}/SKILL.md with
                              NO shared source (the /harness copy is canonical) -- see
                              design/harness-ordering-enforcement/SPEC.md §5.4.4

Exit codes:
  0  All groups' BLOCK contents are byte-identical (after strip-normalization).
  1  Hash mismatch detected (drift) in at least one group.
  2  A file is missing or its BLOCK markers are absent/malformed.

Usage:
  python scripts/verify_block_sync.py
  python scripts/verify_block_sync.py --version

Intended invocation: run manually and on push/PR via .github/workflows/lint.yml
(pre-commit hook wiring is still a later-phase TODO).

Defined contract: see the templates/planner/*.md `<!-- BLOCK-START:<tag> v1 ... -->`
header comments + templates/_shared/{spec_context_block,input_trust_model}.md.
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path

# 이 스크립트 자체의 버전. GROUPS 내 블록 버전(v1/v2)과는 무관하며 독립 관리된다.
SCRIPT_VERSION = "1.0.0"

PLANNERS = [
    "templates/planner/architect.md",
    "templates/planner/planner_single.md",
    "templates/planner/qa_specialist.md",
    "templates/planner/senior_developer.md",
]

# (tag, version, marker-delimited files, shared-source file without markers or None)
HX_HB = ["skills/harness/SKILL.md", "skills/harness-build/SKILL.md"]
HX_HGB = ["skills/harness/SKILL.md", "skills/harness-gate/SKILL.md", "skills/harness-build/SKILL.md"]
HX_HG = ["skills/harness/SKILL.md", "skills/harness-gate/SKILL.md"]
# The five Workflow segment scripts. Each is self-contained (C1: no shared imports), so the
# helpers they all need are one byte-identical block per file; the markers sit inside a JS
# line comment (`// <!-- BLOCK-START:... -->`), which the marker patterns below read as-is.
WF_SCRIPTS = [
    "workflows/harness.plan.workflow.js",
    "workflows/harness.build.workflow.js",
    "workflows/harness.eval.workflow.js",
    "workflows/harness.critic.workflow.js",
    "workflows/deep-review.review.workflow.js",
]

GROUPS: list[tuple[str, str, list[str], str | None]] = [
    ("spec-context-block", "v1", PLANNERS, "templates/_shared/spec_context_block.md"),
    ("input-trust-model", "v2", PLANNERS, "templates/_shared/input_trust_model.md"),
    # harness-ordering-enforcement C5 (SPEC 5.4.4, rev.10) kept the /harness split's operative
    # contracts byte-identical across the skill copies. The v8.14 prompt diet then PROMOTED most
    # of those blocks to single sources under templates/_shared/, which is strictly stronger than
    # byte-identity: there is one copy, so there is nothing to compare. What stays a BLOCK group
    # is the text that must remain INLINE in the skill body -- a missed read of it would change
    # behaviour silently -- and therefore still exists in more than one file.
    # Dissolved at the diet (now single sources, not duplicated text): hx-preamble-a ->
    # orchestrator_contract.md, hx-user-lang / hx-olc-core / hx-olc-inline-returns ->
    # output_language.md, hx-session-entry / hx-session-gate-a / hx-session-gate-b /
    # hx-session-actions-tail -> session_recovery.md, hx-run-style -> run_style.md,
    # hx-boundary-shell / hx-handoff-fields -> session_boundary.md, hx-model-selection ->
    # model_config.md. hx-preamble-b was split: its Mode Gate + Standard Status Format half is
    # the new hx-mode-gate group below, the rest moved to status_format.md.
    # shared_source is None for all four -- the /harness copy is canonical; no copy lives under
    # templates/.
    ("hx-mode-gate", "v2", HX_HB, None),
    ("hx-state-machine", "v3", HX_HB, None),
    ("hx-path-validator", "v2", HX_HGB, None),
    ("hx-scale-render", "v2", HX_HG, None),
    ("wf-prelude", "v1", WF_SCRIPTS, None),
]


def markers(tag: str, version: str) -> tuple[re.Pattern[str], re.Pattern[str]]:
    start = re.compile(
        rf"<!--\s*BLOCK-START:{re.escape(tag)}\s+{re.escape(version)}.*?-->", re.DOTALL
    )
    end = re.compile(rf"<!--\s*BLOCK-END:{re.escape(tag)}\s+{re.escape(version)}\s*-->")
    return start, end


def extract_block(path: Path, tag: str, version: str) -> str:
    start_re, end_re = markers(tag, version)
    text = path.read_text(encoding="utf-8")
    start_match = start_re.search(text)
    end_match = end_re.search(text)
    if not start_match or not end_match:
        print(
            f"[verify_block_sync] {path} [{tag} {version}]: "
            "BLOCK-START or BLOCK-END marker missing (check the version tag)",
            file=sys.stderr,
        )
        sys.exit(2)
    if end_match.start() <= start_match.end():
        print(
            f"[verify_block_sync] {path} [{tag} {version}]: BLOCK-END appears before BLOCK-START",
            file=sys.stderr,
        )
        sys.exit(2)
    return text[start_match.end() : end_match.start()]


def sha(content: str) -> str:
    # strip-normalize both ends so marker-delimited vs whole-file newlines don't drift.
    return hashlib.sha256(content.strip().encode("utf-8")).hexdigest()


def check_group(
    repo_root: Path, tag: str, version: str, files: list[str], source: str | None
) -> int:
    hashes: dict[str, str] = {}
    for rel in files:
        path = repo_root / rel
        if not path.exists():
            print(f"[verify_block_sync] {rel}: file does not exist", file=sys.stderr)
            return 2
        hashes[rel] = sha(extract_block(path, tag, version))

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
            f"[verify_block_sync] OK [{tag} {version}]: {len(hashes)} copies match "
            f"(sha256={next(iter(unique))[:16]}...)"
        )
        return 0

    print(
        f"[verify_block_sync] FAIL [{tag} {version}]: content drift detected",
        file=sys.stderr,
    )
    for rel, h in hashes.items():
        print(f"  {h[:16]}...  {rel}", file=sys.stderr)
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify byte-identical BLOCK content sync.")
    parser.add_argument(
        "--version", action="version", version=f"verify_block_sync {SCRIPT_VERSION}"
    )
    args = parser.parse_args()  # noqa: F841 — no positional args yet; reserved for future use
    repo_root = Path(__file__).resolve().parent.parent
    rc = 0
    for tag, version, files, source in GROUPS:
        result = check_group(repo_root, tag, version, files, source)
        if result == 2:
            return 2
        if result == 1:
            rc = 1
    return rc


if __name__ == "__main__":
    sys.exit(main())
