---
title: "Case-less __target_switch in *.meta.slang silently emits an empty body (no diagnostic)"
type: learning
topic: slang-compiler
source: learnings/1785371749664-case-less-target-switch-in-meta-slang-silently-emi.md
---

# Case-less __target_switch in *.meta.slang silently emits an empty body (no diagnostic)

**Symptom class:** a shader "compiles" for a target but the emitted kernel is a no-op (silent miscompile). Observed on shader-slang/slang#12274: `Buffer<float4>` load for `-target ptx`/`-target cuda` compiled with EXIT 0 but the CUDA-source helper `_Texture_Load_0` had an **empty body**, and NVVM then stripped the dead load/store → PTX entry = `ret;`.

**Root mechanism (verified @HEAD 6462d7d2f):** in `source/slang/hlsl.meta.slang`, intrinsic methods dispatch per target via `__target_switch { case hlsl: ...; case spirv: ...; }`. If the active target has **no matching `case`**, the switch produces an **empty function body** — NOT a diagnostic. For `Buffer<T>` (= `_Texture<T, __ShapeBuffer, ...>`), `T Load(int)` at ~L19361-19375 had cases `hlsl/metal/glsl/spirv` and no `cuda` case → empty helper.

**Two triage lessons:**
1. When an issue says "compiles silently to an empty/no-op kernel," suspect a case-less `__target_switch` in the relevant `*.meta.slang` intrinsic before anything else. The emitted `.cu`/source carries a `#line NNNN "hlsl.meta.slang"` marker on the empty helper that pins the exact source line — grep the emitted source for `#line`.
2. **Verify compile-only, no GPU:** these codegen bugs reproduce with `slangc -target cuda file.slang -o out.cu` (source emit, exit-0-but-empty-body) — you do NOT need a GPU or even NVRTC/PTX. Inspect the emitted `.cu` for the empty helper. This is the same no-GPU method as the CUDA `__constant__`-vs-.param check.

**Capability tension worth flagging to the fixer:** the `Load` already carried `[require(glsl_hlsl_metal_spirv, texture_sm_4_1)]` which *excludes* cuda — so the model declares cuda-unsupported, but the requirement isn't enforced at the call site, hence silent. Principled fix = enforce the existing `[require]` (diagnose), mirroring the WGSL precedent #6304 (Buffer/RWBuffer on WGSL → diagnostic via `[require(cpp_cuda_glsl_hlsl_metal_spirv)]` on the type, PR #6585). Scope caveat: do NOT over-reject StructuredBuffer/ByteAddressBuffer/RWStructuredBuffer — those lower to real pointers on CUDA and work.

Related: [[feedback_no_autofixer_jkwak_self_filed]] (this was jkwak self-filed+self-assigned → parked at triaged, no fixer).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785371749664-case-less-target-switch-in-meta-slang-silently-emi.md`_
