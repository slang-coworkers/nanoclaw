---
title: "slang#12004 sampler-vs-texture noinline SPIR-V param asymmetry — isIllegalSPIRVParameterType isArray gate"
type: learning
topic: slang-compiler
source: learnings/1783527024741-slang-12004-sampler-vs-texture-noinline-spir-v-par.md
---

# slang#12004 sampler-vs-texture noinline SPIR-V param asymmetry — isIllegalSPIRVParameterType isArray gate

**Issue:** shader-slang/slang#12004 — passing a bindless `.Handle` `Texture2D` and `SamplerState` into a `[noinline]` fn gives asymmetric SPIR-V: sampler loaded at callsite & passed by-value as `OpTypeSampler`; image passed as `uint` index & re-loaded (`OpAccessChain`+`OpLoad`) INSIDE the callee.

**Root cause (verified @ HEAD bfe6a7f14):** `source/slang/slang-ir-specialize-resources.cpp:1364-1381` `isIllegalSPIRVParameterType(type, isArray)`:
```cpp
if (as<IRTextureType>(type)) return true;                 // texture ALWAYS specialized
if (isArray) { if (as<IRSamplerStateTypeBase>(type)) return true; }  // sampler only if ARRAY
```
A param flagged "illegal" gets specialized: the bindless handle survives as a `uint` param and `CastDescriptorHandleToResource` is re-emitted INSIDE the callee (`slang-ir-specialize-function-call.cpp:661-669` + `:975-991`) → the "index passed, descriptor reloaded in callee" shape. A scalar `SamplerState` is NOT flagged, so it stays a by-value `OpTypeSampler` param loaded once at the callsite.

**Why the divergence exists (git -L history):** texture always-specialize = #3252 (comment only "we need to specialize all Texture types"). Sampler `isArray` gate = #3546 "Fix spirv emit that leads to pathological downstream time" — added to specialize sampler ARRAYS (compile-time blowup); scalar samplers were never brought in line with the blanket texture rule.

**Key insight for triage:** emission is SYMMETRIC (`slang-emit-spirv.cpp:5085-5123` handles texture→`OpConvertUToSampledImageNV` and sampler→`OpConvertUToSamplerNV` identically) — the by-value-vs-by-index location is decided ENTIRELY by the specialize step, not emit. Do NOT chase this in the emitter. Also: DeepWiki claimed "Texture2D params are generally allowed as function params" — that's the HLSL/GLSL fall-through branch, NOT the SPIR-V-direct branch (source read is authoritative; the SPIR-V branch @ line 64-67 always specializes textures).

**Recommended fix (Approach A):** drop the `isArray` guard so scalar samplers specialize like textures → both pass by index (Slang's documented default). Fork to flag: reporter actually wanted BOTH by-descriptor (image by-value too = Approach B), which means weakening the old broad `IRTextureType` invariant — high-risk maintainer design call, not a blind fix. MUST spirv-val (not just FileCheck) — prior heap-param fixes emit invalid `OpUntypedAccessChainKHR` caught only by the validator.

**Env note:** `-target spirv-asm` and `-O3` need spirv-opt/spirv-dis downstream (unavailable in the triager container). Use `-target spirv -emit-spirv-directly -O0` to a `.spv` and parse the binary directly (small python struct parser over OpTypeFunction/OpFunctionParameter). The asymmetry is produced by Slang's own emitter pre-opt, so `-O0` still reproduces it exactly.

Category: bug / low / P3 / target-emit(SPIR-V)+IR-specialization.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783527024741-slang-12004-sampler-vs-texture-noinline-spir-v-par.md`_
