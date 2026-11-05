---
title: "slang-rhi WGPU GPU repro in ~5 min without building the tests; bisect by release with relink"
type: learning
topic: verification
source: learnings/1793808992860-slang-rhi-wgpu-gpu-repro-in-5-min-without-building.md
---

# slang-rhi WGPU GPU repro in ~5 min without building the tests; bisect by release with relink

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793376172505-q0pht6
written_at: 2026-11-04T16:16:32.860Z
---

# slang-rhi WGPU GPU repro in ~5 min without building the tests; bisect by release with relink

To check a slang-rhi WebGPU (Dawn) pipeline issue against a local slang build:
1. `cmake -S slang-rhi -B b -G Ninja -DCMAKE_BUILD_TYPE=Release -DSLANG_RHI_FETCH_SLANG=OFF -DSLANG_RHI_SLANG_INCLUDE_DIR=$SLANG/include -DSLANG_RHI_SLANG_BINARY_DIR=$SLANG/build/Release -DSLANG_RHI_ENABLE_CUDA=OFF -DSLANG_RHI_ENABLE_VULKAN=OFF -DSLANG_RHI_BUILD_TESTS_WITH_GLFW=OFF` (fetches Dawn prebuilt), then `cmake --build b --target slang-rhi` (20 s on 64 cores).
2. Write a ~100-line main.cpp against the public slang-rhi API and link it with `-Wl,--start-group -lslang-rhi -lslang-rhi-resources -Wl,--end-group -lslang-compiler -ldl -lpthread`. `libdawn.so` must sit next to the exe; it is loaded relative to the module that contains getRHI.
3. On the L40S, Dawn picks the NVIDIA Vulkan adapter. Ignore the "XDG_RUNTIME_DIR" and "shaderUniform*ArrayDynamicIndexing" warnings. Dawn validation errors arrive through IDebugCallback.

Gotchas:
- GLSL source needs `SlangGlobalSessionDesc::enableGLSL = true` on a global session that you pass in through `DeviceDesc.slang.slangGlobalSession`. Otherwise you get "'glsl' module not available". The module path must end in `.glsl`.
- Release bisect: LD_LIBRARY_PATH does NOT swap slang versions, because libslang-compiler's soname is versioned (`.so.0.<ver>`). Relink one exe per release package instead (`-L rel/lib -lslang-compiler -Wl,-rpath,rel/lib`) and confirm with `ldd`.
Used on shader-slang/slang#13972 (v2026.20 OK, v2026.21 fails).

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1793808992860-slang-rhi-wgpu-gpu-repro-in-5-min-without-building.md`_
