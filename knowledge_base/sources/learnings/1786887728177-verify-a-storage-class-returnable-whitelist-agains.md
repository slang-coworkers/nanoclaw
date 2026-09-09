---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1786837009185-7jfa16
written_at: 2026-08-16T13:42:08.177Z
---

# Verify a storage-class/returnable whitelist against BOTH the validator rule and the emit mapping

When a Slang PR adds a "permitted set" check (e.g. E58004: which pointer address spaces may be a function result under SPIR-V Logical addressing), a whitelist is only correct if it is **complete against the mapping that feeds it** — verify from two sources of truth, not one:

1. **The external validator rule** — `external/spirv-tools/source/val/validate_function.cpp:173-198` defines the returnable set under Logical/PSB64 addressing: PhysicalStorageBuffer, StorageBuffer (needs VariablePointersStorageBuffer cap), Workgroup (needs VariablePointers cap). This is what spirv-val actually enforces.
2. **The internal emit mapping** — `slang-emit-spirv.cpp` `addressSpaceToStorageClass()` (~1587-1648) maps each `AddressSpace` enum value to a `SpvStorageClass`. The whitelist must contain **exactly** the AddressSpace values that map INTO the validator's permitted set. For the returnable set, those are `{UserPointer→PhysicalStorageBuffer, StorageBuffer→StorageBuffer, GroupShared→Workgroup}` — nothing else reaches those three classes. A whitelist matching that trio is complete and minimal; any other concrete class is a true positive to diagnose.

Why both: checking only the validator tells you the SPIR-V-level set but not which Slang enum values reach it; checking only the enum risks missing that two enum values collapse to one SPIR-V class, or that a class you'd expect is spelled differently (UserPointer, not "PhysicalStorageBuffer", is the enum that emits PSB).

Also: `IRPtrTypeBase::hasAddressSpace()` (`slang-ir.h:1597`) returns false for `AddressSpace::Generic`, so a `getAddressSpace()`-then-whitelist check correctly skips unset/generic result pointers — only concretely-classed pointers are flagged.

Companion gotcha caught the same review: a module-wide per-function diagnostic loop that drops the `!func->getFirstBlock()` guard becomes a principled false-positive vector — bodyless import/extern declarations get inspected though they emit no OpReturn. The established idiom (`updateFunctionTypes` at ~3043, and `:1787/1884/1949`) guards getFirstBlock precisely for this. Restoring it is false-negative-free (a bodyless func can never be the real source of an unreturnable-return error). But note: in-tree pointer-returning "intrinsics" are `__intrinsic_op` → lower to IR *ops*, NOT surviving IRFunc call targets, so a concrete repro needs an import/extern pointer-returning decl — making this a nit, not a blocker, absent a demonstrated case.
