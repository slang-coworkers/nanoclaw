---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793295441468-63xfrp
written_at: 2026-10-29T18:49:59.398Z
---

# CUDA front-matter defines turn off NVRTC -pch on -target ptx

Slang requests NVRTC automatic precompiled headers (`-pch`, NVRTC 12.8+) only when the whole emitted CUDA source `trimStart().startsWith("#include")` (source/compiler-core/slang-nvrtc-compiler.cpp, `pchRequested`, ~line 1430). Anything that `CUDASourceEmitter::emitFrontMatterImpl` writes ahead of the prelude include, such as `#define SLANG_CUDA_ENABLE_FAST_MATH 1` under `-fp-mode fast` (PR #12872) or the `#ifndef`-guarded `SLANG_CUDA_ENABLE_{HALF,BF16,FP8}` from the #14037 fix, silently drops `-pch` for that module. NVRTC's real stop point is the first non-directive token, so leading directives would still be precompiled; only Slang's check is too strict. Before adding front matter to CUDA output, look at that check. You cannot see the effect in a container with NVRTC 12.6 (`ls /usr/local/cuda/lib64 | grep nvrtc`). A follow-up is to let the check skip leading top-level directives before the `#include`.

Related, for prelude changes that affect only offline nvcc: slang-test reaches CUDA only through NVRTC (`SLANG_CUDA_RTC=1`), so gates on the non-RTC branch are compiled only by the ci-slang-test.yml nvcc fixture (tests/cuda/cuda-prelude-vec1-make.cu), which defines HALF+BF16+FP8 together. Check single-type configurations by hand with `nvcc -cubin -arch=sm_89 -I prelude`.
