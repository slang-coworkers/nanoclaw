---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788744313187-twf35b
written_at: 2026-09-15T10:42:20.215Z
---

# Slang SPIR-V debug-var: value-operand limits & param arg-index remap timing

From shader-slang/slang #12918/#12919 (debug info for function-local opaque resource aliases):

**DebugVar type-eligibility vs DebugValue value-representability are two separate checks.**
- Type side (early, target-independent, in `insertDebugValueStore` / `slang-lower-to-ir`): does this
  *type* deserve a source-level DebugVar? Use a NARROW leaf predicate for opaque handles
  (`isSupportedOpaqueDebugHandleType` = texture/sampler leaf only), NOT the broad `isResourceType`
  (which unwraps arrays + matches buffers/pointer-like/etc.). Guard at leaf/creation sites, never
  inside recursive `isDebuggableType` (its struct/array recursion would make struct-of-handle
  debuggable → emit tries an illegal Function OpVariable of a handle-containing struct).
- Value side (SPIR-V legalization, `processDebugValue`): is the concrete lowered *value* a legal
  OpDebugValue operand? A **combined texture-sampler** value (`IRTextureTypeBase::isCombined()` →
  OpTypeSampledImage, whether from an OpLoad of a combined-image-sampler or an OpSampledImage) is
  NOT permitted as a debug-value operand — drop the DebugValue (variable keeps a location-less
  DebugLocalVariable) rather than emit it.

**Do NOT blanket-reject whole-array DebugValues.** `InputPatch`/`OutputPatch` parameters produce
array-typed DebugValues that are legal, pass spirv-val, and are asserted by tests/spirv/tessellation.
`isSimpleDataType` already recurses into arrays (retains data arrays, excludes opaque-handle arrays).
Rejecting any array-typed value regresses those. Never reject a value shape without a confirmed
illegal case + a regression test.

**DebugVar parameter arg-index (`ArgNumber`) and void/empty-param removal is subtle.**
`cleanUpVoidType` (slang-ir-cleanup-void.cpp) remaps surviving DebugVars' ArgIndex, but only for
params still present as `Void` params when it runs; its `argIndexRemap` is indexed by all-params
position. BUT some empty params (e.g. an empty `Conditional` struct, or a zero-length array) are
stripped by *earlier* type-legalization passes that do NOT remap arg-indices. So making
insertDebugValueStore "advance the index for every param" (instead of only debug-eligible ones)
breaks debug-var-void-argument.slang: the insert-time all-params index no longer lines up with
cleanUpVoidType's table (`kept` → ArgNumber 3 instead of 1). At insert time these params are not yet
`IRVoidType` and there's no zero-sized-type predicate, so a staying-but-ineligible resource param
can't be distinguished from a to-be-removed empty one. Correct fix is cross-cutting (remap through
every removing pass, or centralized source-index preservation) — flag it to the maintainer rather
than forcing a local change that trades one test for another.

**PR-prose accuracy (OUTPUT_REVIEW):** codex flags every over-specific claim you didn't personally
trace — exact pass names, "loaded" vs "lowered" SSA value (a by-value opaque param may bind the
OpFunctionParameter directly OR an OpLoad after resource legalization), "OpSampledImage instruction"
vs "OpTypeSampledImage-typed value". Prefer verifiable generality; each unverified specific is a
review round.
