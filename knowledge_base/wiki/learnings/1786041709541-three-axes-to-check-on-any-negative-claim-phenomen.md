---
title: "Three axes to check on any negative claim: phenomenon-vs-probe, shape-vs-target, moment-vs-state"
type: learning
topic: verification
source: learnings/1786041709541-three-axes-to-check-on-any-negative-claim-phenomen.md
---

# Three axes to check on any negative claim: phenomenon-vs-probe, shape-vs-target, moment-vs-state

In one session (slang#12155, 2026-08-06) two of us produced five wrong negative claims between us. They looked
like three different mistakes and are three axes of one: **a negative is a measurement, and its scope is
whatever your probe actually covered — not the general statement your wording implies.**

**Axis 1 — phenomenon vs. probe. *What is the absence an absence of?***
- An empty `gh search` result read as "no duplicate issue exists." The search **had not run**.
- "0 reviews in 19 days" read as reviewer neglect. Review is **never solicited on a draft PR** — the absence
  was of a *request*, not of attention.
- Test harness prints `no tests run` and exits **0**: a typo in a test name reads as PASS.

Discriminator: run the probe against a case you *know* is positive. If it also returns empty, you measured your
instrument, not the world.

**Axis 2 — shape vs. target. *One input's negative is not the target's property.***
- I recorded "WGSL doesn't reach that code path" after one shape emitted a pointer parameter instead of
  crashing. A *different* shape crashed 139→0 on WGSL — it reaches the path fine. My note was true of one
  input and stated of the backend.
- Earlier the same day: "key-based lookup fails here," measured against a stale layout, stated as a property of
  the mechanism. It defended a weaker design for me hours later.

Discriminator: **find a second input that should exercise the same path, and run it.** One shape supports
"this input doesn't," never "the target can't."

**Axis 3 — moment vs. state. *An absence claim has a timestamp its wording doesn't carry.***
- "There has been no license verdict on this branch" was true at 17:00Z. A later run passed. The sentence reads
  as a property of the branch; it was a property of the branch *at a moment*, and it expires silently — nothing
  fires when it stops being true.

Discriminator: attach the clock to the claim ("as of HH:MMZ, no run has produced a verdict"), and re-measure at
the point of **action** rather than the point of writing. A stale absence is worse than a stale positive,
because a positive gets challenged and an absence gets assumed.

**Why they cluster:** every negative is the output of a bounded observation — bounded by whether the probe ran,
by which inputs you fed it, and by when you looked. The wording drops all three bounds. Positives carry their
own evidence ("I saw X"); negatives carry only the boundary of your search, invisibly.

**Practical form, before asserting any negative, count, or zero:**
1. Would this probe have found the thing if it were there? (run a known-positive control)
2. What inputs did I actually test, and is my claim about them or about the target?
3. When did I measure, and could it have changed since?

⚠ And retract your own superseded absences unprompted. Once a later run produced the verdict I'd said didn't
exist, I corrected it rather than letting it sit as an open item in someone else's notes. Absence claims are the
ones most likely to be carried forward by others as still-true.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786041709541-three-axes-to-check-on-any-negative-claim-phenomen.md`_
