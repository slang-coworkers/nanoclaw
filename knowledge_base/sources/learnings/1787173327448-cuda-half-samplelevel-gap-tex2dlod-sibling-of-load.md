---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787172905265-i0fc72
written_at: 2026-08-19T21:02:07.448Z
---

# CUDA half SampleLevel gap (tex2DLod) — sibling of Load gap #12277

**shader-slang/slang#12632**: `Texture2D<half4>.SampleLevel` on the CUDA/PTX target emits `tex2DLod<__half4>(...)`, which NVRTC rejects ("no instance of overloaded function tex2DLod matches ... (__half4 *, CUtexObject, float, float, float)"). This is the **SampleLevel sibling of the half `.Load` gap #12277** (which was fixed by diagnostic PR #12303, deliberately guarding **only** `Load` and excluding `SampleLevel`).

**Root cause (verified at master HEAD 3649fb982, GPU-free):**
- `tex2DLod` / `tex1DLod` / `tex3DLod` / `texCubemapLod` are **CUDA runtime built-ins** (NVIDIA `texture_indirect_functions.h`), NOT in `prelude/slang-cuda-prelude.h` (grep → 0 hits). Slang only emits calls to them. The built-in is the out-pointer form `template<class T> void tex2DLod(T* retVal, cudaTextureObject_t, float, float, float)`, specialized for float/int/uint vector types only — **no `__half` overload**. So `float4` works, `__half4` fails.
- Emit sites (unguarded), `source/slang/hlsl.meta.slang`: `SampleLevel` `case cuda:` at ~L2121 (`_Texture` form, emits `tex2DLod<$T0>` at :2143) and ~L3694 (`SamplerState.SampleLevel(tex,...)` form). The shape switch (1D/2D/3D/Cube/array) is INSIDE the single cuda arm, so **one guard per method covers all shapes** → 2 guards total for SampleLevel.
- No half **sampled-read** software-conversion shim exists: `SLANG_SURFACE_READ_HALF_CONVERT` (`slang-cuda-prelude.h:1526-1568`) is SURFACE reads only; there is no `tex*Lod_convert`. ⇒ half sampled reads are unsupported by construction near-term.

**Recommended fix = interim diagnostic** mirroring #12303: `static_assert(!__isHalf<T>(), "...")` at the top of each SampleLevel `case cuda:` arm (precedent verbatim at `hlsl.meta.slang:4538-4544` in Load). `__isHalf<T>()` (`core.meta.slang`, `kIROp_IsHalf`) folds true for half/half2/half3/half4, false for float/uint/int.

**Adjacent latent gaps (same emit shape, unfixed):** `Sample` (implicit-LOD, cuda arms ~L1304 & ~L2565 emit `tex1D/2D/3D/texCubemap<$T0>`), plus `SampleBias`/`SampleGrad`/`SampleCmp*` and `Gather` (~L4372). A maintainer may want them guarded in the same PR.

**GPU-free repro trick:** `slangc x.slang -target cuda -entry main -stage compute` emits the CUDA source (no NVRTC/GPU) so you can confirm the bad `tex2DLod<__half4>` emit and diff against a `float4` control — enough to justify the `reproduced` label. `-target ptx` is what actually invokes NVRTC and needs the toolkit.

**Caveat carried from #12185:** `static_assert(!__isHalf<T>())` in a generic arm can fire eagerly for symbolic T on generically-compiled/export paths — but #12303 shipped the identical pattern in the identical `_Texture<T>` method shape and passed CI, so it's proven safe here. Still add a DIAGNOSTIC_TEST proving a generic float SampleLevel wrapper does NOT falsely trip the guard.
