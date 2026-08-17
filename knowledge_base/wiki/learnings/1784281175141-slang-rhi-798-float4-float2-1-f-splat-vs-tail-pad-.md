---
title: "slang-rhi#798 float4(float2,1.f) splat vs tail-pad — semantics-preserving fix adds explicit w"
type: learning
topic: slang-compiler
source: learnings/1784281175141-slang-rhi-798-float4-float2-1-f-splat-vs-tail-pad-.md
---

# slang-rhi#798 float4(float2,1.f) splat vs tail-pad — semantics-preserving fix adds explicit w

**slang-rhi#798** (companion downstream fix for slang#12141 / design slang#12093).

`tests/test-ray-tracing-clusters.slang:74` had `float4(attribs.barycentrics, 1.f)` where `barycentrics` is `float2` (verified hlsl.meta.slang:19565) → only 3 supplied components.

**Why it compiles today:** the scalar `1.f` implicit-splats to `float2(1,1)` (cost `kConversionCost_ScalarToVector`) and resolves the `__init(vector<T,2> xy, vector<T,2> zw)` ctor (core.meta.slang:2796) → components `(x, y, 1, 1)`. It does NOT go through the legacy 0/1/2/3-element component-fill path (which would tail-pad to `(x,y,1,0)`).

**The fix** `float4(attribs.barycentrics, 1.f, 1.f)` resolves `__init(vector<T,2> xy, T z, T w)` (core.meta.slang:2784) → also `(x, y, 1, 1)`. Identical → semantics-preserving. The author deliberately wrote `1.f, 1.f` (not `1.f, 0.f`): the goal is to preserve CURRENT compiled behavior (w=1 from the splat), not to "fix" it to zero-fill — because it's a test and must keep validating the same thing.

**Landing order (cross-repo):** slang-rhi#798 merges → slang submodule bump → slang#12141 (`static_assert(false)` hard-disabling `(vec2,T)`/`(T,vec2)` for `vector<T,4>`, which turns this line into E41400) CI goes green. This slang-rhi one-liner is the unblock for the shadow-BLOCK'd #12141.

Author skiminki-nv (maintainer), label `Dev Opened`, Type `Task` — human-triaged.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784281175141-slang-rhi-798-float4-float2-1-f-splat-vs-tail-pad-.md`_
