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

It ALSO runs a section-reference check (see SECTION_REF_TARGETS). That list now
carries TWO entries with DIFFERENT modes, so no single sentence describes both:

  * mode "anchor-heading" (workflows/_reference/study_measurements.md) -- every
    `<file>` §<Section> pointer into that side-file must resolve to a real
    `## §<Section>` heading there. Behaviour unchanged since it shipped.
  * mode "harness-steps" (skills/harness/SKILL.md) -- that file uses NO `## §Name`
    headings at all, so the anchor-heading rule cannot apply to it. Instead six
    layers check the `§Step N(.N)` citation family and the path-anchored cross-file
    pointers against structural pins. See check_section_refs() for the layers and
    §What this does not check below for the disclosed limits.

A renamed heading otherwise rots every pointer silently -- the same failure mode
this repository already fixed twice for absolute line-number citations.

§What this does not check (harness-steps mode; see §FIGURE PROVENANCE below):
  1. IN-FILE COVERAGE. Of the 428 in-file §citations in skills/harness/SKILL.md, 219
     are checked and 209 are NOT: 204 non-Step citations, 2 `§Step Mode Prerequisites`
     (a Step-prefixed name, not a Step number), and 3 §Step citations carrying ANOTHER
     file's path anchor (they target spec and team-memory, so they are deliberately out
     of scope). 219 + 209 = 428 exactly; the split is a partition, not a sample. The
     unchecked share is just under half -- large, but not the majority.
     RE-MEASURED 2026-09-04, after the spec_stamp change rewrote parts of that file:
     the figures were 403 / 203 / 200 / 195 when this mode shipped, and 422 / 216 / 206 /
     201 one edit-round later inside that same change. Nothing about the
     check moved -- the counted document did. That is the ordinary case for every
     figure in this block, which is why each carries its command rather than a date
     alone.
  2. NUMBERS, NOT TITLES. Renaming `Step 5: Verify Phase` to `Step 5: Mechanical Check`
     passes. A rename sweep over all 80 headings is caught for 20 of them.
  3. SCAN SCOPE. Every layer here iterates SCAN_DIRS (skills/, templates/, workflows/),
     so the repository ROOT documents are never scanned. Measured: 6 sub-path citations
     (ROADMAP.md 4, CHANGELOG.md 2) and 40 path-anchored pointers at this target
     (CHANGELOG.md 27, ROADMAP.md 12, README.md 1) sit outside every count below.
     These two are DATED figures, not invariants: prose about them lives in the very
     files they count, so writing this disclosure moved the second one twice.
     Widening is not a one-line change: iter_files() is shared with collect_markers(),
     so touching it moves the SYNC marker-site total too.
  4. PIN-STEP IS A SET COMPARISON. It sees heading TEXT only -- never order, nesting
     level, or position -- so reordering or re-levelling the Step sections keeps it green.
  5. PIN-FILES IS A ONE-DIRECTORY GLOB (`skills/harness/*.md`). A split into a
     subdirectory, a different extension, or another skill's directory escapes it, and
     glob case-sensitivity is platform-dependent. It catches the sibling-file split the
     conditional-`go` in ROADMAP names, not every conceivable one. Per-target pinning
     (2026-09-04) did NOT change this: it moved the pin's VALUE onto the entry, while
     the SCOPE compared against it is still `(ROOT / entry['path']).parent`. So a second
     target in its own directory is still invisible to the first target's PIN-FILES,
     and silently de-registering that second entry trips nothing here.
  6. MISATTRIBUTION, BOTH DIRECTIONS. Passing-for-the-wrong-reason: the `§Step 1.5`
     token quoted inside that file's §Sub-command: doctor prose resolves against this
     file's own Step 1.5 although the sentence is about team-memory. Failing-for-the-
     wrong-reason is possible too and is NOT hypothetical in shape: a §Step citation
     written without a path anchor is judged against THIS target's ids whatever it
     means. Layers 4 and 5 both use the path anchor to narrow that; a citation that
     omits one gets no such protection.
  7. FENCES, ASYMMETRICALLY. Heading extraction skips code fences; citation extraction
     does not. Today 7 in-file §Step citations sit inside fences and all resolve, so the
     live risk is not a fenced HEADING example (harmless) but a fenced CITATION example
     naming an id this file does not have.

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

