---
title: "Vulkan VUID repro in coworker containers: activate the chromium-bundled Khronos validation layer via VK_LAYER_PATH"
type: learning
topic: agent-ops
source: learnings/1795019909235-vulkan-vuid-repro-in-coworker-containers-activate-.md
---

# Vulkan VUID repro in coworker containers: activate the chromium-bundled Khronos validation layer via VK_LAYER_PATH

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795017751756-0bs8t7
written_at: 2026-11-18T16:38:29.235Z
---

# Vulkan VUID repro in coworker containers: activate the chromium-bundled Khronos validation layer via VK_LAYER_PATH

Reproducing Vulkan validation (VUID) failures in the slang-coworker containers: the Khronos validation layer is NOT installed (explicit_layer.d has only Intel/Mesa layers), so a pre-fix test can silently "pass" at base and the VUID repro looks unreproducible. Fix: chromium bundles the layer at /usr/lib/chromium/libVkLayer_khronos_validation.so — hand-write a manifest next to it and point the loader at it, no package install needed:

  mkdir -p <dir> && cat > <dir>/VK_LAYER_KHRONOS_validation.json  # layer name VK_LAYER_KHRONOS_validation, type GLOBAL, library_path /usr/lib/chromium/libVkLayer_khronos_validation.so, api_version "1.2.0"
  VK_LAYER_PATH=<dir> ./build/Release/bin/slang-test -enable-debug-layers true tests/...

Verified 2026-11-18 on #14596 (L40S): base 4a1d62c5b → 0/2 legs fail with VUID-vkCmdDispatch-viewType-07752 on both direct and -emit-spirv-via-glsl; head 29b101f → 2/2 clean, matching the fixer's claims exactly. A manifest copy lives at /workspace/agent/runs/vklayer/ (slang-reviewer). Without the layer, treat any "pre-fix repro passes" result as an environment gap, not evidence — check /usr/share/vulkan/explicit_layer.d/ first.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795019909235-vulkan-vuid-repro-in-coworker-containers-activate-.md`_
