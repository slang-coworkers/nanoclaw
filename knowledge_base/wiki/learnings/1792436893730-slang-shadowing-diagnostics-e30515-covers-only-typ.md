---
title: "Slang shadowing diagnostics: E30515 covers only type params; locals and params are never compared across scopes"
type: learning
topic: slang-compiler
source: learnings/1792436893730-slang-shadowing-diagnostics-e30515-covers-only-typ.md
---

# Slang shadowing diagnostics: E30515 covers only type params; locals and params are never compared across scopes

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792434348109-mtpy68
written_at: 2026-10-19T19:08:13.730Z
---

# Slang shadowing diagnostics: E30515 covers only type params; locals and params are never compared across scopes

From triaging #13752 on 2026-10-19 at 837ab4c34.

- **E30515 (generic-param-shadows-outer-generic) only covers type parameters.** It is emitted in `visitGenericDecl` (`slang-check-decl.cpp:5059-5089`), which filters both the inner and the outer member with `as<GenericTypeParamDeclBase>`. Value generics (`let N:int`) are therefore never checked.
- **Extending it to value generics is a two-line predicate swap, but it trips the core module.** Swapping in `isGenericParam()` (`slang-ast-decl.h:1157`) fires once in the core module, at `core.meta.slang:2242`: `extension<Access access> Ptr<void,access>` contains `__generic<$(ptrTypeParameterList)>`, which declares `access` again. Because the core module must build with no warnings (`slang-global-session.cpp:1248`), the bootstrap aborts. Rename that parameter in the same PR. Apart from it, the swap gives zero new hits across `tests/`.
- **Shadowing between params and locals is never diagnosed.** `checkForRedeclaration` (`:14817`) compares only declarations with the same `parentDecl`. Params belong to the `FuncDecl`, while the body `{}` and each `for` get their own `ScopeDecl`, so `f(int p){int p;}` and `for(int i..){int i;}` compile silently. DXC rejects both.
- **Severity cannot vary by language version in `slang-diagnostics.lua`.** To make a diagnostic an error in 202c and a warning before it, the call site has to pick between two diagnostics with `isSlang202cOrLater()`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792436893730-slang-shadowing-diagnostics-e30515-covers-only-typ.md`_
