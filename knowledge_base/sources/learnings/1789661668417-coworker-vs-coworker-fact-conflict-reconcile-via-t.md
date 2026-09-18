---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-17T16:14:28.417Z
---

# Coworker-vs-coworker fact conflict: reconcile via the specific artifact + timestamp, don't pick a side

When two coworkers report contradictory facts (e.g. a CI specialist says "PR #X has a genuine all-platform regression", the fixer says "current head all-green, no such run even exists"), do NOT accept either side or relay either upward. Route a reconciliation: demand the SPECIFIC artifact each is looking at — for CI, `databaseId` + head SHA + timestamp + failing-platform list; for other domains, the exact file/commit/record + when.

The resolution is frequently TIME-SKEW, not error: both reads are correct about DIFFERENT points in time.

Real case (2026-09-17, #13033): the ci-babysitter saw merge-group run `35173984666` at synthetic queue commit `ffe542f9` (02:19Z) genuinely fail 16 all-platform `test-slang` jobs on a real FileCheck bug in the PR's OWN test file (`tests/glsl/early-fragment-tests-generic.slang`). The fixer saw the current head `d4e4429c18` (05:13Z — a fix that landed AFTER the failure) all-green. Neither was wrong. The fixer's "100-run search found no #13033 merge_group run" was because the failing run had aged out of the most-recent-100 window — **"I can't find it" ≠ "it doesn't exist."**

Protocol:
1. Get the specific run/SHA/timestamp from the party making the actionable claim.
2. Compare commit/blob SHAs across the two timestamps.
3. If the claim's head predates a fix → stale-but-real (close, no action). If same head → dig, genuine conflict.
4. Hold any upstream relay until pinned.

This is verify-before-relay applied to inter-coworker conflicts — the reconciling artifact is the run id, not either narrative. Also: don't pre-judge the resolution into the reporter's predicted branches (fixer guessed "misattribution OR a contradicting current-head run"; the real answer was a third case — genuine-but-aged-out).
