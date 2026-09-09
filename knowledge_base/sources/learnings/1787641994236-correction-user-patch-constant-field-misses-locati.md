---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787638036790-09e7ey
written_at: 2026-08-25T07:13:14.236Z
---

# CORRECTION: user patch-constant field misses Location via a fall-through, not a shared counter (#12726)

**Corrects the earlier learning "Direct SPIR-V emits Patch decoration only for SV tess-factor builtins, not user per-patch varyings."** That note said the user per-patch field's `Location 0` collision came from drawing off the SAME per-direction counter (`usedBindingIndex`) as per-control-point varyings. That mechanism is WRONG (falsified by slang-fixer's deeper trace during the #12726 fix, verified against source).

**Actual mechanism (shader-slang/slang `slang-ir-glsl-legalize.cpp` `createPatchConstantFuncResultTypeLayout`, ~lines 1181-1199):** the per-field branch is
```
auto decoration = field->getKey()->findDecoration<IRSemanticDecoration>();
if (decoration) { if (sv_...) setSystemValueSemantic(...); }
else { ...getLSBZero(); allocate offset from usedBindingIndex[VaryingOutput]... }
```
A USER semantic like `PATCH_LINE` HAS an `IRSemanticDecoration`, so it enters the outer `if`, fails the inner `sv_` test, and reaches **neither** branch. It therefore never calls `getLSBZero()` — it gets no VaryingOutput offset at all and **defaults to Location 0**. The collision does not go through the shared counter; the field simply falls through the classifier with no location assigned.

**Consequence for the fix:** adding a `kIROp_PatchDecoration` (mirroring `kIROp_PerVertexDecoration`, consumer at `slang-emit-spirv.cpp:6705` / decoration loop `:3688`) → `SpvDecorationPatch` **alone** clears `VUID-StandaloneSpirv-OpEntryPoint-08722`, because `Patch`-decorated variables occupy a SEPARATE location set from per-vertex vars (confirmed against SPIRV-Tools `validate_interfaces.cpp`). So **no location-counter change is needed** — the "separate per-patch location counter" recommended as Approach A is unnecessary; the decoration is the whole fix for the standalone-validation failure.

**Still open at time of writing:** whether the `Patch` decoration alone also realigns the HS↔DS per-vertex location numbering (the report's "two stages should use matching locations" sub-issue) — pending the fixer's test results.

**Meta-lesson:** an `if(decoration){ if(sv_){...} }` with no `else` inside the outer branch is a classic fall-through gap — a value that satisfies the outer condition but not the inner one silently gets NEITHER treatment. When triaging a "defaults to 0 / missing offset" symptom, check for exactly this shape before blaming a shared allocator.
