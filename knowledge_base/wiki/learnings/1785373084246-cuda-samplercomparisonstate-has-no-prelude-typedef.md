---
title: "CUDA SamplerComparisonState has no prelude typedef (unlike SamplerState) — undefined-type NVRTC failure"
type: learning
topic: misc
source: learnings/1785373084246-cuda-samplercomparisonstate-has-no-prelude-typedef.md
---

# CUDA SamplerComparisonState has no prelude typedef (unlike SamplerState) — undefined-type NVRTC failure

**Source:** slang-triager, #12278 (2026-07-30), reproduced GPU-free @HEAD 6462d7d2f.

An unused global `SamplerComparisonState g_scmp;` breaks `-target cuda`/`-target ptx`: it is emitted into the `GlobalParams` struct as the literal type name `SamplerComparisonState` (`CUDASourceEmitter::calcTypeName`, `source/slang/slang-emit-cuda.cpp:388-390`), but `prelude/slang-cuda-prelude.h:187-192` defines only a dummy `SamplerState` (`struct SamplerStateUnused; typedef SamplerStateUnused* SamplerState;`) with NO comparison-state counterpart. `-target cuda` exits 0 emitting undefined-type C++; `-target ptx` then fails NVRTC with `identifier "SamplerComparisonState" is undefined`. Unbounded `SamplerComparisonState g_scmp[]` → `Array<SamplerComparisonState>` fails identically.

**Load-bearing asymmetry (the "why does SamplerState work but not this?"):** neither sampler is dropped when unused — `collect-global-uniforms` builds `GlobalParams` from *layout* fields, not usage, so a mere declaration reserves a member. Plain `SamplerState` only compiles because its dummy prelude typedef makes it a valid (no-op, uniform-space-wasting) type. The comparison variant has no such backing. The prelude comment even carries a `TODO(JS)` about stripping such no-op sampler bindings entirely.

**Fix that works (verified GPU-free via nvcc 12.6, EXIT 2→0 for both scalar and array):** add the symmetric one-liner to the prelude next to `SamplerState` — `struct SamplerComparisonStateUnused; typedef SamplerComparisonStateUnused* SamplerComparisonState;`. No emitter change needed (it already emits the name). Scope caveat to state publicly: this makes a *declared/bound* comparison sampler a harmless no-op like `SamplerState`; it does NOT implement comparison *sampling* (`SampleCmp`) on CUDA.

**Method note:** the recipe from learning 1783355453348 (copy prelude, sed-patch a fixed copy, redirect the emitted `.cu`'s `#include`, diff nvcc error sets) turns "reasoned by inspection" into "reproduced + fix-verified" and merits the `reproduced` label — do this for CUDA-prelude bugs; nvcc is at /usr/local/cuda-12.6.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785373084246-cuda-samplercomparisonstate-has-no-prelude-typedef.md`_
