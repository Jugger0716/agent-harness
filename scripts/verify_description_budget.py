#!/usr/bin/env python3
"""Verify per-skill description caps and the total description-budget ratchet.

Run manually and on push/PR via .github/workflows/lint.yml (pre-commit hook wiring
is still a later-phase TODO). The lint.yml wiring lands in this slice's THIRD commit
(C3); between this commit and that one, check_lint_wiring.sh reports this script as
present-but-unwired, which is expected and not a regression.

MEASUREMENT BASIS
-----------------
Fixed here BEFORE any total was written down, because the sum differs by basis:

  (a) the frontmatter ``description`` value is measured with its outer YAML quotes
      REMOVED;
  (b) a CRLF carriage return is excluded (this repository is edited on Windows with
      core.autocrlf=true, so ``re.M`` leaves a trailing ``\\r`` before ``$``);
  (c) length is a count of UTF-8 CHARACTERS via ``len()``, never bytes. Eleven of the
      seventeen skills contain typographic characters, so bytes and characters differ.

The raw total is exactly 6 characters larger than the unquoted total, and those 6
characters are the outer double quotes of the three deprecation stubs (2 chars x 3);
no other skill quotes its description. Measured pairs, each tagged with the commit
they were taken at -- a bare total without a SHA goes stale silently:

    18b5e47   7,660 unquoted / 7,666 raw
    4295156   7,709 unquoted / 7,715 raw

FIGURE PROVENANCE -- four classes, each with its own required annotation
-----------------------------------------------------------------------
  * repository measurements ................ commit SHA
  * the ceiling re-fixed in this very commit  "at this commit"  (it cannot cite its
                                              own SHA)
  * chosen targets and caps ................ the projection they came from
  * external specification limits .......... the fetch date

EXTERNAL SPECIFICATION LIMITS (fetched 2026-08-31)
--------------------------------------------------
  * description cap 1024 characters -- CONFIRMED, but on the Agent Skills SPEC
    surface only:
      https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview.md
      https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices.md
    The Claude Code surface document does NOT state 1024; what it states is the
    per-entry skill-listing truncation of 1,536 characters:
      https://code.claude.com/docs/en/skills.md   (section: Skill descriptions are cut short)
    This lint enforces 1024 as the conservative ceiling and says so rather than
    claiming the Claude Code surface confirms it.
  * skill-listing per-entry truncation 1536 characters (skillListingMaxDescChars,
    default 1536) and listing budget 1% of the context window
    (skillListingBudgetFraction, default 0.01) with a fallback of 8,000 characters
    (SLASH_COMMAND_TOOL_CHAR_BUDGET):
      https://code.claude.com/docs/en/settings-reference.md
      https://code.claude.com/docs/en/env-vars.md
    When the listing overflows, Claude Code drops the descriptions of the least-used
    skills while keeping every name -- a silent failure with no message to the user.
    That behaviour, not the 1024 cap, is why this ratchet exists.
  * Do NOT write "2%" or "16,000 characters". Those figures are not merely absent
    from the official documentation: they are WRONG. The documented values are 1%
    and 8,000, and 2% appears only as an example of RAISING the budget.

RATCHET CONVENTION
------------------
Lowering any description is free. RAISING one past its recorded ceiling requires
raising that ceiling explicitly in the same commit. This is the same direction as
``min_sites`` in verify_sync_markers.py, but it is NOT the same guarantee: a single
total is fungible across skills, so per-skill ceilings are recorded alongside it.
Lower bounds exist for the descriptions this slice shortens, because a total ceiling
alone approves unlimited shrinkage -- and over-shrinking is this slice's actual risk.

EXIT CODES
----------
  0  pass
  1  violation found
  2  structural problem
"""

import argparse
import os
import re
import sys
from pathlib import Path

SKILLS_GLOB = "skills/*/SKILL.md"

# External specification limit (fetched 2026-08-31; spec surface -- see module docstring).
PER_SKILL_CAP = 1024

# --------------------------------------------------------------------------------
# C2 RE-FIX BLOCK -- the trimming commit updates every constant below in one commit,
# using its own end-of-commit measurement. Nothing outside this block is re-fixed.
# --------------------------------------------------------------------------------

