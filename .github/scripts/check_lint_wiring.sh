#!/usr/bin/env bash
# Name-set equality between the lint scripts that exist and the ones lint.yml actually runs.
#
# Why a NAME SET and not a count: a count is satisfied by duplicates. Paste the same `- run:`
# step twice while adding a new lint and `wired == present` holds while that lint executes
# zero times in CI — the exact silent failure this batch exists to close.
#
# Why stage 1 keeps the LEADING anchor: dropping it also matches a COMMENTED-OUT step
# (`      # - run: ...`), so a disabled lint would read as wired. Measured. The trailing `$`
# anchor cannot be used because the node step ends in `2>&1 | tee ...`, hence two stages.
#
# Why stage 2 loops per line and `sort -u`s: `grep -o` returns EVERY match on a line, so a
# path mentioned twice on one step line (a diagnostic string, a YAML inline comment) would
# otherwise register as a duplicate step. Measured.
#
# Why the character class is [A-Za-z0-9_-]: it must be at least as wide as the right-hand
# glob `scripts/verify_*.py scripts/*.mjs`, or a digit/hyphen in a filename silently makes a
# correctly wired lint read as unwired. Measured.
#
# Lives in .github/scripts/ rather than scripts/ so it neither matches the `scripts/verify_*.py`
# glob it counts nor counts itself (`.sh` is outside NAME_RE).
set -euo pipefail
cd "$(dirname "$0")/../.."

YML=.github/workflows/lint.yml
NAME_RE='scripts/[A-Za-z0-9_-]+\.(py|mjs)'
test -f "$YML" || { echo "[check_lint_wiring] FAIL: $YML missing" >&2; exit 1; }

wired=$(grep -E '^[[:space:]]*- run: ' "$YML" \
        | while IFS= read -r l; do printf '%s\n' "$l" | grep -oE "$NAME_RE" | sort -u; done \
        | sed 's#.*/##' | sort || true)
present=$(ls scripts/verify_*.py scripts/*.mjs | sed 's#.*/##' | sort)

[ -n "$wired" ] || { echo "[check_lint_wiring] FAIL: 0 wired steps — the one-line '- run:' form changed, so this check would be vacuous" >&2; exit 1; }

dups=$(printf '%s\n' "$wired" | uniq -d || true)
[ -z "$dups" ] || { echo "[check_lint_wiring] FAIL: duplicate step(s):" >&2; printf '  %s\n' $dups >&2; exit 1; }

diffout=$(comm -3 <(printf '%s\n' "$wired") <(printf '%s\n' "$present") || true)
[ -z "$diffout" ] || { echo "[check_lint_wiring] FAIL: wired set != present set (col1=wired-but-absent, col2=present-but-unwired):" >&2; printf '%s\n' "$diffout" >&2; exit 1; }

echo "[check_lint_wiring] OK: $(printf '%s\n' "$wired" | wc -l | tr -d ' ') script(s) wired, name sets match"