import collections
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
        # WHAT REPLACES IT is a narrower gap, not none -- and it is NOT the gap an earlier
        # revision of this comment described. That revision said the spec and harness sites
        # "can only fail if the gate text disappears wholesale". Measured, that is wrong in both
        # directions, so it is corrected here rather than deleted:
        #   * The check DOES fire when a token's LAST occurrence in a file disappears. Injected
        #     at the S3 head: renaming spec's single `Session Conflict` -> exit 1. Current counts
        #     are `Session Conflict` 1 at every site except harness (5: table row + gate header +
        #     question) and `Delete and start` 2 everywhere.
        #   * What it genuinely cannot see is WORDING DRIFT while both literals survive, and that
        #     limit applies to all SEVEN sites uniformly, not to spec and harness specially.
        #     Injected: changing spec's question from "will delete it" to "will nuke it" -> exit 0,
        #     undetected.
        # What IS specific to spec and harness is marginal value, not toothlessness: both files
        # already contained the two literals before their markers were added, so the marker adds
        # no coverage there that their own gate text did not already force. Pre-edit counts at the
        # S3 base, `grep -c` (MATCHING LINES, not occurrences -- stating the basis because
        # harness's item 1 was one long line carrying both the option label and the outcome
        # sentence, so 2 occurrences counted as 1 line and the numbers otherwise look inconsistent
        # with spec's): spec 1/2, harness 1/1, ship 0/0.
        # Claim the narrow guarantee -- 7 markers coexist and each site still carries both
        # literals; NOT that the seven gates still agree with the source. Only the live probe
        # shows that.
        # FORWARD CONSTRAINTS, left here because this is where the S2 -> S3 handoff note lived and
        # was consumed, and the equivalent forward notes otherwise exist only outside git:
        #   * S4 (/team-memory) must cite templates/_shared/session_conflict.md IN PROSE ONLY --
        #     adding a SYNC-WITH marker there makes 8 sites against a floor of 7, which passes
        #     silently and restores exactly the slack this zero-slack floor exists to remove.
        #     Following this repository's usual marker convention is what causes the defect here.
        #   * S5's read-only `doctor` carve-out must sit BEFORE item 1's branch table in
        #     skills/harness/SKILL.md, or the gate this slice added blocks a diagnostic that reads
        #     nothing.
        #     DONE in S5 (this bullet is kept, not deleted, so a revert of S5 restores a live
        #     constraint rather than a silent gap): the carve-out sits at the TOP of §Session
        #     Recovery -- before the section's "Before starting a new task" sentence, which is a
        #     STRICTLY STRONGER position than "before item 1's branch table" and the same slot
        #     /spec's digest carve-out occupies. Read this bullet as the stronger coordinate: a
        #     carve-out placed between that sentence and item 1 also satisfies the wording above
        #     and is NOT what S5 shipped.
        #   * S7 must pick up the S3 row added to ROADMAP.md's Unreleased table (harness item 2's
        #     legacy branch has no non-interactive default). It is deferred BECAUSE writing it
        #     would edit item 2, and AC-S3.3's byte-unchanged comparison is the only evidence the
        #     pre-harness path was not made unreachable. Recording it only in a commit message
        #     would have been this repository's own "half-updated ledger" defect: a later slice
        #     reads the ledger, not six commit messages.
        #   * Phase P probe (d) (/harness doctor) needs its comparison method named. Take the
        #     recursive hash of .harness/ before and after the run -- probe (a) already takes that
        #     same hash on its own Cancel path, though its other half is `git branch` invariance,
        #     not `git status` -- and pair it with `git status`, which is what EPIC AC-6.3 asks for
        #     alongside the hash. git status alone cannot see the write: .harness/ is ignored by
        #     this repository's root .gitignore (verify with `git check-ignore -v .harness/`).
        #   * Phase P also owes five S5 carry-overs kept only in a gitignored plan: AC-S5.2, AC-6.2,
        #     AC-6.1's "all six green", EPIC's stale measured values, and the mislabelled cache
        #     copy.
        # REVERT NOTE beyond the marker/floor set below: S3's final correction commit also
        # resolved a contradiction between skills/harness/SKILL.md §Version & Compatibility and
        # item 1's branch table. Reverting that commit alone reinstates the contradiction, which
        # no check here detects -- both texts are prose and both literals survive either way.
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


