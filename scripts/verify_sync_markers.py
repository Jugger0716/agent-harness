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

It ALSO runs a section-reference check (see SECTION_REF_TARGETS): every
`<file>` §<Section> pointer into a listed side-file must resolve to a real
`## §<Section>` heading there. A renamed heading otherwise rots every pointer
silently -- the same failure mode this repository already fixed twice for absolute
line-number citations.

Exit codes:
  0  all known groups consistent
  1  a referential break, too-few sites, or a missing token
  2  a known group's marker was not found anywhere (the SSOT lost its sync sites)

Usage:
  python scripts/verify_sync_markers.py

Intended invocation: run manually and on push/PR via .github/workflows/lint.yml
(pre-commit hook wiring is still a later-phase TODO).
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
        # 3 real marker sites, zero slack: skills/harness/SKILL.md §Conventions
        # injection rule (the genuine cross-file sync site) + skills/spec/SKILL.md
        # §Step 1 step 7 schema doc (the state.json `conventions` field bullet) +
        # skills/spec/SKILL.md §Step 1.5 conventions field contract itself, whose
        # own explanatory prose quotes the marker HTML comment inside a backtick
        # code-span as a documented example of what the marker looks like. That
        # third site adds ZERO value-consistency coverage -- it is the SSOT
        # describing itself, not an independent site that could drift from it --
        # it only raises the floor. HONEST COVERAGE NOTE: rewording that
        # explanatory sentence so it no longer quotes the marker literally drops
        # the site count 3 -> 2, and this group then FAILs with "2 marker
        # site(s), expected >= 3" -- a message that reads as a broken sync site,
        # not as "an SSOT example sentence was reworded." A future maintainer
        # seeing that failure with no sync site actually broken may be tempted
        # to lower min_sites back to 2; don't -- re-quote the marker literally
        # in the SSOT prose instead.
        "min_sites": 3,
    },
    {
        "id": "ambiguity-prompt",
        "target_file": "templates/_shared/mode_gate.md",
        "section": "Ambiguity Prompt",        # NO leading § — MARKER_RE captures the text AFTER §
        "target_anchor": "§Ambiguity Prompt",  # substring that must exist in target_file (§ kept)
        "tokens": ["§Ambiguity Prompt"],       # every marked site must contain this token
        # min_sites is a RAW OCCURRENCE floor, NOT a file-count floor (site count != file
        # count — this scan does not dedupe by file). As of /study: 9 multi-path skills
        # carry the marker (debug, deep-review, harness, migrate, refactor, spec, study,
        # test-gen = 8 files, + migrate and refactor EACH carrying the marker twice = 2 extra
        # raw sites -> 10 total). codebase-audit references §Ambiguity Prompt in prose only
        # and carries NO marker — a pre-existing gap (skills/codebase-audit/SKILL.md §Mode
        # Gate), tracked separately, not part of this floor. Prior value (7) was a floor
        # BELOW the already-measured 9 raw sites (slack 2) — a /study marker omission would
        # have silently passed; 10 = 9 (measured before /study) + 1 (this skill), so removing
        # /study's marker now actually fails this check (AC-22 verification method).
        "min_sites": 10,
    },
    {
        "id": "project-defaults",
        "target_file": "templates/_shared/project_defaults.md",
        "section": "agent-harness-defaults",   # NO leading § — MARKER_RE captures the text AFTER §
        "target_anchor": "agent-harness-defaults:",
        "tokens": ["agent-harness-defaults:"],
        # 9 multi-path skills (codebase-audit, debug, deep-review, harness, migrate,
        # refactor, spec, study, test-gen) each carry exactly ONE marker in this group — raw
        # site count equals file count here (no duplicate-marker skill, unlike
        # ambiguity-prompt above). Prior value (8) was measured with zero slack before
        # /study; 9 = 8 + 1 (this skill).
        "min_sites": 9,
    },
    {
        "id": "adhoc-dispatch",
        "target_file": "templates/_shared/adhoc_dispatch.md",
        "section": "Ad-hoc Dispatch Contract",  # NO leading § — MARKER_RE captures the text AFTER §
        "target_anchor": "Ad-hoc Dispatch Contract",
        "tokens": ["§Ad-hoc Dispatch Contract"],
        # 9 multi-path skills + ship + md-generate + md-optimize = 12 files, one marker each
        # (raw site count equals file count in this group too). Prior value (11) was measured
        # with zero slack before /study; 12 = 11 + 1 (this skill).
        "min_sites": 12,
    },
    {
        "id": "handoff-state-record",
        "target_file": "skills/handoff/SKILL.md",
        "section": "Fixed Label Record Format",  # NO leading § — MARKER_RE captures the text AFTER §
        "target_anchor": "Fixed Label Record Format",
        # the 5-field fixed-label record /handoff generate writes and /handoff resume Step 3.5
        # + /harness Session Boundary both reference (P0-4, v8.8 epic-continuity wiring)
        "tokens": ["Skill :", "Task :", "Phase :", "Mode :", "Docs :"],
        "min_sites": 2,                        # skills/handoff/SKILL.md (self) + skills/harness/SKILL.md
    },
    {
        # harness-handoff-coldreview-epic-slice slice-f, group (b): the workflows/spec.eval.workflow.js
        # `// contract` comment declares it is dispatched by TWO callers -- this group makes sure
        # neither caller's args wiring can silently drift from that declared contract without a
        # min_sites/token failure. Pre-slice-f baseline occurrence counts (measured with the
        # §접근 방식 ①-b snippet, harness / spec / workflow order):
        #   criticFindingsPath 1/1/3, specContent 5/1/2, qaNotes 3/3/2
        # (each file already carried all 3 tokens -- this group adds no new literal, only the
        # marker + min_sites floor; see spec §접근 방식 ④).
        "id": "spec-eval-dual-caller",
        "target_file": "workflows/spec.eval.workflow.js",
        "section": "contract",
        "target_anchor": "contracted for TWO callers",
        "tokens": ["criticFindingsPath", "specContent", "qaNotes"],
        "min_sites": 3,                        # harness §Step 2.6 + spec Phase 2c-D + the workflow's own `// contract` block
    },
    {
        # harness-handoff-coldreview-epic-slice slice-f, group (a): /handoff's slice-command
        # convention (generate Step 1 item 4) and its Next :/Next cmd: derivation (resume Step 5)
        # both point at skills/harness/SKILL.md §Step 3.5: Slice Plan as their format SSOT --
        # this group fails when a marker is removed outright; it does NOT catch a pointer whose
        # prose rots while its marker stays (see the HONEST COVERAGE NOTE below -- effective
        # tokens are 2). Claim the narrower guarantee, never the broader one.
        # Pre-slice-f baseline occurrence counts (harness / handoff order): §Step 3.5 16/0,
        # slice_plan.md 12/1, Next cmd 5/1 -- handoff's `§Step 3.5` count was 0 until slice-f's
        # own edit seeded it (a section name-citation, not a restated format -- see spec
        # §접근 방식 ④); `--output-dir` alone is never used as a token (epic AC-29 bans that form).
        "id": "slice-command-format",
        "target_file": "skills/harness/SKILL.md",
        "section": "Step 3.5: Slice Plan",
        "target_anchor": "slugify(task) == task == Slice",
        # HONEST COVERAGE NOTE: the token `§Step 3.5` is itself a substring of this group's
        # marker text (`<!-- SYNC-WITH: skills/harness/SKILL.md §Step 3.5: Slice Plan -->`), so at
        # any site that carries the marker it can never fail -- the effective token set is 2
        # (`slice_plan.md`, `Next cmd`), not 3. Recorded rather than silently counted as 3;
        # replacing the token needs an epic AC-6 literal revision, which is out of slice-f scope.
        "tokens": ["§Step 3.5", "slice_plan.md", "Next cmd"],
        "min_sites": 2,                        # skills/harness/SKILL.md (self) + skills/handoff/SKILL.md
    },
    {
        # release-readiness review 2026-08-19, working-tree round 1 finding [7]: the
        # re-entry critic paragraph is hand-duplicated in three places -- the dispatched copy
        # (workflows/harness.plan.workflow.js CRITIC_REVISION_BLOCK) and its two author-time
        # sources (templates/planner/synthesis.md, synthesis_standard.md). The measured drift
        # at the time this group was added was 0 (the three copies matched), but nothing
        # enforced it: verify_block_sync.py's GROUPS cover templates/planner/{architect,
        # planner_single,qa_specialist,senior_developer}.md only, and the `// SYNC-SOURCE:`
        # comments in the script are human notes MARKER_RE never matches. The JS marker sits
        # in a line comment (spec.eval.workflow.js precedent) so it is not dispatched.
        "id": "critic-revision-block",
        "target_file": "templates/planner/synthesis.md",
        "section": "Critic Findings (re-entry only)",  # NO leading § -- MARKER_RE captures after §
        "target_anchor": "Critic Findings (re-entry only)",
        "tokens": [
            "These findings reach you as criticFindings",
            "re-synthesize from the proposals only",
        ],
        "min_sites": 3,                        # the 2 .md sources + the dispatched JS copy (slack 0)
    },
    {
        # review-fixes-v8-12 S2: the cross-skill session conflict gate. Four skills (debug,
        # refactor, migrate, test-gen) each cite templates/_shared/session_conflict.md
        # §Gate Procedure and reproduce the ACTIONABLE part of it -- trigger condition, the
        # AskUserQuestion header/question/options, both outcomes, and the non-interactive
        # default -- the same way their own §Mode Gate sections reproduce mode_gate.md's
        # decision table. What they do NOT reproduce is the full procedure, the §Harness
        # exception, and the general destructive-vs-non-destructive rule.
        # An earlier revision of this comment said those sites "restate only the header + the
        # two option labels". That was false when written -- the same paragraph it described
        # also restated the trigger condition, the ordering guarantee and both outcomes -- and
        # it is corrected here rather than deleted.
        # The tokens below check the header and ONE option label. That is a strictly narrower
        # guarantee than "the gate is present and correct"; claim only the narrow one.
        # CORRECTION (S3): an earlier revision of this comment said "COVERAGE GAP until S3:
        # skills/{spec,harness,ship}/SKILL.md carry `Session Conflict` and their own option
        # literals as hand-written prose with NO marker, so they are not sites of this group".
        # S3 converged those three and they now carry markers, so that gap is closed and the
        # sentence is corrected here rather than deleted. The floor below rose 4 -> 7 in the
        # same change.
        # WHAT REPLACES IT is a narrower gap, not none. At the spec and harness sites the two
        # tokens were ALREADY present before their markers were added (measured at the S3 base:
        # spec 1/2, harness 1/1, ship 0/0), because both files spell their own gate out in full.
        # So at those two sites the token check can only fail if the gate text disappears
        # wholesale -- it cannot see wording drift away from the SSOT. Only the ship site is
        # non-vacuous in the S2 sense. Claim the narrow guarantee: 7 markers coexist and ship
        # carries the literals; NOT that the seven gates still agree with the source.
        # REVERT ORDER: this group and its sites must be reverted together, newest commit
        # first. Reverting the marker insertion (or the SSOT) while leaving this group
        # registered drops site discovery to 0, which is exit 2 (MISSING), not exit 1.
        # The SSOT itself carries NO marker: SCAN_DIRS includes
        # "templates", so quoting one there as an example would make the site count 5 rather
        # than 4 and break both this floor and the raise S3 makes to it.
        # Token non-vacuity was MEASURED before the edit, not assumed: `Session Conflict` and
        # `Delete and start` each occurred 0 times in all four skill files, and neither is a
        # substring of this group's marker text -- so unlike slice-command-format's `§Step 3.5`
        # (see its HONEST COVERAGE NOTE above), both tokens here can actually fail.
        "id": "session-conflict",
        "target_file": "templates/_shared/session_conflict.md",
        "section": "Gate Procedure",           # NO leading § — MARKER_RE captures the text AFTER §
        "target_anchor": "§Gate Procedure",
        "tokens": ["Session Conflict", "Delete and start"],
        # zero slack: 7 sites = S2's four skills (debug, refactor, migrate, test-gen) + S3's
        # three (spec, harness, ship). Raised 4 -> 7 in S3, in the same change that added those
        # three markers: a site added without raising the floor fails NOTHING, so the failure
        # mode of forgetting this line is silent slack, not a red build. The only guard is the
        # arithmetic assertion in the slice that adds sites -- `9 sync group(s), 51 marker
        # site(s)` together with this value read directly out of the dict.
        # Reverting one converging commit on its own (harness, say) drops sites to 6 and this
        # floor turns red immediately. That is intended, not a bug: revert the floor in the same
        # operation.
        "min_sites": 7,
    },
]


