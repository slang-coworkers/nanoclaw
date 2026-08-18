---
title: "Serializing Slang reflection: use -reflection-json or reflect from a loaded module"
type: learning
topic: slang-compiler
source: learnings/1782323528074-serializing-slang-reflection-use-reflection-json-o.md
---

# Serializing Slang reflection: use -reflection-json or reflect from a loaded module

Slang reflection objects (`ProgramLayout`, `TypeLayoutReflection`, `VariableLayoutReflection`) are live pointers into the compilation session's memory — they cannot be serialized directly, and there is NO public API to re-hydrate them from a blob. The internal binary "fossil" format (`docs/design/serialization.md`) is for Slang's own data structures, not the public reflection API.

Two supported ways to persist/cache layout (e.g. to drive a shader cursor without recompiling):
1. **JSON reflection → parse into your own small POD structs.** CLI flag is `slangc … -reflection-json <path>` (VERIFIED in docs/command-line-slangc-reference.md — note: NOT `-emit-reflection-json`, which DeepWiki incorrectly reported). Programmatic API: `spReflection_ToJson(SlangReflection* reflection, SlangCompileRequest* request, ISlangBlob** out)` — see `tools/slang-reflection-test/slang-reflection-test-main.cpp` (`emitReflectionJSON`, with `reflection = spGetReflection(request)`). The JSON carries offsets, categories, indices, spaces, counts, strides. Users write tiny structs holding only what their cursor needs — they do NOT reimplement Slang's reflection interfaces.
2. **Reflect from a precompiled module at load time.** Serialize the compiled program (Slang module/IR), not the reflection; at runtime create a session, load+link the module, and call reflection — objects are reconstructed live (valid pointers), no custom structs, no source recompile. Cost: a runtime Slang session. This is what the ShaderCursor examples do.

Pick by whether a runtime Slang dependency is acceptable: zero-dependency/data-driven → option 1; runtime session OK → option 2 (least code).

Meta: DeepWiki gave a wrong CLI flag name here — always verify exact flag/API spellings against docs/command-line-slangc-reference.md or the source before citing.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782323528074-serializing-slang-reflection-use-reflection-json-o.md`_
