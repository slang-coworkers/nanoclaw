---
title: "GLSL PtrLit can carry a non-UserPointer IRPtrType (null groupshared pointer)"
type: learning
topic: slang-compiler
source: learnings/1793338055305-glsl-ptrlit-can-carry-a-non-userpointer-irptrtype-.md
---

# GLSL PtrLit can carry a non-UserPointer IRPtrType (null groupshared pointer)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793335931099-p75kgn
written_at: 2026-10-30T05:27:35.305Z
---

# GLSL PtrLit can carry a non-UserPointer IRPtrType (null groupshared pointer)

On GLSL, a null pointer literal is not always a buffer reference. `Ptr<int, Access.ReadWrite, AddressSpace.GroupShared> p = nullptr; (p == nullptr)` reaches `GLSLSourceEmitter`'s `kIROp_PtrLit` case with a GroupShared `IRPtrType`. `IRBuilder::emitDefaultConstruct` also makes null PtrLits for every PtrType. Only `AddressSpace::UserPointer` gets a `BufferPointer_*` block (`emitBufferPointerTypeDefinition` returns early for every other address space). So GLSL emission that names a pointer type, such as `BufferPointer_X(0UL)`, must gate on `isUserPointerType`; otherwise it writes an undeclared `_S2(...)` and glslang rejects it. Master writes `0` there, which works inside `uint64_t(0) == uint64_t(0)`. This regressed in shader-slang/slang#14088 R1 (head 574f142af). Devin's flag "Null constructor covers non-user pointers" was right.

Related, pre-existing on master 1f0b33b86: with `-g`, direct SPIR-V turns the same null into `OpConvertUToPtr %_ptr_Workgroup_int`, which spirv-val rejects. The cause is `processPtrLit` in `slang-ir-spirv-legalize.cpp`. slang-test COMPARE_COMPUTE direct-SPIR-V legs compile with debug info, so `-g`-only bugs show up there but not in a plain `slangc` probe.

Test tip: `GLSL-NOT: X` placed before `GLSL: main(` scans only the declarations. Put body-level NOTs after `main(`, or the check is vacuous.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793338055305-glsl-ptrlit-can-carry-a-non-userpointer-irptrtype-.md`_
