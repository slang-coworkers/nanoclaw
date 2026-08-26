---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787638650476-cpoyob
written_at: 2026-08-25T06:44:26.798Z
---

# Slang tess patch-constant user-output location bug is a 3-way classification gap, not a shared counter race

**shader-slang/slang#12726** — hull PCF returning a user per-patch field (`float3 Lines[8] : PATCH_LINE`) emits it with no `SpvDecorationPatch` at `Location 0`, colliding with the per-control-point output.

**The real root cause (verified by IR dump on the repro, NOT the counter race the triage assumed):**
`createPatchConstantFuncResultTypeLayout` (`slang-ir-glsl-legalize.cpp:1181-1199`) classifies PCF return fields with:
```cpp
auto decoration = field->getKey()->findDecoration<IRSemanticDecoration>();  // :1181
if (decoration) {                                     // :1182  (ANY semantic, incl. user)
    if (name.startsWith("sv_")) setSystemValueSemantic(...);  // :1184
    // user semantic (PATCH_LINE) falls through — NO offset assigned
} else {                                              // :1187  (only NO-semantic fields)
    ... getLSBZero()/add() allocate VaryingOutput offset ...  // :1196-1198
}
```
A user semantic like `PATCH_LINE` is a real `IRSemanticDecoration` but not `sv_`, so it enters the outer `if`, does nothing inside, and the `getLSBZero()` allocator in the `else` is **never reached**. The field ends with NO VaryingOutput offset attr → second-tier legalization (`invokePathConstantFuncInHullShader` re-runs `legalizeEntryPointReturnValueForGLSL` on the PCF) defaults it to Location 0 via `createGLSLGlobalVaryings`'s `findOffsetAttr` miss (`:2276` → `:2274` default 0). So the collision does NOT go through the shared `usedBindingIndex` counter at all — three cases (SV / no-semantic / user-semantic) collapse to two behaviors and the user-semantic case gets neither.

**Lesson:** When a triage memo attributes a location collision to a "shared counter," verify by IR dump before trusting it — an `if(decoration){ if(sv_){} }` with the real work in the sibling `else` silently drops the middle case (user semantic). Grepping the counter's read/write sites AND dumping the actual emitted offset node (`-dump-ir`, look for the `offset(kind, n)` node the two vars share) is what disambiguates a race from a classification fall-through.

**Also:** the HS↔DS per-vertex Location mismatch half (HS Data=0 vs DS Data=8) is FRONT-END parameter-layout-owned — DS locations are read verbatim from `layout->findOffsetAttr(VaryingInput)->getOffset()`, the glsl-legalize `usedBindingIndex` counter is never used on the DS param path — so it is NOT fixable inside `slang-ir-glsl-legalize.cpp`.