# `## §Section Name` -- the anchor form section pointers use in "anchor-heading" mode
# ONLY. `skills/harness/SKILL.md` uses no such heading; see the harness-steps constants.
SECTION_HEADING_RE = re.compile(r"^## (§[^\n]+?)\s*$", re.M)

# --- harness-steps mode -----------------------------------------------------------
# §FIGURE PROVENANCE. Every pinned constant and every count quoted in the module
# docstring was measured on the tree THIS change produces -- base commit c986901 plus
# BOTH edits this same change makes to skills/harness/SKILL.md. Naming only one of them
# would describe a tree that yields 403/203, not the figures below:
#   (a) repointing a rotted `§state.json schema` at `§Step 1: Setup`. This ADDS NOTHING
#       to the 403 total -- it swaps one §citation for another -- but it moves that one
#       citation from unchecked into checked.
#   (b) appending a misattribution note to §Sub-command: doctor, written deliberately
#       with no §-prefixed token of its own so it perturbs no count. Three earlier
#       revisions of it did carry such tokens and moved the total to 405 each time.
# So against bare c986901 the TOTAL is unchanged at 403; only `in scope` (202 -> 203) and
# `unchecked` (201 -> 200) move, by the single citation (a) relocates. Re-measure with the
# command named beside each figure before changing a pin.
#
# These counts describe ANOTHER file, so quoting them here is safe. Do not copy them
# into skills/harness/SKILL.md itself: a figure that counts its own document invalidates
# itself the moment it is written -- (b) above is that mechanism caught in the act.
#
#   428 in-file §citations   python -c "import re;print(len(re.findall(r'§(?=[0-9A-Za-z])',
#                            open('skills/harness/SKILL.md',encoding='utf-8').read())))"
#   224 bare §Step           ... re.findall(r'§Step', text)
#   222 §Step + number       ... re.findall(r'§Step[ \t\n]+\d', text)
#   219 in scope             222 minus the 3 that carry another file's path anchor
#   209 unchecked            204 non-Step + 2 §Step Mode Prerequisites + 3 foreign
#   17 Step headings / 11 canonical ids
#                            python -c "import re,collections;t=open('skills/harness/SKILL.md',
#                            encoding='utf-8').read();print(collections.Counter(m.group(2) for m
#                            in re.finditer(r'^#{1,6}[ \t]+(Step (\d+(?:\.\d+)?)\b.*)$',t,re.M)))"
#   80 headings              ... re.finditer(r'^(#{1,6})[ \t]+(.*\S)[ \t]*$', text, re.M)
#                            (fence-blind, unlike _headings(); both give 80 today because
#                            no fenced line in that file starts with `#`)
#   20 of 80 caught          replace each heading's whole text with a sentinel, one at a
#                            time, and count the copies this script rejects
#
# Of these, ONLY `219 in scope` is restated by an OK line below; 428 / 224 / 222 / 209 /
# 80 / 20 are not printed anywhere and are reproducible only from the commands above.
# Where an OK line and this comment disagree, the OK line is the live measurement.
FENCE_RE = re.compile(r"^\s*(```|~~~)")
HEAD_LINE_RE = re.compile(r"^(#{1,6})[ \t]+(.*\S)[ \t]*$")
# Heading text up to its first decoration, so `§Step 2` resolves against
# `Step 2: Plan Phase` without the citation having to carry the title.
CUT_RE = re.compile(r"\s*(?::|\s—\s|—|\(|\|)")
# A citation may wrap across a line, a blockquote `> `, or a `// ` comment continuation.
CONT_RE = re.compile(r"[ \t]*\n[ \t]*(?:>[ \t]*|//[ \t]*)?")
_FIRST = r"[A-Z0-9][A-Za-z0-9.'’-]*"
_NEXT = r"(?:(?!and[ \t\n])[A-Za-z0-9][A-Za-z0-9.'’-]*|&)"
_SEP = r"(?::)?(?:[ \t]+|[ \t]*\n[ \t]*(?:>[ \t]*|//[ \t]*)?)"
SECTION_ANY = rf"§{_FIRST}(?:{_SEP}{_NEXT}){{0,7}}"

