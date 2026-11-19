#!/usr/bin/env python3
"""Verify skill body size ceilings, the /handoff load budgets and the dated-marker ban.

Cap the size of every skill body and of what each /handoff call loads, and ban dated
measurement markers and planning tags in the /handoff contract.

Intended invocation: run manually and on push/PR via .github/workflows/lint.yml
(pre-commit hook wiring is still a later-phase TODO). It is wired there in the same commit
that created it, so check_lint_wiring.sh has never seen it unwired.

MEASUREMENT BASIS
-----------------
Fixed here BEFORE any size was written down, because a byte count differs by basis:

  (a) a file is read as BINARY, decoded as strict UTF-8 with its carriage returns still in
      place, and only then has every carriage return (0x0D) removed before it is counted.
      This repository is edited on Windows with core.autocrlf=true, so a working tree copy
      can be CRLF where the committed blob is LF; the CR must not count. The order matters:
      removing CRs first would let a CR that splits a multi-byte sequence heal a damaged file;
  (b) the unit is BYTES of the UTF-8 encoding, never characters. The bodies are mostly ASCII
      but carry multi-byte characters (em dashes, arrows, some Korean), so bytes and
      characters differ; the description lint counts characters, this one deliberately does
      not;
  (c) a UTF-8 BOM is not stripped and not tolerated: it is a structural problem (exit 2),
      because a BOM would silently add 3 bytes to one file and none to its LF-clean twin;
  (d) a file that is not valid UTF-8 is a structural problem too, even though only its size
      is budgeted, so a damaged file cannot pass as a small one.

What is measured: ``len(raw_bytes.decode("utf-8").replace("\\r", "").encode("utf-8"))``,
which for valid UTF-8 is the byte count with every 0x0D removed. A "load" is the plain SUM
of the measured files it names; nothing is deduplicated or discounted.

WHAT THIS CHECKS
----------------
  a. PER-SKILL BODY RATCHET. The SKILL.md of each of the six skills (handoff, harness,
     harness-gate, harness-build, deep-review, md-optimize) is at most its recorded
     ceiling, which is its measured size with zero slack.
  b. HANDOFF LOADS. Three named loads, each with a ceiling equal to its measured size:
       generate          skills/handoff/SKILL.md + templates/handoff/generate.md
       generate+ledger   generate + templates/handoff/generate-ledger.md (read only when
                         a multi-slice epic ledger applies)
       resume            skills/handoff/SKILL.md + templates/handoff/resume.md
     templates/handoff/generate-ledger.md also has a ceiling of its own. On top of the
     ratchet, the generate load is held to a hard SPEC cap (GENERATE_LOAD_SPEC_CAP, 15,360
     bytes): a measured generate load above it fails even if its ratchet ceiling was
     raised, and a ratchet ceiling above it is a mis-edit. Every templates/handoff/*.md
     must be named by a load or have a ceiling of its own, so text moved out of
     generate.md into a new template cannot leave the budget; an unbudgeted one is a
     structural problem.
  c. DATED-MARKER AND PLANNING-TAG BAN over skills/handoff/SKILL.md and every
     templates/handoff/*.md: no line matching ``(Observed|Measured|MEASURED|OBSERVED)``
     followed within 40 non-period characters by ``20dd``, and none carrying a planning
     identifier (``AC-<n>``, ``P0-<n>``, ``spec D-<n>``). A measurement history and a
     rejected alternative belong in design/handoff-diet/RATIONALE.md, not in a file a model
     loads on every call. This is the lint-side twin of the contract test
     ``handoff-contract-carries-no-dated-observation-or-planning-tag`` in
     tests/handoff/cases.mjs and uses the same patterns, ASCII-only like their JS originals
     (see the re.ASCII note at the patterns).

FIGURE PROVENANCE -- each figure is tagged with where it came from
------------------------------------------------------------------
  * every ceiling below ..................... "at this commit" (measured in the very commit
                                              that created the lint, so it cannot cite its
                                              own SHA); the live source for the current
                                              figures is the table this script prints
  * GENERATE_LOAD_SPEC_CAP 15,360 ........... a chosen target, not a measurement: the
                                              "15KB or less" completion criterion of
                                              design/v9-subtraction/SPEC.md section 3.3
                                              (Body reduction), made exact as 15 KiB by the
                                              stage-3 plan, design/v9-subtraction/STAGE3.md
                                              decision D2 (a load is the sum of every file
                                              the call reads, so splitting a file does not
                                              move it)
  * no external specification limit is used here.

At this commit: the generate load is 15,291 bytes (skills/handoff/SKILL.md 6,410 +
templates/handoff/generate.md 8,881), 69 bytes under the cap; generate+ledger is 20,989;
resume is 38,007 (6,410 + templates/handoff/resume.md 31,597).

RATCHET CONVENTION
------------------
Lowering a file is free: the OK line prints ``slack`` per item, so a shrunk file shows up as
slack, and the ceiling can then be lowered in a later commit to keep the budget tight.
RAISING a file past its recorded ceiling requires raising that ceiling explicitly in the same
commit. This is the same direction as the ceilings in verify_description_budget.py. The SPEC
cap is the one figure a ceiling raise cannot buy: past it the body has to shrink.

WHAT THIS DOES NOT CHECK
------------------------
  * It does not forgive growth. The ratchet ceilings have zero slack, so ANY future edit
    to skills/handoff/SKILL.md or templates/handoff/generate.md must be byte-neutral or raise
    the affected ceilings in the same commit: an edit to SKILL.md moves four ceilings at once
    (skill:handoff and all three loads), an edit to generate.md moves two (load:generate and
    load:generate+ledger). The room under the SPEC cap is 69 bytes at this commit (15,360
    minus 15,291), so a raise of the generate ceiling has at most that much to give.
  * It does not read optional loads that happen at run time. The JSON printed by
    skills/handoff/scripts/handoff.mjs, a document's Reading Order entries, and any shared
    template a call reads on demand are outside every budget here; only the files named in
    LOAD_FILES are counted.
  * It does not look at RATIONALE: design/ is outside every budget and every scan. That is
    where moved measurements live, and it is why the marker ban can be strict.
  * It counts bytes, which are a proxy for the context a call occupies, not tokens. Bytes per
    token differ by script, so a byte-neutral edit that swaps one kind of text for another can
    still change the real cost.
  * It budgets SKILL.md bodies, not what a body points at. Text moved out of a body into a
    template the skill always reads passes the body ratchet; for /handoff the loads close
    that, for the other five skills nothing does.
  * It cannot know which call reads a template, only the lists it is given. A new
    templates/handoff/*.md fails as unbudgeted until it is listed, but listing it under its
    own ceiling only budgets its size: a template that /handoff generate always reads must
    be added to the ``generate`` entry of LOAD_FILES in the same commit, or the generate
    load under-counts what a call loads.
  * It does not stop a file from shrinking: an empty or truncated body passes, because
    lowering is free.
  * It does not repeat the contract test's rule that a template must not carry a bare
    ``§Non-Goals`` reference, and it scans the files it globs, where the test names four.

EXIT CODES
----------
  0  pass
  1  violation found: a ceiling or the SPEC cap exceeded, or a marker hit. A measured
     breach of the SPEC cap is reported as a violation even when the generate ceiling was
     also raised past the cap, so that combination exits 1 (with the mis-edit line printed
     too), not 2
  2  structural problem: a listed file is missing or unreadable, a BOM, a file that is not
     valid UTF-8, a skill with no recorded ceiling or a ceiling with no skill, a load with
     no ceiling or a ceiling with no file list, no ``generate`` load configured at all, a
     templates/handoff/*.md that no load names and no ceiling covers, or a ceiling
     configured for the generate load above the SPEC cap while the measured load is still
     within it
"""

