---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787092990177-j2ebuj
written_at: 2026-08-18T23:03:13.079Z
---

# Slang BottomType/Never is only the throws error type, NOT a non-returning/noreturn marker

**Context:** Triaging shader-slang/slang#12612 (guard-style `let ... else`), the "else must diverge" contract hinges on whether Slang can recognize a call that never returns. DeepWiki and a first-pass memo disagreed on whether `BottomType`/`Never` already marks non-returning functions.

**Verified firsthand (2026-08-18, master 9a948c67a):** read ALL 24 `BottomType`/`getBottomType` occurrences across 11 files under `source/slang/`.

- The type EXISTS (`slang-ast-type.h:48-56`), and `FuncType::getResultType()`'s doc comment (`slang-ast-type.h:1059-1060`) states the design *intent*: "a type that can never return will have the bottom type `Never` as its result type." So "no such type exists" is wrong.
- BUT that intent is **UNWIRED**. Every functional use of `BottomType` is the **throws/try ERROR type**: `getErrorType()->equals(getBottomType())`, `errorType`, `getErrorCodeType`, and the default in `slang-syntax.h:467` (checker sites: `slang-check-expr.cpp:4267/5660/5697/7589/7614`, `slang-check-decl.cpp:7750/7754/15613`, `slang-check-stmt.cpp:642`; lowering `slang-lower-to-ir.cpp:2733/4810`; `slang-ast-type.cpp:1485`). The remainder are the singleton ctor (`slang-ast-builder.cpp:149/152`), `_toText`/`_substitute` overrides, and mangling (`slang-mangle.cpp:248`).
- **NOT ONE site reads `FuncType::getResultType()` and checks `== BottomType` to mean "this call diverges."**

**Implications:**
- There is NO checker-level control-flow reachability / "completes normally" analysis, and NO `[noreturn]`/`__noreturn` attribute (grep: zero hits). Missing-return is an IR-level concept (`slang-ir-missing-return.{h,cpp}`, `IRMissingReturn` inserted at `slang-lower-to-ir.cpp:14366-14374`), which models *function* exit only.
- Any feature needing "this branch/call diverges" (guard bindings, exhaustiveness, etc.) must today use a **bounded structural check** over statement shape (ends in `return`/`break`/`continue`/`discard`/`throw`), NOT a type-based `Never` test. A type-based contract would first require *wiring* result-type `Never` (a producer that sets it + a consumer that reads it) — strictly larger scope. The `getResultType` doc comment is the reserved future extension point, currently inert.
- Subtlety: `throw` counts as divergence only when the enclosing function has a non-`Never` **error** type; otherwise `throw` itself is a checker error (`slang-check-stmt.cpp:642`). `return`/`break`/`continue`/`discard` are the unconditional terminating forms.

**Lesson:** when a subagent/DeepWiki summary and your own note disagree on a load-bearing type/semantic fact, resolve it by reading ALL usages of the symbol firsthand before relaying — a doc-comment stating design *intent* does not prove the intent is *wired*.
