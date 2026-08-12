---
title: "[approver/clause-gap] Read autoMergeRequest + reviewDecision before naming a human as the blocker — 'awaiting review' and 'armed to self-merge' look identical on the reviews endpoint"
type: learning
topic: review-approval
source: learnings/1785939843206-approver-clause-gap-read-automergerequest-reviewde.md
---

# [approver/clause-gap] Read autoMergeRequest + reviewDecision before naming a human as the blocker — "awaiting review" and "armed to self-merge" look identical on the reviews endpoint

## Symptom

On slangpy#925 I wrote `next-action: human review by szihs` — the requested
reviewer from the PR metadata. Nothing was waiting on a human:

```
autoMergeRequest: {enabledAt: 2026-08-05T12:55:44Z, enabledBy: ccummingsNV, mergeMethod: SQUASH}
reviewDecision: APPROVED   mergeable: MERGEABLE   mergeStateStatus: BEHIND
```

Auto-merge was **armed**. The only thing holding the PR was `BEHIND`; the next
main update would land it — with the confirmed regression. My report described a
PR waiting for attention when it was in fact a PR waiting for a base-branch
update to self-merge. Those are opposite operational states, and the wrong one
sets the wrong urgency.

## Root cause

I inferred "awaiting review" from `requested reviewer: szihs` + the reviews
endpoint. Neither can see merge automation:

- A **requested reviewer persists after approval** — it is a request record, not
  a pending-work signal.
- `reviewDecision: APPROVED` already meant review was satisfied.
- `autoMergeRequest` is a *separate field* that the reviews endpoint does not
  expose at all. Absence of evidence for automation was read as absence of
  automation.

So the blocker I named was a person who had no outstanding action, while the real
gate (`BEHIND`, resolved by any push to main) went unmentioned.

## How to catch it

One call, before writing any `next-action` that names a person:

```bash
gh pr view $P --repo $R --json autoMergeRequest,reviewDecision,mergeable,mergeStateStatus
```

Read it as a state machine:

| `autoMergeRequest` | `reviewDecision` | actual next action |
|---|---|---|
| non-null | `APPROVED` | **nothing human — lands on next base update.** Time-critical if a defect is open |
| non-null | `REVIEW_REQUIRED` | lands as soon as review clears; approving *is* merging |
| null | `REVIEW_REQUIRED` / `CHANGES_REQUESTED` | genuinely awaiting a human |
| null | `APPROVED` | awaiting someone to press merge |

`mergeStateStatus: BEHIND` with auto-merge armed is **not** a blocker in any
durable sense — it is a countdown, and it is cleared by activity nobody has to
decide on.

## Fix

- **Never name a person as the blocker from `requested reviewer` alone.** Read
  `autoMergeRequest` + `reviewDecision` first and describe the state you actually
  found.
- Worth a clause: an armed auto-merge on a PR where the approver has an open
  `OPEN_GAP` is materially more urgent than a normal abstain — the human window
  to act is bounded by the next push to the base branch, not by someone reading
  their review queue. An abstain that reads as "someone will look at this
  eventually" understates it.
- General principle: when reporting *who must act next*, enumerate the automation
  that can act instead. Merge queues, auto-merge, scheduled rebases, and bots
  with write access all make "waiting for a human" false in a way the
  human-facing endpoints do not show.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785939843206-approver-clause-gap-read-automergerequest-reviewde.md`_
