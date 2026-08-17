---
title: "Descriptor-heap ConstantBuffer<T> SPIR-V crash cluster — 3 fixes landed, verify at ToT"
type: learning
topic: slang-compiler
source: learnings/1783459628122-descriptor-heap-constantbuffer-t-spir-v-crash-clus.md
---

# Descriptor-heap ConstantBuffer<T> SPIR-V crash cluster — 3 fixes landed, verify at ToT

The `spvDescriptorHeapEXT` + `ConstantBuffer<T>` SPIR-V surface has a cluster of related-but-distinct defects. Before asserting any crash/miscompile here repros, **rebuild slangc at true HEAD** — several fixes landed in 2026, and stale binaries/releases mislead.

Landed fixes (all merged):
- **#11211** (merged 2026-06-02, fixes #11037) — crash `assert failure: !"expected lowered buffer resource type to be a pointer"` via `getDescriptorFromHandle(ConstantBuffer<T>.Handle)` on a param.
- **#11647** (merged 2026-07-07, fixes #11483) — *wrong data* (not a crash): nested-array members read back garbage because the heap CB pointer was lowered to Uniform class w/o `ArrayStride`. Fix emits it in **StorageBuffer** class (`getStorageBufferAddressSpace()`, `processConstantBufferDescriptorHeapLoad`, `wrapRemainingConstantBufferElementTypes` in slang-ir-spirv-legalize.cpp). Confirm active by grepping emitted SPIR-V for `SPV_KHR_storage_buffer_storage_class`.

The assert `SLANG_UNEXPECTED("Constant buffer type remaining in spirv emit")` lives at slang-emit-spirv.cpp `kIROp_ConstantBufferType` case (~:2464). A `ConstantBufferType` reaching final emit = an upstream lowering pass didn't translate it to a pointer.

Still OPEN (same assert, different trigger): **#4472** — `ConstantBuffer<Foo> myCB2[2][2]` multidim array, no descriptor heap.

Case in point: **#11980** (filed 2026-07-07 for a Discord report via jkwaknv) — "copy heap `ConstantBuffer<T>` into a local var crashes." Did NOT reproduce at HEAD 1bd105cee; the local-var-copy repro compiles clean to valid SPIR-V. Filed asking the reporter for their `slangc -v` since it's almost certainly a stale build hitting an already-fixed path. Lesson: when a Discord/old-release crash report lands on this surface, the first move is a ToT rebuild + recompile, not a fixer dispatch.

Note the auto-deref gap: `DescriptorHandle<ConstantBuffer<T>>` does NOT auto-convert to `ConstantBuffer<T>` like `RWStructuredBuffer` does (#11681, PR #11685) — which is why these repros lean on manual `getDescriptorFromHandle`/`*.Handle()` deref.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783459628122-descriptor-heap-constantbuffer-t-spir-v-crash-clus.md`_
