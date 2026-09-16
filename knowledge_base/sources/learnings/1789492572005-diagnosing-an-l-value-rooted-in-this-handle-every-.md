---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786484172954-01b3wv
written_at: 2026-09-15T17:16:12.005Z
---

# Diagnosing an l-value "rooted in this": handle every projection node + forwarding boundary + value-vs-reference type

When adding a fail-loudly diagnostic that must decide whether a returned l-value is *rooted in `this`* (e.g. a `[nonmutating] ref` accessor on a value type handing out `&thisCopy.field` → silent lost write), a naive root-walk over just Member/Index expressions is wrong in several subtle ways. Codex found 5 precision bugs across two rounds; the correct shape (slang `slang-check-overload.cpp` `findReferenceRootThisExpr`):

1. **Descend through ALL l-value projection nodes**, not just member/index: `ParenExpr`, `SwizzleExpr` (`.x`) and `MatrixSwizzleExpr` (`._11`) — both are their own AST node, NOT a MemberExpr — and `CastToSuperTypeExpr` (via `->valueArg`, for an upcast of an inherited field). Missing any = false-negative (silent lost write persists for `return _vec.x;` etc.).
2. **STOP (treat as external) at forwarding boundaries:** a dereference (`DerefExpr`/`DerefMemberExpr` = `*ptr`/`ptr->f`) reaches storage outside `this` even if the pointer lives in `this`; and a `MemberExpr` that names a **property/subscript** (not a stored field) is an accessor call that forwards — descend only when `memberExpr->declRef.as<VarDeclBase>()` (a stored field). Note `DerefMemberExpr` is-a `MemberExpr`, so test the deref BEFORE the member case.
3. **Value-type vs reference-type:** a `class` `this` is a *reference*, so a class field is the caller's storage — must NOT diagnose. Test the ROOT `ThisExpr`'s TYPE with `isDeclRefTypeOf<ClassDecl>(rootThis->type.type)`, NOT `getParentAggTypeDecl(accessor)` — the type-based check also correctly handles a `[nonmutating] ref` declared in an `extension` of a class (the `this` type is the extended type), which `getParentAggTypeDecl` misses.
4. **Lambda guard:** `getParentFunc()` returns the enclosing accessor even for a return inside a nested lambda; gate the check with `!m_parentLambdaExpr` so a lambda's return isn't attributed to the accessor.
5. **Known residual (documented, not fixed):** a return that *forwards through a nested accessor* to a this-rooted field isn't caught (stops at the property member); catching it needs nested-accessor analysis. Conservative stop avoids false positives.

Also: the pre-existing `isReferenceIntoFunctionInputParameter` does NOT fire at the return site (its only caller is the mutating-method-on-in-param path), so a return-site check is a NEW producer check, not an "extension" of it — verify where an analogous check actually fires before framing yours as reuse.
