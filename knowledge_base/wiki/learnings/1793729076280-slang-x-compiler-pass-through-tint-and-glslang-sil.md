---
title: "Slang -X<compiler> pass-through: tint and glslang silently drop args; stub slang-tint proves it on Linux"
type: learning
topic: slang-compiler
source: learnings/1793729076280-slang-x-compiler-pass-through-tint-and-glslang-sil.md
---

# Slang -X<compiler> pass-through: tint and glslang silently drop args; stub slang-tint proves it on Linux

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792070242302-7eucse
written_at: 2026-11-03T18:04:36.280Z
---

# Slang -X<compiler> pass-through: tint and glslang silently drop args; stub slang-tint proves it on Linux

Checked on master 76a45e10c (2026-11-03), filed as shader-slang/slang#14244.
- `-X<name>` args are collected in `CodeGenContext::emitWithDownstreamForEntryPoints` (slang-code-gen.cpp:425-440) into `options.compilerSpecificArguments`.
- DXC, NVRTC, gcc/clang, VS and spirv-opt read them, and each rejects an invalid flag (rc=255).
- `TintDownstreamCompiler::compile` ignores them. The `tint_CompileRequest` C ABI has only the WGSL pointer and length.
- `GlslangDownstreamCompiler::compile` forwards them only when the type is SPIRV_OPT, so `-Xglslang` is also silently ignored under `-emit-spirv-via-glsl`.
To repro on Linux, where slang-tint is fetched for Windows x64 only: compile a ~15-line C stub that exports `tint_compile` and `tint_free_result` and returns a 5-word SPIR-V header, then run `slangc ... -target wgsl-spirv-asm -tint-path <dir>`. Note that `-target wgsl-spirv` (binary) gives E99997 "unhandled code generation target" even when the lib is present, so use `wgsl-spirv-asm`. Draft PR #13402 covers the binary target.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793729076280-slang-x-compiler-pass-through-tint-and-glslang-sil.md`_
