---
title: "slang autodiff transpose: narrowing the gradient at construction is not enough — the aggregation type drives dadd dispatch, and even all four narrowings may be insufficient"
type: learning
topic: slang-compiler
source: learnings/1779432820940-slang-autodiff-transpose-aggregation-type-vs-gradi.md
---

# slang autodiff transpose: narrowing the gradient at construction is not enough — the aggregation type drives dadd dispatch, and even all four narrowings may be insufficient

When triaging "Unrecognized field. Cannot emit field accessor" or similar `IRDifferentialPair*` shape mismatches in the autodiff transpose pass (`source/slang/slang-ir-autodiff-transpose.cpp`), the obvious fix is to type-check `revValue` / base-type at gradient construction sites:

- `transposeMakePair` (around line 1700)
- `materializeDifferentialPairGetElementGradients` (around line 2660)
- `transposeLoad` `IRDifferentialPairType` branch (around line 1611)

…and skip pair-element wrapping when the inbound value is already a bare differential. **This is necessary but not sufficient.**

## Step 1: Three-site narrowing isn't enough

Demonstrated on shader-slang/slang#11160 (bwd-of-fwd × `out`-differentiable-parameter, regression from autodiff refactor 45ccce9a3):

A wip commit (89a324357) applied all three narrowings. Repro still crashed. The deeper invariant: even with the gradient narrowed to a bare `Vec`, `aggPrimalType` (used to dispatch `emitDAddOfDiffInstType`) was still computed from the load's pair type, so the dispatch picked `DiffPair.dadd`. The inlined body of `DiffPair.dadd` then re-applied pair-typed accessors to the bare-Vec gradient, reproducing the original "Unrecognized field" mismatch one layer up.

Two paths the next implementer should weigh:
- (a) Narrow `aggPrimalType` to `loadPairType->getValueType()` at the same site as the load-side narrowing — keeps gradient and dispatch types in lockstep.
- (b) Fix the upstream IR builder so the load doesn't carry a `DiffPair` type when the pointed-to slot is actually a bare differential.

## Step 2: Even four-site narrowing may not be enough

When you see a fixer report "narrowing the gradient sites doesn't resolve the crash; dispatch is still picking `DiffPair.dadd`", trust it — don't re-recommend the same construction-site narrowing.

**On #11160, even with all three guards plus a fourth refinement (narrowing `aggregatePrimalType` from the `DiffPair` to its inner value type when `transposeLoad`'s loadType is pair-typed, so `emitDAddOfDiffInstType` dispatches the inner type's plain `add` instead of `DiffPair.dadd`), the repro still crashed with the same signature.**

A debug `fprintf` in `DifferentialPairTypeBuilder::emitFieldAccessor` showed the malformed shape `%52 = GetPrimal(%46)` / `%55 = GetDifferential(%46)` (where `%46 = get_field(%pair, %differential)` is bare `Vec(Float,2)`) followed by a `MakeDiffPair` is *still* emitted — the signature of an inlined `DiffPair.dadd(a,b) = MakeDiffPair(GetPrimal(a)+GetPrimal(b), GetDifferential(a)+GetDifferential(b))` body where `a` and `b` were bound to bare-diff inputs somewhere outside the three patched sites.

**Implication:** when the malformed pattern is `MakeDiffPair(<add>, <add>)` and the adds' operands are `GetPrimal/GetDifferential` of `get_field(..., %differential)` chains, the synthesizer is the inlined `dadd` of a `DiffPair`, not the transpose pass directly. The `aggregatePrimalType` narrowing only covers the `transposeLoad` aggregation site; other dispatch sites for `emitDAddOfDiffInstType` (or any other place that picks up a pair-typed primal type and indirectly inlines `DiffPair.dadd`) need parallel narrowing.

## Diagnostic shortcut

A one-shot `fprintf` in `emitFieldAccessor`'s `else { SLANG_UNEXPECTED(...) }` branch dumping `baseInst` + the parent function (via `dumpIRToString(getParentFunc(baseInst))`) is *enormously* faster than `-dump-ir-before/-after` for narrowing where in the pipeline the malformed IR appears, because it captures the full state of the failing function at the exact moment `emitFieldAccessor` is called. Worth keeping locally during investigation; do not commit. Keep the gate (`if (...) ... else { fprintf(...); SLANG_UNEXPECTED(...); }`) so the assert still fires after.

**Likely regression source for #11160:** commit `45ccce9a3` (2026-04-01) — autodiff transpose / `dadd` dispatch refactor around `DiffPair` narrowing. If you're touching this surface, check that commit for the assumption that gets violated.

## Cross-refs

- Issue: shader-slang/slang#11160
- Closed partial-fix PR (preserves the patch shape): shader-slang/slang#11245
- Triage analysis: comment on #11160 with the three-site recommendation
- Companion: `1779432739908-slang-autodiff-transpose-bare-diff-gradient-with-d.md` (the load-side narrowing fix)
- Related: #8777 (closed, double-bwd_diff), #10883 (similar shape-handling pattern in `emitFieldAccessor`), #11004 (different autodiff path, same area)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1779432820940-slang-autodiff-transpose-aggregation-type-vs-gradi.md`_
