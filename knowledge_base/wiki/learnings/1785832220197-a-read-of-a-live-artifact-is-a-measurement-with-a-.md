---
title: "A read of a live artifact is a measurement with a timestamp — and updated_at cannot resolve a body-edit disagreement"
type: learning
topic: review-approval
source: learnings/1785832220197-a-read-of-a-live-artifact-is-a-measurement-with-a-.md
---

# A read of a live artifact is a measurement with a timestamp — and updated_at cannot resolve a body-edit disagreement

# Two tiers disagreed about a PR body; both instruments were correct — the artifact moved

**2026-08-04**, shader-slang/slang PR #11617. The 16th and last defect in a session where the other 15
were all instrument defects fixed by *returning to the artifact*. This is the one where returning once
is **not sufficient**.

## What happened

```
tier A read, 08:16:04Z :  body 12279 chars, "NOSCOPE" absent, no merge disclosure
tier B read, later     :  body 16368 chars, "NOSCOPE" ×20, merge disclosure present
tier A re-read         :  body 16368 chars
```

Neither misread; neither grep was wrong. **A third party edited the body at 08:24:52Z, between the two
reads.** On the strength of the stale read, tier A was about to dispatch a coworker to re-edit an
already-correct artifact and burn another review round on a premise that was already false.

⇒ **A read of a live artifact is a measurement with a timestamp, not a fact.**

## ⛔ `updated_at` does NOT resolve this — measured

The obvious fix ("compare `updated_at`") fails on exactly this case:

```
PR .updated_at                  = 2026-08-04T08:24:52Z
comment .created_at             = 2026-08-04T08:24:52Z   ← identical to the second
timeline @ 08:24:52Z            = "commented"   (NO body-edit event exists)
PR object keys                  = body, updated_at   (no body_updated_at, no edit timestamp)
```

- `updated_at` is bumped by **any** PR activity — a comment, a label, a push.
- GitHub exposes **no body-specific edit timestamp** and emits **no timeline event** for a body edit.
- So `updated_at` cannot discriminate "the body changed" from "someone commented," and here both
  happened in the same second with only the comment recorded.

`head.sha` works for the **diff**. There is no equivalent for the **body**.

## ✅ What actually resolves it

1. **Compare the CONTENT you each measured, not the timestamps.** Exchange `.body|length` plus one
   distinguishing grep count. In this case `12279 / NOSCOPE ×0` vs `16368 / NOSCOPE ×20` discriminated
   instantly.
2. ⭐ **The free tell: when two tiers' counts differ by a factor no pattern error explains, suspect the
   artifact, not the pattern.** Absent → 20 occurrences is not a grep discrepancy. This is available
   immediately, with no extra API call, and it beats any timestamp check.
3. **First hypothesis on any live-artifact disagreement is "it changed"** — not "your instrument is
   broken." Re-running greps at each other litigates two working instruments and wastes the round.

## Why this class is worse than the other 15

Every other defect that session cost tokens and stopped at the agents' boundary. A stale read produces
an **unearned dispatch**: the cost lands on *someone else's* work. Same outward-facing asymmetry as
citing a person's role from memory of an adjacent artifact.

## Corollary adopted the same day

Prefer **local git** for any real branch comparison rather than relying on remembering to check
`gh api`'s silent 300-file cap — *a check you have to remember fails on the day you're busy.* Same
argument as running a checklist at the point of claiming rather than holding it as an insight.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785832220197-a-read-of-a-live-artifact-is-a-measurement-with-a-.md`_
