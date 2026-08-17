---
title: "A false null: when a race won't reproduce, change the experiment rather than adding repetitions — and use a factorial to test whether fix halves are jointly necessary"
type: learning
topic: verification
source: learnings/1785894193393-a-false-null-when-a-race-won-t-reproduce-change-th.md
---

# A false null: when a race won't reproduce, change the experiment rather than adding repetitions — and use a factorial to test whether fix halves are jointly necessary

Investigating slangpy `test_profiler.cpp:228` (a collector race), a straight A/B reproduction attempt returned
**0/4000 per arm** in Release. That was a **false null**: the natural failure rate is too low to sample on an
idle 8-core container (~5 ms/iteration Release, 26 ms Debug) versus a loaded CI runner. Escalating iteration
count was the wrong lever — 20× more repetitions bought nothing.

**What worked was changing the experiment, three ways:**

1. **Natural reproduction at scale, unmodified.** Base reproduced at **~1/400** unmodified Release runs with the
   exact CI assertion signature. One natural hit on stock code is worth more than thousands of clean runs,
   because it proves the race exists in the shipped configuration.
2. **Window widening via env-gated delay injection** at the suspect point (the `drain()` double-snapshot).
   Base failed **21/30** from 100 µs through 50 ms; the fixed build stayed **0/30** across a **500×** widening.
   Build ONE binary with the delay env-gated and `delay=0` as an inert control, so the probe itself is proven
   not to be the cause.
3. **A 2×2 factorial over the two halves of the fix** — the highest-value step, and the one that overturned the
   published root-cause attribution:

   | configuration | result |
   |---|---|
   | finalization gate only, base ordering | **14/20 fail** |
   | drain-snapshot reorder only, no gate | **18/30 fail** |
   | **both** | **0/30** |

   **Neither half sufficed — jointly necessary.** The triage memo had attributed the failure to the gate alone,
   reasoning (correctly) that the reorder alone couldn't produce the observed values. But **elimination is not
   sufficiency**: showing X-alone can't explain it does NOT establish that Y-alone does. Only varying them
   independently answers that. Consequence: a partial fix would not have closed the bug, and neither half can
   be simplified away in later refactors — worth stating in the PR body so a future reader doesn't "clean up"
   half of it.

**Method controls that make this trustworthy** (cheap, and without them the numbers are worthless): keep the
target test **byte-identical** across arms so only the code under test varies; **positive-control every swapped
binary** by confirming the tests the fix targets FAIL on base and PASS on fixed (this is what proves the base
binary genuinely lacks the fix, rather than a build/link mistake); verify build freshness (mtime against a
pre-build baseline) so you aren't testing a stale artifact.

**Honest limit to state whenever citing this:** delay injection proves **susceptibility and mechanism**, not
production failure rate. A 1/400-natural / 0/4000-plain spread is not a rate measurement. Say which you have.

**And report a null as a null.** The first 0/4000 was published as "null result, not evidence for the
mechanism," which kept it honest and left room to change method. Quietly omitting it would have made the
mechanism look better-supported than it was; presenting it as disproof would have been equally wrong.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785894193393-a-false-null-when-a-race-won-t-reproduce-change-th.md`_
