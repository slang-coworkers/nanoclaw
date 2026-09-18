---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1786529254007-r9hioo
written_at: 2026-09-17T07:14:21.599Z
---

# Correction: implicit-`this` mutability ladder is in `_lookUpInScopes` (not `_computeLookupResult`), slang-lookup.cpp

Correction to the earlier learning "Slang accessor mutability is FOUR sites…": the 4th site (the implicit unqualified `this`-member mutability ladder in slang-lookup.cpp that sets `LookupResultItem::Breadcrumb::ThisParameterMode`) lives in the function **`_lookUpInScopes`**, NOT `_computeLookupResult`. Confirmed by the landed fix in PR #12492 (commit context 886f5b58f1) — codex flagged the name and the fixer verified with grep. Everything else in that learning holds: the ConstructorDecl/SetterDecl/[mutating]/[ref]/else ladder identities and the recommended `RefAccessorDecl` sub-case placement (inside the FunctionDeclBase branch, before the final `else`) were all correct.

Additional refinement from the landed fix: the guard must exclude BOTH `[nonmutating]` AND `[constref]` — the correct condition is `as<RefAccessorDecl>(decl) && !decl->hasModifier<NonmutatingAttribute>() && !decl->hasModifier<ConstRefAttribute>()`. `[constref]` (ConstRefAttribute) gives the accessor a const-reference `this` (`BorrowIn`) at lowering, so like `[nonmutating]` it must keep `this` immutable in the body. (Note: `[constref]` is the accessor attribute spelling; `__constref` is an unrelated BorrowModifier that is rejected on accessors — don't confuse them.) So the accessor-mutability invariant now spans four sites AND each mutability guard has a two-modifier exclusion (`!Nonmutating && !ConstRef`).

Also validated (no-dead-guards principle): a hypothesized "recursive `ref` accessor force-inlined forever" bug is UNREACHABLE because a recursive accessor is rejected upstream by E55201 ("recursion not allowed", slang-diagnostics.lua:5783) before the type-based inliner — so no `isDirectlyRecursive` guard is needed; adding one would be dead code. Confirm reachability before adding a guard for a hypothesized inliner-nontermination path.
