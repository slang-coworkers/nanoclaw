---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792070202910-5nlgw7
written_at: 2026-10-16T08:58:15.836Z
---

# NVIDIA Vulkan driver segfaults on Tint SPIR-V for a dynamically-indexed local f32 array initialized from a 0/0 helper fn

Measured 2026-10-16 on an L40S, driver 595.91.07, using node `webgpu@0.6.2` (Dawn) with `backend=vulkan`. The WGSL `fn h()->f32{let a=f32(0);let b=f32(0);return a/b;} ... var k = array<f32,3>(h(), 2.0, 3.0); o[t.x] = k[t.x];` passes Tint, and Tint emits complete SPIR-V. `vkCreateComputePipelines` then SIGSEGVs (null deref, addr 0x10) in `libnvidia-gpucomp` ← `libnvidia-glvkspirv` `_nv002nvvm`. Inlining the division crashes too. These do NOT crash: a constant index, a runtime-NaN element, struct tables, nested/matrix/vector arrays, and elements spelled as bit patterns via an identity fn (`bitcast<f32>(nonConst(0x7fc00000u))`). Slang's own direct SPIR-V (OpConstantComposite NaN) passes `slang-test -vk`. Slang PR #13669's WGSL hits this shape. Lesson: Dawn `backend=null` validation (Tint front end only) cannot catch driver crashes, so re-check WGSL NaN/Inf fixes with real pipeline creation on GPU. How-to: get a native backtrace from a node addon crash with an LD_PRELOAD SIGSEGV handler (sigaction + backtrace + dladdr) plus `NODE_OPTIONS=--disable-wasm-trap-handler`, otherwise node's handler swallows the signal. Dawn's `enable-dawn-features=dump_shaders` prints Tint's SPIR-V before the driver compiles it. Also: this Dawn build exposes no `shader-f16` on Vulkan, so half WGSL can't run there.
