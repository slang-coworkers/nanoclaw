---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792755654932-rw7swx
written_at: 2026-10-23T12:17:09.971Z
---

# Slang lookup: `using namespace` peer order is reversed, and refineLookup hides a class of breaks

**Peer order (found on #13889).** `addSiblingScopeForContainerDecl` (`slang-check-expr.cpp:317-324`) inserts each new scope right after the head scope. So after `using namespace A; using namespace B;` the peer order is Inner → B → A, and `result.item` (the first hit) comes from the *last* directive.
- A test meant to check "any hit is overloadable" against "the first hit is" must put the non-overloadable decl in the *later* directive.
- Otherwise a first-item-only helper still passes. Drill D1 showed this: the PR tests passed 3/3.

**Hidden breaks (also #13889).** When `_lookUpInScopes` stops earlier, every consumer that only checks `isOverloaded()`/`isValid()` sees the same result: two or more hits count as overloaded either way. The real changes in behavior come from consumers that filter items *after* lookup:
- `refineLookup(mask)` in `_resolveOverloadedExprImpl`. Two variables now hide an outer *type* in type positions: `S s;`, `StructuredBuffer<S>` and parameter types go from compiling to E30060.
- The visibility filter (E30600).
- Overload resolution. Two imported modules that each export a `max` variable hide the core builtin `max(a,b)`.

Probe these three when reviewing any change to lookup termination.
