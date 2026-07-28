---
name: project-11075-ifloat-generic-minmax-vector-cpp-cuda-ice
description: "#11075 ICE: IFloat-generic min/max on vector, cpp/cuda targets — Real-fix-scope AUTHORIZED, fixer dispatched"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9fd7ec17-c358-440b-8d4e-d0f8385fab55
---

# slang#11075 — ICE: IFloat-generic min/max + vector instantiation on cpp/cuda

**State (2026-07-28):** FIX AUTHORIZED by jhelferty-nv (MEMBER + assignee),
comment 5098355553: *"create a PR with the 'Real fix scope' approach."*
DISPATCHED to slang-fixer, canonical thread `gh-issue-shader-slang/slang-11075`.
Draft-only, merge OPERATOR-gated.

**Bug:** `min<T>`/`max<T>` called from a `T:IFloat` (or `IComparable`) generic
context, specialized on a vector (`float2/3/4`), aborts on `-target cpp`/`cuda`
with `unexpected type in intrinsic definition` (`E99997`). metal/hlsl/glsl/wgsl OK
(bare `"min"` maps to their overloaded vector intrinsic). Regression from PR #9593
(IComparable min/max overloads, merged 2026-01-15). Reproduced @ `3da83a82d`.

**Root path:** IComparable `min` body (hlsl.meta.slang:12960-12974) is the only
candidate at abstract-T generic site. `__isFloat<float3>()` folds to **true**
(peephole unwraps vector→element before `isFloatingType`), so body enters
`__min_impl` (`$P_min($0,$1)`). `$P` expansion switch
(slang-intrinsic-expand.cpp:682-720) has no `kIROp_VectorType` case → `default:`
`SLANG_UNEXPECTED` at :715.

**"Real fix scope" (AUTHORIZED — 3 areas together, from bot comment 4443874787):**
1. `slang-ir-peephole.cpp:1815` — `kIROp_IsVector` must check the **pre-unwrap**
   type (currently folds `__isVector<float3>()` to false — bug). Trivial.
2. `slang-intrinsic-expand.cpp:691-717` — extend `$P` switch to drill into
   `IRVectorType` and emit element-type prefix (`$P_min(float3)` → `F32_min(...)`).
3. `prelude/slang-cpp-scalar-intrinsics.h` + `prelude/slang-cuda-prelude.h` — add
   vector-arity `F32_min/max`, `I32_min/max`, `U32_min/max` (likely `F64_*` too).
   CPU: template on `Vector<T,N>`. CUDA: per-arity overloads for `floatN/intN/uintN`.

Narrow meta.slang-only approaches (1a vector `__min_impl` overload; 1b
`__isVector` short-circuit) were TRIED and FAILED — documented in comment 4443874787.
Do NOT retry them.

**Test gap:** no test for IFloat/IComparable-generic min/max specialized on vector,
cpp+cuda, with metal parity. Regression test required.

**Owners cc'd:** jkwak-work, gtong-nv (PR #9593 author), csyonghe (core-lib owner).
Reporter: BeezBeez.