import argparse
import re
import sys
from pathlib import Path

PREFIX = "[verify_body_budget]"

SKILLS_GLOB = "skills/*/SKILL.md"
HANDOFF_TEMPLATES_GLOB = "templates/handoff/*.md"

HANDOFF_SKILL = "skills/handoff/SKILL.md"
GENERATE_MD = "templates/handoff/generate.md"
LEDGER_MD = "templates/handoff/generate-ledger.md"
RESUME_MD = "templates/handoff/resume.md"

# Hard SPEC cap on what a `generate` call loads: design/v9-subtraction/SPEC.md §3.3 (Body
# reduction: the body loaded when generate is called is 15KB or less), made exact as 15 KiB
# by the stage-3 plan decision D2 (design/v9-subtraction/STAGE3.md). Do NOT raise this to
# make a build pass: the ratchet ceilings below are what a growing edit raises, and this cap
# exists precisely because a ceiling can always be raised. Change it only when the SPEC itself
# is revised.
GENERATE_LOAD_SPEC_CAP = 15360

# --------------------------------------------------------------------------------
# CEILINGS -- every value is its size measured at this commit (the commit that created the
# lint), with zero slack. Raise one only in the same commit as the growth that needs it.
# --------------------------------------------------------------------------------

# Per-skill SKILL.md body ceilings, in bytes (basis in the module docstring).
SKILL_BODY_CEILING = {
    "handoff": 6410,
    "harness": 82921,
    "harness-gate": 47179,
    "harness-build": 131965,
    "deep-review": 39997,
    "md-optimize": 20854,
}

