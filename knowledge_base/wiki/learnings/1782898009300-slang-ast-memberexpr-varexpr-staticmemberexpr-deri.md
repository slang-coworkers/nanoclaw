---
title: "Slang AST: MemberExpr/VarExpr/StaticMemberExpr derive from DeclRefExpr — order as&lt;derived&gt; before as&lt;base&gt;"
type: learning
topic: slang-compiler
source: learnings/1782898009300-slang-ast-memberexpr-varexpr-staticmemberexpr-deri.md
---

# Slang AST: MemberExpr/VarExpr/StaticMemberExpr derive from DeclRefExpr — order as&lt;derived&gt; before as&lt;base&gt;

In Slang's expression AST (`source/slang/slang-ast-expr.h`): `VarExpr`, `MemberExpr`, and `StaticMemberExpr` all derive from `DeclRefExpr` (`:43/:312/:328`), and `DerefMemberExpr` derives from `MemberExpr` (`:321`). `IndexExpr` derives directly from `Expr` (`:300`), NOT from `DeclRefExpr`.

Consequence: `as<DeclRefExpr>(expr)` matches a `MemberExpr`/`VarExpr`/`StaticMemberExpr` instance (as<Base> matches derived). So in any `as<>`-cascade that classifies expressions, you MUST test the most-derived type first. Testing `as<DeclRefExpr>` before `as<MemberExpr>` makes the MemberExpr branch dead code — the base-class branch swallows every member access and sees only the member's own `declRef.getDecl()` (the field decl), losing the base object.

Real bug (shader-slang/slang#11878, E30051 false positive): `_exprsDefinitelyAlias` (`slang-check-expr.cpp:3968`) had exactly this ordering bug — `as<DeclRefExpr>` at :3976 before `as<MemberExpr>` at :3983 — so `a.x` and `b.x` (any two distinct objects of the same struct) were judged to alias because both name field `x`. Introduced by PR #11151. Fix: reorder (MemberExpr before DeclRefExpr) so the base recurses.

Triage technique that cracked it: static reading of `_exprsDefinitelyAlias` said the recursion should distinguish bases, contradicting the observed warning. Empirical discriminators (same field on different bases → warn; different field on same base → no warn; different literal index at the *outermost* node → no warn but at a *nested* node → warn) pinned the behavior to "only the outermost node is discriminated", which pointed straight at the base-vs-derived dispatch bug. When static reading and observed behavior disagree, run cheap discriminators before assuming your read of the AST-node types is right.

Also: `-dump-ast` is unmaintained (produces no useful tree); don't rely on it — use empirical discriminators or a debug printf instead. And E30051 is a front-end semantic-check diagnostic, so it reproduces target-independently (e.g. `-target hlsl`), before any downstream compiler load.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782898009300-slang-ast-memberexpr-varexpr-staticmemberexpr-deri.md`_
