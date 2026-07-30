---
title: "CUDA texture Load half-texel gap: loud undefined-template vs #12274 silent-empty"
type: learning
topic: misc
source: learnings/1785373293265-cuda-texture-load-half-texel-gap-loud-undefined-te.md
---

# CUDA texture Load half-texel gap: loud undefined-template vs #12274 silent-empty

shader-slang/slang#12277 (jkwak CUDA/PTX series). Loading a half-typed READ-ONLY texture (`Texture2D<half/half2/half4>`, `Texture3D<half4>`) for CUDA/PTX emits a call to a prelude template that is declared-but-never-instantiated for half, so NVRTC fails with `tex2Dfetch_int<T> [with T=__half4] was referenced but not defined`.

**Mechanism (verified @HEAD 6462d7d2f):**
- Emit: `_Texture<T>.Load` cuda case maps to `tex2Dfetch_int<$T0>` / `tex3Dfetch_int<$T0>` where `$T0` = the texel element type — `source/slang/hlsl.meta.slang:4556`/`:4558`.
- Prelude: `template<typename T> ... T tex2Dfetch_int(...)` is DECLARED with no body at `prelude/slang-cuda-prelude.h:6144-6145`, but `SLANG_TEX2DFETCH_INT_IMPL` is only instantiated for `float`/`uint`/`int` (`:6180-6182`; 3D analog `:6223-6225`). No half instantiation → undefined-symbol link error. float4/uint4 work because their base types ARE instantiated.
- The `[require(cpp_cuda_glsl_hlsl_metal_spirv_wgsl, texture_sm_4_1)]` on Load (`:4528`) is TARGET-level only — it does not screen the element type, so nothing rejects half up front.

**Do NOT dedup with #12274.** Both are jkwak CUDA/PTX texel-type gaps but DISTINCT sites + failure classes:
- #12274 = `Buffer<T>.Load` `__target_switch` with NO cuda case (`hlsl.meta.slang:19361+`) → case-less switch emits an EMPTY helper body → SILENT miscompile (PTX=`ret;`), no error.
- #12277 = `_Texture<T>.Load` cuda case IS present, emits a well-formed call to an UN-INSTANTIATED prelude template → LOUD NVRTC "referenced but not defined" link error, half-only.
Rule of thumb: case-LESS switch → silent-empty; case-PRESENT + missing prelude instantiation → loud undefined symbol. Different bug, different fix location.

**Recommended fix = diagnose (Approach A), not implement.** Add a half-only guard in the cuda case: `static_assert(!__isHalf<T>(), "...")`. `__isHalf<T>()` already exists (`core.meta.slang:3950`, intrinsic `kIROp_IsHalf`) and `static_assert(false, "Unsupported 'Load' of 'texture' for 'cuda' target")` already sits at `hlsl.meta.slang:4561`; `static_assert` over a compile-time type predicate is precedented (`__isPackedInputInterpretation` guards at `:31496+`). Actually IMPLEMENTING half fetch is a separate feature — PTX `tex.*` int-coord fetches return f32/u32/s32, so half needs a SOFTWARE conversion path, exactly like the RWTexture `surf2Dread` half path (`docs/cuda-target.md:176-178`; docs `:329` already lists half texture as unsupported).

**GPU-free repro works** (no GPU needed — it's a compile/link gap): local Debug slangc + NVRTC 12.6, `slangc -target ptx -Xnvrtc "-I<cuda include>" half4-load.slang -o out.ptx` reproduces the exact reporter error; `-target cuda` only emits source and "succeeds" because it stops before NVRTC. Reuses the nvcc/NVRTC GPU-free validation recipe (learning 1783355453348).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785373293265-cuda-texture-load-half-texel-gap-loud-undefined-te.md`_
