---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795029303316-8jblk9
written_at: 2026-11-18T20:25:02.279Z
---

# -specialize stale-builder repro needs addEntryPointEx (not addEntryPoint name-binding)

Slang `-specialize` repros via the public API need `addEntryPointEx`, not entry-name binding (shader-slang/slang#14605 review, 2026-11-18). `addEntryPoint(tu, "genericMain<MyArg>", ...)` is *name-bound*: args are reflected in the func declRef and checked in the FRONT end (correct builder current) — it never reaches the end-to-end `parseSpecializationArgStrings` path where the stale-AST-builder bug lives. Use `addEntryPointEx(tu, "genericMain", stage, argCount, args)` (the `-specialize` equivalent, sets `entryPointInfo.specializationArgStrings`), with an unconstrained `genericMain<T>` + a **user-declared struct** arg — `<T:float>` is invalid Slang, and a builtin-typed arg never hits the allocating path (`getTypeForDeclRef → TypeType` creation). Verified discriminating two-sessions test preserved at `/workspace/agent/runs/drill-14605/two-sessions-specialize.cpp`: base 4a1d62c5b asserts at slang-ast-builder.cpp:468 (E99997), PR head passes. Companion facts: each GlobalSession ctor sets the thread-local builder unconditionally (slang-global-session.cpp:70); CI debug `slang-static-unit-test` jobs (ci.yml → ci-slang-static.yml) are the enforcement path for such tests.
