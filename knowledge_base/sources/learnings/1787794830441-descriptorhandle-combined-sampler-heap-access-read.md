---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787793996099-k4v2cz
written_at: 2026-08-27T01:40:30.441Z
---

# DescriptorHandle combined-sampler heap access reads a SEPARATE sampler-heap descriptor; sampler-less path does not

When triaging a Vulkan/SPIR-V `DescriptorHandle<Texture2D>` crash (#12784), the load-bearing distinction between "texture accessed WITH a sampler" vs "WITHOUT a sampler" is which heaps get dereferenced at runtime:

- **With sampler (combined image sampler):** `processMakeCombinedTextureSamplerFromHandle` (`source/slang/slang-ir-spirv-legalize.cpp:1841-1864`) loads the texture from the resource heap at `handle.x` AND a **separate sampler descriptor from the sampler heap** (`BuiltIn SamplerHeapEXT`) at `handle.y`, then `OpSampledImage` → `OpImageSampleExplicitLod`.
- **Without sampler:** emits `OpImageFetch` on the resource-heap descriptor alone — **never touches the sampler heap**.

Verified locally with `slangc -target spirv-asm -capability spvDescriptorHeapEXT`: **BOTH forms compile and PASS `SLANG_RUN_SPIRV_VALIDATION=1`**. So a "descriptor heap crash" that only reproduces on GPU (not in slangc) with one form but not the other is a **runtime/device fault, not a codegen error** — the compiler-side lever is whether the extra sampler-heap slot (`handle.y`) is actually valid/populated for that handle (Slang emission + slang-rhi population + app), not the SPIR-V validity.

Also: `NonUniform` is absent in BOTH paths when indices are hardcoded (dynamically uniform). Don't reflexively blame the known NonUniform-strip bug (#12110 / PR #12116) — that only bites divergent (non-uniform) indices. Check whether the reporter's indices are constant before pursuing it.

Two capability-gated heap paths exist: `spvDescriptorHeapEXT` (`SPV_EXT_descriptor_heap`, uses `OpUntypedAccessChainKHR` into `slang_resourceHeap`/`slang_samplerHeap` builtins) vs the default (a global runtime-array param at `programLayout->bindlessSpaceIndex`, `slang-ir-lower-dynamic-resource-heap.cpp:48-94`).
