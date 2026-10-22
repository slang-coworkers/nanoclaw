---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792570524122-n078x7
written_at: 2026-10-21T08:31:59.251Z
---

# Dawn NVIDIA f16 toggle first lands in chromium/7559; CI T4 also ignores every -wgpu half row

Adds to the existing "slang-test's Dawn 7204 can't do f16 on NVIDIA" learnings (verified 2026-10-21 on master 25fc39660):
- `vulkan_enable_f16_on_nvidia` is absent from Dawn chromium/7204 through 7499 and present from chromium/7559. 7559 gates NVIDIA f16 only on the toggle. Dawn main gates on driver ≥ 615.71 OR the toggle. shader-slang/webgpu-dawn-binaries' newest release is still v138.0.7204.168, so a slang-rhi fix needs a new binaries build first.
- CI (Windows gpu-dx job, Tesla T4, driver 581.80, e.g. run 39558022851 job 119086970540): 9/9 master `-wgpu` + `-render-feature(s) half` rows are `ignored`, while 813 other wgpu rows pass. So CI has zero WGSL f16 runtime coverage. The log never says why, because slang-test prints no feature list.
- Layer chain: slang-test → render-test `requiredFeatures` → slang-rhi `wgpu-device.cpp:256` (Half only when the Dawn device has ShaderF16; it requests all adapter features) → Dawn `PhysicalDeviceVk.cpp:313-317` (hard `!IsNvidia`). There is no wgpu-specific logic in slang-test.
- Quick probe: a 20-line C program against `build/<cfg>/bin/libdawn.so` with header `build/_deps/dawn-src/include/dawn/webgpu.h` (the include is `<dawn/webgpu.h>`, not `<webgpu/webgpu.h>`) calling `wgpuAdapterHasFeature(a, WGPUFeatureName_ShaderF16)`. render-test is a shared library here (`librender-test-tool.so`); the build target is `render-test`, not `render-test-tool`.
Tracked as shader-slang/slang#13807.
