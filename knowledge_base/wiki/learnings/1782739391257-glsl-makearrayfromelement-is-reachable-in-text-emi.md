---
title: "GLSL MakeArrayFromElement IS reachable in text emit (default-init global const array)"
type: learning
topic: slang-compiler
source: learnings/1782739391257-glsl-makearrayfromelement-is-reachable-in-text-emi.md
---

# GLSL MakeArrayFromElement IS reachable in text emit (default-init global const array)

# GLSL `MakeArrayFromElement` is reachable in text emit — don't assume it's dead/parity-only

Confirmed during the 3-reviewer pass on shader-slang/slang#11819 (GLSL array-constructor emit fix for issue #11802). The PR author initially claimed the `kIROp_MakeArrayFromElement` GLSL emit branch was "hard to produce from surface const-array syntax that survives to GLSL text emit" and shipped it untested. **That claim was wrong** — Reviewer A (correctness) traced the producer/survival path and the fixer then reproduced it empirically.

## Why it's reachable (the trace)
- `getDefaultVal` of an array type emits `MakeArrayFromElement` directly — `source/slang/slang-lower-to-ir.cpp:6526` (`emitMakeArrayFromElement(irType, irDefaultElement)`).
- `processMakeArrayFromElement` in `source/slang/slang-ir-simplify-for-emit.cpp:107` only **decomposes** the inst into per-element stores when its user is an `IRStore`.
- A **global `static const`** default-initialized array has **no `IRStore` user**, so the inst survives simplify-for-emit and reaches the emitter as an un-stored initializer.
- Empirical confirmation: a default-init global const array (runtime-indexed so it isn't folded away) emits e.g. `const int z_0[4] = int[](0, 0, 0, 0);` — i.e. the broadcast `MakeArrayFromElement` branch.

## Reviewer takeaways
- When reviewing emit-layer changes that add a `Make*` case, **don't accept an "unreachable / hard to produce" rationale at face value** — check `getDefaultVal` (lowering) and the relevant `simplify-for-emit` decomposition condition (`IRStore`-user gating). Default-initialized **globals** are the classic way a `Make*` inst survives to text emit un-decomposed.
- The concrete test recipe to force `MakeArrayFromElement` into GLSL text emit: a **default-initialized global `const` array, runtime-indexed** (prevents constant folding), then FileCheck the broadcast constructor (`T[](e, e, …)`) and round-trip via `-emit-spirv-via-glsl`.
- This complements the existing #11802/#11819 learnings (brace-init invalid <4.20, nested `int[][3]` order, `-emit-spirv-via-glsl` round-trip beats text-only FileCheck).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782739391257-glsl-makearrayfromelement-is-reachable-in-text-emi.md`_
