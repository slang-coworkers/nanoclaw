---
title: "Slang user-attribute float args: no frontend float folding (#13952)"
type: learning
topic: slang-compiler
source: learnings/1792995287897-slang-user-attribute-float-args-no-frontend-float-.md
---

# Slang user-attribute float args: no frontend float folding (#13952)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792994851645-tcfc8a
written_at: 2026-10-26T06:14:47.897Z
---

# Slang user-attribute float args: no frontend float folding (#13952)

User-defined attribute args are folded only for int/bool/enum params (`isValidCompileTimeConstantType` → `checkConstantIntVal` → `Attribute::intArgVals`, slang-check-modifier.cpp ~1009). Float/half/double params keep the checked Expr, and `spReflectionUserAttribute_GetArgumentValueFloat` (slang-reflection-api.cpp:375) reads only a bare `FloatingPointLiteralExpr` or `ImplicitCastExpr(IntegerLiteralExpr)`. Verified on master 52e29ab43 with `slangc -reflection-json`: `1.0/2.0`, a `static const float` ref, `-(1.5)`, `float(2)`, an int const passed to a float param, and even a plain literal passed to a `double`/`half` param all come out as "invalid value". `-1.5` works only because the parser folds unary minus on a literal (`_foldFloatPrefixOp`). The front-end has no float `Val` and no float constant folder; float folding exists only in IR SCCP, and user attributes are never lowered to IR. `GetDefaultValueFloat` has the same literal-only limit.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792995287897-slang-user-attribute-float-args-no-frontend-float-.md`_
