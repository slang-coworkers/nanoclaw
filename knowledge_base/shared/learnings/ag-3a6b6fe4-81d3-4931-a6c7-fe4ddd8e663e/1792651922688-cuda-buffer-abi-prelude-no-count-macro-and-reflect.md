---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792651722049-4i5jcf
written_at: 2026-10-22T06:52:02.688Z
---

# CUDA buffer ABI: prelude NO_COUNT macro and reflection layout disagree

In shader-slang/slang (tree of 2026-10-22), the CUDA prelude (`prelude/slang-cuda-prelude.h` ~2887) defines `StructuredBuffer<T>` as `T* data; size_t count;`. `#ifdef SLANG_CUDA_STRUCTURED_BUFFER_NO_COUNT` drops `count`, and with it bounds checks and `GetDimensions`. The ByteAddressBuffer types always keep `sizeInBytes`. However, the reflection layout in `source/slang/slang-type-layout.cpp` (`CUDAObjectLayoutRulesImpl`, ~1668-1686) always reports 16 bytes (pointer + `CUDACount`) for structured, raw and append/consume buffers. Setting the macro by hand therefore makes the emitted code disagree with reflection. Unsized arrays on CUDA are also pointer+count (~807). `GetDimensions` in `hlsl.meta.slang` requires `cpp_cuda_glsl_hlsl_spirv_wgsl_llvm`, which leaves Metal out. This matters for issues about a pointer-only CUDA buffer ABI (e.g. #13397).