# A CANONICAL Step heading is `Step N:` or `Step N — `, but NOT `Step N — INLINE/WORKFLOW
# path`. That exclusion is the whole point: ids 2, 4 and 5 each appear on THREE headings
# (canonical + INLINE + WORKFLOW), so sourcing ids from all 17 Step headings would let the
# canonical heading be deleted outright while a sub-path heading kept its id alive --
# measured: 38 citations left pointing at nothing, exit 0.
CANON_STEP_RE = re.compile(r"^Step (\d+(?:\.\d+)?)(?=:| — )(?! — (?:INLINE|WORKFLOW) path\b)")
SUBPATH_HEAD_RE = re.compile(r"^Step (\d+(?:\.\d+)?) — (INLINE|WORKFLOW) path\b")
STEP_CITE_RE = re.compile(r"§Step" + _SEP + r"(\d+(?:\.\d+)?)")
SUBPATH_CITE_RE = re.compile(
    r"§Step" + _SEP + r"(\d+(?:\.\d+)?)[ \t]*—[ \t]*(INLINE|WORKFLOW) path"
)
# `skills/spec/SKILL.md §Step 1.5` inside harness is a pointer at ANOTHER file; without
# this it would be checked against harness's own Step ids and pass for the wrong reason.
PATH_ANCHOR_RE = re.compile(
    r"(?:\{CLAUDE_PLUGIN_ROOT\}/)?"
    r"((?:skills|templates|workflows)/[A-Za-z0-9_.\-/]+\.(?:md|js))`?[ \t\n]*§Step"
)

# Zero-slack structural pins, same convention as `min_sites`: adding a Step section means
# raising the pin in the SAME change, and removing one fails immediately. These pins, not
# a citation-count floor, are what makes a heading rename un-silenceable -- deleting the
# citations to hide a rename trips PIN-STEP instead.
HARNESS_STEP_IDS = {"1", "1.5", "2", "2.6", "3", "3.5", "4", "5", "6", "7", "8"}  # 11
HARNESS_SUBPATHS = {
    ("2", "INLINE"), ("2", "WORKFLOW"),
    ("4", "INLINE"), ("4", "WORKFLOW"),
    ("5", "INLINE"), ("5", "WORKFLOW"),
}  # 6
HARNESS_FILES = {"skills/harness/SKILL.md"}  # the whole of skills/harness/*.md
HARNESS_MIN_CROSS_FILES = 7  # FILES, not occurrences: prose rewording must not trip it
# Anchors that are genuinely not headings. The value is the literal that MUST exist in the
# target -- an allowlist that is never compared against the file is a pass, not a check.
HARNESS_NON_HEADING_ANCHORS = {
    "Conventions injection rule": "**Conventions injection rule (used by Step 2):**",
}


