---
title: "Slang variable-pointers signature-walk fix: only (GroupShared, parameter) is a fail-without-fix regression test"
type: learning
topic: slang-compiler
source: learnings/1780972705906-slang-variable-pointers-signature-walk-fix-only-gr.md
---

# Slang variable-pointers signature-walk fix: only (GroupShared, parameter) is a fail-without-fix regression test

Context: PR #11521 (issue #11518) added `requireFunctionTypeCapabilitiesIfNeeded(IRFuncType*)` in slang-emit-spirv.cpp, called from `emitFunc`, which forwards the function's result type + every param type to the existing `requireVariableBufferCapabilityIfNeeded`. The fix declares `SPV_KHR_variable_pointers`/`VariablePointers` for a Workgroup/StorageBuffer pointer that survives only in a non-inlined function's signature.

Non-obvious test-design insight (verified against the checkout, Jun 2026): although the new helper walks BOTH result and parameter positions and BOTH address spaces, only the **(GroupShared, parameter)** combination is isolatable as a fail-without-fix regression. A reviewer's instinct is to also add result-type and StorageBuffer tests for branch coverage — but those tests would PASS even without the fix, because the capability is already declared at a value site on those paths:

- **Result-type arm**: `emitCall` (slang-emit-spirv.cpp:~7841) calls `requireVariableBufferCapabilityIfNeeded(inst->getDataType())` = the call's result type. A `[noinline]` fn *returning* a groupshared pointer therefore declares the cap at the call site regardless of the signature walk.
- **StorageBuffer arm**: StorageBuffer pointers are produced by the access-chain value sites `emitGetOffsetPtr`/`emitGetElement` (~8211/8268), which already declare `VariablePointersStorageBuffer`.

So the correct resolution of a "untested branches" gap here is to DOCUMENT in the test why those arms can't be isolated (they're covered by value sites), not to add tests that pass with or without the fix. The (GroupShared, parameter) case is fail-detecting only when the body merely scalar-dereferences the pointer (no access chain) and the caller passes a whole-variable address (`__getAddress(gs)`), so no value site fires.

Reference declaring value sites (all call `requireVariableBufferCapabilityIfNeeded`): emitVar + debug-var backing, emitPhi, emitCall, emitGetOffsetPtr, emitGetElement, emitLoad. `emitStore` does NOT declare it (a store consumes a pointer, doesn't materialize one). `IRFunc::getDataType()` (slang-ir.h:1851) returns `IRFuncType*` directly, so no `as<IRFuncType>` cast is needed at the emitFunc call site.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780972705906-slang-variable-pointers-signature-walk-fix-only-gr.md`_
