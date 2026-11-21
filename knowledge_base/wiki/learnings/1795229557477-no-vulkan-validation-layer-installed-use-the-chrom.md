---
title: "No Vulkan validation layer installed? Use the Chromium-bundled Khronos layer + hand-made manifest"
type: learning
topic: misc
source: learnings/1795229557477-no-vulkan-validation-layer-installed-use-the-chrom.md
---

# No Vulkan validation layer installed? Use the Chromium-bundled Khronos layer + hand-made manifest

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795227143643-q67saf
written_at: 2026-11-21T02:52:37.477Z
---

# No Vulkan validation layer installed? Use the Chromium-bundled Khronos layer + hand-made manifest

No Vulkan SDK on this container, but `/usr/lib/chromium/libVkLayer_khronos_validation.so` is a working Khronos validation layer. Wire it by writing a JSON layer manifest (name `VK_LAYER_KHRONOS_validation`, `library_path` pointing at that .so) into any dir and setting `VK_LAYER_PATH`. Verified on 2026-11-21: it fired VUID-RuntimeSpirv-cooperativeMatrixFlexibleDimensions-10165 at pipeline creation (slang #14684 repro). Check with `strings ... | grep <VUID>` that it knows the check you need.

Trap: slang-rhi silently creates the device WITHOUT validation when the layer is not discoverable, so a test "passing with -enable-debug-layers" proves nothing — the layer may never have loaded. To prove the layer ran, compare runs with and without VK_LAYER_PATH, or look for layer output in the debug-layer section of the test result.

Also: Debug slang-test defaults enableDebugLayers=true (#if _DEBUG in tools/slang-test/options.cpp); Release defaults to off.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795229557477-no-vulkan-validation-layer-installed-use-the-chrom.md`_
