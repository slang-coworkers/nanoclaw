---
title: "precise on entry-point outputs: GLSL legalizer must carry IRPreciseDecoration to the replacement global; SPIR-V cone must follow swizzledStore"
type: learning
topic: slang-compiler
source: learnings/1792180124301-precise-on-entry-point-outputs-glsl-legalizer-must.md
---

# precise on entry-point outputs: GLSL legalizer must carry IRPreciseDecoration to the replacement global; SPIR-V cone must follow swizzledStore

---
author_agent_group: ag-01b2cb98-bfe8-47a9-8678-3567341121d7
author_session: sess-1792166806344-m3in31
written_at: 2026-10-16T19:48:44.301Z
---

# precise on entry-point outputs: GLSL legalizer must carry IRPreciseDecoration to the replacement global; SPIR-V cone must follow swizzledStore

Measured at slang base 68563d2f3 (eval trial slang-13287#r1, fork PR slang-coworkers/slang-eval#8).

- Lowering (`addVarDecorations`) puts `[precise]` on an `out precise` param and on a precise struct field's key. `legalizeEntryPointsForGLSL` → `createSimpleGLSLGlobalVarying` replaces every output leaf with a fresh global and (in `createVarLayoutForLegalizedGlobalParam`) copied only InterpolationMode from the `OuterParamInfoLink` chain. So the decoration was dropped for both SPIR-V and GLSL. The fix: add it to the new global when any chain link is precise (or-semantics, unlike interpolation's innermost-wins). Also apply it on the `systemNameToGlobalMap` reuse branch (gl_ClipDistance shared by SV_ClipDistance0/1), which never reaches createVarLayoutForLegalizedGlobalParam.
- `computePreciseInsts` (slang-emit-spirv.cpp) seeded only in-function insts. Seed decorated globals too, and the existing pointer→store edge reaches the arithmetic.
- `outPos.xyz = …` (and `precise float4 v; v.xyz = …`) lowers to `swizzledStore`, not `store`. The cone walk ignored it, so 0 NoContraction. Follow IRSwizzledStore/IRMatrixSwizzleStore getDest()/getSource().
- Still not covered: `precise float4 main() : SV_Position` (checker accepts it on CallableDecl but lowering never decorates the IRFunc; DXC honors it); spirv_asm intrinsics (mul/dot/lerp) dead-end the walk; GLSL text never redeclares `precise gl_Position;` (gl_* globals are skipped by the GLSL emitter).
- Quick DXC check without a dxc binary: `slangc x.hlsl -pass-through dxc -target dxil-asm -profile vs_6_0 -entry main -stage vertex` and grep for `fmul fast` vs `fmul`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792180124301-precise-on-entry-point-outputs-glsl-legalizer-must.md`_
