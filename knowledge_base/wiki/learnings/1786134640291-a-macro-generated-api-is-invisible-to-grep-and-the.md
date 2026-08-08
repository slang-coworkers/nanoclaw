---
title: "A macro-generated API is invisible to grep — and the non-portable sibling is the only literal hit"
type: learning
topic: misc
source: learnings/1786134640291-a-macro-generated-api-is-invisible-to-grep-and-the.md
---

# A macro-generated API is invisible to grep — and the non-portable sibling is the only literal hit

In `shader-slang/slang`'s `source/slang/hlsl.meta.slang`, two `RayQuery` barycentrics methods exist with **different target portability**, and a grep finds only the one you must not use:

- `CommittedRayBarycentrics()` — literal source text at `:21827`, `[require(glsl_metal_spirv, rayquery)]`. **No `hlsl` arm ⇒ won't compile for D3D12.**
- `CommittedTriangleBarycentrics()` — `[require(glsl_hlsl_metal_spirv, rayquery)]` at `:22212`. **Portable**, and the one to recommend.

Measured control: `grep -c 'CommittedTriangleBarycentrics' hlsl.meta.slang` = **0**; `grep -c 'CommittedRayBarycentrics'` = **1**.

Why: the portable one is **macro-generated**. `hlsl.meta.slang` contains an embedded C++-ish generator. A table at `:22194-22203` holds rows like `{"float2", "TriangleBarycentrics", "Barycentrics", "triangle_barycentric_coord"}`, and the body at `:22213` is `$(method.type) $(ccName)$(method.hlslName)()` inside two nested loops: `for (auto method : rayQueryMethods)` (`:22204`) and the outer `for (candidateOrCommitted...)` (`:22059`) where `ccName` comes from `kCandidateCommitted[] = {"Candidate","Committed"}` (`:22054`). So `Candidate`/`Committed` × 8 table rows are minted at build time and **the final method name never appears as literal text**.

Same generator mints `CommittedPrimitiveIndex/InstanceID/InstanceIndex/GeometryIndex/TriangleFrontFace/ObjectRayOrigin/ObjectRayDirection`, plus `Committed{ObjectToWorld,WorldToObject}{3x4,4x3}` from a second table at `:22129-22131`.

**Generalizable rule:** in a metaprogrammed core module, "grep found exactly one spelling" is not an enumeration of the API — and the bias is toward whatever the *hand-written* code happens to be, which here is the non-portable arm. Before recommending an intrinsic from this file, grep the **generator tables** (`__generic`-ish `$(...)` bodies, `const char* ...[] = {` rows) for the semantic keyword ("Barycentrics"), not the user-facing name. A zero-hit grep for a method users clearly call is a strong tell that you're looking at generated output.

Also worth knowing: **Slang has no matrix-truncation conversion.** Searching `hlsl.meta.slang`, `core.meta.slang`, and the user-guide docs for truncation/conversion yields zero hits, so `(float3x3)someFloat3x4` is not something to rely on. Both `mul` directions do exist — `mul(matrix<T,N,M>, vector<T,M>)` at `:13692` and `mul(vector<T,N>, matrix<T,N,M>)` at `:13611` — so pick the matrix shape that already matches (`float3x4` with a `float4` on the right; `float4` on the left of a `float4x3`) instead of truncating. Bonus: `mul(float4(n,0), CommittedWorldToObject4x3())` is a row-vector multiply = `transpose(inverse(o2w)) * n`, i.e. the correct normal matrix for free with no `inverse()` call.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786134640291-a-macro-generated-api-is-invisible-to-grep-and-the.md`_
