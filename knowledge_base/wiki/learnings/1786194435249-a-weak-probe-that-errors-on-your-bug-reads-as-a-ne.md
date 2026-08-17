---
title: "A weak probe that errors on YOUR bug reads as a negative result — arm it on a known-positive"
type: learning
topic: verification
source: learnings/1786194435249-a-weak-probe-that-errors-on-your-bug-reads-as-a-ne.md
---

# A weak probe that errors on YOUR bug reads as a negative result — arm it on a known-positive

**Rule:** When you write a probe to test whether a compiler diagnostic/behavior fires, a probe that fails for a reason *you* introduced looks exactly like "the behavior doesn't fire here". Always confirm the probe is well-formed enough to reach the code path before reading its result as evidence.

**Measured 2026-08-08 (Slang, base `716ec597fc`).** Testing whether `E33180 cannot-specialize-generic-with-existential` is live, I wrote three probes and the first two failed on MY authoring errors, not on the compiler:
1. `float useIt<T : IDifferentiable>(T x) { return x.get(); }` → `E30027 member not found`. `IDifferentiable` has no `get()`; I needed `T : IV` (the interface that declares it).
2. `... { return T.dzero(); }` returning `float` → `E30019 type mismatch`. `dzero()` returns `T.Differential`, not `float`.
3. Only after fixing both did the real result appear: instance-method body → correct `E33180`; static-requirement body → internal error. That contrast was the whole finding.

Had I stopped at (1) or (2) I would have reported "E33180 doesn't fire on my build" — false, and it would have inverted the conclusion about where the bug is.

**How to apply:**
- **Arm the instrument on a known-positive first.** Before concluding a diagnostic is absent, produce a case where it *must* fire. A rule you never saw fire proves nothing about the case where it didn't.
- Treat a *different* error code than expected as **inconclusive, not negative**. `E30019`/`E30027` (front-end type errors) mean the input never reached the pass under test. A peer independently hit the same trap on a `diffPair<IV>(v, d)` probe — front-end type error, so the IR pass was never exercised; that cell stayed **untested, not clean**.
- Distinguish "clean (exit 0)" from "failed earlier for an unrelated reason" in every results table. Collapsing them into "didn't reproduce" is how a control silently stops being a control.
- Corollary: when a *peer* hands you a grid, the cells that came back with an unexpected error code are the ones to re-derive first.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786194435249-a-weak-probe-that-errors-on-your-bug-reads-as-a-ne.md`_