# Files counted once per load, by named load. The names are what the table and a violation
# line print, after a `load:` prefix.
LOAD_FILES = {
    "generate": (HANDOFF_SKILL, GENERATE_MD),
    "generate+ledger": (HANDOFF_SKILL, GENERATE_MD, LEDGER_MD),
    "resume": (HANDOFF_SKILL, RESUME_MD),
}

LOAD_CEILING = {
    "generate": 15291,
    "generate+ledger": 20989,
    "resume": 38007,
}

# A template with a ceiling of its own, beyond the loads it belongs to. generate-ledger.md is
# read only when a multi-slice epic ledger applies, so no other budget would catch it alone.
FILE_CEILING = {
    LEDGER_MD: 5698,
}

# --------------------------------------------------------------------------------
# End of CEILINGS
# --------------------------------------------------------------------------------

# Same patterns as the contract test in tests/handoff/cases.mjs. re.ASCII makes \b and \d
# ASCII-only, as they are in JavaScript: without it a Hangul letter before `AC-1` is a word
# character in Python (no boundary, no hit) and not in JS (boundary, hit). `\d` and `\d+` are
# match-equivalent here, so `+` is kept for readability only.
# One difference remains: the `[^.]{0,40}` window counts Python code points but JS UTF-16 code
# units, so around astral characters (emoji) the two windows differ. The lint's window is the
# wider one, so it can flag a line the test misses and never the reverse: not a silent pass.
# Nothing checks the two regexes against each other mechanically -- when one is changed, change
# the other in the same commit.
DATED_RE = re.compile(r"(Observed|Measured|MEASURED|OBSERVED)[^.]{0,40}20[0-9]{2}", re.ASCII)
TAG_RES = (
    re.compile(r"\bAC-\d+", re.ASCII),
    re.compile(r"\bP0-\d+", re.ASCII),
    re.compile(r"spec D-\d", re.ASCII),
)

BOM = b"\xef\xbb\xbf"
LINE_CUT = 120


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def read_measured(root: Path, rel: str, structural: list):
    """Return (bytes_without_CR, text_without_CR) for one file, or None after recording why not.

    BOM is checked on the raw bytes and the decode is strict and runs BEFORE the CRs are
    removed, so neither a BOM nor a CR inside a multi-byte sequence can hide in a size.
    """
    path = root / rel
    if not path.is_file():
        structural.append("%s: missing, or not a regular file" % rel)
        return None
    try:
        raw = path.read_bytes()
    except OSError as exc:
        structural.append("%s: cannot be read (%s)" % (rel, exc.strerror or type(exc).__name__))
        return None
    if raw.startswith(BOM):
        structural.append("%s: starts with a UTF-8 BOM -- remove it; a BOM adds 3 bytes the LF twin does not have" % rel)
        return None
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        structural.append("%s: not valid UTF-8 (%s at byte %d)" % (rel, exc.reason, exc.start))
        return None
    text = text.replace("\r", "")
    return len(text.encode("utf-8")), text


