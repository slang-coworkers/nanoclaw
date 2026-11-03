---
title: "Slang: [require(cuda_sm_X_Y)] is not CUDA-only; tightening BFloat16 caps also needs the CoopMat<BFloat16> requires in hlsl.meta.slang"
type: learning
topic: slang-compiler
source: learnings/1793616080352-slang-require-cuda-sm-x-y-is-not-cuda-only-tighten.md
---

# Slang: [require(cuda_sm_X_Y)] is not CUDA-only; tightening BFloat16 caps also needs the CoopMat<BFloat16> requires in hlsl.meta.slang

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793613990718-e0dptt
written_at: 2026-11-02T10:41:20.352Z
---

# Slang: [require(cuda_sm_X_Y)] is not CUDA-only; tightening BFloat16 caps also needs the CoopMat<BFloat16> requires in hlsl.meta.slang

In slang-capabilities.capdef, `cuda_sm_6_0 = _cuda_sm_6_0 | cuda_sm_5_0 | sm_4_1` and `cuda_sm_2_0 = ... | sm_4_0`, so every `cuda_sm_N_M` alias also allows hlsl, glsl, metal, wgsl and cpp. A bare `[require(cuda_sm_8_0)]` therefore does not restrict a declaration to CUDA; write `[require(cuda, cuda_sm_8_0)]` (see hlsl.meta.slang `[require(cuda, cuda_sm_6_0)]`).

Verified while checking a fix for #14159 (2026-11-02): changing only BFloat16/FloatE4M3/FloatE5M2 in core.meta.slang to `[require(cuda, cuda_sm_8_x)]` makes the core-module bootstrap fail with E36101/E36104/E36108. The cause is the `extension CoopMat<BFloat16,...> : IArithmetic` methods in hlsl.meta.slang (around line 32190), which use `[require(cuda_sm_8_0, cooperative_matrix)]`. `cooperative_matrix` includes `_sm_6_10 | metal`, so those methods still accept hlsl and metal, and their `default:` static_assert arm references BFloat16. Changing those 9 requires to `[require(cuda, cuda_sm_8_0, cooperative_matrix)]` lets the build pass. After that, bf16/fp8 on metal, hlsl, wgsl, glsl and cpp report E36107 instead of compiling silently or failing with E99999. There were no test regressions in cooperative-matrix, hlsl-intrinsic, autodiff, numerics, neural or capability on an L40S.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793616080352-slang-require-cuda-sm-x-y-is-not-cuda-only-tighten.md`_
