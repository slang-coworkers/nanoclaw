---
title: "Slang SPIR-V variable-pointers cap is declared from value sites, not function signatures"
type: learning
topic: slang-compiler
source: learnings/1780967438806-slang-spir-v-variable-pointers-cap-is-declared-fro.md
---

# Slang SPIR-V variable-pointers cap is declared from value sites, not function signatures

When triaging/fixing SPIR-V `VariablePointers` / `SPV_KHR_variable_pointers` capability issues in Slang (e.g. issue #11518):

- The capability is declared by `requireVariableBufferCapabilityIfNeeded(AddressSpace)` in `source/slang/slang-emit-spirv.cpp` (~:11311). It declares `VariablePointersStorageBuffer` for StorageBuffer and `VariablePointers` for GroupShared, **unconditionally** (a `targetCaps.implies(...)` gate was added in PR #11324 then reverted — master is unconditional).
- Critically, **all its callers are value-materialization sites** (var / load / store / element-ptr). It is NOT called from function-signature emission — `emitParam` (~:7633) and `emitOpTypeFunction` / `kIROp_FuncType` (~:2761) emit `OpFunctionParameter` / `OpTypeFunction %_ptr_Workgroup` with no capability call.
- The legalizer flag `m_sharedContext->m_needVariablePointer` (`slang-ir-spirv-legalize.h:32`, set at `slang-ir-spirv-legalize.cpp:1018` for groupshared call-args and `:2366` if target implies the cap) is a **red herring for emit**: it is consumed only legalize-side (`:1084`) to suppress a temp-var rewrite, and is **never read in slang-emit-spirv.cpp**. It does not drive emit-time capability declaration.
- Consequence: a `Ptr<T, GroupShared>` (Workgroup) pointer that survives as a **non-inlined** function parameter (`[noinline]`, recursion, separately-compiled callee) emits an invalid SPIR-V signature with no `OpCapability VariablePointers`. Inlining (`slang-ir-inline.cpp` ForceInline/UnsafeForceInlineEarly) hides it in the common case.
- The fix shape (per the author/reviewer in PR #11324, comment r3377197655): a `requireFunctionTypeCapabilitiesIfNeeded(irFunc->getDataType())` call in `emitFunc` that walks the function type's param/result pointer types and reuses `requireVariableBufferCapabilityIfNeeded`. **Do not** re-introduce a `targetCaps.implies(SPV_KHR_variable_pointers)` gate — the extension atom isn't in the minimal target cap set, so it silently elides (see learning 1780933412397 on family-vs-implies gating).
- `SPV_KHR_variable_pointers` is a single capdef atom (`slang-capabilities.capdef:583`, `: _spirv_1_0`); the StorageBuffer/Workgroup capability split exists only at emit via the `SpvCapability*` enum, not in capdef.
- `-restrictive-capability-check` only flips Capability-category diagnostics warning↔error (`slang-compiler.h:256-264`); it cannot help here because the signature path issues no diagnostic at all — so the cap is silently omitted regardless of the flag.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780967438806-slang-spir-v-variable-pointers-cap-is-declared-fro.md`_
