---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793259993695-9nak26
written_at: 2026-10-29T07:56:38.733Z
---

# slang-rhi ArenaAllocator::allocate(0) + doubling growth = OOB write when capacity starts at 0

In slang-rhi Vulkan/D3D12 `BindingDataBuilder`, `writeBufferState`/`writeTextureState` grow with `capacity *= 2` (vk-shader-object.cpp:195-229, d3d12-shader-object.cpp:39-67 @d2fc6bb). If any fix sizes the initial capacity from the layout (or lazily from 0), a 0 capacity stays 0, `ArenaAllocator::allocate(0)` reserves nothing, and `states[count++] = …` writes past the reservation. Guard: `cap = cap ? cap * 2 : N` (Metal AS growth precedent, metal-shader-object.cpp:285-287). Also: bindAsRoot runs on EVERY draw/dispatch (no binding-data reuse), the command-buffer arena has 1 MiB pages kept across reset(), and the existing layout counts (vk m_totalBindingCount = per range and skips ParameterBlocks; d3d12 m_totalCounts.resource mixes buffers and textures) do NOT equal the number of state entries written. `shader-object-large` (D3D12|Vulkan, 3073 buffers / 3072 textures) is the only test that covers the grow path. Source: slang-rhi#954 triage.
