---
title: "A control that doesn't fire may mean you misunderstood the bug — not that your test is weak (refines 'control the control')"
type: learning
topic: misc
source: learnings/1785777358105-a-control-that-doesn-t-fire-may-mean-you-misunders.md
---

# A control that doesn't fire may mean you misunderstood the bug — not that your test is weak (refines "control the control")

## Refinement

My earlier learning ["Control the control"] framed a non-firing positive control as a **test-quality** problem: the assertion wasn't discriminating. There is a second, more important reading, and it should be checked **first**:

> **A control that fails to fire may be telling you the failure mode you're testing does not exist.**

Not "my test is weak" but "my model of the bug is wrong."

## The why (slangpy#1073, 2026-08-03 — the fixer's own formulation)

The fixer wrote a regression test asserting `parent_index == -1`, on the theory that a phantom stack slot would make a dead slot become the **parent** of later zones. The positive control didn't fire.

The shallow reading is "the assertion isn't discriminating, write a better one." The true reading was deeper: **`parent_correlation_id != 0` guards the parent lookup** (`profiler.cpp:832`, `:1396`), so a zeroed slot yields an **unparented** zone, never a **mis-parented** one. The mis-parenting symptom the test was built around **doesn't exist**. Worse, the zeroed sentinel had been introduced by the fixer's own prior fix — so it was already the exact value consumers read as "no parent."

The actual damage was always and only the **capacity leak** (`zone_depth` never returning to 0, burning one of 64 slots per out-of-order end). The replacement test measures precisely that: open 64 zones after the out-of-order pair, assert `zone_count() == 65`.

## How to apply

When a positive control doesn't fire, run these in order:

1. **Does the symptom I'm asserting on actually exist?** Trace the consumer. If some guard/normalization makes broken and fixed produce the same observable, you modelled the wrong symptom — fix your understanding before your test.
2. **Did one of my own earlier fixes create the value I'm asserting against?** Stacked fixes in one area routinely collapse the discriminator for the next (here: the (B) sentinel destroyed `parent_index`'s discriminating power for (C)).
3. **Only then:** treat it as a weak-assertion problem and pick a sharper observable — preferably the **downstream damage** (capacity exhausted, count wrong, operation rejected), not an intermediate field other code may normalize.

The payoff of getting the order right: step 1 corrects a wrong belief about the system, which is worth far more than a better test. A test rewritten under the shallow reading can still be measuring a fiction — just more precisely.

Related: [Control the control], [One positive control per hazard], [A stale test binary can pass the very test you're validating]. Same family — a green/quiet signal that is silent about the thing you care about — but this one locates the silence in your **model of the bug**, not in the harness.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785777358105-a-control-that-doesn-t-fire-may-mean-you-misunders.md`_
