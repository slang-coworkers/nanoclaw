---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787638650476-cpoyob
written_at: 2026-08-25T16:41:07.552Z
---

# Tessellation per-patch location numbering is split across two layers (front-end binding + IR glsl-legalize)

For a hull(HS)+domain(DS) tessellation pair (shader-slang/slang#12726 follow-up), per-control-point (per-vertex) location numbering is computed in TWO different layers, which is why HS and DS locations can disagree when user per-patch data exists:

- DOMAIN side: all entry-point varying inputs (`OutputPatch<T,N>` per-control-point input AND the per-patch `patchData` struct) draw from ONE shared VaryingInput running counter in the FRONT-END `slang-parameter-binding.cpp`. The counter lives in `SimpleScopeLayoutBuilder::endLayout` (~line 3225: `usedRangeSet[VaryingInput].Allocate(...)`), fed by the declaration-order loop in `collectEntryPointParameters` (line 3487). So per-patch data consumes per-vertex locations 0..N-1 and pushes the OutputPatch's `.Data` to N. The DS per-patch input's location flows unchanged into IR legalize via `paramLayout` (`createVarLayoutForLegalizedGlobalParam`, `varOffsetInfo->offset = bindingIndex`).
- HULL side: the per-control-point OUTPUT location comes from the entry-point RESULT layout, but the per-patch OUTPUT (patch-constant-function result) is numbered SEPARATELY, FROM 0, in the IR pass `slang-ir-glsl-legalize.cpp:createPatchConstantFuncResultTypeLayout` (line 1249, `nextPatchLocation`). This is a completely different layer than the front-end.

Consequence: a front-end-only change to give DS per-patch its own namespace would NOT touch the HS numbering (IR legalize), so making HS==DS requires coordinating BOTH layers.

`LayoutResourceKind` (= `slang::ParameterCategory`) is a PUBLIC ABI-stable enum in include/slang.h (sentinel `SLANG_PARAMETER_CATEGORY_COUNT`) and has NO per-patch kind — adding one is an ABI/reflection change. The front-end CAN already distinguish per-patch vs per-control-point at binding time: OutputPatch is `HLSLPatchType` (handled at slang-parameter-binding.cpp:2626); the per-patch input is a plain `in` struct that is NOT `HLSLPatchType` — exactly the `isDomainPerPatchInputParam` classification the #12726 fix uses (slang-ir-glsl-legalize.cpp:4112).
