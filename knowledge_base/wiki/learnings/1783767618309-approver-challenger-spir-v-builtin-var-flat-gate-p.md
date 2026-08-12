---
title: "[approver/challenger] SPIR-V builtin-var Flat gate: prove else-branch reachability via getBuiltinGlobalVar's ptr-assert, not IR-type intuition"
type: learning
topic: review-approval
source: learnings/1783767618309-approver-challenger-spir-v-builtin-var-flat-gate-p.md
---

# [approver/challenger] SPIR-V builtin-var Flat gate: prove else-branch reachability via getBuiltinGlobalVar's ptr-assert, not IR-type intuition

**Symptom:** slang#12064 (restore Flat decoration for SubgroupLocalInvocationId/SubgroupSize in fragment shaders) refactored `needFlatDecorationForBuiltinVar` (source/slang/slang-emit-spirv.cpp) to add a non-pointer `else` branch that SKIPS the Input/BuiltinInput address-space gate. The production review flagged this as a 🟡 gap ("undocumented always-BuiltinInput invariant"). The tempting quick clear — "GlobalVar/GlobalParam are always ptr-typed so the else branch only runs for the builtin-var op" — is WRONG: deepwiki confirms `IRGlobalParam` CAN be non-pointer-typed (only `IRGlobalVar` is always ptr).

**Root cause / correct reachability proof:** `needFlatDecorationForBuiltinVar` is called from exactly ONE site: `getBuiltinGlobalVar`, which asserts its `type` arg is a pointer (`SLANG_ASSERT(ptrType)`). Two caller families of `getBuiltinGlobalVar`:
- `maybeEmitSystemVal` (~50 calls): every one passes `inst->getFullType()` as the (asserted-ptr) type arg AND `inst` as irInst. Since getFullType is a bare ptr, `getDataType()` is that same ptr → the PTR branch runs (addrSpace gate PRESERVED). Never the else branch.
- `emitBuiltinVar`: passes a freshly-built `AddressSpace::BuiltinInput` ptr as the type arg and the `SPIRVAsmOperandBuiltinVar` op (scalar/vector `getDataType()`, non-ptr) as irInst → the else branch, and it HARDCODES BuiltinInput.
∴ the else branch is reachable only for `SPIRVAsmOperandBuiltinVar`, which is always BuiltinInput → the skipped gate has no current wrong-output trigger. The gap CLEARS as future-proofing.

**How to catch it:** For any predicate that reads `irInst->getDataType()` and branches on ptr-vs-non-ptr, don't reason from "which IR ops are ptr-typed" — trace the CALLERS and any type-asserts they satisfy. An assert upstream (`getBuiltinGlobalVar`'s ptr-assert) can make an apparently-reachable branch unreachable in practice. IRGlobalParam being non-ptr-capable is a real trap that a type-intuition clear would miss.

**Fix (procedure):** challenger clears an addrSpace/type-gate-skip gap ONLY after a caller-trace reachability proof, not from IR-type folklore. Confirmed via deepwiki that IRGlobalParam can be value-typed; confirmed the composite uint4-mask subgroup builtins DO reach the same else path (so gap #2's "composite untested" is reachable, held as OPEN_GAP).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783767618309-approver-challenger-spir-v-builtin-var-flat-gate-p.md`_
