---
title: "Slang scalar SV_DispatchThreadID is component .x, not a flattened index"
type: learning
topic: slang-compiler
source: learnings/1786115913613-slang-scalar-sv-dispatchthreadid-is-component-x-no.md
---

# Slang scalar SV_DispatchThreadID is component .x, not a flattened index

Slang relaxes HLSL's `uint3` requirement on the 3D compute system-value semantics — `SV_DispatchThreadID`, `SV_GroupID`, `SV_GroupThreadID` can be declared `uint`, `uint2`, `int`, or `int2`. **The narrowing is a swizzle, not a linearization.**

`tryConvertValue` (`source/slang/slang-ir-legalize-varying-params.cpp:293-315`): vector→narrower-vector goes through `emitVectorReshape`; vector→scalar is `builder.emitSwizzle(elemType, val, 1, &index)` with `index = 0` ⇒ **component `.x`**. End-to-end proof in `tests/cuda/dispatch-thread-id-extraction.slang`, whose FileCheck line pins `uint {{.*}} = (blockIdx * blockDim + threadIdx).x;`.

⚠️ **Consequence to warn users about:** `void main(uint tid : SV_DispatchThreadID)` under `[numthreads(8,8,1)]` silently **collides** — every thread in a column sees the same `tid`. It compiles clean. The scalar form is only correct for a genuinely 1D dispatch. For a flat index use `SV_GroupIndex` (group-local, scalar `uint` only) or flatten yourself.

Two more facts worth reusing:
- **The identities are load-bearing, not conventions.** When a target lacks the derived builtins Slang *computes* them: `emitCalcDispatchThreadID` / `emitCalcGroupIndex` (`slang-ir-legalize-varying-params.cpp:214-241`) give `dispatchThreadID = groupID*extents + groupThreadID` and `groupIndex = (z*Ny + y)*Nx + x` (x fastest-varying). `emitCalcGroupExtents` (:189) defaults each absent `[numthreads]` axis to 1 and **bails on a non-literal extent** — so a specialization-constant `[numthreads]` cannot be used for derivation.
- **Scope the type flexibility honestly.** It is proven by source + tests only; no user-guide page documents it (`docs/user-guide/03-convenience-features.md` merely *uses* `uint3` in an example). Metal/WGSL take a different path (`permittedTypes`) and **diagnose `SystemValueTypeIncompatible`** rather than converting, so `uint2` is safest on SPIR-V/GLSL/CUDA.

The canonical mapping table is `docs/user-guide/a2-01-spirv-target-specific.md#system-value-semantics` (rows 65/72/73/74); the GLSL target page explicitly defers to it rather than duplicating.

**Method note (mis-scoping trap I avoided):** searching `SV_GroupIndex` surfaces #9980 "[Metal] gl_LocalInvocationIndex produces wrong results for multi-dimensional GLSL compute shaders" — tempting to cite as a gotcha, but the reporter states HLSL `SV_GroupIndex` works and only the GLSL `layout(local_size_*)` path fails. Citing it on an HLSL-style question would have pinned a real bug to the wrong path. Read which *path* an issue indicts, not just which identifier it names.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786115913613-slang-scalar-sv-dispatchthreadid-is-component-x-no.md`_
