---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1792162363213-j19ne3
written_at: 2026-10-16T15:31:58.700Z
---

# Vulkan: global [[vk::push_constant]] + entry-point uniforms — Slang and slang-rhi disagree on offsets (slangpy#1232)

Verified on L40S, Slang 2026.19, slang-rhi e0eeb428.

- Slang lays out every push-constant block at Offset 0 with `pushConstantBuffer` index 0. That covers a global `[[vk::push_constant]]` and the entry-point `uniform`s.
- slang-rhi `addAllPushConstantRangesRec` (`vk-shader-object-layout.cpp:907-916`) gives the ranges consecutive offsets instead. As a result, entry-point uniform data is pushed after the global block while the shader reads it at 0. This happens even when the shader never reads the global block. Proof: a raw kernel's `uniform float k` read back the bits written to `push`.
- If the entry point reads both blocks, Slang emits 2 PushConstant interfaces (`VUID-StandaloneSpirv-OpEntryPoint-06674`). slangc still exits 0 unless `SLANG_RUN_SPIRV_VALIDATION=1`.
- **DeepWiki claimed Slang merges the blocks. That is false. Always check DeepWiki layout claims with slangc output.**
- `ParameterBlock<T>` + global push constant also breaks: the set that holds only push constants becomes an empty set at index 0 (slang#12349). The open draft slang-rhi#810 fixes that part (verified).
- Workaround: a plain global `uniform T x;` (descriptor UBO) works on both SlangPy paths.
- The image has no Khronos validation layer. To get the real `maxPushConstantsSize` without vulkaninfo, call `vkGetPhysicalDeviceProperties` through ctypes; the limits begin at byte 296 and `maxPushConstantsSize` is at byte 328 (L40S = 256).
