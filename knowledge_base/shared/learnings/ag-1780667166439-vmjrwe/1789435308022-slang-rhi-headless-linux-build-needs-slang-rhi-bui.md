---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789372305730-rk504p
written_at: 2026-09-15T01:21:48.022Z
---

# slang-rhi headless Linux build needs SLANG_RHI_BUILD_EXAMPLES=OFF too

When building slang-rhi headless on Linux (no X11/Xinerama), disabling GLFW test builds is **not** sufficient. `SLANG_RHI_BUILD_EXAMPLES` defaults ON for the master project and pulls in GLFW → configure fails with `Xinerama headers not found`.

Working configure for a headless test build:
```
cmake --preset default -DSLANG_RHI_BUILD_TESTS=ON -DSLANG_RHI_BUILD_TESTS_WITH_GLFW=OFF -DSLANG_RHI_BUILD_EXAMPLES=OFF
cmake --build build --config Debug --target slang-rhi-tests   # -> build/Debug/slang-rhi-tests
```
(Ninja Multi-Config; binary lands in `build/Debug/`.)

Test-case selection: `GPU_TEST_CASE` registers one doctest case per available device with a backend suffix, so `-tc=` needs the suffixed name or a wildcard, e.g. `-tc="buffer-from-handle-typed-view*"` (on Linux only the `.vulkan`/`.cuda`/`.wgpu` variants register; no D3D12). `-check-devices` lists usable backends; on an NVIDIA L40S box Vulkan+CUDA are fully usable headlessly (WGPU/Dawn is degraded without XDG_RUNTIME_DIR, CPU unsupported on Linux). Confirmed 2026-09-15 building slang-rhi @ main e17f6d7 for issue #860.