# Files whose `<path>` §<Section> references are machine-checked, each with the MODE
# that fits its own heading style. Each entry is {"path": ..., "mode": ...} plus
# whatever keys that mode requires -- see the harness-steps entry below.
#
# ORIGINAL SCOPING JUDGEMENT, KEPT (2026-08, when the list held one file) -- do not read
# it as still describing the whole list:
#   "Deliberately scoped to `workflows/_reference/` rather than generic: many §references
#   in this repository legitimately point at something that is NOT an exact `## §` heading
#   -- a bullet (skills/study/SKILL.md documents `§Allowed Writes` as a Key Rules bullet),
#   a prefix-matched heading (`§Mode Gate` vs the full `## Mode Gate -- path & mode
#   resolution ...`), or a section of the citing file itself (`§3.4a`). A generic check
#   would fail on all of those, so it would be turned off."
#   What this DOES guard is the one case with no other guard at all: a skill that moved
#   its measurement record into a side file and now cites it by section name.
#
# WHAT CHANGED (2026-09-03): that judgement was right about a GENERIC check and is why
# this is still not one. The list did not become generic -- it gained a SECOND entry with
# its OWN mode. `skills/harness/SKILL.md` has zero `## §Name` headings, so extending
# "anchor-heading" to it would fail on every pointer; the "harness-steps" mode instead
# checks only the `§Step N(.N)` family plus path-anchored cross-file pointers, and
# discloses the 200 in-file citations it does not check (module docstring
# §What this does not check). All three "would fail" shapes quoted above remain
# unchecked -- note that the disclosure counts categories rather than naming these three
# by example, and that two of them (`§Allowed Writes`, `§3.4a`) live in other files
# entirely, so nothing here brought them under a check either.
#
# Entry condition for a third entry: state its mode, measure the citation families in
# that file first, pin whatever the mode compares against with zero slack, and supply
# every key that mode requires (_MODE_REQUIRED_KEYS below names them).
#
# WHAT CHANGED (2026-09-04): "harness-steps" was parameterised per target. Its five
# knobs -- step_ids / subpaths / files / min_cross_files / non_heading_anchors -- now
# live in the ENTRY rather than in module scope. `_check_harness_steps` took a path
# argument but read all five as module globals, so two targets under this mode shared
# ONE set of pins and neither could satisfy it. Measured before this change on a
# scratch copy split at the Step 4 boundary into `skills/harness-build/`: the split
# alone failed with 54 failures, and registering the new file under "harness-steps"
# exactly as ROADMAP's W7 conditional-`go` instructs made it 70. This commit is that
# instruction's missing prerequisite, landed on its own so the split it enables can be
# reviewed separately. Behaviour for the two entries below is unchanged: same pins,
# read from a different place.
#
# A SECOND harness-steps entry must supply all five. `min_cross_files` is the one most
# easily got wrong: it floors how many OTHER files carry a path-anchored §pointer at
# THAT target, so for a newly created file nothing points at yet it is 1, not the 7
# pinned for `skills/harness/SKILL.md`.
SECTION_REF_TARGETS = [
    {"path": "workflows/_reference/study_measurements.md", "mode": "anchor-heading"},
    {
        "path": "skills/harness/SKILL.md",
        "mode": "harness-steps",
        # The constants keep their names so every existing reference to them still
        # resolves. Measured 2026-09-04, and only two such references exist:
        # CLAUDE.md §Verification and ROADMAP.md's W7 row. This module's own docstring
        # does NOT name them -- an earlier revision of this comment said it did.
        # What moved is where the checker READS them from.
        "step_ids": HARNESS_STEP_IDS,
        "subpaths": HARNESS_SUBPATHS,
        "files": HARNESS_FILES,
        "min_cross_files": HARNESS_MIN_CROSS_FILES,
        "non_heading_anchors": HARNESS_NON_HEADING_ANCHORS,
    },
]

# Keys a mode REQUIRES on its entry. Checked before dispatch so a target added without
# its pins fails with a message naming them, not with a KeyError traceback.
_MODE_REQUIRED_KEYS = {
    "anchor-heading": (),
    "harness-steps": (
        "step_ids",
        "subpaths",
        "files",
        "min_cross_files",
        "non_heading_anchors",
    ),
}


def _fail(msg: str) -> None:
    print(f"[verify_sync_markers] FAIL section-ref: {msg}", file=sys.stderr)


def _headings(text: str) -> list[str]:
    """ATX heading texts, code fences skipped (a fenced `# ...` line is not a heading).

    `rstrip("\\r")` is load-bearing, not tidiness: HEAD_LINE_RE ends `[ \\t]*$`, which a
    trailing CR does not satisfy, so on a CRLF working tree this would return ZERO
    headings and every layer below would fail for a reason unrelated to its subject.
    `.gitattributes` pins `*.md text eol=lf` so a fresh checkout is LF, but its own
    limits section records that an already-written working tree keeps CRLF -- and the
    neighbouring anchor-heading mode is immune, so without this the new mode would be
    strictly more fragile than the one it sits beside.
    """
    out, fence = [], False
    for line in text.split("\n"):
        line = line.rstrip("\r")
        if FENCE_RE.match(line):
            fence = not fence
            continue
        if fence:
            continue
        m = HEAD_LINE_RE.match(line)
        if m:
            out.append(m.group(2))
    return out


