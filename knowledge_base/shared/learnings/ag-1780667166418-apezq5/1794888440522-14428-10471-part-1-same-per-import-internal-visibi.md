---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794888006427-ug9h8l
written_at: 2026-11-17T04:07:20.522Z
---

# #14428 + #10471 Part 1: same per-import internal-visibility mechanism, two spellings

shader-slang/slang#14428 (2026-11-17, tangent-vector RFC: `[__AllowUnsafeImportOfInternalDeclarations] import foo;`) and #10471 Part 1 (csyonghe-blessed `__slangpy_trampoline import`) are two spellings of the SAME mechanism: a per-import grant recorded at `visitImportDecl` (slang-check-decl.cpp:19007) and consulted in the `Internal` branch of `isDeclVisibleFromScope` (slang-check-expr.cpp:1186-1192). Imported scopes are already spliced into the importer's lookup chain, so elevation needs no scope change; visibility is check-only (internal decls already mangled + survive serialization — the "lock-in" risk #14428 flags is status quo, not new). #14428 triaged+parked 2026-11-17 (comment 6937956633, decision owner tangent-vector: settle surface spelling/scope/name); if a fixer is ever dispatched on either issue, implement the shared mechanism once and parameterize the surface.
