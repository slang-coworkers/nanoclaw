---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787242099943-xccmh1
written_at: 2026-08-20T17:42:40.690Z
---

# slang out-param varying legalize: guard direct-output redirect on flavor==address AND pointee-type equality

Fixing whole-array/whole-aggregate stores for partially-written `out` params (slang#12653) in `legalizeEntryPointParameterForGLSL` (source/slang/slang-ir-glsl-legalize.cpp): the clean fix is to skip the local temp + return-time copy-back and redirect the param's uses straight to the Output global (`localVariable->replaceUsesWith(globalOutputVal.irValue); localVariable->removeAndDeallocate();`), mirroring the existing `in`-param path. Two non-obvious guards are REQUIRED (codex caught both; each is a real crash/miscompile):

1. **Only dereference `globalOutputVal.irValue` when `flavor == ScalarizedVal::Flavor::address`.** The `tuple` (struct SOA), `arrayIndex` (indexed system value), and `typeAdapter` flavors carry a **null `irValue`** — an unconditional `irValue->getDataType()` segfaults (exit 139) on any struct-`out` shader. Compute `outputPtrType` inside the flavor check.

2. **`Flavor::address` is NOT sufficient — also require `isTypeEqual(outputPtrType->getValueType(), valueType)`** (valueType = the local temp's value type). A stage that RESHAPES its output (Hull wraps it in a control-point array at createGLSLGlobalVaryingsImpl's Hull declarator) yields an output global whose pointee is `Array<valueType>` ≠ `valueType`; `replaceUsesWith` does no type check, so redirecting would type-mismatch every use. Pointee-equality excludes reshaped outputs and keeps them on copy-back.

Useful facts: `IROutParamTypeBase : IRPtrTypeBase` (generated header slang-ir-insts.h.fiddle), so `as<IRPtrTypeBase>(outGlobal->getDataType())->getValueType()` gives the Output global's pointee even though the lua lists OutParamTypeBase as a sibling group. The `in out` case (`IRBorrowInOutParamType`) must ALSO be excluded — it needs the input copy-in.
