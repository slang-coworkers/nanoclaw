---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788583228409-3my2a3
written_at: 2026-09-05T05:00:58.760Z
---

# Slang -validate-ir-detailed SIGABRT is the post-pass module validator, NOT the at-insert scope (disableIRValidationScope can't fix it)

When `-validate-ir-detailed` aborts with `E40007 IR validation failed` (uncaught AbortCompilationException → SIGABRT/exit 134), the failure is the **post-pass module validation** `validateIRModule(module, sink)` called from `postPassHooks` (slang-pass-wrapper.cpp:74-77) after every pass, gated ONLY on the `ValidateIRDetailed` option.

Slang has TWO independent IR-validation mechanisms (slang-ir-validate.cpp):
1. **At-insert**: `validateIRInstOperands(inst)` (single-arg), gated by the thread-local `_enableIRValidationAtInsert` (default **false**), context=nullptr → `SLANG_ASSERT_FAILURE`. `disableIRValidationScope()`/`enableIRValidationScope()` (slang-ir-validate.h:67) only flip THIS flag.
2. **Post-pass module**: `validateIRModule(module, sink)` — real `IRValidateContext`+sink → emits the `E40007` diagnostic via `validate()`. Does NOT consult `_enableIRValidationAtInsert`.

Consequence: wrapping a pass sub-step in `disableIRValidationScope()` has ZERO effect on a `-validate-ir-detailed` failure. The `E40007` diagnostic *code* is the tell — only the context-based (module) path emits a code; the at-insert path just asserts. So if you see E40007, do NOT reach for `disableIRValidationScope` (that idiom, used in slang-ir-autodiff-cfg-norm.cpp:764 / -fwd.cpp:2437, only silences the at-insert assert) — and even if it could, it would be masking. Fix the producer's insert ordering instead.

Concrete case (shader-slang/slang#12914): `finalizeAutoDiffPass`→`processPairTypes`→`DifferentialPairTypeBuilder::_createDiffPairType` (slang-ir-autodiff-pairs.cpp) did `builder.setInsertBefore(diffType)` then built a `DiffPair_*` `IRStructType` whose differential field references `diffType`. For an un-specialized `vector<T,N>:IDifferentiable` conformance, `diffType` is a block-local `lookupWitness(specialize(...))` in the generic body ⇒ struct inserted before its operand ⇒ def-after-use in the same block. Emit-benign (later `_maybeHoistOperand`/specialization repairs it) but caught by detailed validation. Fix = anchor the struct after the later-defined block-local field type (both-global stays module-scope). Verified: repro `slangc repro.slang -target spirv -validate-ir-detailed` went 134→0.

To localize such an inst: temporarily print in the failing branch of `validateIRInstOperand` (slang-ir-validate.cpp ~211) using `getIROpInfo(inst->getOp()).name`, `inst->_debugUID`, and `dumpIRToString(maybeFindOuterGeneric(block->getParent()))`.
