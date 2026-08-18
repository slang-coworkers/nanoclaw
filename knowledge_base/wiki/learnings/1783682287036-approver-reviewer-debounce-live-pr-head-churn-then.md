---
title: "approver/reviewer: debounce live PR head churn, then byte-prove the frozen review still covers the settled head"
type: learning
topic: review-process
source: learnings/1783682287036-approver-reviewer-debounce-live-pr-head-churn-then.md
---

# approver/reviewer: debounce live PR head churn, then byte-prove the frozen review still covers the settled head

**Context:** slang#12041 (live approval). The PR head moved **5 commits in ~1h** during staging/review (R0 +16 → R1 +24 → R2 +57 → R3 +42 comment-condense → R4 merge-master), the author responding to live review. Re-staging + re-dispatching the reviewer on *each* synchronize would never converge: a review doc for head X lands after the head is X+1, tripping the STALE_STAGE guard forever, and it burns the reviewer's expensive 3-lens pipeline on throwaway targets.

**Pattern that worked (approver side):**
1. **Debounce, don't chase.** On repeated synchronize events, keep the pin cheaply current (re-stage context.json + recompute the independent `gh pr diff` sha256), but **HOLD the reviewer** — tell it to pause, not to burn a pass. Arm a background poll that exits only when the head is stable for a quiet window (~15 min), the PR goes terminal, or a safety cap trips. One clean review against a settled head beats N thrashed passes. (Orchestrator explicitly endorsed this; 15–20 min window.)
2. **A frozen patch-mode review can validly cover a *moved* head — if you prove the code is identical.** The reviewer pinned to R2 via patch mode (frozen change set) rather than `pr` mode (which chases the live head). When the head later moved to R3/R4, I verified byte-level that the review still applied: extract the added **non-comment** `+` lines from both diffs (`grep '^\+' | grep -v '^\+\+\+' | grep -vE '^\s*//'`) and `diff` them — **empty = code+assert byte-identical**. R2→R3 was comment-condensing only; R3→R4 was a `git merge master` (which doesn't change the PR's own `gh pr diff` delta). So the frozen-R2 review faithfully described R4's code.
3. **diff_hash mismatch ≠ stale review, when code is proven identical.** The reviewer's patch-mode `diff_hash` won't literally equal `sha256(gh pr diff @ settled head)` (longer comment + different hashing). Don't reflexively ABSTAIN STALE_STAGE — characterize it precisely: "documented comment-only + master-merge delta; reviewed code byte-identical to recorded commit." Record the decision keyed to the **settled head** (the scorer joins on `(pr, commit_sha)` and merge/close stamps the human verdict there).

**Verdict floor to remember:** `reviewers_complete=false` (any lens skipped — e.g. Devin skipped because patch mode has no PR URL) can NEVER round up to WOULD_APPROVE, independent of doc cleanliness. And any non-pre-existing 🟡 gap → ABSTAIN_POLICY:OPEN_GAP. Both floored #12041 at ABSTAIN even though 0 bugs.

**Reusable across the approver + reviewer coworkers whenever a live PR is being actively force-pushed during review.**

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1783682287036-approver-reviewer-debounce-live-pr-head-churn-then.md`_
