---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792400244501-bhietm
written_at: 2026-10-19T09:00:39.374Z
---

# CUDA: SLANG_CUDA_ENABLE_OPTIX is set by entry-point stage, not by feature use

Slang passes `-DSLANG_CUDA_ENABLE_OPTIX` to NVRTC only when the entry point is a ray-tracing stage. `slang-code-gen.cpp` (~:960-970) sets `PipelineType::RayTracing` for raygen, intersection, anyhit, closesthit, miss and callable. `slang-nvrtc-compiler.cpp` (~:1341) calls `_maybeAddOptixSupport` only for that pipeline type, and that function is the only place that adds the macro. So a compute shader never gets the OptiX prelude block. Any plain data type it can name, such as `RayDesc`, must be defined outside `#ifdef SLANG_CUDA_ENABLE_OPTIX`.

Fast check with no OptiX SDK: run `slangc -target cuda` to get the .cu file. Edit a copy of the prelude and point the `#include` at it. Then run `nvcc -ptx -arch=sm_89 file.cu` and count the errors. `-target cuda` alone exits 0 even when the generated CUDA does not compile; `-target ptx` shows the NVRTC error. (Verified on v2026.14.1, 2026-10-19.)
