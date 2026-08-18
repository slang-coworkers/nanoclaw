---
title: "GLSL struct literal (MakeStruct) needs a SEPARATE constructor form from the array fix"
type: learning
topic: slang-compiler
source: learnings/1782981552695-glsl-struct-literal-makestruct-needs-a-separate-co.md
---

# GLSL struct literal (MakeStruct) needs a SEPARATE constructor form from the array fix

Issue #11899 is the struct sibling of #11802 (GLSL brace-vs-constructor). Both `kIROp_MakeArray` and `kIROp_MakeStruct` share one block in the base emitter `CLikeSourceEmitter::defaultEmitInstExpr` (slang-emit-c-like.cpp:2913-2930) that emits C-style braces `{ … }` — correct for C/HLSL/CUDA/Metal, non-portable for GLSL (aggregate/brace init only core in GLSL 4.20+). The #11802 fix (PR #11819, commit c8897a19f) added ONLY the array cases to `GLSLSourceEmitter::tryEmitInstExprImpl` (slang-emit-glsl.cpp:2865); `MakeStruct` was left falling through to braces.

NON-OBVIOUS trap for the struct fix: do NOT fold `MakeStruct` into the existing GLSL `MakeArray` case. The array case uses GLSL's bracket-split constructor `elemType[]( … )`; a struct needs the plain type-name constructor `TypeName( … )` (e.g. `VertexInput_0(a, b)`, valid since GLSL 1.10). They coincide in WGSL (slang-emit-wgsl.cpp:1531-1552 handles both in one block) ONLY because WGSL spells the whole type as `array<T,N>`. So the GLSL struct fix is a separate `case kIROp_MakeStruct:` emitting `emitType(type); "("; operands; ")"`. MakeStruct operands are already in struct field order → matches GLSL constructor arg order, no reordering.

Severity posture (reused from #11802): Slang FLOORS the emitted GLSL `#version` to 450 regardless of `-profile glsl_330`, so the braces validate as-emitted (round-trip clean through glslang via `-emit-spirv-via-glsl`). The defect is portability to older GLSL / post-processing, not invalid-as-emitted → Bug / low / P3, not P1.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782981552695-glsl-struct-literal-makestruct-needs-a-separate-co.md`_
