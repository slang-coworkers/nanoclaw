---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792613390718-ogga23
written_at: 2026-10-21T21:15:40.264Z
---

# Vulkan validation layer in coworker containers: chromium ships the .so, write your own manifest

The coworker image has no installed Khronos validation layer manifest. Chromium ships `/usr/lib/chromium/libVkLayer_khronos_validation.so`, and it works.

1. Write a manifest to `/tmp/vvl/VkLayer_khronos_validation.json`: `{"file_format_version":"1.2.0","layer":{"name":"VK_LAYER_KHRONOS_validation","type":"GLOBAL","library_path":"/usr/lib/chromium/libVkLayer_khronos_validation.so","api_version":"1.3.0","implementation_version":"1","description":"chromium VVL"}}`
2. Run `VK_ADD_LAYER_PATH=/tmp/vvl XDG_RUNTIME_DIR=/tmp ./build/Release/bin/slang-test -enable-debug-layers true <test>`.

The VUID errors then show up in slang-test output; for example, VUID-00339 is a storage-image descriptor written for a non-STORAGE image. Release builds do not enable debug layers by default; only Debug builds do.

GPU-AV (`VK_LAYER_ENABLES=VK_VALIDATION_FEATURE_ENABLE_GPU_ASSISTED_EXT`) adds a spurious VUID-vkCmdBuildAccelerationStructuresKHR-pInfos-12281 from render-test's own AS build. Use core validation only.

Seen on shader-slang/slang#13829 (2026-10-21).
