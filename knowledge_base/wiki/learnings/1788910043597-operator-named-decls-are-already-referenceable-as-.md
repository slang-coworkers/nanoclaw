---
title: "Operator-named decls are already referenceable as expressions via ParseDeclName reuse"
type: learning
topic: misc
source: learnings/1788910043597-operator-named-decls-are-already-referenceable-as-.md
---

# Operator-named decls are already referenceable as expressions via ParseDeclName reuse

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788909317361-c8wgos
written_at: 2026-09-08T23:27:23.597Z
---

# Operator-named decls are already referenceable as expressions via ParseDeclName reuse

When triaging shader-slang/slang#12971 ("allow operator-symbol-named decls to be referenced as expressions", e.g. `operator+(a,b)`, `x.operator()(v)`), the surprise: the feature is **~90% already implemented**, so don't scope a fixer for a big new parser/checker/lookup build.

**Why it already works** (verified empirically on a built Debug `slangi` — bare + member `.` forms parse AND resolve; existing test `tests/language-feature/ifunc/functor.slang:33` exercises `f.operator()(1.0f)`):
- `ParseDeclName` (`source/slang/slang-parser.cpp:1421-1502`) is effectively the proposal's `SimpleName ::= Identifier | 'operator' OperatorName` production, and it is **already reused** at both expression name-read sites: `parseAtomicExpr` case Identifier (~:9100, builds VarExpr) and `parsePostfixExpr` case Dot/RightArrow (~:9226, builds MemberExpr). `operator` is a *contextual* keyword (a plain Identifier token — not lexed as reserved), so it flows into the Identifier case for free.
- Operator decls carry the **operator-symbol Name itself** (`"+"`, `"()"`), NOT `"operator+"` (confirmed: `isPrefixOperatorName` compares `decl->getName()->text` literally against `"+"/"-"/...`, slang-check-decl.cpp:~15522). `a+b` itself builds a VarExpr named `"+"`. So a synthesized VarExpr/MemberExpr with the operator Name resolves through the ordinary `visitVarExpr`/`lookUp` + `visitMemberExpr`/`lookUpMember` paths — **no new lookup machinery**.

**The one genuine gap:** the `::`-qualified spelling (`Type::operator+`, `Namespace::operator+`) fails to parse — `parseAtomicExpr`/`parsePostfixExpr` `case TokenType::Scope` (~:9192-9210) reads names via `ParseStaticMemberName` (~:1508-1516), which special-cases only `__subscript` and does NOT route through `ParseDeclName`. Fix = route it through the shared production (matches the "one canonical name-reading production" convention).

**Caveats:** subscript is stored under literal `"operator[]"` not `"[]"` (getSubscriptOperatorName, slang-syntax.h:~543); fixity check is favorable (TryCheckOverloadCandidateFixity only filters Prefix/Postfix, an ordinary InvokeExpr passes).

**General lesson:** for a "let X be spelled as an expression" language request, first check whether the expression-position name reader already shares the declaration-position name reader — reuse can mean the feature falls out for free, and the real work is just tests + one unified insertion point.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1788910043597-operator-named-decls-are-already-referenceable-as-.md`_
