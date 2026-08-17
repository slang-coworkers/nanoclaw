---
title: "[approver/infra-abstain] harvest exit 20 is NOT NO_REVIEW_SIGNAL — a clean CodeRabbit pass lands as a summary-comment EDIT (2nd instance)"
type: learning
topic: review-approval
source: learnings/1786347975646-approver-infra-abstain-harvest-exit-20-is-not-no-r.md
---

# [approver/infra-abstain] harvest exit 20 is NOT NO_REVIEW_SIGNAL — a clean CodeRabbit pass lands as a summary-comment EDIT (2nd instance)

# `[approver/infra-abstain]` A clean CodeRabbit pass is invisible to `pulls/N/reviews` — key on the rate-limit marker's ABSENCE

**Second confirmed instance** (first: slang-rhi#811-R2). Now generalizes; treat as the expected shape.

## Symptom

`scripts/collect-reviews.sh --repo shader-slang/slang-rhi --pr 598 --commit 49a443de7322…` returned
**exit 20** with `review/harvest.json` = `{found:false}` — the "no harvestable bot review, fall to
Devin-only" tier. Meanwhile a **genuine, head-current, clean CodeRabbit review existed.**

## Root cause

When CodeRabbit has **no actionable comments**, it does not post a review row. It **EDITS its
existing summary comment** in place:

- `issues/598/comments` → id `4259249267`, `coderabbitai[bot]`,
  `created 2026-04-16T10:19:15Z`, **`updated 2026-08-10T07:04:07Z`** (~90 s after the push)
- body: `No actionable comments were generated in the recent review. 🎉`
- `📥 Commits` header spans `4e9e7835…49a443de` (= the pinned head); `📒 Files selected: src/cuda/cuda-device.cpp`

`pulls/598/reviews` → `[]`. The harvester reads review **rows**, so it is structurally blind to this.

## How to catch it

On **any** non-zero harvest exit, before concluding `NO_REVIEW_SIGNAL`, read
`issues/<n>/comments --paginate` and check the `coderabbitai[bot]` comment for:

1. **the absence of the `rate limited by coderabbit.ai` marker** ← *the discriminating probe*;
2. the `📥 Commits` range covering the pinned head;
3. `📒 Files selected` naming the changed path.

⭐ **Key on the rate-limit marker's ABSENCE, not on the header's presence.** A rate-limited or
never-started review prints its intended *scope* (commits/files headers) the same way a real one
does — the headers are present in both cases. Only the marker discriminates. This is the single probe
that got both #811 rounds and #598 right.

⇒ **harvest exit 20 alone is NOT `NO_REVIEW_SIGNAL`.** Recording an `ABSTAIN_INFRA` off the exit code
alone discards a real primary signal.

## Two companion traps found on the same PR

- **Review scope ≠ PR scope.** CodeRabbit reviewed only the merge-delta `4e9e7835…49a443de` — the two
  main-merge commits. The **substantive** one-line change (`b488be57`, Dec 2025) had never been
  reviewed by anything, human or bot, in 8 months. Always read the `📥 Commits` range as a *scope
  limit*, and say in the decision what was actually reviewed.
- ⭐⭐ **"Claude finished" is a RUNNER STATUS LINE, not a verdict — read the body.**
  `github-actions[bot]` comment `3635577194` reads *"Claude finished @szihs's task in 2m 23s"*, but
  the 774-char body is an **empty shell**: a 6-item todo list with **every box unchecked**, ending at
  *"Starting now..."* — no findings, no fix, no conclusion. And that job's log is **HTTP 410**
  (retention expired ⇒ unrecoverable). **A null artifact wearing a success header is worse than a
  missing one**, because the header invites you to count it as a review that happened. Demand a
  positive token (findings count / verdict line) *and* a liveness token before crediting any bot
  reply.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786347975646-approver-infra-abstain-harvest-exit-20-is-not-no-r.md`_
