---
title: "Slang RHI feature gate + disabled Vulkan runtime test: the SLANG_RHI_FEATURES X-macro is the cross-repo bridge"
type: learning
topic: slang-compiler
source: learnings/1780969782467-slang-rhi-feature-gate-disabled-vulkan-runtime-tes.md
---

# Slang RHI feature gate + disabled Vulkan runtime test: the SLANG_RHI_FEATURES X-macro is the cross-repo bridge

From triaging shader-slang/slang#11519 (expose RHI gate for VK_NV_shader_atomic_float16_vector so disabled Vulkan COMPARE_COMPUTE tests can run). Reusable for any "add an RHI device-feature gate so a disabled Vulkan runtime test can be enabled" triage.

**The single bridge: `SLANG_RHI_FEATURES` X-macro.** It lives in slang-rhi (`include/slang-rhi.h`, ~line 104-180) and is the name table — each line `x(EnumName, "string-name")` generates BOTH the `rhi::Feature` enum entry AND the valid `-render-feature` string. shader-slang/slang's render-test (`tools/render-test/render-test-main.cpp` `_getFeatureFromName` ~:196, validated via `options.cpp` ~:146-165) generates its valid feature-name list FROM that same macro via the slang-rhi headers. **So adding one X-macro line in slang-rhi auto-makes `-render-feature <name>` valid in slang-test — no hand-edit in slang tooling.** A COMPARE_COMPUTE test that declares an unsatisfied `-render-feature` is IGNORED (createDevice returns SLANG_E_NOT_AVAILABLE), so re-enabling a test is SAFE even on no-GPU CI: it auto-skips where the feature is absent, runs where present.

**Vulkan detection pattern (slang-rhi `src/vulkan/`):** add a `VkPhysicalDevice*FeaturesNV/EXT` struct member to `VulkanExtendedFeatures` (`vk-api.h`), chain it with `EXTEND_DESC_CHAIN(deviceFeatures2, ...)` in `vk-device.cpp` query block, then a `SIMPLE_EXTENSION_FEATURE(struct, boolMember, VK_*_EXTENSION_NAME, { availableFeatures.push_back(Feature::X); ... })` block. Copy the closest existing atomic-float block as the template. Watch: the system `<vulkan/vulkan.h>` must define the FeaturesNV struct (newer extensions ~Vulkan 1.3.280+); a Vulkan-Headers bump may be needed.

**Cross-repo sequencing (always):** slang-rhi PR first → bump slang-rhi pin in shader-slang/slang → THEN the slang test-re-enable PR (the test PR won't compile against an old pin because the feature name is unknown). The substantive work is OFF-REPO in slang-rhi; the slang side is often ZERO compiler code (just test directives) when codegen+capability already landed.

**Two gotchas worth checking every time:** (1) "disabled test" reasons vary — distinguish a MISSING FEATURE GATE (fixed by this work) from a VALIDATION-LAYER rejection (NV driver allows it but spirv-val doesn't — needs `-skip-spirv-validation` or stays disabled regardless of the gate). (2) Verify the issue's cited test paths actually exist at HEAD — #11519 cited `byte-address-half-atomics-capability.slang` which doesn't exist (closest: `byte-address-half-atomics.slang`).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780969782467-slang-rhi-feature-gate-disabled-vulkan-runtime-tes.md`_
