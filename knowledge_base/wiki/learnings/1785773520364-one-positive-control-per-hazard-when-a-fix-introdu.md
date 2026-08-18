---
title: "One positive control per hazard: when a fix introduces a new failure mode, prove the test catches THAT one too"
type: learning
topic: misc
source: learnings/1785773520364-one-positive-control-per-hazard-when-a-fix-introdu.md
---

# One positive control per hazard: when a fix introduces a new failure mode, prove the test catches THAT one too

## Rule

A positive control proves a test can fail — but it only proves it for **the hazard you disabled**. When your fix (or a reviewer's finding) introduces or reveals a **second, different** failure mode, you need a **second positive control targeting that mode specifically**. Otherwise you're trusting an unproven claim that your test covers the new hazard.

## The why (concrete, slangpy#1073 profiler, 2026-08-03)

The fixer fixed a reference **leak** in `Profiler::end_zone` (an early return on zone-stack mismatch skipped `release_zone_from_global_frame`, so the frame never sealed → permanent wedge). The fix released the reference on the mismatch path.

**The fix itself was buggy:** releasing on *every* mismatch allowed the same reference to be released **twice** — reject `outer` while `inner` is open (releases), end `inner` (valid), then re-present `outer`, which now satisfies the *valid* path and releases again. `release_zone_from_global_frame` asserts `count > 0`, so in **release builds** this underflows a packed counter and corrupts shared state. A leak had been converted into potential memory corruption. Codex's adversarial review caught it.

The remedy needed **two** controls, not one:
1. Remove the release stanza → the test must fail. *(Proves the test still catches the original **leak**.)*
2. Weaken the new ownership guard to `true` → the test must fail/abort/assert. *(Proves the test actually catches the new **double-release**.)*

Control 1 alone would have passed happily while saying nothing about the hazard that had just been introduced. The fixer also had to **extend the test** (re-present the rejected token a second time) — because control 2 has nothing to exercise unless the test drives that sequence.

## How to apply

- Enumerate hazards, not fixes: after a change, list every way the touched invariant can now break (leak, double-release/double-free, underflow, deadlock, stall). Each needs its own control.
- **Sabotage the specific guard**, not just the specific feature: to test a guard, neuter the guard (`if (owned)` → `if (true)`), not the whole block.
- If a control has nothing to trip on, the test is too narrow — extend the test until the control can fail.
- Prefer fixes that need **no new state**: the sound shape here reused the existing zone-stack slot as the ownership marker, with `0` a safe "already released" sentinel because `correlation_id` is never 0. Fewer invariants to control for.
- Watch for the class **"my fix converted failure mode A into failure mode B"** — leak→double-free, stall→corruption, drop→deadlock. It's common in reference-counting, ring buffers, and completion/finalization gates, and it's invisible to a control that only tests A.

Related: [A stale test binary can pass the very test you're validating] and [Review gates validate the shape you chose…] — same theme: a green result that is silent about the thing you actually need to know.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785773520364-one-positive-control-per-hazard-when-a-fix-introdu.md`_
