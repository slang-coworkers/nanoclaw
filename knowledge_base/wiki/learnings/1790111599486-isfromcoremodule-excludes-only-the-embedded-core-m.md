---
title: "isFromCoreModule excludes only the embedded core module, not standard-library modules"
type: learning
topic: misc
source: learnings/1790111599486-isfromcoremodule-excludes-only-the-embedded-core-m.md
---

# isFromCoreModule excludes only the embedded core module, not standard-library modules

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789599710829-tncj2s
written_at: 2026-09-22T21:13:19.486Z
---

# isFromCoreModule excludes only the embedded core module, not standard-library modules

When filtering out "builtin"/"library" declarations in the Slang checker, `isFromCoreModule(decl)` (source/slang/slang-lower-to-ir.cpp) checks only for `FromCoreModuleModifier`, which is applied **solely** to the embedded core module (core.meta.slang / hlsl / glsl), set at `slang-compile-request.cpp` when `m_isCoreModuleCode` is true.

It does **NOT** cover the separately-compiled standard-library modules under `source/standard-modules/` (`slang.numerics`, `slang.functional`, `slang.neural`, `workgraph`, `differentiable`). Those are loaded from the standard-module search path (`getStandardModuleDirPath` in slang-session.cpp) as ordinary imported `.slang` modules and carry **no** `FromCoreModuleModifier`. So `isFromCoreModule` returns false for them, and they leak into any "exclude builtin decls" logic when a user imports them (they're gated behind `-experimental-feature` + `[ExperimentalModule]`, so this only surfaces with experimental features on).

Consequences / options if you need to exclude standard-library decls:
- `[ExperimentalModule]` (`ExperimentalModuleAttribute`, precedent at slang-session.cpp:1621, slang-lower-to-ir.cpp:15800) marks exactly today's standard modules — but it means "experimental", not "standard library" (a user can mark their own module experimental), so it's a fragile proxy.
- There is **no** dedicated "is standard-library module" provenance bit on `Module`/`ModuleDecl` (Module only exposes `m_pathInfo`, `getModuleDecl`).
- The robust, zero-infrastructure alternative is a same-module identity check: `getModuleDecl(someScope) == getModuleDecl(candidateDecl)` (existing precedent at slang-check-expr.cpp:~1156). This excludes core, ALL standard-library, and every other imported module at once — but also excludes the user's own *imported* modules (narrows "user-declared" to "same-module").

Discovered while fixing #13140 (constraint-suggestion note): the "exclude standard/core, but keep user imports" intent has no cheap clean implementation without adding a provenance flag on the standard-module load path.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790111599486-isfromcoremodule-excludes-only-the-embedded-core-m.md`_
