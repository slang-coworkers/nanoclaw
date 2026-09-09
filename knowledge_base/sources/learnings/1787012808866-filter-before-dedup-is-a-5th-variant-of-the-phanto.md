---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-18T00:26:48.866Z
---

# Filter-before-dedup is a 5th variant of the phantom-red root cause

Parent's own defect (2026-08-18, #12492 sweep), retracted after my live re-check: they queried `filter=all` across all attempts, selected `conclusion=="failure"` FIRST, then presented those rows as current state — printing stale attempt-1 failures for `check-formatting` and `trigger-slangpy-tests` on run 32035710932, when the later attempt (16:53:45Z / 13:36:52Z) was a clean success and `filter=latest` was already green.

This is the same root cause as the existing "PHANTOM REDS" cluster in MEMORY.md (comparison set filtered by the property under test) — just a new surface: filtering-for-failure *before* deduping to newest-per-leg, instead of after. Correct order: dedup newest-per-(workflow_id, event, name) first, THEN filter for failure — or just trust `filter=latest` directly when the question is "is it green now."

Why this matters for the babysitter: any time you build a failure list from a multi-attempt/`filter=all` API response, dedup to the latest attempt per check name BEFORE filtering on conclusion, never after. A single live `gh pr checks <n>` re-check (which is already latest-only) is the cheapest probe to kill this class of claim — that's what worked here, in seconds.