# Files whose `<path>` §<Section> references must resolve to a real `## §<Section>`
# heading in that file. Deliberately scoped to `workflows/_reference/` rather than
# generic: many §references in this repository legitimately point at something that is
# NOT an exact `## §` heading -- a bullet (skills/study/SKILL.md documents `§Allowed
# Writes` as a Key Rules bullet), a prefix-matched heading (`§Mode Gate` vs the full
# `## Mode Gate -- path & mode resolution ...`), or a section of the citing file itself
# (`§3.4a`). A generic check would fail on all of those, so it would be turned off.
#
# What this DOES guard is the one case with no other guard at all: a skill that moved its
# measurement record into a side file and now cites it by section name. Rename a heading
# there and every pointer rots silently -- the same failure this repository already fixed
# twice for absolute line-number citations.
SECTION_REF_TARGETS = ["workflows/_reference/study_measurements.md"]

# `## §Section Name` (the anchor form section pointers use)
SECTION_HEADING_RE = re.compile(r"^## (§[^\n]+?)\s*$", re.M)


def check_section_refs() -> int:
    """Return the number of unresolved `<target>` §Section references."""
    bad = 0
    for target_rel in SECTION_REF_TARGETS:
        target = ROOT / target_rel
        if not target.exists():
            # Not an error: the referencing skill may not be present in every checkout.
            # An unresolved reference to a missing file is caught below instead.
            headings: set[str] = set()
        else:
            headings = set(SECTION_HEADING_RE.findall(target.read_text(encoding="utf-8")))

        basename = target_rel.rsplit("/", 1)[-1]
        # A pointer may be wrapped across `// ` comment continuation lines; flatten those
        # so a wrapped path still resolves (and so wrapping is not a silent failure).
        # One regex, anchored on the path mention, optionally capturing a second section
        # ("... §A and §B"). Anchoring matters: a free-floating "§A and §B" pattern would
        # both admit §references that belong to some other file and silently DROP a
        # renamed second element, which is the opposite of what a guard should do.
        section = r"§[A-Z][A-Za-z]*(?: [A-Z][A-Za-z]*)*"
        ref_re = re.compile(
            re.escape(basename) + rf"`?\s+({section})(?:\s+and\s+({section}))?"
        )
        total = 0
        for p in iter_files():
            if p == target:
                continue
            try:
                text = p.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            if basename not in text:
                continue
            flat = re.sub(r"\n\s*//\s*", " ", text)
            refs = [g for match in ref_re.findall(flat) for g in match if g]
            for ref in refs:
                total += 1
                if ref not in headings:
                    bad += 1
                    print(
                        f"[verify_sync_markers] FAIL section-ref: "
                        f"{p.relative_to(ROOT)} cites {target_rel} {ref!r}, "
                        f"which is not a `## {ref}` heading there",
                        file=sys.stderr,
                    )
        if not bad:
            print(
                f"[verify_sync_markers] OK: {total} section ref(s) -> "
                f"{target_rel} ({len(headings)} heading(s))"
            )
    return bad


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

    bad += check_section_refs()

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
