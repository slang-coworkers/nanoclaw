---
title: "[approver/calibration] Retractions, hedges and self-criticisms are the least-audited class of claim — three instances in one PR where over-caution WAS the error"
type: learning
topic: review-approval
source: learnings/1786285724438-approver-calibration-retractions-hedges-and-self-c.md
---

# [approver/calibration] Retractions, hedges and self-criticisms are the least-audited class of claim — three instances in one PR where over-caution WAS the error

## Symptom

Reviewing one PR produced three errors that all pointed the *same* direction — toward
excess caution — and all three nearly survived, because erring against your own
interest reads as rigour and nothing challenges it.

1. **My unverified hedge.** Recommending a producer-side fix, I wrote that the flags in
   question "are also consulted for non-image paths", implying in-tree consumers I had
   never checked. Enumerated: inside the backend the *only* consumer is the one file I
   was already discussing; every other hit is a producer in a different backend. **The
   fix I was hedging against was cleaner than my hedge implied.**
2. **A peer's inflated self-criticism.** They found an undisclosed epsilon in their own
   analysis and reported it as *"had one been a presentable format, my tolerance would
   have deleted the decision-relevant case."* Measured: the four decision-relevant rows
   sit **2.4× to 8.4× outside** the band; the nearest row anywhere survives. Real
   danger in kind, **not in margin**.
3. **A peer's over-broad retraction.** They withdrew corroboration for a `file:line` I
   had supplied, correctly noting they'd taken it from my report and never verified it
   themselves. I re-opened the file: **the citation was right**, exactly where I'd said.
   The honest disclosure of *their* evidence state read like a demotion of *the fact*.

## Root cause

All three are claims — a hedge asserts a risk exists, a self-criticism asserts a
severity, a retraction asserts an evidentiary gap — and none of them gets audited,
because the reviewer's reflex is to check claims that *favour* the author. Nobody
pushes back on "I may be wrong" or "this could be worse than I said." So the error
lives.

And over-caution is not free. It hands a human a fuzzier ask than the evidence
supports, and in case 3 it would have *destroyed verified evidence*: demoting my own
twice-confirmed `file:line` to "uncorroborated" because a peer stepped back from it.

## Rules

- **A hedge is a claim.** Before writing "X may also be true, so the fix might not be
  safe", check X. If you wouldn't ship the positive form unverified, don't ship the
  cautionary form unverified either.
- **Quantify a near-miss before calling it one.** "It could have deleted the key row"
  and "it came within 0.06pp of deleting the key row" are different claims. Compute the
  margin; if it's 8× the threshold, say so.
- **When someone withdraws support for a fact you supplied, RE-DERIVE — don't demote.**
  The peer's evidence state and the fact's truth value are independent variables. Their
  stepping back is information about their verification, not about the file.
- **When auditing your own filter's blast radius, count both directions.** A two-sided
  threshold takes victims from both tallies, so its radius is the *sum* of the
  per-direction deltas, not the larger one. (Peer read 264−262=2 and 24−20=4 and took
  4; the answer was 6.)
- The keeper phrasing, theirs: **"a correction of my own error is the least-audited
  thing I write."**

## Why this matters beyond politeness

The counterweight is already well known — rounding *up* to approve is the classic
failure and there are guards against it. What this PR showed is that the guard has a
mirror image with no guard on it: **the same review that catches optimism does not
catch pessimism**, because pessimism arrives wearing the costume of diligence. Both
directions produce a wrong artifact. Only one of them gets argued with.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786285724438-approver-calibration-retractions-hedges-and-self-c.md`_
