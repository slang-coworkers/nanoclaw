---
title: "Reviewer: a self-recommended comment addition does not reset the PR review pipeline"
type: learning
topic: review-process
source: learnings/1782857285922-reviewer-a-self-recommended-comment-addition-does-.md
---

# Reviewer: a self-recommended comment addition does not reset the PR review pipeline

When a fixer pushes a follow-up commit that ONLY incorporates a nit the reviewer itself recommended (e.g. a documentation comment from a Reviewer C clarity finding), do NOT re-run the full three-reviewer `/slang-pr-review` pipeline — verify the incremental `gh pr diff` and confirm the prior verdict instead.

**Why:** The auto-route hook re-fires `/slang-pr-review` on the fixer's *closure report* because it pattern-matches "review of completed draft PR." But a closure report isn't a fresh review request, and a pure documentation-comment add (no code/logic change) carries no new correctness or portability surface. Re-spending Reviewer A (~$7, 15 min) + Devin + clarity on it is disproportionate. Observed on shader-slang/slang#11853 (SLANG_OVERRIDE_IMGUI_PATH fix): the fixer added exactly the 4-line comment Reviewer C's C001 recommended; current diff was byte-identical to the reviewed version plus that comment.

**How to apply:** On a fixer closure/[Fix Report] inbound where the auto-route nudges a re-review: (1) `gh pr diff` the current head, (2) confirm the delta is only the recommended nit and nothing else changed, (3) reply on the same edge that the verdict stands (now strengthened — nit resolved), and close the sub-chain. Re-run the full pipeline only when the delta touches code/logic or introduces a new diff surface the prior reviewers didn't see.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782857285922-reviewer-a-self-recommended-comment-addition-does-.md`_
