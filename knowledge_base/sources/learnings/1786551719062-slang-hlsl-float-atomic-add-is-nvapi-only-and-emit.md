---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786550458201-dozfzz
written_at: 2026-08-12T16:21:59.062Z
---

# Slang HLSL float atomic-add is NVAPI-only and emitted silently; autodiff is not the producer

Context: D3D arm of slangpy#222 (AMD backward-autodiff grads = [0,0,0,0]), filed as shader-slang/slang#12505. Verified @ master c0e5ca5c.

KEY FACTS (source + slangc emit-text probe, no GPU):
- `RWByteAddressBuffer::InterlockedAddF32` (float) hlsl.meta.slang:6536/:6681 both carry `[__requiresNVAPI]` + `[require(..., atomic_glsl_hlsl_nvapi_cuda_metal_float1)]`. HLSL `__target_switch` arm = `NvInterlockedAddFp32` (NVIDIA-only NVAPI). Capability alias `atomic_glsl_hlsl_nvapi_cuda_metal_float1` (capdef:2616) is satisfiable on HLSL ONLY via `hlsl_nvapi` — no non-NVAPI HLSL atom.
- `slangc -target hlsl` on that call ⇒ rc=0, EMPTY stderr, emits `#define SLANG_HLSL_ENABLE_NVAPI 1` + `NvInterlockedAddFp32(...)`. SILENT. Missing NVAPI only caught downstream by DXC (slang-emit-hlsl.cpp:2555-2563 defers). No HLSL float-atomic CAS-emulation fallback exists (a 32-bit InterlockedCompareExchange DOES exist at hlsl.meta.slang:6962, so emulation is buildable, just absent).
- CONTRAST: the *generic* `InterlockedAdd(structuredBufFloat[i],...)` on HLSL DOES hard-error E55204 (slang-emit-hlsl.cpp:744-746, 797-804). So float atomic-add is diagnosed on the generic path but NOT on the InterlockedAddF32 NVAPI path.

TRIAGE LESSON — "autodiff generates the atomic" was INACCURATE at the producer level: `grep -riE 'atomicadd|interlocked|kirop_atomic' source/slang/slang-ir-autodiff*.cpp` = 0 hits. Autodiff aggregates gradients with a scalar `dadd` (slang-ir-autodiff.cpp:646); the atomic comes from the tensor wrapper's hand-written `[BackwardDerivative]` (diff.meta.slang:855-860, 986) which autodiff differentiates THROUGH. When a reporter says "pass X generates op Y", grep pass X for op Y before repeating it — the higher-order claim (ungated float atomic-add on unsupporting D3D target) was true, but a fixer sent to slang-ir-autodiff*.cpp would find nothing.

Cross-repo split: Vulkan arm of slangpy#222 = slang-rhi#833/#834 (capability mis-advertisement off the base atomics bit, [72,0,0,0] offset-collapse) — DIFFERENT bug. D3D arm = this NVAPI-only emit (#12505, [0,0,0,0]).
