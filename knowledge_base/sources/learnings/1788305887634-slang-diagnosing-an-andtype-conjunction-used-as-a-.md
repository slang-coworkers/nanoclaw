---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788297747800-edhxhe
written_at: 2026-09-01T23:38:07.634Z
---

# Slang: diagnosing an AndType (conjunction) used as a value type

Fixing "AndType should have been flattened before reaching member lookup" (slang#12873) — an interface conjunction `A & B` used as the type of a *value*.

**Where conjunctions are/aren't valid:** `AndType` is flattened (`maybeFlattenConjunctionType`, slang-check-decl.cpp) ONLY at generic-constraint (`visitGenericTypeConstraintDecl`) and inheritance-clause (`visitInheritanceDecl`) sites. As a value type it flattens nowhere and blows up downstream. Diagnose it at the producer boundary (it's a legitimately *formable* user construct → deserves a diagnostic, not an assert).

**The value-type boundary is `CoerceToUsableType`/`CheckUsableType`** (slang-check-type.cpp), which is DISTINCT from `CheckProperType` (used by constraints/inheritance) — so a check there is automatically scoped to value uses and won't break constraints. BUT: function RETURN types use `CheckProperType` (because `void` is legal), so they bypass CoerceToUsableType — a separate call site in `visitFuncDecl` is needed.

**One boundary is not enough — AndType-as-value is whack-a-mole across subsystems.** Beyond declarations, a conjunction value arises from a pointer deref `(A&B)*` or a substituted generic field `Box<A&B>.field`; those only surface at MEMBER LOOKUP. Catch them at `checkGeneralMemberLookupExpr` (skip completion-token requests). And make the `_lookUpMembersInSuperTypeImpl` AndType branch a graceful `return` (find nothing) as a net for static/completion lookups. SEPARATE remaining paths (leave/scope out, cite #12430): `is`/`as`/cast hit a DIFFERENT assert in `slang-check-conformance.cpp` ("...reaching isSubtype"); an aggregate transitively containing a conjunction field used as data ICEs in `slang-type-layout.cpp`.

**Gotchas:**
- `as<AndType>(type)` is a STRUCTURAL cast — does NOT canonicalize. Use `type->getCanonicalType()` to catch a `typealias` to a conjunction (the repro used one).
- Don't write `SLANG_ASSERT(false); return;` for graceful recovery — `SLANG_ASSERT`→`SLANG_ASSUME` in release makes the `return` unreachable (UB). Use a plain `return`.
- `int & float` also forms an `AndType` (not just interfaces), so word the diagnostic "conjunction type", not "interface conjunction".
- Diagnostics are Lua now: `source/slang/slang-diagnostics.lua`, `err("kebab-name", CODE, "summary", span{loc="expr:Expr", message="...~type:Type..."})` → generates `Diagnostics::KebabName{.type=, .expr=}`. docs/diagnostics.md. `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` — harness rejects a redundant `non-exhaustive`; plain `//CHECK: E30133` matches anywhere.
- clang-format-17 lives at `/usr/lib/llvm-17/bin` (not default PATH); prepend it before `./extras/formatting.sh`.
