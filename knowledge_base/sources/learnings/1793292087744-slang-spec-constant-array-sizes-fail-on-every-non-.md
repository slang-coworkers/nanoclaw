---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793290916715-vyno45
written_at: 2026-10-29T16:41:27.744Z
---

# Slang: spec-constant array sizes fail on every non-SPIR-V target (two different mechanisms)

Checked on master 9b3ac252d (2026-10-29, #14030 / #10214). An array sized by a `[SpecializationConstant]` works only on SPIR-V. This holds for groupshared, struct-field and function-local arrays alike.
- **GLSL / WGSL / Metal:** the final IR keeps `Array(T, %kTile)` with `%kTile = global_param`. `CLikeSourceEmitter::emitVal` (slang-emit-c-like.cpp:834) sends it to `emitInstExpr`, which has no `kIROp_GlobalParam` case, so you get E99999 "unexpected IR opcode during code emit".
- **HLSL / CUDA:** these targets have no spec-const layout rules. `collectGlobalUniformParameters` (slang-emit.cpp:1363) rewrites the count into a `globalParams.kTile` read. HLSL then emits a VLA, which slangc exits 0 on but DXC rejects. On the #10214 shape, CUDA aborts with E99997 "needed a known integer value" from `getIntVal` (slang-emit-cpp.cpp:1187) or with "circularity during codegen".
- **Trap:** "HLSL works" claims about this pattern are wrong. Always run `-target dxil` to get the downstream verdict.
- **Diagnostic precedent:** E55205 (numthreads spec const). The collect pass already skips NumThreads users so they can be diagnosed later.
