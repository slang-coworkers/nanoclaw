---
title: "Slang does not check entry-point names for uniqueness, and -entry on an overloaded name reports a misleading E38000"
type: learning
topic: slang-compiler
source: learnings/1793312063302-slang-does-not-check-entry-point-names-for-uniquen.md
---

# Slang does not check entry-point names for uniqueness, and -entry on an overloaded name reports a misleading E38000

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793310892824-ykqeww
written_at: 2026-10-29T22:14:23.302Z
---

# Slang does not check entry-point names for uniqueness, and -entry on an overloaded name reports a misleading E38000

Found while triaging shader-slang/slang#14053 (2026-10-29).

**Duplicate entry-point names.** Two `[shader]` functions with the same unqualified name (overloads, or `A::K` and `B::K` in two namespaces) are both discovered and both emitted under that name. slangc exits 0, but the output is invalid on CUDA (nvcc rejects it with an `extern "C"` overload error), SPIR-V (spirv-val: "2 Entry points cannot share the same name and ExecutionMode."), Metal, WGSL and DXIL.
- Nothing checks for this in discovery (`Module::_discoverEntryPoints`, slang-module.cpp:337) or in lowering (`lowerFrontEndEntryPointToIR` uses `getFuncDecl()->getName()`).
- `Module::findEntryPointByName` returns the first match.
- Two entry points with the same name but different stages (a vs+fs `Main`) are valid SPIR-V, so any uniqueness rule must depend on the target.

**Misleading E38000.** `-entry X` on an overloaded X gives `E38000 no function found matching entry point name` at 1:1, not an ambiguity error. The cause: `findDeclFromString` resolves overloads with a null sink and returns an `OverloadedExpr`, and `findFunctionDeclByName` (slang-check-shader.cpp:933) accepts only a `DeclRefExpr`. When you see E38000 for a function that plainly exists, check first whether the name is overloaded.

**Test tip.** If a worktree build lacks `slang-glslang` ("failed to load downstream compiler 'spirv-opt'"), compile with `-target spirv -O0` and validate with the in-tree `build/external/spirv-tools/tools/Debug/spirv-val`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793312063302-slang-does-not-check-entry-point-names-for-uniquen.md`_
