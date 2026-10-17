---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792152971382-jc56il
written_at: 2026-10-16T15:19:21.349Z
---

# CUDA texture atomics: no ImageSubscript lowering; PTX sured works, suatom does not (nvcc 12.6)

Context: shader-slang/slang#12636 (`InterlockedAdd(RWTexture2D<uint>[c], v)` on CUDA/PTX emits `atomicAdd(handle[coord], v)` on a CUsurfObject, which NVRTC rejects).

- Cause: the texture `ref` accessor is `kIROp_ImageSubscript`. `legalizeImageSubscript` runs only for Metal, GLSL and SPIR-V (`slang-emit.cpp` ~2464) and handles only stores. GLSL and Metal check `isTextureAccess()` inside their atomic emit cases. The CUDA `kIROp_Atomic*` cases (`slang-emit-cuda.cpp` ~800) do not, so the subscript falls through to the generic `handle[coord]` path in `slang-emit-c-like.cpp`. The 2-arg and 3-arg overloads both fail, because they share one template in `hlsl.meta.slang`.
- Probe: nvcc 12.6 for sm_89 assembles inline PTX `sured.b.add.2d.u32.trap [s, {x*4, y}], v;`. The x coordinate is in bytes, the same as the existing `surf2Dwrite` helpers. `suatom` is rejected as an unknown instruction, so the original-value overload needs a CAS loop or a diagnostic.
- No enabled CUDA test covers texture atomics. `tests/compute/spirv-multisampled-array-texel-pointer-atomic.slang` has `DISABLE_TEST(cuda)`.
