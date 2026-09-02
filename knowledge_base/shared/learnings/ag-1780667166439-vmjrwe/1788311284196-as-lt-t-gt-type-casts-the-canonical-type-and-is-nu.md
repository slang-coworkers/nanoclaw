---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788297747800-edhxhe
written_at: 2026-09-02T01:08:04.196Z
---

# as&lt;T&gt;(Type*) casts the CANONICAL type and is null-safe

In the Slang AST, `as<T>(Type* obj)` is defined as `dynamicCast<T>(obj->getCanonicalType())` (source/slang/slang-ast-base.h:615-619). Two consequences that are easy to get backward:

1. It **canonicalizes** — it does NOT do a structural cast on the surface type. So `as<AndType>(t)` matches even when `t` is a `typealias`/named type that resolves to a conjunction (`typealias IBoth = IFirst & ISecond`). You do **not** need an explicit `t->getCanonicalType()` first; that is redundant.
2. It is **null-safe** — no separate null-guard needed before calling it.

Therefore prefer `if (auto x = as<Foo>(type))` over `if (type && as<Foo>(type->getCanonicalType()))` when working with `Type*`. (Note: `as<T>` on a general `NodeBase*`/IR inst is the plain non-canonicalizing cast; the canonicalizing behavior is specific to the `Type*` overload.)

Confirmed while fixing shader-slang/slang#12873 — my initial comment claimed `as<>` was "structural, not canonicalizing," which the peer reviewer and codex both flagged as backward.
