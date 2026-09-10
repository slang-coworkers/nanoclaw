---
name: feedback_merge_commit_sha_is_populated_on_a_closed_pr
description: "A CLOSED-not-merged PR still returns a non-null merge_commit_sha — only merged/merged_at prove a merge. And a PR closed because it was SPLIT is not a dead review: re-target the findings at the successor that owns them, after checking which successor already has a review."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 973fe4d6-47bd-4ca8-8434-3a07f3751993
---

# `merge_commit_sha` is populated on a merely-CLOSED PR

Measured 2026-08-06 on nanoclaw#1112 ([[project_nanoclaw_1112_fail_closed_split]]). Mid-review state
recheck:

```json
{"state":"closed","merged":false,"merged_at":null,
 "merge_commit_sha":"8cea666eacd0061a7868c2a6947f53c500e6cc08","closed_at":"2026-08-06T13:39:49Z"}
```

GitHub computes `merge_commit_sha` for any *mergeable* PR — it is a test-merge result, not a record of
a merge that happened. ⭐⭐⭐ **Only `merged` / `merged_at` establish a merge.** Reading the sha as
proof would have had me file findings against a tree nobody runs, and verify blobs against a commit
that exists in no branch.

Sibling trap in the same family: `gh pr view --json state` returned `CLOSED` with
`mergeStateStatus: UNKNOWN` — the *state* was right but `gh pr checks` still listed both checks as
`pass`, so **a green check list says nothing about whether the PR survived**.

## A PR closed because it was SPLIT is not a dead review

#1112 was closed and superseded by #1119 + #1120, both merged ~2 min later, split on *revert profile*
rather than failure shape. All 6 shared blobs at #1112's head were **byte-identical** to `nv-main`'s
tip by `git rev-parse` ⇒ **every measurement carried over with zero re-work.**

⇒ **Procedure when a PR closes under you:**
1. `merged`/`merged_at` — merged, or closed?
2. If closed: list recent PRs (`gh pr list --state all`) for a successor; the author's own closing
   comment usually names it.
3. **Diff your measured blobs against the successor / the base tip by hash.** Identical ⇒ the review
   stands as-is; re-target it.
4. **Check each successor's existing comment count before writing.** Here #1119 already carried a
   concurrent session's review whose headline matched a finding I had reproduced independently; #1120
   had **zero**. Posting to the one that owns the finding and has no coverage is the whole value —
   duplicating the other costs a round-trip and reader attention.
5. Leave a short closure note on the closed PR pointing at where the review went, so the chain has a
   resumable artifact on the surface a human will land on.

⚠️ **Do not treat the closure as a reason to drop the chain.** The findings were live on `nv-main`
either way; the only thing the close changed was *which number to post under*.

Related: [[feedback_a_branch_ref_is_not_a_commit_ref_after_merge]] (the mirror error — a branch name
resolving post-merge), and the merge-race posture in [[slang-nanoclaw-chains-index]] (rechecking state
immediately before posting is what caught this).
