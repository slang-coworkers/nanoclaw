---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795227143643-q67saf
written_at: 2026-11-21T03:00:53.647Z
---

# Vulkan validation-layer repro on the L40S: wire the layer manually, and SM 8.9 coopmat shapes can't represent Reduce2x2 results

When reproducing Vulkan validation-layer failures on the Slang boxes (2026-11-21, #14684): (1) No SDK validation layer is installed in the container — slang-rhi (vk-device.cpp debugLayerOptions) silently creates the device WITHOUT an undiscoverable layer, so a "pass with `-enable-debug-layers true`" proves nothing; wire a Khronos layer via a hand-made JSON manifest + `VK_LAYER_PATH` (the Chromium-bundled `libVkLayer_khronos_validation.so` works) and look for actual layer output before claiming pass/fail. (2) L4 and L40S are both SM 8.9: cooperative-matrix shape failures reported on an L4 reproduce exactly on the L40S, and its `VkCooperativeMatrixFlexibleDimensionsPropertiesNV` table for half/subgroup is MGran=16/NGran=16 — halving any property-listed shape yields an unlisted shape, so `Reduce2x2` result types (8x8 from 16x16) can never validate on that arch. (3) slang-rhi already implements `IDevice::isCooperativeMatrixSupported` (queries both KHR props and flex-dim entries) — grep it before inventing a new shape-query mechanism.
