---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786551716726-r8o5ee
written_at: 2026-08-12T16:34:09.501Z
---

# HLSL float atomic-add is NVAPI-only and emits silently; the tensor producer is not the autodiff pass

slang#12505 (D3D arm of slangpy#222). On HLSL/D3D, `RWByteAddressBuffer.InterlockedAddF32(float)` (hlsl.meta.slang:6536/:6681, both `[__requiresNVAPI]`) lowers ONLY to the NVIDIA-only NVAPI intrinsic `NvInterlockedAddFp32`, emitted **silently** (slangc -target hlsl => rc=0, empty stderr, unconditional `#define SLANG_HLSL_ENABLE_NVAPI 1` + `#include nvHLSLExtns.h`). On AMD-D3D12 this can't perform the atomic => autodiff gradient scatter never accumulates => grad all-zero. Capability alias `atomic_glsl_hlsl_nvapi_cuda_metal_float1` (slang-capabilities.capdef:2616) is satisfiable on HLSL ONLY via `hlsl_nvapi`.

Key gotchas verified @ c0e5ca5c:
1. **Producer is NOT the autodiff pass.** `grep -riE 'atomicadd|interlocked|kirop_atomic' slang-ir-autodiff*.cpp` = 0 hits; gradient agg is scalar `dadd` (emitDAddOfDiffInstType, slang-ir-autodiff.cpp:646). The atomic comes from the core-module tensor backward path: DiffTensorView.load `[BackwardDerivative]` -> AtomicAdd.load_backward (diff.meta.slang:855-860) -> InterlockedAdd. A fixer searching autodiff sources finds nothing.
2. **Asymmetry: generic float atomic IS diagnosed, InterlockedAddF32 is NOT.** Generic `InterlockedAdd(floatBuf[i],...)` -target hlsl => E55204 hard error (slang-emit-hlsl.cpp:744-746). The NVAPI InterlockedAddF32 path bypasses that diagnostic entirely.
3. **The `default:` arm is a trap.** Both InterlockedAddF32 decls carry a `default:` arm (`__getEquivalentStructuredBuffer<float>` + `__atomic_add`), but it is UNREACHABLE on HLSL (explicit `case hlsl:` wins) and couldn't work anyway (`__atomic_add` float => kIROp_AtomicAdd => E55204). Not a working fallback.
4. **No in-tree pure-DXC float-atomic CAS precedent.** The existing `InterlockedAddF16Emulated` (:6642) is ITSELF NVAPI (`_NvInterlockedAddFp16x2`). A CAS emulation (Approach B) built on 32-bit `InterlockedCompareExchange` (:6962) would be new code, and must build per-use buffer views not mutate the shared BAB type inst (cf. #12265 replaceUsesWith whole-module type flip).

Fix is a maintainer design call (NVAPI policy + whether to add float-atomic emulation), not mechanical: the capability system currently treats `hlsl_nvapi` as compile-time-available on HLSL, so "HLSL-but-no-NVAPI" isn't expressible today and Approach A (diagnose when absent) would need that distinction introduced.
