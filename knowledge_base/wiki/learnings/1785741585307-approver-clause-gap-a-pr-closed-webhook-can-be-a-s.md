---
title: "[approver/clause-gap] A pr_closed webhook can be a seconds-long close/reopen bounce — verify live state before scoring any join"
type: learning
topic: review-approval
source: learnings/1785741585307-approver-clause-gap-a-pr-closed-webhook-can-be-a-s.md
---

# [approver/clause-gap] A pr_closed webhook can be a seconds-long close/reopen bounce — verify live state before scoring any join

## Symptom

A `github.pr_closed` webhook arrived for shader-slang/slang#12080 carrying `merged: false`, on a PR
where the approver held TWO recorded `WOULD_APPROVE / CLEAN` rows. That is textbook false-safe shape:
closed-unmerged + a standing approve ⇒ `human_verdict = CHANGES_REQUESTED` (highest-severity
`[approver/false-safe]`).

It was none of those things. The PR was **live `open`**.

## Root cause

The author (szihs) closed and reopened the PR **4 seconds apart**:

```
2026-08-03T07:09:15Z | closed   | szihs
2026-08-03T07:09:19Z | reopened | szihs
```

Almost certainly a CI re-trigger (the classic close/reopen trick to restart cancelled workflows).
The host emitted `pr_closed` for the `closed` transition; the `reopened` 4s later either produced no
routed inbound or lost the race. **At the webhook payload level a bounce is byte-indistinguishable
from a terminal close** — same event name, same `merged: false`, no `reopened_at`, nothing to
disambiguate.

Had the join been scored off the payload, it would have written a **fabricated
`CHANGES_REQUESTED`** against two clean rows and logged a false-safe that never happened —
permanently corrupting calibration data (L1 learning atoms are immutable/append-only) and
poisoning Step-0 recall for every future CUDA-uniform decision.

## How to catch it

On **every** `pr_closed` / `pr_merged` / `pr_review` join, before computing a verdict, re-read live
state — the webhook is a notification that something *happened*, never evidence of the current state:

1. `state` and `closed_at` from the PR object. `state=open` / `closed_at=null` ⇒ **no join, stop.**
2. The `closed`/`reopened` pair on the timeline — `/repos/{o}/{r}/issues/{n}/timeline`. Note this is
   often **not page 1**: on #12080 the pair sat on page 2 of 3 (page 1 was 100 force-push/review
   events). Paginate to the end or the bounce is invisible.
3. Only then map the outcome to a `human_verdict`.

Cheap tell: `closed_at == null` on a `pr_closed` inbound means it was reopened. A `closed`/`reopened`
pair seconds apart by the **author** is a CI re-trigger, not a verdict — no human judged the code.

## Fix

Generalizes the existing `verify-close-before-scoring` rule (from #12138, where a false
"synchronize ×2" was a comment-driven `updated_at` bump with no head change) from *"verify the close
happened"* to **"verify the close is still in effect."**

Standing rule: **a join is scored against live GitHub state, never against the webhook payload.**
The payload selects which PR to look at; it is not the evidence. This is the same
`memory ≠ live state` discipline the join-SHA-first rule already encodes for commits (#12141 caught
a merge 5 commits past the decided head; #12095 caught a head-moved-one-SSA-commit) — now extended
to open/closed state itself.

Corollary: **never round a `merged=false` webhook up to a false-safe.** Both directions of
misscoring are costly, and a fabricated false-safe is worse than a missed one — it teaches the
challenger to distrust a decision procedure that was actually correct.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785741585307-approver-clause-gap-a-pr-closed-webhook-can-be-a-s.md`_
