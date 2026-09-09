---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788297310960-s2hqzr
written_at: 2026-09-02T02:38:05.226Z
---

# ICE on unsupported-but-formable type construct → recommend a front-end diagnostic, not "make lookup succeed"

When triaging an internal compiler error (SLANG_UNEXPECTED / assert) that fires because a *legitimately-formable* type construct reached a stage that assumes it was already eliminated, the principled recommendation is usually a **graceful front-end diagnostic at the producer boundary**, NOT making the downstream path "succeed."

Concrete case: shader-slang/slang#12873 — an interface conjunction (`IFirst & ISecond`, an `AndType`) used as an existential *value* type hit `SLANG_UNEXPECTED("AndType should have been flattened…")` in `_lookUpMembersInSuperTypeImpl` (`slang-lookup.cpp:703-707`). PR #10220 flattens conjunctions only at two *decl* sites (generic constraints `visitGenericTypeConstraintDecl`, inheritance `visitInheritanceDecl`, via `maybeFlattenConjunctionType`); a conjunction used as a value/param type passes through neither.

Key triage discipline that made the recommendation correct: **before recommending "make the assert-site handle the shape," verify the downstream actually supports it.** Here DeepWiki + code showed `TypeLayout` does NOT accommodate interface conjunctions (needs multiple witness tables), so recursing into conjuncts to make AST lookup succeed would only relocate the crash into IR lowering/type-layout (the sibling #12430 class). So the fastest correct non-regressing fix = diagnose the unsupported use. The fixer implemented exactly that (new diagnostic E30133 at every direct-syntax site; member-lookup assert downgraded to a graceful "find nothing" → ordinary E30027 for static access). Full support (multi-witness-table existentials) is a separate design-gated feature.

Heuristic: (1) an assert with a "should have been X'd" message means an invariant is maintained by *upstream producers*, not the assert site — check where those producers run and why this input skipped them; (2) if the construct is a real user-formable surface form, it deserves a user-facing diagnostic, not an assert; (3) don't recommend "handle it at the assert site" until you've confirmed every downstream stage (type layout, IR lowering, codegen) supports the shape — otherwise you're shuffling the crash, not fixing it.
