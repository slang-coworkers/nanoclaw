---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-30T19:21:31.473Z
---

# Before calling a signature "distinct from" a tracked issue, check issue body + fix-sha ancestry

## The mistake

Classified 5 hits of `verify-documented-compiler-version.sh` exit-4 (`build-windows-debug-cl-aarch64 / build`) as "distinct from #13041, no tracking issue" and drafted a new issue. Wrong on two counts:

1. **2 of the 5 were already named in #13041's own issue body** (#12754, #12749) — never checked the issue body for prior-instance callouts before declaring "distinct."
2. **4 of the 5 predated the fix commit** `d89866432c` (2026-09-17) — they simply *are* #13041, not a new signature. Never checked fix-sha ancestry (`gh api compare/<fixSha>...<headSha>`) before calling something new.

The *actual* new signal was 3 **post-fix** hits (fix commit confirmed ancestor of tested SHA via `status:ahead`, yet the identical failure recurred) — 2 of which were `merge_group` runs, invisible if only scanning PR-head checks.

## The generalizable rule

Before ever calling a CI signature "distinct from" a tracked issue:
1. Read the tracked issue's own body for named prior PR instances.
2. For every candidate hit, run the ancestry check: `gh api repos/<owner>/<repo>/compare/<fixSha>...<testedSha> --jq '{status,ahead_by,behind_by}'`. `status:ahead`/`behind_by:0` means the fix **is** an ancestor — if the failure still recurs there, the fix is *incomplete*, not "this is a new bug."
3. Count `merge_group` hits alongside PR-head-check hits — a merge-queue eviction can carry the identical signature and is easy to miss if only scanning `prs[]`.

## The registry-level fix (so this can't recur silently)

A `status:"open"→"closed"` self-heal in a tracked-regression registry only proves the *issue* closed — it never proves failures *stopped*. Added a `fixIncomplete: true` boolean (deliberately independent of `status`, since `status` stays `closed` forever once the GH issue is closed) to both `tracked-regressions.json` and `base-skew-signatures.json` entries, plus a code change in `sweep-script-v2.mjs`'s `classifyBaseSkew`: the old logic unconditionally fail-opened an "ahead of fix" match (`ahead/identical => fix already present, trust it, don't suppress`). Now, when `entry.fixIncomplete` is set, an ahead match still runs the log-content verification (`logGrep`) before deciding — a verified match classifies as `verdict:'fix-incomplete'` tied to the issue (never recounted as new); an unmatched log still falls through to actionable (a real, different, unrelated failure on that same ahead-of-fix head is not swallowed).

## Bonus: full-scan tail rollup false positives

Separately root-caused a `rollupUnexplained` false positive (#13032, flagged "unexplained" 2 sweeps running against a live 100% green PR): `fetchNonGreenRollups`'s GraphQL tail path has no equivalent of the floor path's `dedupeByLatestAttempt`/`checkSuiteEventMap` same-name-different-check-suite collision resolution. An old (18-day-stale) commit with two same-named check-runs (one cancelled, one success, ~1.5h apart) can leave GitHub's own `statusCheckRollup.state` stuck non-SUCCESS in a paginated list read, even though a fresh direct query reads SUCCESS. Fix: added `verifyRollupUnexplained(headSha)` that fires *only* when `rollupUnexplained` is already true (cost proportional to the rare mismatch, not total tail volume) and reuses the floor's existing REST dedup helpers rather than re-deriving GitHub's rollup logic — same "positive evidence required, never silently trust an empty bucket" pattern as the earlier gate-0j fix. Fails open (never clears the flag) on any fetch error. Live-verified against the real #13032 fixture: `rollup` still reads `FAILURE` from the raw GraphQL list query, but `rollupReverified:true, rollupUnexplained:false` after the REST re-verification — confirms the fix closes the false positive without masking a genuine one.
