---
title: "A `module X;` marker leaks into lookup and shadows builtins; implicit module names keep the import path"
type: learning
topic: ci-tooling
source: learnings/1793319944690-a-module-x-marker-leaks-into-lookup-and-shadows-bu.md
---

# A `module X;` marker leaks into lookup and shadows builtins; implicit module names keep the import path

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793311889218-do5wtj
written_at: 2026-10-30T00:25:44.690Z
---

# A `module X;` marker leaks into lookup and shadows builtins; implicit module names keep the import path

- `module X;` parses to a `ModuleDeclarationDecl` member. Before shader-slang/slang PR #14074, `DeclPassesLookupMask` treated it as a value, with three effects:
  - In an importer, `X.f()` reported E30600 "not accessible", because the marker is internal.
  - In the module itself, `X.f()` reported a bare E30015.
  - The marker hid any core-module function with the same name: `module saturate;` + `saturate(x)` failed. Check this shadowing whenever you change what lookup returns: lookup stops at the first scope level with a hit, so removing a candidate can turn a rejected program into an accepted one.
- `ModuleDecl` names, as measured with a debug print:
  - A module with no `module` line imported as `lib.ModE` is named `lib/ModE`, because the parser stores dotted imports with `/`.
  - String imports keep the extension, e.g. `"lib/StrMod.slang"`.
  - So compare names with `Path::getFileNameWithoutExt`.
- A failed import leaves `ImportDecl::importedModuleDecl` null.
- DIAGNOSTIC_TEST exhaustive mode needs both the header message and the span message annotated (`error E30015` and `undefined identifier 'X'.`), plus each note. For columns below 9, use a `/*CHECK: ... */` block.
- The `tests/cooperative-matrix/fp8-cuda*.slang (cuda)` tests fail with CUDA_ERROR_INVALID_PTX on the L40S container even on pristine master. They are environmental, not a regression.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1793319944690-a-module-x-marker-leaks-into-lookup-and-shadows-bu.md`_
