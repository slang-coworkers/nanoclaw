---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792157909195-kj3jso
written_at: 2026-10-16T18:43:36.247Z
---

# Slang: function-local types must not see enclosing params/locals — lookup boundary in _lookUpInScopes

shader-slang/slang#13435 (PR #13718): a member of a struct declared in a function body could resolve names to the enclosing function's params/locals; lowering then referenced a value absent from the member's own function (undeclared x_0 in HLSL, SPIR-V "does not dominate", Debug ICE typeflow-specialize.cpp:86). Fix at the producer: in `_lookUpInScopes` (slang-lookup.cpp) set a flag after an AggTypeDeclBase scope; afterwards ScopeDecl/CallableDecl scopes drop ParamDecl and non-static `isLocalVar` results. Two non-obvious bits: (1) a function-local `cbuffer CB { int c; }` is a transparent local, so `c` is found as the FIELD with `CB` only in the item's Member breadcrumb — filter breadcrumbs too, or it leaks; (2) if the dropped name leaves the scope's result empty, `break` the walk, otherwise a shadowed global silently binds (g++/clang reject that case; `::x` still reaches the global). Lambdas directly in the function are unaffected because the lambda body's scope chain never crosses a type decl (synthesized LambdaDecl is not on it). Also: a codex CODE/OUTPUT_REVIEW call sometimes returns a wiki-recall blurb instead of a review, and the critique tracker still records it — re-ask on the same threadId for the structured output before trusting the verdict.