# Repository measurement at this commit (C2) -- a ceiling re-fixed in the commit that
# creates it cannot cite its own SHA, so it is annotated this way rather than left bare.
# Was 7709 at 4295156, before this slice trimmed four descriptions.
TOTAL_CEILING = 6841

# Per-skill ceilings (unquoted basis). Untouched skills keep their 4295156 measurement;
# the five this commit edits are re-fixed at this commit. The three stub ceilings are the
# lengths of the target wordings the epic plan fixed, not a projection.
PER_SKILL_CEILING = {
    "code-review": 45,   # at this commit (C2); was 226 at 4295156
    "codebase-audit": 410,
    "debug": 495,
    "deep-review": 668,
    "handoff": 617,
    "harness": 470,
    "md-generate": 469,
    "md-optimize": 194,
    "memory": 45,     # at this commit (C2); was 229 at 4295156
    "migrate": 397,
    "refactor": 329,
    "ship": 520,
    "spec": 595,      # at this commit (C2); was 594 at 4295156. Raised by exactly the
                      # one character the YAML repair costs (": " -> " -- " em dash).
    "study": 662,     # at this commit (C2); was 1009 at 4295156
    "team-memory": 412,
    "test-gen": 472,
    "workflow": 41,   # at this commit (C2); was 198 at 4295156
}

# Lower bounds for the descriptions this slice shortens, set from the landed text at this
# commit (C2) with deliberate slack below it. A total ceiling alone approves unlimited
# shrinkage, and over-shrinking -- a skill that silently stops being selected -- is this
# slice's actual risk. The required-token lists below already pin the content; these bounds
# are the backstop for a future edit that guts a description while keeping its tokens.
LOWER_BOUND = {
    "study": 600,        # landed 662 at this commit (C2)
    "code-review": 30,   # landed 45
    "memory": 30,        # landed 45
    "workflow": 30,      # landed 41
}

# --------------------------------------------------------------------------------
# End of C2 RE-FIX BLOCK
# --------------------------------------------------------------------------------

# Tokens that must survive the trim, and tokens the trim must remove. Both lists are
# the machine form of the plan's preserve/remove classification; without them a trim
# that satisfies the character target while deleting the discriminating tokens passes
# every other check.
REQUIRED_TOKENS = {
    "study": [
        "study guide",
        "3-tier study guide",
        "concept explanation",
        "real code excerpts",
        "interview Q&A",
        "hands-on exercises",
        "engineering principles",
        "anti-patterns",
        "glossary",
        "verified revision material",
        "not a usage guide",
        "transferable technical knowledge",
        "engineering judgment",
        "Machine-checked provenance",
        "repo-quote re-verification",
        "inference-vs-repo claim basis",
        "HTML report",
        "/harness",
        "project",
        "git diff",
    ],
}

FORBIDDEN_TOKENS = {
    "study": [
        "3-tier mode",
        "opt-in gated",
        "WebSearch/WebFetch are disallowed",
        "structurally unverified",
    ],
}

# First and second person is a discovery hazard: the description is injected into the
# system prompt and an inconsistent point of view degrades skill selection
# (best-practices, Writing effective descriptions, fetched 2026-08-31).
POV_RE = re.compile(r"(?<![\w/-])(I|we|our|us|you|your|my|me)(?![\w/-])", re.I)

# Skills whose descriptions violate the third-person rule today. Both are outside this
# slice's scope. The allowlist is zero-slack in both directions: an entry that stops
# violating is itself an error, so a fixed description cannot leave a stale entry behind.
POV_ALLOWLIST = {
    "handoff": "pre-existing 'you' in the resume-gate sentence; outside this slice's scope",
    "spec": "pre-existing 'you' in the when-to-use sentence; outside this slice's scope",
}

DESC_RE = re.compile(r"^description:[ \t]*(.*)$", re.M)


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def split_frontmatter(text: str, skill: str, problems: list) -> str:
    """Return the frontmatter body delimited by the FIRST TWO bare '---' lines.

    Counting '---' lines in the whole file is wrong: five skills use horizontal rules
    in their body, one of them sixteen times.
    """
    lines = text.replace("\r\n", "\n").split("\n")
    marks = [i for i, line in enumerate(lines) if line.strip() == "---"]
    if len(marks) < 2:
        problems.append("%s: fewer than two '---' delimiter lines" % skill)
        return ""
    return "\n".join(lines[marks[0] + 1:marks[1]])


