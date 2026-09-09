---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787905055769-si0h6g
written_at: 2026-08-31T07:50:29.504Z
---

# [approver/calibration] Confirmed-safe: new CI lint-guard PR, positive-control verified, merged unchanged

## Outcome (calibration join)
slang#12793 (add a `git grep` CI guard rejecting `${CMAKE_BINARY_DIR}` in first-party CMake).
Decision: **WOULD_APPROVE @ 777942ff**. Human verdict: **MERGED by jvepsalainen-nv at head_sha
777942ff = my exact decision commit** (merged unchanged, zero follow-up commits). My call matched
the APPROVED-equivalent outcome. Confirmed correct.

## The shape that was safe (transferable)
A **new CI lint-guard PR** merges safely when ALL of these hold — this is the checklist that
carried the decision, not the PR's diff size (+72 / 3 files is irrelevant on its own):
1. **The guard is provably LIVE, not dead.** Its failure direction (a match query that never
   fires) is invisible to CI-green, so I reproduced the guard and ran the POSITIVE CONTROL directly:
   it exits non-zero on real violations (top-level, nested, and the first-party `external/…` file)
   and zero on the clean tree. A guard you only saw pass on clean input carries zero bits.
2. **Current master is clean under the guard**, so it won't red-fail every unrelated PR (verified
   by running the guard query on a fresh master clone).
3. **The guard is WIRED into a real gate** (a `pull_request` workflow with the right `paths:`),
   not just added as a loose script — the slang#12344 "added but wired to no gate" OPEN_GAP does
   not apply. Intentionally **non-required** is fine when documented and matching a sibling
   precedent (here `check-submodules.yml`); non-required informs, doesn't block — a maintainer
   policy call, not a defect.
4. **Scope boundary is the right one:** `git grep` over tracked files excludes vendored submodule
   CMake automatically while still covering first-party `external/CMakeLists.txt` — the
   tracked-vs-submodule boundary, not an `external/` path prefix. `-w` avoids embedded-identifier
   false positives. Confirmed by the positive-control cases.

## The one load-bearing caution (see the sibling critique-mustfix learning)
This PR was dependency-ordered (held draft until #12570 merged, then un-drafted, head moved). The
Devin signal was initially STALE/draft-era and I nearly stamped it head-current. Verifying
head-currency (re-run Devin → "Analysis is up to date" + live cross-check that #12570 merged and
master is clean) was the step that made the WOULD_APPROVE sound. For this class of PR, head-currency
of the review signal is the thing most likely to be wrong — check it, don't assume it.

## Bottom line for Step-0 recall
CI/build-only guard PRs of this shape (live-verified positive control + clean current master +
wired gate + correct scope) are low-risk and merge unchanged. Spend the challenger budget on
(a) the positive control and (b) review-signal head-currency, not on the diff size.
