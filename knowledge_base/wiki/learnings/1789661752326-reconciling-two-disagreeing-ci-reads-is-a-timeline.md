---
title: "Reconciling two disagreeing CI reads is a TIMELINE problem — compare commit/blob SHAs across timestamps, and 'can't find the run' ≠ 'no run exists'"
type: learning
topic: ci-tooling
source: learnings/1789661752326-reconciling-two-disagreeing-ci-reads-is-a-timeline.md
---

# Reconciling two disagreeing CI reads is a TIMELINE problem — compare commit/blob SHAs across timestamps, and "can't find the run" ≠ "no run exists"

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787245500729-lnepq2
written_at: 2026-09-17T16:15:52.326Z
---

# Reconciling two disagreeing CI reads is a TIMELINE problem — compare commit/blob SHAs across timestamps, and "can't find the run" ≠ "no run exists"

## Context
A CI-babysitter reported an "all-platform `test-slang` regression, do-not-requeue" on a PR I had just reported as "code-clean, only a Falcor flake." Both reads were about the *same PR* but could not both be true — so a supervisor asked me to reconcile before either became fact.

## What actually happened (a "third case")
Neither "it's a genuine current regression I own" nor "the babysitter misread" was correct. The truth was **stale-but-genuine**:
- The babysitter's failure was a real 16-job all-platform `test-slang` failure on a **merge_group synthetic commit created at 02:19Z**, on the **pre-fix state** of my own course-correction area (a FileCheck bug in a test file).
- My later push (05:13Z) **fixed exactly that**: the test file's blob changed, and the head-check run at 05:33Z was all-green on every `test-slang` job.
- So both reads were right at *different points in time*.

## The reconciliation technique (transferable)
When two CI reads of "the same thing" disagree, treat it as a **timeline/identity problem**, not a right-vs-wrong problem:
1. **Pin the exact run** each side saw: `databaseId`, the **head/commit SHA**, and the failing **job/platform list**. A verdict without the specific run is unfalsifiable.
2. **Compare SHAs across timestamps.** merge_group/merge-queue runs execute on a *synthetic queue commit* (a fresh master-merge), NOT your branch head — so its SHA and even a test file's **blob SHA** can differ from your current head. If the failing run's commit predates your fix-push, and the file's blob changed since, your push likely resolved it. Verify the head-check run at your current SHA is green.
3. **Green PR-branch CI does NOT clear a merge_group failure** — the merge commit can surface integration regressions the branch didn't (and vice-versa, an old merge-commit failure can be stale). Always check the *current head's* check-runs directly.

## The trap I nearly hit
I searched `gh run list --event merge_group --limit 100`, found no run for the PR, and leaned toward "misattributed / likely doesn't exist." **It existed — it had aged out of the most-recent-100 window** given queue throughput since 02:19Z. `gh run list` pagination beyond page 1 also failed with a token 401 here, so I *couldn't* page back. **"Can't find it in the recent window" ≠ "it doesn't exist."**
- What saved the call: I **hedged** — I said "not in the *last 100*" and *asked the other side to cite its specific run* rather than flatly asserting fabrication. That framing let it resolve cleanly instead of becoming a wrong published claim.
- Lesson: when your search window is bounded (recent-N, or blocked pagination), scope your conclusion to the window you actually searched, and request the counterpart's exact run before declaring misattribution.

## Slang-specific mechanics
- merge_group runs live on refs like `gh-readonly-queue/master/pr-<N>-<baseSHA>`; filter `gh run list --event merge_group` on `headBranch` containing `pr-<N>`.
- A PR not in the merge queue (`gh pr view --json autoMergeRequest` = null) won't have a *current* merge_group run, but may have had past ones that aged out.
- Per-commit `gh api repos/OWNER/REPO/commits/<sha>/check-runs?per_page=100` (single page) is reliable even when `gh run list` pagination 401s.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1789661752326-reconciling-two-disagreeing-ci-reads-is-a-timeline.md`_
