---
title: "ResourceDescriptorHeap/SamplerDescriptorHeap input syntax is front-end-only — backend already exists"
type: learning
topic: misc
source: learnings/1781219589907-resourcedescriptorheap-samplerdescriptorheap-input.md
---

# ResourceDescriptorHeap/SamplerDescriptorHeap input syntax is front-end-only — backend already exists

Triaging slang#11568 (expose HLSL SM6.6 `ResourceDescriptorHeap[i]` / `SamplerDescriptorHeap[i]` direct-indexing as Slang INPUT for SPIR-V+DXIL): the entire descriptor-heap backend ALREADY exists and is reachable today only via `DescriptorHandle<T>`. These two names are NOT input-language builtins — they appear only as HLSL *emission output*. So a request to "support `ResourceDescriptorHeap[i]` input syntax" is front-end surface-syntax work, not new codegen.

Verified file:line @ HEAD 45c04170f (shader-slang/slang):
- HLSL backend literally emits `ResourceDescriptorHeap[...]`/`SamplerDescriptorHeap[...]`: `source/slang/slang-emit-hlsl.cpp:1328-1345`.
- Lowering switch `defaultGetDescriptorFromHandle` (HLSL + `case spvDescriptorHeapEXT:` branches): `hlsl.meta.slang:27228-27328`. SPV_EXT_descriptor_heap is already wired.
- `DescriptorHandle<T>` def `hlsl.meta.slang:27076-27154`; load intrinsics `:27194-27200` (`kIROp_Load{Resource,Sampler}DescriptorFromHeap`).
- SPIR-V heap ops/emit: `slang-ir.cpp:3191-3197`, `slang-ir-spirv-legalize.cpp:1773-1781`, `slang-emit-spirv.cpp` emitDescriptorHeapLoad ~7110-7155.
- Capability: `slang-capabilities.capdef:683` SPV_EXT_descriptor_heap, `:945` spvDescriptorHeapEXT.

Recommended implementation: declare magic globals `ResourceDescriptorHeap`/`SamplerDescriptorHeap` in hlsl.meta.slang whose `operator[]` yields `DescriptorHandle<T>`, riding the EXISTING handle→T implicit-conversion + lowering. No new IR insts/emitters. Crux: HLSL infers the indexed result's resource type `T` from assignment/usage context (`Texture2D t = ResourceDescriptorHeap[i];`); reusing DescriptorHandle<T>→T coercion best sidesteps this.

Design note: accepting this as Slang *input* is a language-surface decision in maintainer @jkwak-work's active `siggraph2026` descriptor-heap cluster — confirm intent before building. #9699 (CLOSED) covered DescriptorHandle+SPV_EXT, NOT this syntax, so it is NOT a duplicate.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1781219589907-resourcedescriptorheap-samplerdescriptorheap-input.md`_
