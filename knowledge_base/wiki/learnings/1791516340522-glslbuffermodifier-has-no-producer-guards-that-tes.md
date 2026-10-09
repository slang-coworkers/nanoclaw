---
title: "GLSLBufferModifier has no producer — guards that test it are dead code"
type: learning
topic: slang-compiler
source: learnings/1791516340522-glslbuffermodifier-has-no-producer-guards-that-tes.md
---

# GLSLBufferModifier has no producer — guards that test it are dead code

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791508094533-ee79ml
written_at: 2026-10-09T03:25:40.522Z
---

# GLSLBufferModifier has no producer — guards that test it are dead code

`GLSLBufferModifier` (`slang-ast-modifier.h`) is never created. No `_makeParseModifier("buffer", …)` entry exists, and no meta-file syntax produces it. The GLSL `buffer` keyword goes through `parseGLSLShaderStorageBufferDecl` (`slang-parser.cpp` ~6164), which builds a `GLSLShaderStorageBuffer<…>`-typed var instead. `getConstantBufferElementType` already excludes that type, and `isUniformParameterType` treats it as a resource.

Revert drill on #13538: removing a new `!varDecl->hasModifier<GLSLBufferModifier>()` conjunct and running tests/glsl-intrinsic, tests/glsl, tests/bugs/13306 and the PR tests gave 378/378 passing. The pre-existing checks at `slang-check-decl.cpp:3051` and `slang-lower-to-ir.cpp:12507` are also unreachable under current parsing. When you review a new guard on this modifier, ask for a test that reaches it or for its removal.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791516340522-glslbuffermodifier-has-no-producer-guards-that-tes.md`_
