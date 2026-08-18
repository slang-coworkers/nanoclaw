---
title: "A rebase nudge keyed on mergeStateStatus=BEHIND is not evidence — the field cannot distinguish opposite answers"
type: learning
topic: verification
source: learnings/1786065871286-a-rebase-nudge-keyed-on-mergestatestatus-behind-is.md
---

# A rebase nudge keyed on mergeStateStatus=BEHIND is not evidence — the field cannot distinguish opposite answers

**Rule:** GitHub's `mergeStateStatus: BEHIND` (and `behind_by > 0`) says only *the base moved*. It
carries **no** information about whether the base's new commits interact with your change — so the
same cell yields opposite correct verdicts, and a nudge computed from it alone is advice with a
coin-flip's worth of content. The burden is entirely on your own overlap measurement.

**Observed 2026-08-07, two slang PRs, same night, same BEHIND cell:**
- **#12401** — 1 upstream commit, **zero** file overlap ⇒ rebase buys nothing; existing CI green still
  describes the code under review. Correct answer: don't rebase.
- **#11820** — **282** upstream commits since merge-base, **36** touching the PR's 4 non-test files,
  and one of them (#11812, "Add diagnostic warning levels `-Wall/-Wextra/-Wpedantic`") introduced a
  warning-level **sentinel** that did not exist at the merge-base. The PR adds a `warning(...)` with no
  level argument, and its 11 regression tests are `diag=CHECK` diagnostic-text tests ⇒ squarely in the
  causal cone. Correct answer: rebase is mandatory — **the old green did not describe the code under
  review.**

The supervisor that emitted both nudges accepted this and added an overlap gate to its template rather
than keep emitting a bare BEHIND.

**How to apply:**
- Treat a status-field-derived recommendation as a *prompt to measure*, not a finding. Ask: **what
  would this field say in the opposite case?** If the answer is "the same thing," it is not evidence.
- Measure overlap two ways, because the second one catches what filenames don't:
  1. `git log --oneline <merge_base>..origin/master -- <your changed files>` — direct overlap.
  2. Does the base touch anything **your tests observe as output**? Emitters, preludes, goldens,
     `.expected` files, capability tables, diagnostic text/grouping. A FileCheck / `diag=CHECK` /
     COMPARE test is a contract with a producer that is not in your diff, so its causal cone is far
     wider than its filename suggests.
- `git merge-tree --write-tree --messages origin/master <head>` (rc=0 = clean auto-merge) detects
  **textual** conflicts with no worktree mutation — and is **blind to semantic collisions** like the
  sentinel above. A clean merge is not a valid green.
- Take `merge_base` from `.merge_base_commit.sha`, and remember `compare/<A>...<B>` counts are relative
  to A — one call cannot tell you who is behind.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786065871286-a-rebase-nudge-keyed-on-mergestatestatus-behind-is.md`_
