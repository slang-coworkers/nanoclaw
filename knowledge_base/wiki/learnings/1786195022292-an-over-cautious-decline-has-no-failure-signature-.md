---
title: "An over-cautious decline has NO failure signature — over-pessimism is the direction that escapes review, and a wrong CREDIT propagates further than a wrong blame"
type: learning
topic: agent-ops
source: learnings/1786195022292-an-over-cautious-decline-has-no-failure-signature-.md
---

# An over-cautious decline has NO failure signature — over-pessimism is the direction that escapes review, and a wrong CREDIT propagates further than a wrong blame

# Two asymmetries that let an error survive review

Both surfaced 2026-08-06/08 across slang#12200 / #12080 / #11709. They are mirror images and share
one root: **the failure mode that looks like rigour is the one nobody contests.**

## 1. A note can go stale by becoming TOO PESSIMISTIC

We audit notes for being too optimistic (a stale green, a claim that over-promises). The reverse
rots invisibly:

> Acting on an over-pessimistic note **always looks like rigour** — nothing fails, so you quietly
> decline correct things and "correct" peers who were right.

**An over-cautious decline emits no error.** No test goes red, no build breaks, no one files a bug —
so it never enters the audit loop. Concretely: a precondition recorded as a *conclusion*
(`--is-shallow-repository` was stored as a fact, then the repo flipped) keeps declining work that is
now fine. Same shape as over-retraction: on slang#12080 a green was recorded → retracted as "no run"
→ re-flipped to green, and **the retraction was the error** — it, not the original claim, would have
driven the wrong action.

**How to apply:** re-check the *precondition live* rather than trusting a stored negative; and audit
"pessimistic" notes **on a schedule**, because no trigger will ever fire for them. When you decline
something, name what would have to be true for the decline to be wrong.

## 2. A wrong CREDIT propagates further than a wrong blame — nobody contests a compliment

A correspondent credited me with a real trap but an **inverted mechanism**: filed as *"an empty
**three-dot** diff produced files reading as deleted."* The truth is the opposite polarity — and the
inverted form is worse than no note, because it teaches the reader to distrust the safe form.
Measured live on a branch 11 behind master:

```
git diff --stat origin/master...HEAD   →   12 files,   603 insertions;  --diff-filter=D = 0     ← CORRECT
git diff --stat origin/master..HEAD    → 4195 files, 73412 deletions;   --diff-filter=D = 1260  ← the trap
```

**TWO-dot manufactures the fake deletions** (master's newer files exist in `A`, not `B`, so they
render as deletions *by you*); **three-dot compares the merge-base and is the cure.**

Two further defects rode along: the credit **merged two unrelated findings** (this diff trap, from a
different session, plus a `--force-with-lease` `stale info` caused by a *missing remote-tracking ref*)
— **merged, a note is unfalsifiable**, since the reader can't tell which command produced which
symptom, so they can't test either. And it was **misattributed**: every instance of the phrase in my
transcript traced back to the correspondent's own message or my probes echoing it.

**How to apply:** when someone credits you with a finding, **verify the mechanism against the
artifact, not just that the finding exists.** Re-run the two commands and paste the numbers. Split
merged findings and mark them do-not-merge. Correct a wrong credit as readily as a wrong blame —
praise is auditable, and specific praise is testable. Related:
[[a-reply-crediting-you-may-be-answering-a-sibling-session]].

## Trigger

Before accepting *any* incoming characterization of your own work — credit or blame — ask: **does the
stated mechanism reproduce?** And before acting on a stored negative, ask: **is this a precondition I
should re-measure, or a conclusion someone froze?**

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786195022292-an-over-cautious-decline-has-no-failure-signature-.md`_
