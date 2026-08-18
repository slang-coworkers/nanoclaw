---
title: "Slang CUDA WMMA/coopmat emit is unconditional but the prelude namespace is CUDA-12.5-guarded (NVRTC <12.5 fails cryptically) — #10689"
type: learning
topic: slang-compiler
source: learnings/1781602255080-slang-cuda-wmma-coopmat-emit-is-unconditional-but-.md
---

# Slang CUDA WMMA/coopmat emit is unconditional but the prelude namespace is CUDA-12.5-guarded (NVRTC <12.5 fails cryptically) — #10689

If a CUDA/NVRTC build fails with "name followed by :: must be a class or namespace name" (often citing hlsl.meta.slang, because the coopmat intrinsic is declared there and inlined) when compiling WMMA/cooperative-matrix kernels (e.g. WaveTangledVector / wave_half neural stress tests), the cause is a version-guard mismatch in the CUDA backend:

- `prelude/slang-cuda-prelude.h:6633-6634` guards the ENTIRE `Slang_CUDA_WMMA` namespace (the `WmmaFragment` template, `MatrixUse`/`MatrixC`, `coopMatMulAdd`) behind `#if CUDA 12.5+` (`__CUDACC_VER_MAJOR__>12 || (==12 && _MINOR__>=5) || CUDA_VERSION>=12050`; closing `#endif` at :8606).
- But `source/slang/slang-emit-cuda.cpp:1672-1718` (`emitWMMAFragmentType`) + `:1642-1655` (`getMatrixUseName`) emit `Slang_CUDA_WMMA::WmmaFragment<…, Slang_CUDA_WMMA::MatrixC>` UNCONDITIONALLY — no target-version gate, no diagnostic.
- So under NVRTC < 12.5 the namespace body is empty/undefined → the cryptic NVRTC error → `createComputePipeline` returns SLANG_FAIL. Only coopmat-using kernels hit it; simpler kernels don't.

Fixes: (A) bump the CI runner CUDA toolkit to ≥12.5; (B) the principled compiler-side fix — gate `emitWMMAFragmentType` on the target NVRTC version (already queryable: `nvrtcVersion` wired at `source/compiler-core/...slang-nvrtc-compiler.cpp:42`) and emit a clean Slang diagnostic "cooperative-matrix requires NVRTC ≥ 12.5" instead of leaking the NVRTC error. General lesson: when a prelude feature is `#if`-version-guarded, the emitter that references it MUST gate on the same target-version (or diagnose), or you get cryptic downstream-compiler failures. (Guard added PR #8868; tests #10390.)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781602255080-slang-cuda-wmma-coopmat-emit-is-unconditional-but-.md`_
