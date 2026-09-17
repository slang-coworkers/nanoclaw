---
title: "slang-rhi OMM VUID-10904 CI red is likely a VVL 1.4.341.1 false positive — converter proven compliant on-hardware"
type: learning
topic: slang-compiler
source: learnings/1789600998422-slang-rhi-omm-vuid-10904-ci-red-is-likely-a-vvl-1-.md
---

# slang-rhi OMM VUID-10904 CI red is likely a VVL 1.4.341.1 false positive — converter proven compliant on-hardware

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789500735617-caju0o
written_at: 2026-09-16T23:23:18.422Z
---

# slang-rhi OMM VUID-10904 CI red is likely a VVL 1.4.341.1 false positive — converter proven compliant on-hardware

When a slang PR bumps `external/slang-rhi` onto an OMM-bearing commit (opacity micromap, slang-rhi #853/#852), the `test-linux-debug-gcc-x86_64-rhi / test-slang-rhi` job can fail `opacity-micromap-build.vulkan` / `-trace.vulkan` with **VUID-vkCmdBuildAccelerationStructuresKHR-pInfos-10904** ("if the OMM's indexType is VK_INDEX_TYPE_NONE_KHR, indexBuffer.deviceAddress must be 0").

**The slang-rhi OMM converter is NOT the cause — it's VUID-compliant.** `AccelerationStructureBuildDescConverter::convert` (`src/vulkan/vk-acceleration-structure.cpp`) writes `indexType` and `indexBuffer` together in mutually-exclusive branches: the Indexed branch (~L264-276) sets `UINT16/UINT32` + a real buffer; the Linear/`else` branch (~L277-280) sets `NONE` and never touches `indexBuffer`, which `opacityMicromapDatas.resize()` (~L201) value-initializes to 0. So it *cannot* emit `NONE + non-zero buffer`. The naive `ommData.indexBuffer = {};` "fix" in the else branch is a **no-op** (bytes already 0) — don't ship it.

**Why slang-rhi's own CI is green but slang's fails:** slang-rhi's Linux Vulkan CI runs on **lavapipe** (Mesa software Vulkan) which lacks `VK_EXT_opacity_micromap`, so the OMM tests `SKIP` (green). slang's `test-slang-rhi` runs on real OMM hardware with validation enabled → the tests execute and the layer fires the VUID. (Also: slang master often pins slang-rhi at a pre-OMM commit, so this only surfaces on a submodule-bump PR.)

**Best-supported hypothesis for the red:** a false positive in the **Vulkan SDK 1.4.341.1** validation layer on the recently-added OMM VUID-10904/10905 for the `indexType==NONE` case. Fix path is CI-side (pin/bump the validation-layer version or a targeted VUID suppression) or an upstream VVL report — not a slang-rhi code change.

**Methodology lesson (the useful bit):** when a validation-layer VUID won't reproduce locally because you only have a *different* VVL version (here v1.3.239, predating the VUID — a KHRONOS validation layer is often not installed by default; only MESA/INTEL manifests exist), do NOT install the SDK to chase it if that rebuilds a shared container. Instead **instrument the producer and capture the exact struct bytes handed to the Vulkan call on real hardware** — that is stronger evidence than a layer run and cleanly separates a real impl bug from a layer false positive. And never hand a maintainer a second *guessed* fix-site: the first guess here (`:277-280`) was a no-op; a verified byte-level trace is the real answer.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789600998422-slang-rhi-omm-vuid-10904-ci-red-is-likely-a-vvl-1-.md`_
