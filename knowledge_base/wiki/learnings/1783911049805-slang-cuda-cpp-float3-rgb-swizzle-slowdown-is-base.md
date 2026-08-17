---
title: "Slang CUDA/CPP float3 .rgb swizzle slowdown is base re-evaluation, not layout"
type: learning
topic: slang-compiler
source: learnings/1783911049805-slang-cuda-cpp-float3-rgb-swizzle-slowdown-is-base.md
---

# Slang CUDA/CPP float3 .rgb swizzle slowdown is base re-evaluation, not layout

**Symptom:** `float3`/`.rgb` swizzle arithmetic in a hot loop runs ~3x slower on CUDA (and CPU/C++) than the same code reading a whole `float4`. SPIR-V (Vulkan) and HLSL (D3D12) show no penalty.

**Root cause (verified, slang#12073 + DeepWiki):** Slang's C-family emitter (`CPPSourceEmitter`, `source/slang/slang-emit-cpp.cpp:1642-1719`, inherited by `CUDASourceEmitter`) lowers a *multi-component swizzle read* to a per-component brace initializer: `float3{ base.x, base.y, base.z }`. It calls `emitOperand(base)` once per component. Because `shouldFoldInstIntoUseSites` folds texture/buffer loads into their use sites, a folded load under the swizzle is textually emitted N times → N fetches for an N-wide swizzle. Emitted `.cu` proof: `float3{ (tex2Dfetch<float4>(...)).x, (...).y, (...).z }`. SPIR-V uses one `OpVectorShuffle`, HLSL a native `.xyz` — base read once, hence the backend asymmetry.

**The trap (I fell into this):** the intuitive hypothesis is `float3`'s 12-byte/4-byte-aligned CUDA layout defeating NVRTC register allocation. That is WRONG — falsified by the `f3_epi` control kernel in slang#12073: native `float3` whose `.rgb` base is a *register-resident local* emits 1 fetch and is fast. The penalty tracks the **swizzle over a folded/expensive base**, not the type or its layout, and it is **not CUDA-only** — CPU/C++ shares the emitter.

**Fix / workaround:** bind the fetch to a named local first, then read its components — `float4 s = tex[q]; use s.r/s.g/s.b` — so the base is a variable, read once. Applies to reads, constructor swizzles (`float4(shade(uv).rgb, a)` calls `shade` 3x → hoist to a local), everything with a non-trivial base under a multi-component swizzle.

**Reviewer note:** when verifying a "why does X target run slower" claim, get the emitted code / a fetch-count control, don't reason from layout alone. A surface observation (per-component `make_floatN` expansion) is consistent with multiple causal stories; the control kernel is what disambiguates. Context: slangpy#1059 → docs PR slangpy#1060 (Track B), compiler fix Track A = slang#12073.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783911049805-slang-cuda-cpp-float3-rgb-swizzle-slowdown-is-base.md`_
