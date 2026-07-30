---
name: project_12277_cuda_ptx_half_texture_load_undefined_fetch
description: "slang#12277 CUDA/PTX half Texture.Load references undefined tex*fetch_int<half> prelude templates — triaged P2, Approach A (diagnose) recommended, held for jkwak maintainer scoping"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2e9c46bd-ffcc-429d-bd82-9a10823a82e8
---

# slang#12277 — [CUDA/PTX] Half texture Load → undefined tex*fetch_int<half> templates

Self-filed by **jkwak-work** (maintainer), part of his CUDA/PTX series. Triaged 2026-07-30. **P2 / medium**, bug; component = target-emit (CUDA/PTX) + core-module prelude. Verified @HEAD `6462d7d2f` (GPU-free, NVRTC).

**Bug:** `_Texture<T>.Load` for CUDA/PTX emits a call to `tex2Dfetch_int<$T0>` / `tex3Dfetch_int<$T0>` (hlsl.meta.slang:4556/4558) but the prelude only instantiates float/uint/int specializations (`SLANG_TEX{2,3}DFETCH_INT_IMPL` @ slang-cuda-prelude.h:6180-6182 / 6223-6225) — **no half/half2/half4**. `-target cuda` "succeeds" (emits unresolved call as source); `-target ptx` FAILS at NVRTC: `tex2Dfetch_int<T> [with T=__half4] referenced but not defined`. Repros for Texture2D<half|half2|half4> + Texture3D<half4>; float4/uint4 controls clean.

**NOT a dup** (verified at code level): #12274 = `Buffer<T>.Load` case-LESS switch → silent empty helper (loud vs silent — different site/class); #12182 = -rdc linkage; old #1798 = format conversion on binding, not fetch-template instantiation.

**Approaches:**
- **A [RECOMMENDED, small]:** diagnose up-front — add `static_assert(!__isHalf<T>(), ...)` guard in cuda case of `_Texture.Load` (hlsl.meta.slang:4537-4561). `__isHalf<T>()` exists (core.meta.slang:3950); static_assert-over-type-predicate is precedented. Scope guard **half-only** — must NOT reject float/uint/int, must NOT touch RWTexture<half> surf2Dread software path (docs/cuda-target.md:176). Add DIAGNOSTIC_TEST (half4 fires, float4 clean). Reference RWTexture surface workaround in diagnostic/PR.
- **B [separate feature]:** add half instantiations w/ software conversion (fetch f32 → convert half). High effort/risk; maintainer scoping decision, not this bug fix.
- C (docs-only): rejected; docs already note limitation (cuda-target.md:329) but leave confusing NVRTC error.

**State:** triage memo at inbox/a2a-1785373317631-6g6axw/triage-12277.md. **HELD for jkwak maintainer scoping (A vs B)** — his own issue; do NOT auto-dispatch fix. Fix authorized only on his "make a PR" signal. Triager to post VERIFIED verdict on GitHub. Canonical thread `gh-issue-shader-slang/slang-12277`.

Related: [[project_12274_ptx_buffer_empty_kernel]] · [[project_12273_cuda_callable_output_crash]] · [[project_12182_cuda_optix_callable_rdc_linkage]]. Learning: case-less-target-switch (#12274 silent sibling); cuda-prelude-nvcc GPU-free recipe.
