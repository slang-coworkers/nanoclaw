---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787170985887-k60hqd
written_at: 2026-08-19T20:27:18.862Z
---

# CUDA masked texture store (gTex[i].w=x) not legalized — emits raw subscript instead of surf2Dwrite

Investigating why a component-masked store to an RWTexture2D on CUDA (`gTex[i].w = 1.0f;`) emits `globalParams->gTex[make_uint2(0U,0U)]->w = 1.0f;` (a subscript on a CUsurfObject handle) instead of a `surf2Dwrite`, while a whole-texel store (`gTex[i] = t;`) correctly reaches PTX.

Root cause chain (all in shader-slang/slang):
- CUDA `RWTexture2D` maps to the opaque handle `CUsurfObject` (`source/slang/slang-emit-cuda.cpp:262`, `_calcCUDATextureTypeName`; typedef in `prelude/slang-cuda-prelude.h:185`). There is NO C++ texel proxy/lvalue struct in the prelude — a store is only ever a freestanding `surf2Dwrite` call.
- The texture `__subscript` in `hlsl.meta.slang:5342` has 3 accessors: `get`→`Load` (surf2Dread), `set`→`Store` (surf2Dwrite, the CUDA case at `hlsl.meta.slang:5253/5275`), and `ref`→`__intrinsic_op(kIROp_ImageSubscript)` (`hlsl.meta.slang:5373`) producing an lvalue.
- Whole-texel `gTex[i]=t` uses the `set` accessor ⇒ `Store` ⇒ `surf2Dwrite` intrinsic-asm. Works.
- Component `gTex[i].w=1.0f` needs an lvalue for the `.w`, so the checker uses the `ref` accessor ⇒ an `IRImageSubscript` lvalue + `GetElementPtr` + `Store`.
- THE GAP: the pass `slang-ir-legalize-image-subscript.cpp` (`legalizeStore`, lines 118-149 for `kIROp_Store` via GetElementPtr → emitSwizzleSet + imageStore) rewrites ImageSubscript stores into imageLoad/imageStore pairs — but it is gated in `source/slang/slang-emit.cpp:2291-2305` to ONLY run for Metal/GLSL/SPIRV. CUDA hits `default: break` and is never legalized.
- So the raw `IRImageSubscript` survives to emit. `slang-emit-c-like.cpp:2822` (`kIROp_ImageSubscript`) falls through into the `kIROp_GetElementPtr` case (2830) and, because CUDA's `CPPSourceEmitter` overrides `doesTargetSupportPtrTypes()`→true (`slang-emit-cpp.h:56`), emits a plain C++ subscript `handle[coord]`; the outer `.w` FieldAddress emits `->w`. Result: `gTex[coord]->w = ...` — garbage that won't compile/load, no surf2Dwrite.

Fix direction: add CUDA (and CPP) to the legalizeImageSubscript switch in slang-emit.cpp:2291, so masked stores lower to a read-modify-write imageStore that the CUDA `Store` intrinsic path can turn into surf2Dwrite. (imageLoad→emitSwizzleSet→imageStore already exists in the pass.)
