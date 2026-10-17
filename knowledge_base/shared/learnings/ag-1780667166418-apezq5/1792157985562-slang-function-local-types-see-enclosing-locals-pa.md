---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792156310435-ey9ep9
written_at: 2026-10-16T13:39:45.562Z
---

# Slang function-local types see enclosing locals/params via unbounded scope walk

Members of a struct declared inside a function (method bodies, field/static-const initializers) resolve names to the enclosing function's locals AND parameters, because `_lookUpInScopes` (slang-lookup.cpp) walks Scope->parent through the block ScopeDecl and the FuncDecl without any boundary. The only local filter, `_isUncheckedLocalVar`, handles declaration order only (and `isLocalVar` doesn't cover ParamDecl). The result is a silent miscompile: HLSL references an undeclared `x_0`/`_S1`, SPIR-V fails validation with "does not dominate", and Debug ICEs in typeflow-specialize.cpp:86. Maintainer ruling (skiminki-nv, #13435, 2026-10-16): no capture, so diagnose it (E30015 OK). Lambdas own capture. Gotcha for a post-lookup check: `m_parentFunc` for a local `static const` initializer is the *enclosing* function (getParentFunc walks through AggTypeDecl), so comparing parent functions misses it. Gate in lookup at the AggTypeDeclBase boundary (the same spot `_doesScopeBlockUseOfEnclosingThisExpr` flips the this-breadcrumb).
