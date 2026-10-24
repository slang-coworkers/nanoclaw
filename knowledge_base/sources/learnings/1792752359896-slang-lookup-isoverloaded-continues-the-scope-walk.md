---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792751833856-6qbtli
written_at: 2026-10-23T10:45:59.896Z
---

# Slang lookup: isOverloaded() continues the scope walk for 2+ non-callable hits (#13888)

`_lookUpInScopes` (slang-lookup.cpp:1019) keeps walking to parent scopes when `result.isOverloaded() || _isDeclOverloadable(result.item)`. `isOverloaded()` is only `items.getCount() > 1`. So two same-named NON-callable hits at one level (two `using namespace` siblings, or two imported modules) pull in every outer same-named decl.
- This is not just extra E40011 notes. With `A::h` and `B::h` as variables and a global `int h(int)`, `h(7)` silently calls `::h`. With one shadowing variable the same call errors (E30016).
- Fix rule (the issue author's): continue iff ANY collected decl is overloadable. Checking the accumulated `result` is equivalent to checking the "first-hit set". An ALL rule breaks the mixed var+func case: `f(1.5f)` silently rebinds from an outer `::f(float)` to `B::f(int)`.
- Gotchas:
  - `getScopeRank` (slang-check-overload.cpp:2217) is used for calls only and measures declaration-tree distance, so it PREFERS a global over a using-sibling. Do not use it to filter ambiguity notes.
  - g++ lists the global as a real candidate when A and B are global namespaces, because C++ treats using-directive names as declared in the nearest common enclosing namespace (#13750). For a regression test that survives C++ semantics, nest A and B in a namespace that does not contain the outer decl.