def _heading_index(headings: list[str]) -> set[str]:
    """Every string a cross-file pointer may legitimately abbreviate a heading to."""
    idx: set[str] = set()
    for h in headings:
        c = CUT_RE.search(h)
        key = (h[: c.start()] if c else h).strip().rstrip(":").strip()
        for v in (h, key):
            idx.add(v)
            idx.add(v.replace("`", ""))
        n = re.match(r"^(\d+)\.\s", h)
        if n:
            idx.add(n.group(1))
    return idx


def _resolve(core: str, idx: set[str], extra=()) -> str | None:
    """Longest-prefix reduction: `§Step 3.5 Slice Plan's row` -> `Step 3.5`."""
    s = CONT_RE.sub(" ", core.lstrip("§")).strip()
    toks = [x for x in s.split(" ") if x]
    for n in range(len(toks), 0, -1):
        cand = re.sub(r"[’']s$", "", " ".join(toks[:n])).rstrip(".,;:)”\"'&")
        if cand and (cand in idx or cand in extra):
            return cand
    return None


def _check_harness_steps(entry: dict) -> int:
    """Six layers over one harness-steps target. Returns that target's failure count.

    Every pin comes from `entry`, never from module scope: two targets under this mode
    would otherwise share one set of pins and neither could satisfy it. The five keys
    are guaranteed present by check_section_refs()'s _MODE_REQUIRED_KEYS check.
    """
    target_rel = entry["path"]
    step_ids_pin = entry["step_ids"]
    subpaths_pin = entry["subpaths"]
    files_pin = entry["files"]
    min_cross_files = entry["min_cross_files"]
    non_heading_anchors = entry["non_heading_anchors"]
    target = ROOT / target_rel
    if not target.exists():
        _fail(f"target file missing: {target_rel}")
        return 1
    text = target.read_text(encoding="utf-8")
    heads = _headings(text)
    idx = _heading_index(heads)
    bad = 0

    # 1. PIN-STEP -- canonical Step ids, multiset (a duplicated id is also a failure).
    ids = [m.group(1) for h in heads for m in [CANON_STEP_RE.match(h)] if m]
    if collections.Counter(ids) != collections.Counter(step_ids_pin):
        bad += 1
        _fail(
            f"{target_rel} canonical Step ids {sorted(ids)} != pinned "
            f"{sorted(step_ids_pin)} -- update this target's 'step_ids' in "
            f"SECTION_REF_TARGETS in this change"
        )
    # 2. PIN-SUBPATH -- `Step N — INLINE|WORKFLOW path` sub-headings.
    subs = [
        (m.group(1), m.group(2)) for h in heads for m in [SUBPATH_HEAD_RE.match(h)] if m
    ]
    if set(subs) != subpaths_pin or len(subs) != len(subpaths_pin):
        bad += 1
        _fail(
            f"{target_rel} sub-path headings {sorted(subs)} != pinned "
            f"{sorted(subpaths_pin)} -- update this target's 'subpaths' in "
            f"SECTION_REF_TARGETS in this change"
        )
    # 3. PIN-ANCHOR / PIN-FILES -- non-heading anchors and the file set itself.
    for anchor, literal in non_heading_anchors.items():
        if literal not in text:
            bad += 1
            _fail(
                f"{target_rel} no longer contains the literal for non-heading anchor "
                f"{anchor!r}: {literal!r}"
            )
    target_dir = (ROOT / target_rel).parent
    glob_label = str(target_dir.relative_to(ROOT)).replace("\\", "/") + "/*.md"
    present = {
        str(p.relative_to(ROOT)).replace("\\", "/") for p in target_dir.glob("*.md")
    }
    if present != files_pin:
        bad += 1
        _fail(
            f"{glob_label} is {sorted(present)} != pinned {sorted(files_pin)} "
            f"-- a split must register each new file in SECTION_REF_TARGETS, giving that "
            f"entry its OWN files/step_ids/subpaths/min_cross_files/non_heading_anchors "
            f"pins, in the same change. "
            f"NOTE: this glob only sees {glob_label}, so a split into ANOTHER skill "
            f"directory is invisible to this pin -- see the module docstring's limit 5"
        )

    id_set, sub_set = set(ids), set(subs)

    # 4. SELF-STEP -- in-file `§Step N`, minus citations anchored to another file.
    foreign_at = {
        m.end() - len("§Step")
        for m in PATH_ANCHOR_RE.finditer(text)
        if m.group(1) != target_rel
    }
    in_scope = foreign = 0
    for m in STEP_CITE_RE.finditer(text):
        if m.start() in foreign_at:
            foreign += 1
            continue
        in_scope += 1
        if m.group(1) not in id_set:
            bad += 1
            _fail(
                f"{target_rel}:{text.count(chr(10), 0, m.start()) + 1} cites "
                f"§Step {m.group(1)}, which is not a canonical Step heading there"
            )

    # 5. SUBPATH-CITE -- the `Step N — INLINE|WORKFLOW path` family, scoped the same way
    # layer 4 is. NOT repository-wide in two senses, both of which are real:
    #   (a) iter_files() covers SCAN_DIRS only, so root documents are never scanned;
    #   (b) `skills/migrate/SKILL.md` and `skills/refactor/SKILL.md` own sub-path headings
    #       of their OWN (measured: `Step 5 — INLINE path` / `Step 5 — WORKFLOW path` in
    #       each). Judging every such citation tree-wide against this target's subpaths
    #       pass a migrate-owned citation coincidentally -- harness happens to pin id 5
    #       too -- and would turn it red the day harness stops doing so. That is the
    #       silent wrong-attribution layer 4's PATH_ANCHOR_RE already guards against, so
    #       this layer takes the same rule rather than the opposite one.
    # In scope: citations inside the target itself, plus citations elsewhere that carry
    # the target's own path anchor.
    subpath_anchor_re = re.compile(
        r"(?:\{CLAUDE_PLUGIN_ROOT\}/)?" + re.escape(target_rel) + r"`?[ \t\n]*§Step"
    )
    sub_cites = 0
    for p in iter_files():
        try:
            txt = p.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        anchored = {m.end() - len("§Step") for m in subpath_anchor_re.finditer(txt)}
        # Same exclusion layer 4 applies, and for the same reason: a citation carrying
        # ANOTHER file's path anchor is that file's business even when it sits inside
        # this target. Layer 4 did this from the start; layer 5 only narrowed p !=
        # target, so an anchored pointer in the target itself was judged against the
        # target's own pins. Harmless while nothing points out of this file (measured
        # 2026-09-04: 0 such citations, so this changes no current count) -- and a
        # deterministic false FAIL the moment a split makes one, which is exactly the
        # tail-retained split REMEASURE-split.md §2.4 adopts: its 3 sub-path citations
        # at Steps 4 and 5 stay in this file and get re-anchored at the new one.
        foreign_sub = {
            m.end() - len("§Step")
            for m in PATH_ANCHOR_RE.finditer(txt)
            if m.group(1) != target_rel
        }
        for m in SUBPATH_CITE_RE.finditer(txt):
            if m.start() in foreign_sub:
                continue  # anchored at another file -- not this target's
            if p != target and m.start() not in anchored:
                continue  # another file's own sub-path section -- not this target's
            sub_cites += 1
            if (m.group(1), m.group(2)) not in sub_set:
                bad += 1
                _fail(
                    f"{p.relative_to(ROOT)}:{txt.count(chr(10), 0, m.start()) + 1} cites "
                    f"{m.group(0).strip()!r}, which is not a sub-path heading in {target_rel}"
                )

    # 6. CROSS -- path-anchored pointers only. `basename` matching is deliberately NOT
    # used here: 17 skills share the basename `SKILL.md`, so it cannot tell which file a
    # pointer means.
    ref_re = re.compile(
        re.escape(target_rel)
        + rf"`?{_SEP}(?:—{_SEP})?({SECTION_ANY})(?:{_SEP}and{_SEP}({SECTION_ANY}))?"
    )
    used: set[str] = set()
    files: set[str] = set()
    total = 0
    for p in iter_files():
        if p == target:
            continue
        try:
            txt = p.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        if target_rel not in txt:
            continue
        for m in ref_re.finditer(txt):
            for g in m.groups():
                if not g:
                    continue
                total += 1
                files.add(str(p.relative_to(ROOT)))
                r = _resolve(g, idx)
                if r is None:
                    r = _resolve(g, set(), non_heading_anchors.keys())
                    if r is not None:
                        used.add(r)
                if r is None:
                    bad += 1
                    _fail(
                        f"{p.relative_to(ROOT)}:{txt.count(chr(10), 0, m.start()) + 1} cites "
                        f"{target_rel} {g.replace(chr(10), ' ')!r}, which resolves to no "
                        f"heading there"
                    )
    if len(files) < min_cross_files:
        bad += 1
        _fail(
            f"{len(files)} file(s) carry a path-anchored {target_rel} §pointer, "
            f"expected >= {min_cross_files} (this target's min_cross_files pin)"
        )
    for dead in set(non_heading_anchors) - used:
        bad += 1
        _fail(
            f"{target_rel}: non_heading_anchors entry {dead!r} is never used by any "
            f"pointer -- remove it rather than leaving a stale allowlist entry"
        )

    if not bad:
        print(
            f"[verify_sync_markers] OK: {total} cross-file section ref(s) from "
            f"{len(files)} file(s) -> {target_rel}"
        )
        print(
            f"[verify_sync_markers] OK: {in_scope} in-file §Step ref(s) -> "
            f"{len(id_set)} pinned Step id(s); {sub_cites} §Step N — INLINE|WORKFLOW path "
            f"ref(s) -> {len(sub_set)} pinned sub-path heading(s); {foreign} "
            f"foreign-anchored §Step ref(s) OUT OF SCOPE (see module docstring "
            f"§What this does not check)"
        )
    return bad


