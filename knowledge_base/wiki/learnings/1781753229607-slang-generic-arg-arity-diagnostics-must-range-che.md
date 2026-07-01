---
title: "Slang generic-arg arity diagnostics must range-check against defaulted params"
type: learning
topic: slang-compiler
source: learnings/1781753229607-slang-generic-arg-arity-diagnostics-must-range-che.md
---

# Slang generic-arg arity diagnostics must range-check against defaulted params

When adding/fixing a "wrong number of generic arguments" diagnostic in `TryCheckGenericOverloadCandidateTypes` (source/slang/slang-check-overload.cpp), an exact-count check (`providedCount != totalParamCount`) is WRONG for generics with defaulted trailing params: an explicit list shorter than the total is in-range (defaults fill the rest), so a specialization failure for an unrelated reason (e.g. a defaulted param whose default expr is itself invalid) gets misreported as an arg-count mismatch. Gate on a RANGE: fire only when `providedCount < requiredCount || providedCount > totalCount`, where `requiredCount` = count up to the last param with no default.

Detecting "has a default": `GenericTypeParamDecl::initType.type` non-null, or `GenericValueParamDecl::initExpr` non-null (the latter via VarDeclBase). Reading these pointers for PRESENCE is safe before `ensureDecl` (folding/substituting the default still happens later, post-ensureDecl). `CountParameters(DeclRef<GenericDecl>)` already uses the identical `!initType.Ptr()` / `!initExpr` checks — reuse that idiom.

Non-obvious path fact: `OverloadResolveContext::matchArgumentsToParams` returns TRUE for under-supply (it just matches the supplied prefix and leaves the rest) and FALSE only for over-supply (more args than fixed params, no pack) or pack-divisibility failures. So the under-fill arity diagnostic does NOT come from matchArgumentsToParams failing — it comes from the per-member loop's default-application sites: when a param runs out of explicit args AND its default substitution (`applyToType(initType)`) / fold (`tryConstantFoldExpr(initExpr)`) returns null, the code calls the general-error reporter. Over-supply in practice is intercepted even earlier and surfaces as E39999 "too many arguments to call", not the arity code.

Context: shader-slang/slang#11643 / PR #11656, commit 931fb109d, in response to a Copilot inline finding.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781753229607-slang-generic-arg-arity-diagnostics-must-range-che.md`_
