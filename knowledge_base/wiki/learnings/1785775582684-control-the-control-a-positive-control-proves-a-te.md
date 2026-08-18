---
title: "Control the control: a positive control proves a test can fail, not that it fails for the right reason"
type: learning
topic: misc
source: learnings/1785775582684-control-the-control-a-positive-control-proves-a-te.md
---

# Control the control: a positive control proves a test can fail, not that it fails for the right reason

## Rule

A positive control (sabotage the fix → the test must fail) proves a test **can** fail. It does **not** prove the test fails **because of the hazard you care about**. Before trusting a new regression test, ask: **does my assertion read an observable the bug can actually move?** If the bug and the fix produce the same value for what you assert on, the test is **vacuous** — and it will sail through its own positive control.

## The why (concrete, slangpy#1073 profiler, 2026-08-03)

A test named `out of order zone end leaves the thread zone stack usable` asserted `parent_index == -1` for a zone opened after an out-of-order zone end. **It passed with the fix fully neutered.**

Instrumentation showed why: the fix *does* change state (`zone_depth` 1→0), but `begin_zone` derives the parent as `zone_depth ? zone_stack[zone_depth-1] : 0` — and `zone_stack[0]` had **already been zeroed by an earlier fix in the same area**. So the parent read `0` in both the fixed and broken cases, and the zone was a root either way. The assertion was blind to the bug by construction.

Two compounding traps:
1. **A prior fix stripped the discriminating power of the obvious assertion.** Fix (B) zeroed the slot; that made `parent_index` unable to distinguish (C)-fixed from (C)-broken. When you stack fixes in one area, each one can silently invalidate the natural observable for the next.
2. **The counter you reach for may aggregate the thing you're testing.** A first rewrite asserted `producer_drop_count == 0` — impossible, because the out-of-order `end_zone` itself bumps `stack_overflow_count`, which `producer_drop_count` sums in. That test would have failed *with* the fix. **Check a counter's aggregation before asserting on it.**

**What caught it:** the build subagent **positive-controlled the control itself** — it didn't just run the sabotage protocol, it questioned whether the test under control was discriminating. That one extra step is the whole lesson.

**The fix:** assert on the **actual damage**, not a proxy. The real consequence of a phantom stack slot is a **capacity leak**, so the rewritten test opens 64 zones (== `MAX_ZONE_DEPTH`) after the out-of-order pair and asserts `zone_count() == 65`. With a phantom slot, `zone_depth` starts at 1, the 64th `begin_zone` overflows and is rejected → 64 zones and a null token. That value genuinely differs fixed-vs-broken.

## How to apply

- For each new regression test, name the **observable the bug moves** and confirm it differs between fixed and broken. If you can't name one, you don't have a test yet.
- Run the control, then **interrogate the control**: "if this test were vacuous, would this control have told me?" (Usually: no.)
- Prefer asserting the **downstream damage** (capacity exhausted, count wrong, operation rejected) over an intermediate flag/field that other code may normalize.
- When stacking fixes in one area, **re-derive each test's discriminator after every fix** — and re-run earlier controls to confirm they still fire (here A and B were re-fired and did).
- Verify how any counter is composed before using it as an oracle.

Related: [One positive control per hazard], [A stale test binary can pass the very test you're validating], [Dump-based FileCheck tests need `-o -`…]. All four are the same family: **a PASS that is structurally silent about the failure you care about.** This one is the deepest — the silence is in the assertion itself.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785775582684-control-the-control-a-positive-control-proves-a-te.md`_
