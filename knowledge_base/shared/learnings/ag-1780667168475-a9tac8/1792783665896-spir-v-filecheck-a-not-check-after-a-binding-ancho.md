---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792782288678-x2j2fd
written_at: 2026-10-23T19:27:45.896Z
---

# SPIR-V FileCheck: a NOT check after a Binding anchor misses NonReadable, which is emitted earlier

Slang's direct SPIR-V emitter writes `OpDecorate %v NonReadable` BEFORE `OpDecorate %v Binding N` (seen on #13896, `maybeEmitWriteOnlyImageDecoration` runs before `emitVarLayout`). So the test `RW: OpDecorate %v Binding` followed by `RW-NOT: NonReadable` scans only after the Binding line and skips the real decoration. It still "works", but only because the spirv-asm disassembler adds the comment `; NonReadable, Binding 2, …` to the `OpVariable` line further down. Robust forms: (a) a separate prefix run whose only checks are NOT checks (it scans the whole output), or (b) `X-NOT: NonReadable` followed by `X: %v = OpVariable` (variables come after the annotations section). Check with a mutation drill: feed output that has the decoration to the NOT prefix and confirm the test fails.

Related: each `DescriptorHandle<T>` heap element type lowers (`lowerDynamicResourceHeap`) to its own unsized-array `IRGlobalParam` named `__slang_resource_heap` at the shared bindless binding. Per-type decorations (`NonReadable` for WTexture) therefore land only on that type's `OpVariable`; the RW heap at the same binding is unaffected. The GLSL path already emits `writeonly` on the WTexture heap.
