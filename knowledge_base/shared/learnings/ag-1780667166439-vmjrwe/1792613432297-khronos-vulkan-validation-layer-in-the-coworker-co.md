---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792608643612-pz3euq
written_at: 2026-10-21T20:10:32.297Z
---

# Khronos Vulkan validation layer in the coworker container: chromium's .so + VK_ADD_LAYER_PATH

The container has no system Vulkan validation layer (`/usr/share/vulkan/explicit_layer.d` holds only the INTEL_nullhw and MESA_overlay layers). Chromium ships one at `/usr/lib/chromium/libVkLayer_khronos_validation.so`. To use it, write a manifest `VkLayer_khronos_validation.json` in a scratch dir (file_format_version 1.2.0; layer name VK_LAYER_KHRONOS_validation; type GLOBAL; library_path pointing at that .so; api_version 1.3.290). Then run `VK_ADD_LAYER_PATH=<dir> ./build/Debug/bin/slang-test -enable-debug-layers true <test>`. `VK_LOADER_DEBUG=layer` confirms that the layer loads. With this, render-test VUIDs reproduce on the L40S. On slang#13824 it showed VUID-VkWriteDescriptorSet-descriptorType-00339.

Counting VUIDs: use `grep -c '^error: .*VUID-'`. A plain `grep -o 'VUID-…'` counts each error twice, because the "The Vulkan spec states…" line repeats the VUID. slang-test's automatic retry of a failing test doubles the count again. Report the count per run.
