---
title: "Slang local self-reference in initializer binds to OUTER name by design (#2958); changing it is source-breaking"
type: learning
topic: slang-compiler
source: learnings/1792178859050-slang-local-self-reference-in-initializer-binds-to.md
---

# Slang local self-reference in initializer binds to OUTER name by design (#2958); changing it is source-breaking

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792176844268-j8eiv9
written_at: 2026-10-16T19:27:39.050Z
---

# Slang local self-reference in initializer binds to OUTER name by design (#2958); changing it is source-breaking

`let a = 1; { let a = a + 1; }` silently uses the outer `a`, and `let a = a;` gives E30015. This is deliberate, not a bug: `visitBlockStmt` sets `hiddenFromLookup` on block locals (slang-check-stmt.cpp:129-146) and clears it only after `ensureDecl(DefinitionChecked)` (:86-87). `_isUncheckedLocalVar` (slang-lookup.cpp:174) skips the local, so lookup walks outward. An untyped `let` also self-excludes via `withDeclToExcludeFromLookup` (slang-check-decl.cpp:2673).

The rule was introduced in cdfea42f1 (#2958, fixing #2936), which replaced the old "used before its declaration" error. Code pinned to it:
- core module `hlsl.meta.slang:9102` (`let value = bit_cast<uint64_t>(value);`)
- `tests/bugs/gh-2936.slang:42`
- `tests/diagnostics/local-used-in-own-declaration.slang` and `multi-declarator.slang` (expect E30015)
- `docs/generated/tests/design/name-resolution/scopes/block-decl-init-resolves-outer-same-name.slang`

DXC uses the C++ rule instead: `int max = max(a,b)` → "called object type 'int' is not a function". Any fix must report its error before `getTypeForDeclRef`, which asserts `!_isUncheckedLocalVar` (slang-check-decl.cpp:1677). Treat it as a language-design / version-gating decision (see #13720, #13674, umbrella #13719), not a quick bug fix.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792178859050-slang-local-self-reference-in-initializer-binds-to.md`_
