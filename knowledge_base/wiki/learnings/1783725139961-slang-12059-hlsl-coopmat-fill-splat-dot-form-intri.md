---
title: "slang#12059 HLSL CoopMat fill/Splat — dot-form intrinsic on void method discards value-returning target op"
type: learning
topic: slang-compiler
source: learnings/1783725139961-slang-12059-hlsl-coopmat-fill-splat-dot-form-intri.md
---

# slang#12059 HLSL CoopMat fill/Splat — dot-form intrinsic on void method discards value-returning target op

In hlsl.meta.slang, `__intrinsic_asm ".Method"` (dot-prefix) on a `[mutating] void` method emits `receiver.Method(args)` as a bare expression-statement and **discards the return value** — `[mutating]` only makes `this` inout, it does NOT capture a target intrinsic's return. So if the HLSL target op is *value-returning* (e.g. `dx::linalg::Matrix::Splat(T)` is a static op returning a filled Matrix per hlsl-specs proposal 0035), the destination is never written and stays uninitialized.

Concretely (#12059, HEAD 01adc68f3): `CoopMat.fill(t)` HLSL case at `hlsl.meta.slang:28226` is `case hlsl: __intrinsic_asm ".Splat";`. Emitted HLSL: `C_0.Splat(0.0f);` with result ignored, `C_0` uninitialized → access violation at PSO creation. `clear()` (:28244 → `fill(T(0))`), scalar `__init(T)` (:28169), `__init(int)` (:28201) all funnel through it. Reproduced compiler-only: `slangc repro.slang -target hlsl -profile cs_6_10 -entry computeMain`.

**Two in-tree precedents for the fix (both worth knowing):**
1. Same struct, 3 lines below: `__hlslLoadBAB`/`__hlslLoadRWBAB` (:28285) are `internal static This` helpers with `__intrinsic_asm "$TR::Load($0,...)"` — the idiom for capturing a value-returning static target op into a var. Fix for fill: add `internal static This __hlslSplat(T t){ __intrinsic_asm "$TR::Splat($0)"; }` and set HLSL case to `this = __hlslSplat(t);`.
2. Same bug-CLASS solved differently: `MultiplyAccumulate` (also void-mutating in HLSL, but kIROp_CoopMatMulAdd is value-producing) → value-returning C++ prelude wrapper `__slang_cm_muladd` (slang-emit-hlsl-prelude.cpp:282, `c.MultiplyAccumulate(a,b); return c;`). That's the heavier path (needs a dedicated IR op); use it only when the op is C++-emitted. `fill` has no IR op (only CoopMatMulAdd in slang-ir-insts.lua:1646) so the meta.slang helper (path 1) is correct/proportionate.

The SPIR-V case of fill (:28217, `this = spirv_asm{...OpCompositeConstruct}`) and CUDA/Metal (genuinely-mutating `($0)->fill` / `_slang_simdgroup_fill`) are all correct — **HLSL is the only broken target**. General rule: when a target op is value-returning, a `void` dot-form intrinsic silently drops it; the method must capture the result (`this = ...` via a value-returning helper or spirv_asm), never a bare `.Method` statement. Introduced by PR #10711 (HLSL CoopMat for SM 6.10); not a regression.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783725139961-slang-12059-hlsl-coopmat-fill-splat-dot-form-intri.md`_
