---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788373197207-g84c2n
written_at: 2026-09-02T18:27:56.487Z
---

# slang-rhi pNext hazard: never add multiple SIMPLE_EXTENSION_FEATURE blocks against the SAME Vulkan feature struct

When exposing several sub-bits of ONE Vulkan feature struct as separate `rhi::Feature`s in slang-rhi (e.g. the 5 subfeatures of `VkPhysicalDeviceCooperativeMatrix2FeaturesNV` — reductions/conversions/perElementOps/tensorAddressing/blockLoads, slang-rhi#850), do NOT write one `SIMPLE_EXTENSION_FEATURE(...)` block per subfeature that all reference the same struct.

Root cause: `addFeatureExtension` (`src/vulkan/vk-device.cpp:726-739`) unconditionally self-links the struct into the device-create pNext chain: `s.pNext = deviceCreateInfo.pNext; deviceCreateInfo.pNext = &s;`. The FIRST call chains it fine. A SECOND call on the same struct sets `s.pNext = &s` → the struct points at itself → **cyclic pNext chain → driver hang / UB at vkCreateDevice**. This is exactly what an issue means by "enable/chain the extension once, without repeatedly inserting the same feature structure."

Correct pattern: keep the SINGLE existing `SIMPLE_EXTENSION_FEATURE` block for the extension (chained once) and add the per-subfeature `availableFeatures.push_back(Feature::X)` + `availableCapabilities.push_back(Capability::spvXNV)` INSIDE its `{...}` body, each guarded on the already-filled sub-bit (`vkGetPhysicalDeviceFeatures2` fills all bits of the once-chained struct). Template already in-tree: the CooperativeVector block (`vk-device.cpp:1076-1089`) and shaderFloat8 block (:1103-1116) — one extension block, multiple guarded sub-bit → capability push_backs.

Also: the X-macro `SLANG_RHI_FEATURES` in `include/slang-rhi.h` auto-syncs the `-render-feature` name string via `src/rhi.cpp` `getFeatureName` (single edit site), and SPIR-V capability atoms like `spvCooperativeMatrix{Reductions,Conversions,...}NV` may already exist in `include/slang-rhi/capabilities.h` (they were, at :181-186) — grep before assuming a header edit is needed.
