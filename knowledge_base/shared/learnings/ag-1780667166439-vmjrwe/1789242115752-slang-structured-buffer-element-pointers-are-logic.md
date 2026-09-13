---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788273857996-jsrk1t
written_at: 2026-09-12T19:41:55.752Z
---

# Slang structured-buffer element pointers are logical StorageBuffer; surface int* is physical Device (slang#12581)

Fixing #12581 (`__getAddress`/`&buf[i]` on a mutable `RWStructuredBuffer`) surfaced several non-obvious facts about the SPIR-V address-space pipeline:

1. **A descriptor-backed buffer-element pointer (`RWStructuredBufferGetElementPtr`) is a *logical* `StorageBuffer` pointer, but the surface `Ptr<T>`/`int*` type defaults to `AddressSpace.Device` == `UserPointer` == SPIR-V `PhysicalStorageBuffer` (a *physical* pointer).** There is no valid logical↔physical conversion. The mismatch only manifests when the pointer *slot* survives to emission — a `-O0` local, or a `-g` `DebugVar` backing variable — as `OpStore Pointer type does not match Object type`. With mem2reg the slot is promoted and only the (correct) value survives, so `-O0`-off builds pass by luck. **Always reproduce these with `-g2` (and/or `-O0`) + `SLANG_RUN_SPIRV_VALIDATION=1`; a plain `-vk` run without debug info can miss it.**

2. **Pointer variables are NOT promoted to SSA phis for the SPIR-V target** — logical pointers can't be phi'd without VariablePointers, so a conditionally-reassigned/loop-carried pointer local stays a `Function`-storage slot (confirmed: 0 `OpPhi` for pointers in output). `eliminatePhis` also runs *before* `specializeAddressSpace` (slang-emit.cpp) on the direct-SPIR-V path. So the reachable shape to fix is the *surviving slot*, not a pointer phi. `resolvePhiAddrSpace` in the address-space pass only serves the pass's pre-phi-elimination callers (metal/wgsl).

3. **Derived pointer ops (`GetOffsetPtr`/`GetElementPtr`/`FieldAddress`) off a descriptor pointer are `StorageBuffer`-native from lowering** — only the *slot* and *loads of the slot* carry the stale surface `Device` default. So when reconciling a slot fed a derived value whose base is an unreconciled slot (`int* r = s + 1;`), resolve *through* the derived op to the base slot's reconciled address space, not the derived inst's own (not-yet-retyped) type — otherwise a `-g2` `DebugVar` for `r` stays physical and fails validation. Do NOT resolve through a pointer `BitCast` or int-to-ptr cast (`(int*)0x1000` lowers to `kIROp_CastIntToPtr` → `OpConvertUToPtr`, a genuine physical pointer whose declared type is authoritative).

4. **`isAllowedDebugVarType` returns false for a `StorageBuffer` pointee**, so once a slot's contained type is specialized to `StorageBuffer` the SPIR-V emitter omits the debug backing `OpVariable` entirely — which is what removes the mismatched store.

5. **Reinterpreting a logical pointer via bitcast (`(uint*)p`) is unsupported** by SPIR-V logical addressing ("Instruction may not have a logical pointer operand"), independent of address-space handling — a separate pre-existing limitation, not fixable by address-space propagation.
