---
name: project_9062_diffptr_array_spirv_validation_parked
metadata: 
  node_type: memory
  type: project
  originSessionId: 5065036b-059a-48a1-a520-0aa456599191
---

shader-slang/slang **#9062** — "Reenable spirv-validation in tests/autodiff/diff-ptr-type-array.slang". Bug, **medium/P2**, component **SPIR-V target-emit + autodiff**. Triaged + **reproduced on ToT** (`bfe6a7f14`) 2026-07-08.

**Root cause:** Slang emits an illegal `OpCompositeConstruct` building an **array of logical (StorageBuffer) pointers** (`%_arr__ptr_StorageBuffer_RWStructuredBuffer_int_2`) — SPIR-V logical addressing forbids a logical pointer as an `OpCompositeConstruct` operand. IR was always illegal; a SPIRV-Tools validator update just started enforcing it. Autodiff `DifferentialPtrPair<MyPtrType[2]>` lowering pins the array-of-resource-structs as a first-class composite. Every legalization predicate that would eliminate it (`isIllegalGLSLParameterType`, `TypeInliningPass::doesTypeRequireInline`, `legalizeResourceTypes`) inspects only the array's **direct** element type — none recurses into struct fields, so `MyPtrType[2]` (struct wrapping `RWStructuredBuffer`) slips through where bare `RWStructuredBuffer[2]` would be caught. Pass ordering verified (resource-legalize runs *after* autodiff) → structural blindness, not timing.

**Fix direction:** Approach A (recommended) = SPIR-V-target legalization step rewriting composites-of-logical-pointers into local var + per-element store/access-chain (target-scoped, keeps emit simple, matches jkwak's in-thread reasoning). Approach B (alt) = teach resource-specialization to recurse struct fields (wider blast radius). Reject C (keep validation disabled — issue asks to re-enable). UNCERTAIN for fixer: exact IRMakeArray origin (processPairTypes vs resource-splitting).

**State (07-08): RE-ENGAGED — jkwak said "Let's go with Approach A"** ([issuecomment-4919314017](https://github.com/shader-slang/slang/issues/9062#issuecomment-4919314017)). Maintainer accepted our A/B recommendation and picked A. Routed to triager to dispatch fixer on Approach A, **drafts-only**, with the standing guardrail: jkwak is assignee — if he already has a branch/PR/self-fix in progress, STAND DOWN (don't duplicate). Fixer must confirm IRMakeArray origin (processPairTypes vs resource-splitting) before committing to A's rewrite scope, and correct `Fixes #9062` on the draft.

Prior verdict posted: [issuecomment-4916354332](https://github.com/shader-slang/slang/issues/9062#issuecomment-4916354332), `reproduced` label added. Triage memo `triage-9062.md`. Canonical thread `gh-issue-shader-slang/slang-9062`. Related (none a dup): #5805, #9801, PR #8984/#8920.

**Approach A spec:** SPIR-V-target legalization step (near `slang-ir-spirv-legalize.cpp` processConstructor / SPIRVLegalizationContext) detecting IRMakeArray/IRMakeStruct whose element/field type is (or transitively contains) an IRPtrType with a LOGICAL storage class (StorageBuffer/Uniform/Workgroup — NOT PhysicalStorageBuffer) → materialize Function-storage local var + per-element OpStore via OpAccessChain, rewrite consumers (OpCompositeExtract → OpAccessChain, stores, returns). Risk medium: must rewrite ALL consumers of the former composite. Re-enable spirv-validation on the test (remove the DISABLE_TEST `-vk` line) as the acceptance check.