def unquote(value: str):
    """Strip one matched pair of outer quotes. Returns (value, was_quoted)."""
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1], True
    return value, False


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.parse_args()

    root = repo_root()
    paths = sorted(root.glob(SKILLS_GLOB))
    if not paths:
        print("[verify_description_budget] no %s found" % SKILLS_GLOB, file=sys.stderr)
        return 2

    problems = []
    rows = []
    total_unquoted = 0
    total_raw = 0

    for path in paths:
        skill = path.parent.name
        text = path.read_text(encoding="utf-8")
        body = split_frontmatter(text, skill, problems)
        if not body:
            continue

        matches = DESC_RE.findall(body)
        if len(matches) != 1:
            problems.append(
                "%s: expected exactly one 'description:' line inside the frontmatter, found %d"
                % (skill, len(matches))
            )
            continue

        raw = matches[0].replace("\r", "").strip()
        if not raw:
            problems.append("%s: description is empty" % skill)
            continue

        value, quoted = unquote(raw)
        if value.startswith("[") and not quoted:
            problems.append(
                "%s: description starts with '[' but is not quoted -- YAML reads it as a flow sequence"
                % skill
            )
        if not quoted and ": " in value:
            problems.append(
                "%s: unquoted plain scalar contains ': ' -- YAML cannot parse this and the skill "
                "does not load" % skill
            )

        length = len(value)
        total_unquoted += length
        total_raw += len(raw)
        rows.append((skill, length, len(raw), quoted))

        if length > PER_SKILL_CAP:
            problems.append(
                "%s: %d characters exceeds the %d cap by %d"
                % (skill, length, PER_SKILL_CAP, length - PER_SKILL_CAP)
            )

        ceiling = PER_SKILL_CEILING.get(skill)
        if ceiling is None:
            problems.append("%s: no per-skill ceiling recorded -- add one in the same commit" % skill)
        elif length > ceiling:
            problems.append(
                "%s: %d characters exceeds its recorded ceiling %d by %d -- raise the ceiling "
                "explicitly in this commit or shorten the description"
                % (skill, length, ceiling, length - ceiling)
            )

        floor = LOWER_BOUND.get(skill)
        if floor is not None and length < floor:
            problems.append(
                "%s: %d characters is below its recorded lower bound %d -- a description this "
                "short has lost trigger signal" % (skill, length, floor)
            )

        for token in REQUIRED_TOKENS.get(skill, []):
            if token not in value:
                problems.append("%s: required token missing: %r" % (skill, token))
        for token in FORBIDDEN_TOKENS.get(skill, []):
            if token in value:
                problems.append("%s: forbidden token still present: %r" % (skill, token))

        hits = sorted({m.group(0) for m in POV_RE.finditer(value)})
        if hits:
            if skill not in POV_ALLOWLIST:
                problems.append(
                    "%s: first/second person in description: %s" % (skill, ", ".join(hits))
                )
        elif skill in POV_ALLOWLIST:
            problems.append(
                "%s: listed in POV_ALLOWLIST but no longer violates -- remove the entry in this "
                "commit" % skill
            )

    if problems:
        for line in problems:
            print("[verify_description_budget] FAIL: %s" % line, file=sys.stderr)
        return 1

    for skill, length, raw_len, quoted in rows:
        ceiling = PER_SKILL_CEILING[skill]
        print(
            "  %-16s %5d chars  (raw %5d%s)  ceiling %5d  slack %4d"
            % (skill, length, raw_len, " q" if quoted else "  ", ceiling, ceiling - length)
        )
    delta = total_raw - total_unquoted
    print(
        "[verify_description_budget] OK: %d skills, total %d chars (raw %d, delta %d), "
        "ceiling %d, slack %d"
        % (len(rows), total_unquoted, total_raw, delta, TOTAL_CEILING, TOTAL_CEILING - total_unquoted)
    )

    if total_unquoted > TOTAL_CEILING:
        print(
            "[verify_description_budget] FAIL: total %d exceeds the ceiling %d by %d -- lower a "
            "description or raise TOTAL_CEILING explicitly in this commit"
            % (total_unquoted, TOTAL_CEILING, total_unquoted - TOTAL_CEILING),
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
