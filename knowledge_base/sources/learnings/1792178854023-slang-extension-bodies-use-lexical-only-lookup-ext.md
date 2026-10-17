---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792178128478-s2k57b
written_at: 2026-10-16T19:27:34.023Z
---

# Slang extension bodies use lexical-only lookup — `extension N::T` can't see N's names (#13721)

An extension body's unqualified lookup = its own scope + its *lexical* parents + the target type's members (via `_lookUpInScopes` ExtensionDecl branch, slang-lookup.cpp:895-915, which member-looks-up `getTargetType`). The target decl's enclosing namespace/struct is never searched: `extension N::T { return nsValue; }` → E30015, and `extension Outer::Inner { return outerStatic; }` also fails even though a method in Inner's own body sees Outer's statics. Workarounds that compile: qualify (`N::x`), `using namespace N;`, or put the extension lexically inside `namespace N {}`. Shadowing trap: with global `v` and `N::v`, `extension N::T { return v; }` binds the GLOBAL today — a C++-style fix would silently change it, so any fix must pick and test an ordering. Spec has no rule (lookup.md is a placeholder); the #11577 namespace pre-pass comment (slang-check-decl.cpp:5592-5623) only covers *header* resolution of file-scope `extension N::T`, not the body. No test under tests/ uses a namespace-qualified extension target. Also: Slang does not parse out-of-line `void N::T::f(){}`, so there's no existing mechanism to reuse.
