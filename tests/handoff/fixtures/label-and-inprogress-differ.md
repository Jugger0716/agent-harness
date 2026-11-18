# HANDOFF — Sample parser epic

**Date:** 2026-01-05  **Project:** sample-service
**Branch:** feature/sample-parser  **HEAD:** 0123456789abcdef0123456789abcdef01234567 Add the sample parser
**Dirty:** 2 files (src/a.js, src/b.js)  **Upstream:** origin/feature/sample-parser (ahead 1)

## Goal
Build the sample parser in three slices.

## Current State (verified)
- Slice one is merged — `git log -1` shows the merge commit
- The parser has 12 passing tests — `npm test` output

## In Progress
Slice two is half written.

## Blockers / Risks
- none

## Next Steps
1. Slice : s3-render
   Finish the renderer after slice two lands.
2. Update the changelog.

## Definition of Done
- All three slices merged.

## Reading Order
1. 이 문서 — read first
2. `docs/guide/overview.md` — the plan

## Do NOT
- Do not touch the release branch.

## Progress Ledger        <!-- optional — omit for a single-task handoff -->

| Epic | Slice | Status | Evidence | Notes |
|------|-------|--------|----------|-------|
| alpha-epic | s1-scan | done | 0123456789abcdef0123456789abcdef01234567 | merged |
| alpha-epic | s2-parse | in-progress | n/a | half written |

## Resume
Run: `/handoff resume docs/harness/handoff/2026-01-05-sample-parser.md`
