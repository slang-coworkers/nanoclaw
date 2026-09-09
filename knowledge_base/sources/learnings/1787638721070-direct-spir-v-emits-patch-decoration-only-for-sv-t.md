---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787638036790-09e7ey
written_at: 2026-08-25T06:18:41.070Z
---

# Direct SPIR-V emits Patch decoration only for SV tess-factor builtins, not user per-patch varyings

**Bug class (shader-slang/slang #12726, confirmed master@4be785081):** the direct SPIR-V backend (`-emit-spirv-directly`) applies `SpvDecorationPatch` to tessellation varyings in exactly ONE place — `slang-emit-spirv.cpp` `getBuiltinGlobalVar`, gated on the `SpvBuiltInTessLevelInner`/`TessLevelOuter` builtins (i.e. only `SV_TessFactor`/`SV_InsideTessFactor`). A hull patch-constant function that returns USER per-patch data (e.g. `float3 Lines[8] : PATCH_LINE`) gets that field legalized (in `slang-ir-glsl-legalize.cpp` `createPatchConstantFuncResultTypeLayout`) into an ordinary varying global with NO per-patch marker, so it never receives `Patch`. Worse, its `Location` is drawn from the SAME per-direction counter (`GLSLLegalizationContext::usedBindingIndex`, a single shared `Dictionary<LayoutResourceKind,UIntSet>`) as per-control-point varyings, so it collides at Location 0 with the per-control-point output → `spirv-val` fails `VUID-StandaloneSpirv-OpEntryPoint-08722` while `slangc` exits 0 (silent bad output). The domain (tess-eval) input side has the same missing-`Patch` defect and its per-vertex location numbering doesn't match the hull side.

**Why it matters:** valid SPIR-V puts `Patch`-decorated varyings in an INDEPENDENT location space from per-vertex varyings, so both can start at Location 0. Missing the `Patch` decoration is therefore both a correctness bug AND the cause of the location collision.

**Principled fix pattern (recommended):** there is no first-class per-patch IR decoration today (grep slang-ir-insts.lua/.h — only `IRPatchConstantFuncDecoration` + the `HLSLInputPatch/OutputPatch` container types; "per-patch" is modeled only implicitly via the builtin special-case). Introduce one mirroring the existing `kIROp_PerVertexDecoration` (producer in glsl-legalize, consumer `slang-emit-spirv.cpp:6705` → `SpvDecorationPerVertexKHR`) and `kIROp_GLSLPrimitivesRateDecoration` (consumer at `emit-spirv.cpp:3688` decoration loop → `SpvDecorationPerPrimitiveEXT`). Attach it to user patch-constant OUTPUT globals (`createPatchConstantFuncResultTypeLayout`) and domain patch-INPUT globals (`legalizePatchParam`), emit `SpvDecorationPatch` for it in the `emitGlobalParam` decoration loop, and give per-patch varyings a SEPARATE location counter so patch/per-vertex spaces are independent and HS↔DS realign.

**Gotcha for the fixer:** `tests/spirv/hull-shader.slang` currently BAKES IN the buggy behavior — its patch-constant output has a user field `uint instanceId` and the CHECK asserts a plain `Location` with no `Patch`. Those CHECK lines must be updated; they're evidence of the bug, not intended behavior. Also both GLSL text and direct-SPIR-V share `legalizeEntryPointsForGLSL`, so this legalization is the common front; `slang-ir-spirv-legalize.cpp` has zero tess/patch handling.

**Triage note:** a clean `slangc` exit proves nothing here — emit spirv-asm and grep the `OpDecorate ... Patch`/`Location` lines; the overlapping `Location 0` with a missing `Patch` on the user field is the whole signature.
