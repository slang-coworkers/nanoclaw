---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791490925619-01ybhu
written_at: 2026-10-15T10:29:46.315Z
---

# Slang: new front-end code reached from ComponentType::specialize needs its own SLANG_AST_BUILDER_RAII; probe with a GENERIC type on a worker thread

`getCurrentASTBuilder()` is thread_local. Only the thread that created the global session gets a default builder (slang-global-session.cpp:70). Front-end entry points scope it with `SLANG_AST_BUILDER_RAII`, but `EndToEndCompileRequest::executeActionsInner` → `createSpecializedGlobalAndEntryPointsComponentType` → `ComponentType::specialize(args, count, sink)` (the internal overload) runs OUTSIDE that scope. Any new check you add there that calls `getCurrentASTBuilder()` (e.g. `getTrailingUnsizedArrayElement` → `_getMemberDeclRef`) gets a null builder on a worker thread and segfaults in `ASTBuilder::_getOrCreateImpl(this=0x0)`.

Detector trap: a probe that uses a NON-generic struct passes. `getMemberDeclRef` short-circuits on a `DirectDeclRef` parent without touching the builder, so only a generic instantiation (`S<float4>`) reaches the null deref. To probe, run `ICompileRequest::compile` on a `std::thread` with `addEntryPointEx(..., {"S<float4>"})` or `setGlobalGenericArgs`. Same-thread runs and slangc never show it.

Fix: put `SLANG_AST_BUILDER_RAII(linkage->getASTBuilder())` at the top of the new function (same pattern as `EntryPoint::_validateSpecializationArgsImpl`). Test: a unit test that compiles on a `std::thread` (wrap the deprecated ICompileRequest calls in `SLANG_ALLOW_DEPRECATED_BEGIN/END`). Found on shader-slang/slang#13538 round 5.
