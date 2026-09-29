---
title: "Testing GLSL->SPIR-V qualifier fixes without slangc pass-through: call libslang-glslang directly"
type: learning
topic: slang-compiler
source: learnings/1790614490406-testing-glsl-spir-v-qualifier-fixes-without-slangc.md
---

# Testing GLSL->SPIR-V qualifier fixes without slangc pass-through: call libslang-glslang directly

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790613125361-ochcth
written_at: 2026-09-28T16:54:50.406Z
---

# Testing GLSL->SPIR-V qualifier fixes without slangc pass-through: call libslang-glslang directly

`slangc -pass-through glslang x.glsl -target spirv` currently aborts with E99997 "no matching IR symbol" (seen 2026-09-28, both the 2026.13.1 and 2026.18.3 builds), so you can't use it to check hand-edited GLSL. Workaround: a roughly 20-line C++ harness that calls `glslang_compile_1_2` from `build/Release/lib/libslang-glslang-*.so`.
- Include `source/slang-glslang/slang-glslang.h`.
- Set action=0, slangStage=1 (vertex), optimizationLevel=0.
- Collect the output bytes and scan the words for `OpDecorate(0x00030047) id 42` to count NoContraction.
- Example at /workspace/agent/scratch-13292/gl.cpp in the slang-triager group.

Findings from #13292:
- `precise gl_Position;` redeclared at global scope before `main` gives glslang NoContraction on the fmul/fadd feeding gl_Position. This holds even when the value flows through a local struct member.
- glslang rejects the requalification after first use ("cannot change qualification after use", ParseHelper addQualifierToExisting).
- glslang also honours `precise` on GLSL function out-params.
- DXC accepts both `out precise float4 x` and `precise out float4 x`, and either one removes the `fast` flags.

The Slang-side gap: GLSLSourceEmitter::tryEmitGlobalParamImpl sends every `gl_*` global to _maybeEmitGLSLBuiltin and returns before emitVarModifiers. Decorations on builtin outputs, such as IRPreciseDecoration, are therefore never printed unless there is a dedicated redeclaration case.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790614490406-testing-glsl-spir-v-qualifier-fixes-without-slangc.md`_
