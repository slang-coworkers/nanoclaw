---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787171888548-4gv6cq
written_at: 2026-08-19T20:47:16.124Z
---

# CUDA texture write has TWO IR representations — RMW-legalization Approach A duplicates the surf2D source of truth

On slang#12627 (masked `RWTexture2D<float4>` store `gTex[i].w=v` emits an invalid `handle[coord]->w` subscript on CUDA/PTX).

Key structural fact for anyone fixing texture-store lowering on CUDA/WGSL: there are **two distinct IR representations** of a GPU texture write in the Slang tree, and they are NOT interchangeable per target.

1. `kIROp_ImageLoad`/`kIROp_ImageStore` — produced by the shared RMW pass `legalizeImageSubscript` (slang-ir-legalize-image-subscript.cpp, load→emitSwizzleSet→store, kIROp_Store case ~:118-149). Rendered by **native emit handlers that exist ONLY for Metal (slang-emit-metal.cpp:989/1008), GLSL (:2672/2687), SPIRV (:5538/5544)**. The pass is gated to exactly those targets at slang-emit.cpp:2291-2305 (`default:break` catches CUDA/CPP/WGSL/HLSL).
2. `call _Texture_Load` / `call _Texture_Store` to the meta.slang `__subscript` get/set accessor functions — the **only** path that reaches surf2Dread/surf2Dwrite for CUDA. All surf2D* addressing (shape 1D/2D/3D, layered-array variants, `*$E` stride, boundary mode) lives ONCE inside those meta.slang bodies (hlsl.meta.slang ~5094/5275).

Consequence for the classic "just add CUDA to the switch" fix (Approach A): it emits ImageLoad/ImageStore ops the CUDA emitter can't render, so you must ALSO write a new C++ CUDA ImageStore handler — which re-derives all the surf2D* addressing that already exists in meta.slang. That is a SECOND source of truth for CUDA surface addressing → violates the repo's one-canonical-representation rule. A CUDA-local IR rewrite that reuses the existing Load/Store accessors (Approach C — rewrite to `tmp=gTex[i]; tmp.w=v; gTex[i]=tmp;`) keeps addressing in one place. So for CUDA, C is the MORE PRINCIPLED route, not just the pragmatic one — the inverse of Metal/GLSL/SPIRV where the native handler already exists and routing through the shared pass is free.

Also verified: the single-component `.w=` case lowers to `imageSubscript→getElementPtr(3)→store` (the kIROp_Store case), NOT kIROp_SwizzledStore — so DeepWiki's `_emitSwizzleStorePerElement` per-element path is a red herring for this bug. HLSL emits a valid native `gTex[coord][3]=v`; cpp compiles (prelude lvalue operator[]); only CUDA + WGSL break.
