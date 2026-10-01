---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1790221593129-crpbco
written_at: 2026-09-30T16:10:12.373Z
---

# SPIR-V Function var holding a logical pointer: VPSB/VP lift the rule only for StorageBuffer/Workgroup pointees

# SPIR-V: VariablePointers lifts the "variable may not allocate a pointer" rule only for StorageBuffer/Workgroup pointees

**Rule (spirv-val primary source).** `ValidateVariablePointer` in `SPIRV-Tools/source/val/validate_memory.cpp` (main branch, read 2026-09-30) governs OpVariables under Logical or PhysicalStorageBuffer64 addressing. When the variable's pointee contains a logical pointer:
- A pointer to **StorageBuffer** is legal only if `VariablePointersStorageBuffer` is declared.
- A pointer to **Workgroup** is legal only if `VariablePointers` is declared.
- A pointer to **any other storage class**, including `Uniform`, is rejected no matter which capabilities are declared: *"variables can only allocate a pointer to the StorageBuffer or Workgroup storage classes"*.
- Older spirv-val builds word this as *"In Logical addressing, variables may not allocate a pointer type"*. If a report quotes that text, the reporter's validator predates the per-storage-class check.

**Why it matters for Slang.** On pre-1.4 profiles such as `-profile spirv_1_3`, Slang emits SSBO/RWStructuredBuffer as `Uniform`+BufferBlock. A Function-storage slot holding that resource pointer (`%_ptr_Function__ptr_Uniform_RWStructuredBuffer`) is therefore **unfixable by declaring a capability**. Per slang-fixer's findings on #13250 (not independently re-verified), on ≥1.4 Slang uses the StorageBuffer class, already declares VPSB via `requireVariableBufferCapabilityIfNeeded`, and validates. The capability declaration mechanism itself is covered by the existing learning "Slang SPIR-V variable-pointers cap is declared from value sites, not function signatures".

**Process lesson (shader-slang/slang#13250).** The triage memo marked "Approach C: rely on VariablePointers" as *"proven not to lift the rule"*, citing only Slang's legalizer (spirv-legalize.cpp:1031-1037), not the validator. The Orchestrator relayed that as fact to the fixer. Maintainer saipraveenb25 then named the missing VariablePointers/VPSB capability as the fundamental issue. The truth sat in between: the maintainer was right for StorageBuffer pointees and the triage was right for Uniform pointees. **Check a "rejected approach" claim about spec or validator semantics against the validator source (or the spec's Universal Validation Rules) before relaying it. A citation into Slang's own code is not evidence of what spirv-val accepts.** Also check which storage class the target profile actually emits, because the answer can change between SPIR-V 1.3 and 1.4.
