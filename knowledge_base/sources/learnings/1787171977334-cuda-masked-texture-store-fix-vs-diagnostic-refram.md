---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787170985887-k60hqd
written_at: 2026-08-19T20:39:37.334Z
---

# CUDA masked texture store — fix-vs-diagnostic reframed by cross-backend RMW precedent

Triaging shader-slang/slang#12627 (CUDA/PTX: `gTex[i].w = 1.0f` on RWTexture2D emits `handle[coord]->w` subscript on CUsurfObject, nvrtc-rejected). Two non-obvious facts that flip the "fix or just diagnose?" decision:

1. **The read-modify-write IS the accepted lowering, not a compromise.** `legalizeImageSubscript`/`legalizeStore` (source/slang/slang-ir-legalize-image-subscript.cpp:151-178) rewrites a masked texture store into load-full-texel → swizzleSet → store-full-texel. This pass is gated to Metal/GLSL/SPIRV only at slang-emit.cpp:2291-2305; CUDA/WGSL/HLSL/CPP hit `default: break`. So when a reporter argues "an RMW isn't faithful for concurrent different-channel writes, so maybe diagnose instead" — that exact non-atomic RMW is ALREADY Slang's shipped behavior on 3 other GPU targets (confirmed via DeepWiki). ⇒ a CUDA-only compile-time error would be an unprincipled cross-backend divergence; the consistent fix is to route CUDA through the same RMW. A diagnostic, if wanted, should warn on ALL affected targets.

2. **"Just add CUDA to the legalize switch" is insufficient.** CUDA emitter has NO kIROp_ImageStore/kIROp_ImageLoad handler — only Metal/GLSL/SPIRV do (slang-emit-metal.cpp:989/1008, glsl:2672/2687, spirv:5538/5544). CUDA reaches surf2Dwrite/surf2Dread ONLY via the hlsl.meta.slang subscript accessors (`set`→Store→surf2Dwrite at hlsl.meta.slang:5275; `ref`→kIROp_ImageSubscript at :5373). Adding CUDA to the switch would emit ImageLoad/ImageStore ops CUDA can't render. Pragmatic route: a CUDA-local IR rewrite to `float4 t=gTex[i]; t.w=v; gTex[i]=t;` reusing the existing meta.slang Load/Store accessors.

GPU-free repro works fully in the prod fixer container: `slangc -target cuda` shows the bad subscript, `-target ptx` runs nvrtc (12.6 present) and reproduces the exact error; slangc exits 0 either way. C++ target compiles (its RWTexture prelude type has a real lvalue operator[]); WGSL shares the CUDA gap.
