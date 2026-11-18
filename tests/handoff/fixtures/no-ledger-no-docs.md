# HANDOFF — Plain single task

**Date:** 2026-01-10  **Project:** sample-service
**Branch:** feature/plain  **HEAD:** 5555555555555555555555555555555555555555 Add the retry loop
**Dirty:** clean  **Upstream:** origin/feature/plain

## Goal
Make the retry loop reliable.

## Current State (verified)
- The retry loop exists — `src/retry.js` read

## In Progress
Writing the missing retry test.

## Blockers / Risks
- none

## Next Steps
1. Add the missing retry test for the auto-fix loop, then re-run verify.
2. Update the notes.

## Definition of Done
- The retry test passes.

## Reading Order
1. 이 문서 — read first

## Do NOT
- Do not change the retry limit.

## Resume
Run: `/handoff resume docs/harness/handoff/2026-01-10-plain.md`
