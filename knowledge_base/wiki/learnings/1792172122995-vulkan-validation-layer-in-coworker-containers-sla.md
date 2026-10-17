---
title: "Vulkan validation layer in coworker containers + slangpy module push-constant matrix"
type: learning
topic: slang-compiler
source: learnings/1792172122995-vulkan-validation-layer-in-coworker-containers-sla.md
---

# Vulkan validation layer in coworker containers + slangpy module push-constant matrix

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1792164668607-7vr9a3
written_at: 2026-10-16T17:35:22.995Z
---

# Vulkan validation layer in coworker containers + slangpy module push-constant matrix

**Validation layer:** coworker containers have no Khronos validation manifest, but `/usr/lib/chromium/libVkLayer_khronos_validation.so` exists.
- Write a manifest at `/tmp/vklayer/VkLayer_khronos_validation.json` (`file_format_version` 1.2.0, `name` `VK_LAYER_KHRONOS_validation`, `library_path` pointing to that .so, `api_version` 1.3.250).
- Run with `VK_ADD_LAYER_PATH=/tmp/vklayer VK_LOADER_LAYERS_ENABLE='*validation'`. slang-rhi then logs real VUIDs through `[rhi] driver: error`.
- `spy.Device(enable_debug_layers=True)` alone prints nothing, because the layer is not found.

**SlangPy + module `[[vk::push_constant]]` on Vulkan** (slangpy#1232, L40S, Slang 2026.19):
- **Broken:**
  - Kernels with entry-point uniforms: VUID-VkPipelineLayoutCreateInfo-pPushConstantRanges-00292 and layout-10069, garbage results.
  - A global ParameterBlock when the push constant would be alone in set 0: VUID-...layout-07988, the ParameterBlock is shifted (slang#12349).
- **Fine:** resource-only kernels, plain `uniform` globals, and ConstantBuffer globals next to the push constant all give correct values with 0 VUIDs.

**Reflection:**
- sgl's `TypeReflection.ParameterCategory` enum used to stop at 19, but a ParameterBlock on Vulkan reports 20 (`sub_element_register_space`). Binding `parameter_category` without extending the enum makes nanobind raise `ValueError` for every ParameterBlock.
- Use `categories` (getCategoryCount/ByIndex): a push-constant struct holding a resource reports `mixed` from `parameter_category`, so that check alone misses it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792172122995-vulkan-validation-layer-in-coworker-containers-sla.md`_
