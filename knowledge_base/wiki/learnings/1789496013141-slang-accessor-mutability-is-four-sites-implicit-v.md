---
title: "Slang accessor mutability is FOUR sites — implicit vs explicit `this` are duplicate ladders (slang-lookup.cpp vs visitThisExpr)"
type: learning
topic: slang-compiler
source: learnings/1789496013141-slang-accessor-mutability-is-four-sites-implicit-v.md
---

# Slang accessor mutability is FOUR sites — implicit vs explicit `this` are duplicate ladders (slang-lookup.cpp vs visitThisExpr)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1786529254007-r9hioo
written_at: 2026-09-15T18:13:33.141Z
---

# Slang accessor mutability is FOUR sites — implicit vs explicit `this` are duplicate ladders (slang-lookup.cpp vs visitThisExpr)

Correction/extension of the earlier "three decision points" learning. Making a Slang accessor implicitly mutating requires FOUR sites, and — critically — the "is `this` an l-value inside the body" question has TWO separate, duplicate implementations depending on whether the member write is written with an explicit `this.` or as an unqualified name:

1. `isEffectivelyMutating` (`slang-check-overload.cpp` ~1016) — caller needs a mutable base.
2. `getDeclaredParamPassingModeForImplicitThisParam` (`slang-lower-to-ir.cpp` ~3875-3891) — how `this` is passed (`BorrowInOut` vs `In`).
3. `SemanticsExprVisitor::visitThisExpr` (`slang-check-expr.cpp` ~9062-9092) — l-value-ness of an **EXPLICIT** `this` AST node (`this._v = ...`).
4. `_computeLookupResult` (`slang-lookup.cpp` ~986-1041) — l-value-ness of an **IMPLICIT** unqualified member write (`_v = ...`, no `this.`). This sets `LookupResultItem::Breadcrumb::ThisParameterMode`; a fresh `ThisExpr` is synthesized at `slang-check-expr.cpp:1024` and takes its l-value flag from that breadcrumb (1040-1042) — it NEVER calls visitThisExpr.

Gotcha that bit PR #12492 (Option A: unannotated `ref` → implicitly mutating): patching only sites 1-3 left the implicit unqualified write (`_v = _v+1` in a `ref` body) still failing with **E30049** ("assign to immutable member; use [mutating]"), because site 4's ladder recognizes `ConstructorDecl`/`SetterDecl`/`[mutating]`/`[ref]` but not `RefAccessorDecl` → an unannotated `ref` (a `FunctionDeclBase`, not a `SetterDecl`, no auto-modifier) falls into the `else`→`ImmutableValue`. An explicit-`this` write compiled (site 3 fixed) while the unqualified form didn't — so a `this.`-only test papers over the real repro. Always test the UNQUALIFIED member-write form.

Fix for site 4: add a `RefAccessorDecl && !hasModifier<NonmutatingAttribute>()` sub-case INSIDE the `FunctionDeclBase` branch (before its final `else`), mirroring the `[mutating]`/`[ref]` sub-cases. Do NOT fold it into the `SetterDecl` branch — that branch is UNCONDITIONAL (no `[nonmutating]` guard), so folding would let `[nonmutating] ref { _v=x; }` wrongly compile. The `!NonmutatingAttribute` guard keeps `[nonmutating] ref` rejected (falls through to `else`→Immutable).

Bigger lesson: sites 3 and 4 are duplicate implementations of the same ctor/setter/[mutating]/[ref]/else policy — the root reason each accessor-kind change needs multiple synchronized edits. `isEffectivelyMutating` is a single-source-of-truth candidate both could route through. Reviewer rule: for any accessor-mutability change, grep BOTH `visitThisExpr` and `slang-lookup.cpp`'s `_computeLookupResult` (and the two lowering/overload deciders), and require an unqualified-member-write test, not just `this.`-qualified.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789496013141-slang-accessor-mutability-is-four-sites-implicit-v.md`_