def _check_anchor_heading(entry: dict) -> int:
    """The original `## §Section` check. Returns this target's failure count.

    Takes the whole entry, not a path, so both modes share one dispatch signature.
    This mode requires no extra keys -- _MODE_REQUIRED_KEYS records that as an empty
    tuple rather than by omission, so a mode missing from that table is a bug rather
    than a silent "requires nothing" default.
    """
    target_rel = entry["path"]
    bad = 0
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


_SECTION_REF_MODES = {
    "anchor-heading": _check_anchor_heading,
    "harness-steps": _check_harness_steps,
}


def check_section_refs() -> int:
    """Run each target under its own mode. Returns total unresolved references.

    The per-target counter matters: with one shared counter, a first target that
    fails would suppress the SECOND target's OK line, reporting a green target as
    silent. Each entry reports its own result.
    """
    bad = 0
    for entry in SECTION_REF_TARGETS:
        checker = _SECTION_REF_MODES.get(entry["mode"])
        if checker is None:
            print(
                f"[verify_sync_markers] FAIL section-ref: unknown mode "
                f"{entry['mode']!r} for {entry['path']}",
                file=sys.stderr,
            )
            bad += 1
            continue
        required = _MODE_REQUIRED_KEYS.get(entry["mode"])
        if required is None:
            print(
                f"[verify_sync_markers] FAIL section-ref: mode {entry['mode']!r} has a "
                f"checker but no _MODE_REQUIRED_KEYS entry -- add one (an empty tuple "
                f"when the mode needs no extra keys) rather than leaving the table "
                f"incomplete",
                file=sys.stderr,
            )
            bad += 1
            continue
        missing = [k for k in required if k not in entry]
        if missing:
            print(
                f"[verify_sync_markers] FAIL section-ref: {entry['path']}: mode "
                f"{entry['mode']!r} entry is missing {missing} -- every key a mode "
                f"requires must be pinned on the entry itself",
                file=sys.stderr,
            )
            bad += 1
            continue
        bad += checker(entry)
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
