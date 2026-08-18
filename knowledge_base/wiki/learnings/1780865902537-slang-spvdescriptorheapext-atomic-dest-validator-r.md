---
title: "slang spvDescriptorHeapEXT: atomic-dest validator rejects heap texel pointers (E41403)"
type: learning
topic: slang-compiler
source: learnings/1780865902537-slang-spvdescriptorheapext-atomic-dest-validator-r.md
---

# slang spvDescriptorHeapEXT: atomic-dest validator rejects heap texel pointers (E41403)

## Symptom
`InterlockedAdd` (any atomic) on a `DescriptorHandle<RWTexture2D<uint>>` texel fails to compile with
`error[E41403]: invalid atomic destination` — but ONLY when `-capability spvDescriptorHeapEXT` is set.
Without the capability the identical atomic compiles. (shader-slang/slang#11506, triaged 2026-06-07, master 5230a81f2.)

## Root cause — a validation false-negative in the descriptor-heap lowering path
1. With spvDescriptorHeapEXT, `DescriptorHandle<RWTexture2D>` becomes heap-resident; the texture value is an
   `IRSPIRVLoadDescriptorFromHeap` instead of an `IRLoad` of a global texture.
2. `processImageSubscript` (source/slang/slang-ir-spirv-legalize.cpp:~1357-1370) special-cases that: when the
   image operand is `IRSPIRVLoadDescriptorFromHeap`, it REPLACES the `IRImageSubscript` with
   `IRSPIRVLoadTexelPointerFromHeap` (a pointer in `AddressSpace::Image`). The plain-texture branch (IRLoad)
   keeps the `IRImageSubscript`.
3. The atomic-destination validator `isValidAtomicDest` (source/slang/slang-ir-validate.cpp:455-527), driven by
   `validateAtomicOperations`, runs at the END of SPIR-V legalization (slang-ir-spirv-legalize.cpp:~2789) — AFTER
   step 2. (Validation is deliberately deferred for SPIR-V at slang-emit.cpp:1917-1921 until after address-space
   specialization, so groupshared func-param atomics validate correctly — do NOT reorder it.)
4. `isValidAtomicDest` accepts `IRImageSubscript` (:463) and a pointer addr-space allowlist
   {Global,GroupShared,StorageBuffer,UserPointer,Uniform+BufferBlock} (:468-487) — but NOT
   `IRSPIRVLoadTexelPointerFromHeap` and NOT `AddressSpace::Image` → returns false (:526) → E41403 (:548-551).
   The op already EMITS correctly (OpUntypedImageTexelPointerEXT, slang-emit-spirv.cpp:~4934-4959) — purely a
   validator gap, no ABI/header impact.

## Fix
Add `if (as<IRSPIRVLoadTexelPointerFromHeap>(dst)) return true;` at slang-ir-validate.cpp:463-464 (mirror the
IRImageSubscript case). Optionally also `case AddressSpace::Image: return true;` in the switch — but note :466
tests `as<IRPtrType>` (not IRPtrTypeBase), verify the ptr-type op before relying on the addr-space case alone.

## Generalizable pattern (the load-bearing takeaway)
The spvDescriptorHeapEXT lowering produces opcodes (`kIROp_SPIRVLoadDescriptorFromHeap`,
`kIROp_SPIRVLoadTexelPointerFromHeap`) that DOWNSTREAM allowlists keep failing to recognize. This is the SAME
class of bug as #11498/#11496 (SIGSEGV — fixed by teaching the function-call/buffer-load specialization
allowlists about the heap descriptor op; PR #11502). When triaging any new spvDescriptorHeapEXT breakage:
grep for where the analogous NON-heap op (IRImageSubscript, IRLoad-of-texture, cast-to-resource) is allowlisted
and check whether the heap op was added alongside it. Always validate the binary with SLANG_RUN_SPIRV_VALIDATION=1
— text FileCheck cannot catch malformed descriptor-heap SPIR-V.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780865902537-slang-spvdescriptorheapext-atomic-dest-validator-r.md`_
