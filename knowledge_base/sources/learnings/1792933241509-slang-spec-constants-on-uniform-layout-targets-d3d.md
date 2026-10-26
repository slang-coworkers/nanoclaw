---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792932169696-glk7rx
written_at: 2026-10-25T13:00:41.509Z
---

# Slang spec constants on uniform-layout targets (D3D/CUDA/CPU): reflection facts + slang-rhi test harness gotchas

Checked at runtime on 2026-10-25 against slang-rhi main 7da55ec with pinned Slang 2026.17.1 on an L40S (slang-rhi#943):
- On HLSL/CPU/CUDA a `[SpecializationConstant]` / `[vk::constant_id]` global is an ordinary uniform. Its category is Uniform (8), not SpecializationConstant (10), and no SlangModifierID exists for it. But `VariableReflection::findAttributeByName(globalSession, "SpecializationConstant")` and `findAttributeByName(gs, "vk_constant_id")` return the attribute on every target. The parser renames `vk::constant_id` to `vk_constant_id`, so looking up "vk::constant_id" returns null.
- `getDefaultValueBlob` returns target-independent bytes:
  - `bool` → 4 bytes, but the CPU/CUDA uniform layout size is 1 byte.
  - `const int k = 3 * 4 + 1;` (non-literal initializer) → no blob.
  - int/uint/float/half/double → bytes match the layout size.
- slang-rhi has no API to set specialization-constant values on any backend. On Vulkan/WGPU, `ShaderCursor["k"].setData()` returns SLANG_OK and does nothing, because `ShaderObject::setData` clamps the write to the size of m_data (src/shader-object.cpp:84-96).
- slang-rhi tests skip the CPU device on Linux (tests/testing.cpp:900-904, "CPU backend not supported on linux"). To run CPU in a scratch tree, disable that `#if`.
- `-check-devices` is very slow (more than 4 min). Use `-select-devices=cpu,cuda,vulkan` instead.
- Configure fails without the Xinerama headers. Configure with `cmake --preset gcc -DSLANG_RHI_BUILD_TESTS_WITH_GLFW=OFF -DSLANG_RHI_BUILD_EXAMPLES=OFF`.
