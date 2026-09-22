---
title: "Logical-address-space Ptr as a struct field → invalid SPIR-V OpCompositeConstruct (VariablePointers does NOT help)"
type: learning
topic: slang-compiler
source: learnings/1790017243652-logical-address-space-ptr-as-a-struct-field-invali.md
---

# Logical-address-space Ptr as a struct field → invalid SPIR-V OpCompositeConstruct (VariablePointers does NOT help)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790016528628-ejbdzx
written_at: 2026-09-21T19:00:43.652Z
---

# Logical-address-space Ptr as a struct field → invalid SPIR-V OpCompositeConstruct (VariablePointers does NOT help)

A Slang `struct` with a **logical**-address-space pointer field (`Ptr<T, Access, GroupShared/Function/Private>` → SPIR-V `Workgroup`/`Function`/`Private` storage class), constructed as a local, emits an invalid `OpCompositeConstruct`/`OpCompositeExtract` with the logical pointer as a composite operand. slangc emits it silently (rc=0, no warning/error); only `spirv-val` (or `SLANG_RUN_SPIRV_VALIDATION=1`) rejects it: "Instruction may not have a logical pointer operand" / "may not return a logical pointer". Confirmed on shader-slang/slang#13206 (repro is GPU-free: `slangc x.slang -target spirv-asm`).

Key facts (source-verified, HEAD ~2026.13.1-50 / 2026.18):
- **VariablePointers capability does NOT fix it** — the direct-spirv path already declares `OpCapability VariablePointers`+`SPV_KHR_variable_pointers` and STILL fails validation. VariablePointers relaxes pointer-as-function-argument / variable-pointer restrictions, NOT a logical pointer as a composite operand.
- Only **physical** pointers (`AddressSpace::UserPointer`/Device → `PhysicalStorageBuffer`) are legal inside a composite; they also force the physical addressing model (`requirePhysicalStorageAddressing`, slang-emit-spirv.cpp:2141/2554). Logical storage classes never flip to physical.
- Mechanism: a partial struct-field write `s.f = <logical ptr>` is legalized `addr-inst-elimination.cpp:41-68` (store(fieldAddr)→store(updateElement)) → SSA promotes the local to an aggregate value (slang-ir-ssa.cpp:478-573; the :503-510 comment explicitly anticipates a missing scalarization) → peephole `emitMakeStruct` (slang-ir-peephole.cpp:1169) → `MakeStruct` carrying the logical ptr → emit `OpCompositeConstruct` (slang-emit-spirv.cpp:5050-5051). `slang-ir-specialize-address-space.cpp` only re-types pointer address spaces and reconciles pointer *slots* (Var/DebugVar) — it has NO MakeStruct/FieldExtract case and never tracks a pointer nested inside a composite VALUE (struct-field reconciliation is out of scope, "tracked in #13039" :456-461). **There is NO SROA/scalarization pass and NO diagnostic today.**
- Same underlying class as **#9062** (autodiff array-of-logical-pointers wrapped as a struct → OpCompositeConstruct). A principled fix (SROA/scalarize a struct that *transitively* contains a logical pointer under logical addressing, so the pointer never enters a composite) must have a "contains-a-logical-pointer" predicate that RECURSES struct fields + arrays — the #9062 blind spot — and also handle copies/returns/phis of such structs. Fallback = a front-end diagnostic rejecting logical-ptr-in-composite (cf the existing `diagnose-non-device-ptr-in-impl.slang` for the AnyValue/dyn-dispatch case).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790017243652-logical-address-space-ptr-as-a-struct-field-invali.md`_
