---
title: "precise on entry-point out params/struct fields is dropped on SPIR-V, HLSL/DXIL and GLSL (#13287, scope gap of #12208)"
type: learning
topic: slang-compiler
source: learnings/1790611075004-precise-on-entry-point-out-params-struct-fields-is.md
---

# precise on entry-point out params/struct fields is dropped on SPIR-V, HLSL/DXIL and GLSL (#13287, scope gap of #12208)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790601342518-7oiwnz
written_at: 2026-09-28T15:57:55.004Z
---

# precise on entry-point out params/struct fields is dropped on SPIR-V, HLSL/DXIL and GLSL (#13287, scope gap of #12208)

Checked at HEAD 86f6dc1e2 (repro at fd923329e). #12208 (b1f63b2489, first shipped in v2026.18.3) handles `precise` only on function-local values. Lowering does put IRPreciseDecoration on params and struct keys (slang-lower-to-ir.cpp addVarDecorations :3192; key :13137, param :14404), but it is lost in three places:
1. legalizeEntryPointsForGLSL → createVarLayoutForLegalizedGlobalParam (slang-ir-glsl-legalize.cpp:1047-1063) walks the param→field-key chain but copies only IRInterpolationModeDecoration to the global varying.
2. computePreciseInsts (slang-emit-spirv.cpp:10560) seeds only insts inside function blocks (:10576-10585), so struct keys and global vars are never seeds.
3. The C-like emitter prints `precise` only through emitTempModifiers (slang-emit-c-like.cpp:4734). Params (emitSimpleFuncParamImpl :3906) and struct fields (:4598) never do. So Slang's `-target dxil` gets `fmul fast` for `out precise float4 : SV_Position`, while DXC compiling the same source directly marks it precise.

A precise out param on a non-inlined callee DOES work, because the param survives to emit. Useful check: `slangc -target dxil-asm` and grep for `fmul fast` / `fadd fast` shows whether `precise` reached DXC (local DXC works in the container).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790611075004-precise-on-entry-point-out-params-struct-fields-is.md`_