def scan_markers(rel: str, text: str) -> list:
    """Return one 'path:line: text' hit per offending line, each tagged with its kind.

    Split on "\\n" only (as the contract test does), never splitlines(), which would also
    break on form feeds and Unicode separators and shift every later line number.
    """
    hits = []
    for lineno, line in enumerate(text.split("\n"), 1):
        kinds = []
        if DATED_RE.search(line):
            kinds.append("dated-marker")
        if any(r.search(line) for r in TAG_RES):
            kinds.append("planning-tag")
        if kinds:
            hits.append("%s %s:%d: %s" % ("+".join(kinds), rel, lineno, line.strip()[:LINE_CUT]))
    return hits


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.parse_args()

    # A hit line echoes contract text; a console that cannot encode it (cp949) must not turn
    # the report into a traceback.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(errors="backslashreplace")

    root = repo_root()
    structural = []

    # ---- configuration against what exists -----------------------------------------------
    skill_paths = sorted(root.glob(SKILLS_GLOB))
    skills_found = {p.parent.name for p in skill_paths}
    if not skills_found:
        structural.append("no %s found" % SKILLS_GLOB)
    for name in sorted(skills_found - set(SKILL_BODY_CEILING)):
        structural.append("skill %s: no body ceiling recorded -- add one in the same commit" % name)
    for name in sorted(set(SKILL_BODY_CEILING) - skills_found):
        structural.append("skill %s: has a body ceiling but skills/%s/SKILL.md does not exist" % (name, name))
    for name in sorted(set(LOAD_FILES) - set(LOAD_CEILING)):
        structural.append("load %s: no ceiling recorded -- add one in the same commit" % name)
    for name in sorted(set(LOAD_CEILING) - set(LOAD_FILES)):
        structural.append("load %s: has a ceiling but no file list in LOAD_FILES" % name)
    # The SPEC cap below is defined on the `generate` load, so a config without it cannot be judged.
    if "generate" not in LOAD_FILES or "generate" not in LOAD_CEILING:
        structural.append(
            "load generate: missing from LOAD_FILES or LOAD_CEILING -- the SPEC cap is defined on it"
        )
    template_rels = sorted(p.relative_to(root).as_posix() for p in root.glob(HANDOFF_TEMPLATES_GLOB))
    if not template_rels:
        structural.append("no %s found" % HANDOFF_TEMPLATES_GLOB)
    # Every handoff template is budgeted by a load or by a ceiling of its own: otherwise moving
    # text out of generate.md into a new file would take it out of every budget.
    budgeted = {f for files in LOAD_FILES.values() for f in files} | set(FILE_CEILING)
    for rel in template_rels:
        if rel not in budgeted:
            structural.append(
                "%s: unbudgeted handoff template -- add it to a load in LOAD_FILES or give it a "
                "FILE_CEILING entry in the same commit" % rel
            )

    # ---- read every file once ------------------------------------------------------------
    wanted = {"skills/%s/SKILL.md" % n for n in skills_found}
    wanted |= set(FILE_CEILING)
    wanted |= {f for files in LOAD_FILES.values() for f in files}
    wanted |= set(template_rels)
    wanted.add(HANDOFF_SKILL)
    measured = {}
    for rel in sorted(wanted):
        got = read_measured(root, rel, structural)
        if got is not None:
            measured[rel] = got

    if structural:
        for line in structural:
            print("%s STRUCTURAL: %s" % (PREFIX, line), file=sys.stderr)
        return 2

    # ---- the budgets ---------------------------------------------------------------------
    violations = []
    rows = []  # (item, bytes, ceiling)

    def budget(item: str, size: int, ceiling: int) -> None:
        rows.append((item, size, ceiling))
        if size > ceiling:
            violations.append(
                "%s: %d bytes exceeds its ceiling %d by %d -- raise the ceiling explicitly in this "
                "commit or shorten the file" % (item, size, ceiling, size - ceiling)
            )

    for name in sorted(SKILL_BODY_CEILING):
        budget("skill:%s" % name, measured["skills/%s/SKILL.md" % name][0], SKILL_BODY_CEILING[name])
    load_size = {}
    for name, files in LOAD_FILES.items():
        load_size[name] = sum(measured[f][0] for f in files)
        budget("load:%s" % name, load_size[name], LOAD_CEILING[name])
    for rel, ceiling in FILE_CEILING.items():
        budget("file:%s" % rel.rsplit("/", 1)[-1], measured[rel][0], ceiling)

    # The SPEC cap, checked on the measurement itself and on the configured ceiling: raising
    # the ratchet ceiling must neither hide an over-cap load nor pass as a legitimate edit.
    generate = load_size["generate"]
    if generate > GENERATE_LOAD_SPEC_CAP:
        violations.append(
            "load:generate: %d bytes exceeds the SPEC cap %d by %d -- the cap is not a ratchet "
            "ceiling and cannot be raised by editing one; shorten skills/handoff/SKILL.md or "
            "templates/handoff/generate.md (SPEC section 3.3)"
            % (generate, GENERATE_LOAD_SPEC_CAP, generate - GENERATE_LOAD_SPEC_CAP)
        )
    misedit = []
    if LOAD_CEILING["generate"] > GENERATE_LOAD_SPEC_CAP:
        misedit.append(
            "load:generate: configured ceiling %d is above the SPEC cap %d by %d -- a mis-edit; the "
            "ceiling is at most the cap"
            % (LOAD_CEILING["generate"], GENERATE_LOAD_SPEC_CAP, LOAD_CEILING["generate"] - GENERATE_LOAD_SPEC_CAP)
        )

    # ---- the marker and planning-tag scan ------------------------------------------------
    scan_files = [HANDOFF_SKILL] + template_rels
    hits = []
    for rel in scan_files:
        hits.extend(scan_markers(rel, measured[rel][1]))
    violations.extend(hits)

    if violations:
        for line in violations:
            print("%s FAIL: %s" % (PREFIX, line), file=sys.stderr)
        for line in misedit:
            print("%s STRUCTURAL: %s" % (PREFIX, line), file=sys.stderr)
        return 1
    if misedit:
        for line in misedit:
            print("%s STRUCTURAL: %s" % (PREFIX, line), file=sys.stderr)
        return 2

    for item, size, ceiling in rows:
        print("  %-24s %7d bytes  ceiling %7d  slack %5d" % (item, size, ceiling, ceiling - size))
    print("  %-24s %d files scanned, 0 hits" % ("handoff markers", len(scan_files)))
    print(
        "%s OK: %d items, handoff generate load %d/%d (SPEC cap %d)"
        % (PREFIX, len(rows), generate, LOAD_CEILING["generate"], GENERATE_LOAD_SPEC_CAP)
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
