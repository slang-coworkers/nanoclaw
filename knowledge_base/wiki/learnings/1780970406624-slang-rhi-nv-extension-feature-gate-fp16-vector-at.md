---
title: "slang-rhi NV-extension feature gate (fp16-vector atomics) + Vulkan-Headers v1.4.318 retires bump caveat"
type: learning
topic: slang-compiler
source: learnings/1780970406624-slang-rhi-nv-extension-feature-gate-fp16-vector-at.md
---

# slang-rhi NV-extension feature gate (fp16-vector atomics) + Vulkan-Headers v1.4.318 retires bump caveat

**Adding a slang-rhi device-feature gate for a Vulkan extension is a 4-edit, append-only pattern** (validated on slang#11519 / VK_NV_shader_atomic_float16_vector, slang-rhi @ 3bbff40):

1. `include/slang-rhi.h` SLANG_RHI_FEATURES X-macro (~L104–173): one line `x(EnumName,"feature-string")` generates BOTH `rhi::Feature::EnumName` AND the valid `-render-feature` string. slang's render-test auto-derives its name map from this → **zero hand-edits in slang tooling**.
2. `src/vulkan/vk-api.h` VulkanExtendedFeatures struct: add the `VkPhysicalDevice<X>FeaturesNV/EXT member = { VK_STRUCTURE_TYPE_... }`.
3. `src/vulkan/vk-device.cpp`: `EXTEND_DESC_CHAIN(deviceFeatures2, extendedFeatures.<member>);` (chains into pNext query).
4. `src/vulkan/vk-device.cpp`: `SIMPLE_EXTENSION_FEATURE(extendedFeatures.<member>, <vkBoolField>, VK_<EXT>_EXTENSION_NAME, { availableFeatures.push_back(Feature::<X>); availableCapabilities.push_back(Capability::<cap>); });` — copy the closest existing atomic block.

**Non-obvious gotchas:**
- The render-test `-render-feature` gate reads `availableFeatures` (the Feature enum) ONLY — but for a runtime COMPARE_COMPUTE to actually compile the intrinsic, the device must also advertise the SPIR-V capability via `availableCapabilities.push_back(Capability::...)`. Push BOTH. (The matching `Capability::_GL_NV_shader_atomic_fp16_vector` already existed in slang-rhi capabilities.h.)
- **Vulkan-Headers is pinned at v1.4.318** (slang-rhi CMakeLists.txt:215, FetchContent). It already defines NV/EXT structs published up through ~mid-2025 — e.g. `VkPhysicalDeviceShaderAtomicFloat16VectorFeaturesNV` (vulkan_core.h:21272, member `shaderFloat16VectorAtomics`), STYPE `...=1000563000` (L1234), `VK_NV_SHADER_ATOMIC_FLOAT16_VECTOR_EXTENSION_NAME` (L21271). So the common "headers may predate the extension" caveat is usually already retired — verify by `curl raw.githubusercontent.com/KhronosGroup/Vulkan-Headers/v1.4.318/include/vulkan/vulkan_core.h` and grep, don't assume a bump is needed.
- **ABI nuance:** the Feature enum is generated `SLANG_RHI_FEATURES(...) _Count`. Mid-macro insert shifts later enumerators' integer values. Benign for the slang↔slang-rhi build-from-source pinning, but if strict no-shift matters, append at the very end. Precedent: slang-rhi PR #658 (atomic-bfloat16) appended at end.
- slang-rhi compiles HEADLESS here (no GPU/Vulkan SDK) via FetchContent — Vulkan backend may need libx11-dev. But the device-feature DETECTION path (`DeviceImpl::initVulkanDevice`) only runs against a real physical device → a compile-verify is possible, a functional-verify is NOT without the GPU + extension.
- Cross-repo sequence: slang-rhi gate PR → bump `external/slang-rhi` pin in slang → (capability PR merges) → slang test-re-enable PR. A disabled test using `-render-features <name>` that the device can't satisfy auto-skips (SLANG_E_NOT_AVAILABLE), so re-enabling is safe on no-GPU CI. Distinguish missing-gate vs validation-layer-rejection disables — the latter aren't fixed by the gate.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780970406624-slang-rhi-nv-extension-feature-gate-fp16-vector-at.md`_
