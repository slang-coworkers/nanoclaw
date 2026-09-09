---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788582270448-q15zft
written_at: 2026-09-05T04:49:02.043Z
---

# CORRECTION: disableIRValidationScope does NOT gate the post-pass validateIRModule (E40007) — only at-insert asserts

Refines the earlier learning "-validate-ir-detailed can SIGABRT on transient invalid-SSA from autodiff finalization". Verified in-code on ToT (~HEAD 961e4e59) and confirmed by the fixer on #12914.

**The two IR-validation paths are distinct and independently gated:**
- **At-insert validation** — `validateIRInstOperands(inst)` (source/slang/slang-ir-validate.cpp:323-325) runs during IR building and is gated by the `thread_local bool _enableIRValidationAtInsert` (:309). `IRValidationScope` / `disableIRValidationScope()` (:312-320, helper slang-ir-validate.h:67) toggles ONLY that flag. The autodiff usages at slang-ir-autodiff-cfg-norm.cpp:764 (around `constructSSA`) and slang-ir-autodiff-fwd.cpp:2437 silence just these at-insert asserts.
- **Post-pass module validation** — `validateIRModule(...)` invoked from `postPassHooks` under `-validate-ir-detailed` (slang-pass-wrapper.cpp:74-76). This walks the whole module and emits `E40007 IR validation failed: def must come before use in same block`. It does **NOT** consult `_enableIRValidationAtInsert`; it runs unconditionally when ValidateIRDetailed is set.

**Consequence:** wrapping a pass in `disableIRValidationScope()` does NOT suppress an E40007 post-pass abort — the scope is already restored by the time the pass boundary validation runs. So "guard the transient step with disableIRValidationScope" is NOT a viable fix for a `-validate-ir-detailed` post-pass SIGABRT. If the post-pass IR genuinely violates SSA ordering, the correct fix is at the **producer** (fix the insert point), not a validation scope.

**#12914 concretely:** the abort came from a real producer insert-ordering bug — `DifferentialPairTypeBuilder::_createDiffPairType` (slang-ir-autodiff-pairs.cpp:229) does `setInsertBefore(diffType)` then builds a `DiffPair_…` struct referencing `diffType`; fine when `diffType` is a global type (scalar `Float`) but wrong when it's a block-local inst (vector: the un-specialized `vector<T,N>:IDifferentiable` Differential is a `lookupWitness` in a generic body) ⇒ def-after-use. Fix = insert the struct after its operands when they are local. Lesson: when triaging a `-validate-ir-detailed`-only abort, do NOT assume a validation-scope relaxation is the fix; verify which validation path fires (at-insert vs post-pass) before recommending disableIRValidationScope.
