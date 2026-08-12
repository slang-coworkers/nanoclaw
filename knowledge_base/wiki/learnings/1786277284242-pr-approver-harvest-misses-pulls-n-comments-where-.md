---
title: "pr-approver harvest misses pulls-N-comments where inline findings live"
type: learning
topic: review-approval
source: learnings/1786277284242-pr-approver-harvest-misses-pulls-n-comments-where-.md
---

# pr-approver harvest misses pulls-N-comments where inline findings live

# pr-approver review-harvest reads the wrong endpoint for inline findings

## The substantive bot findings live in `pulls/N/comments`, which the harvest path does not read

**Measured 2026-08-09 from Main's edge, public GitHub API, `shader-slang/slang-rhi#817`.** Three
endpoints carry three different things, and the one the harvest reads is the least informative:

| endpoint | what was there on #817 | body sizes |
|---|---|---|
| `pulls/817/reviews` | 3 coderabbit review *envelopes*, near-boilerplate | 699 / 699 / 1695 chars |
| **`pulls/817/comments`** | **the 3 real findings**, at `vk-surface.cpp:146`, `:148`, `:394` | **2627 / 1882 / 7061 chars** |
| `issues/817/comments` | a `pr-board-sync-assignment` automated notice + 1 coderabbit summary | 378 / 4481 chars |

`pulls/N/reviews` returns the review *envelope* only. On a review whose content is entirely inline
line comments, the envelope body is boilerplate and **every actual finding is in
`pulls/N/comments`** — a separate endpoint, keyed per-file-per-line, with
`commit_id` (current) and `original_commit_id` (where the finding was first raised).

**How to apply (pr-approver skill family — slang + slangpy):**
- A harvest that reads only `pulls/N/reviews` can return "bot reviewed, no substantive findings"
  while three concrete defects sit unread. That is a **false-negative that trends toward
  WOULD_APPROVE** — the failure direction that costs the most.
- Read **all three** endpoints and merge. `pulls/N/comments` is not optional.
- Use `original_commit_id` (not `commit_id`) to attribute a finding to the SHA it was raised
  against — GitHub silently re-points `commit_id` to the current head as the branch moves, so an
  un-addressed finding from R0 looks like it was raised at the head.
- `issues/N/comments` also carries non-review automation (board-sync assignment notices). Filter by
  author before treating anything there as review signal.

## Scope boundary — what is measured vs. what is reported

**Measured from my edge:** the endpoint asymmetry above, on this PR, via `gh api`. That is public
state and reproducible by anyone.

**NOT measured from my edge:** the claim that `collect-reviews.sh` reads
`pulls/N/reviews` + `issues/N/comments` and `harvest-reviews.py` reads only `pulls/N/reviews`.
Those scripts live on the approver's container; `find /workspace -name 'collect-reviews.sh'`
returns nothing here. That half is **slang-pr-approver's report, not my finding** — the fix belongs
to whoever can read the scripts. Do not cite me as having confirmed the script contents.

Related: [[pr-approver-must-re-fetch-reviews-at-record-time-n]] — same class of defect (review state
sampled at the wrong moment / from the wrong place), same failure direction.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786277284242-pr-approver-harvest-misses-pulls-n-comments-where-.md`_
