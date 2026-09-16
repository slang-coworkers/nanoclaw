---
title: "Slang #13107/#13115 static-const POD-struct-array global-constant fold: 3-reviewer consensus + recurring findings"
type: learning
topic: review-process
source: learnings/1789525381949-slang-13107-13115-static-const-pod-struct-array-gl.md
---

# Slang #13107/#13115 static-const POD-struct-array global-constant fold: 3-reviewer consensus + recurring findings

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789523346221-0f1z5r
written_at: 2026-09-16T02:23:01.949Z
---

# Slang #13107/#13115 static-const POD-struct-array global-constant fold: 3-reviewer consensus + recurring findings

PR #13115 (fixes #13107) is the POD-struct follow-on to the #12688/#11628 static-const-array-as-global-constant family. It has two coordinated changes in `slang-ir-legalize-global-values.cpp`: (A1) `isSimpleConstantType` recurses through struct fields (POD struct = simple constant iff every field is; resource/pointer fields fall through to false → conservative inline); (A2) a new pre-pass `legalizeConstantConstructorCallsForGlobalScope` folds module-scope synthesized member-wise `$init` calls to `IRMakeStruct` before `inlineGlobalConstantsForLegalization`, with an `if (as<IRCall>(inst)) return false;` guard keeping any module-scope IRCall illegal-as-global so unfoldable ctors still inline.

**Three-reviewer outcome (A correctness / B Devin / C clarity): NO correctness bug.** Prior recall noted `isSimpleConstantType`/POD member-wise-ctor→MakeStruct fold had no prior hit — now covered. Recurring, reproducible findings on this fold shape:

- **The `tryReplaceSynthesizedConstructorCallWithMakeStruct` misnomer** (A nit + C FG001, convergent): the helper *builds and returns* a makeStruct (or nullptr); the caller does `replaceUsesWith`+`removeAndDeallocate`. Rename to `tryBuildMakeStructForSynthesizedConstructorCall`.
- **The layering Question** (A 🔵): reconstructing makeStruct by symbolically walking the `$init` body (Var→FieldAddress→Store→Load→Return) at module scope trips CLAUDE.md's "context-rediscovery / consumer-side patching" self-review flags. Calibration: this is a **justify-in-PR-Process-report** item (or move fold to producer), NOT a redesign demand — C independently judged the representation-level fix "sits at the right layer." Reconcilable.
- **Test gap** (A 🟡): nested/recursive-fold test asserting only type + `$init`-absence does NOT lock field values → a field-key/declaration-order scramble passes. Fix: add always-available `//TEST:COMPARE_COMPUTE(filecheck-buffer=CHECK):-cpu -output-using-type` (CPU-kernel path reaches the same pass) checking known field sums.
- **Inaccurate test-header gating comment** (A nit + C FG004): `shouldLegalizeExistentialAndResourceTypes` is FALSE for CPP/C/CUDA; CUDA reaches the pass via the separate `target==CUDASource` clause. Don't attribute CUDA's gating to that flag.

**Metal/WGSL CI-only risk was NOT a real gap here:** neither Devin's cross-backend pass nor A's cross-backend reviewer flagged a Metal/WGSL emit bug — consistent with the family calibration that a shared-path emit change isn't an OPEN_GAP when those targets inherit the path unchanged with a valid pre-existing emit case. Metal/WGSL still validate on CI (no local toolchain), but absence of a reviewer flag is expected, not a coverage hole to abstain on.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1789525381949-slang-13107-13115-static-const-pod-struct-array-gl.md`_
