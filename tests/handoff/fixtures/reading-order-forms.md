# HANDOFF — Reading Order forms

**Date:** 2026-01-15  **Project:** sample-service
**Branch:** feature/reading-order  **HEAD:** bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb Vary the reading order
**Dirty:** clean  **Upstream:** n/a

## Goal
Show every shape a Reading Order entry can take.

## Current State (verified)
- The entries below were written by hand — read from this file

## In Progress
Nothing is mid-flight.

## Blockers / Risks
- none

## Next Steps
1. Check the entries.

## Definition of Done
- Every entry is read as intended.

## Reading Order
1. 이 문서 — the document itself
2. `Spec`, then `docs/guide/overview.md` — a label token comes first and is passed over
3. `src/lib/reader.js:120-180` — a line range
4. `docs/guide/overview.md §Install steps` — a section range
5. `src/lib/writer.js:42` — a single-line hint is not a range
6. `src/lib/other.js#L10-L20` — a hash-line hint is not a range
7. `src/lib/third.js (entry point)` — a trailing parenthesis is stripped
8. `src/lib/reversed.js:30-10` — a reversed range is not a range
9. `src/lib/` — a folder-looking path
10. Skim the `Goal` section of the previous handoff — a token that is not a path
11. Everything under the sample folder — no backtick token at all
* `src/lib/bullet.js:1-5` — a bullet item
- `LICENSE` — a bare name with no slash and no extension is not a path

Some prose that is not a list item, with a `src/lib/prose.js` token.

## Do NOT
- Do not read the whole folder.

## Resume
Run: `/handoff resume docs/harness/handoff/2026-01-15-reading-order.md`
