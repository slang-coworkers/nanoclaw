---
title: "Combined-sampler GetDimensions off-by-one (WGSL/Metal/CUDA) — shared root with HLSL #10522"
type: learning
topic: slang-compiler
source: learnings/1781992589265-combined-sampler-getdimensions-off-by-one-wgsl-met.md
---

# Combined-sampler GetDimensions off-by-one (WGSL/Metal/CUDA) — shared root with HLSL #10522

**Symptom:** `Sampler2D<T>.GetDimensions(out0, out1)` miscompiles on WGSL (slang #11669) — width is written to the *sampler* var, height to the first output, second output never written. Reproduces identically on **Metal**; likely CUDA. SPIR-V and GLSL escape (SPIR-V has a dedicated combined variant; GLSL keeps a native single-operand `sampler2D`).

**Root cause (traced, HEAD 146e61da5):** For targets without native combined samplers, `lowerCombinedTextureSamplers` (`source/slang/slang-ir-lower-combined-texture-sampler.cpp:52-65`) splits `Sampler2D` into a `struct{texture,sampler}`, so by emit time the call operands are `[texture, sampler, out0, out1]`. The WGSL/Metal/CUDA `GetDimensions` intrinsic strings are **C++-generated** in `TextureTypeInfo::writeGetDimensionFunctions()` (`source/slang/slang-core-module-textures.cpp:233`, per-shape switch `:277-407`, 2D WGSL at `:305-317`) and reference operands positionally as `$0`=receiver / `$1`,`$2`=out-params, assuming the receiver is ONE operand. The combined-sampler compensation `m_argIndexOffset -= 1` fires **only** under the `$p` marker (`source/slang/slang-intrinsic-expand.cpp:391-407`; `$N` resolves at `:288` as `parseNat()+m_argIndexOffset`), which the GetDimensions strings never emit → the injected sampler operand shifts everything by one.

**Key cross-link:** This is the SAME root cause as **#10522** (OPEN, "Dev Reviewed", HLSL/`Sampler2DShadow`) — there the leaked sampler shows up as the first arg of an HLSL member-call `tex.GetDimensions(sampler, w, h)`. Different emit mechanics (HLSL member-call vs `$N` positional string), one underlying cause. Maintainer on #10522 endorsed the fix: rewrite `combinedSampler.GetDimensions(...)` → `combinedSampler.__getTexture().GetDimensions(...)` (also the user workaround) — a source/early-IR rewrite fixes WGSL+Metal+CUDA+HLSL in one place. Don't close either issue from triage/fix — dedup is a maintainer call.

**Triage tip:** when a combined-sampler intrinsic miscompiles on one target, check the other `$N`-string targets (Metal/CUDA) — the bug is usually target-family-wide, not specific to the reported target.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781992589265-combined-sampler-getdimensions-off-by-one-wgsl-met.md`_
