---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787674519569-5ex2n6
written_at: 2026-08-25T16:27:23.000Z
---

# Slang #12753: literal-vs-conformance generic inference is an ORDERING bug, not a type-join bug

shader-slang/slang#12753: `acceptBox<Element, Box : IBox<Element>>(Box, Element)` with `struct UIntBox : IBox<uint>` — the call `acceptBox(box, 3)` fails E38029 "UIntBox does not conform to IBox<int>", even though `Element=uint` is derivable from the conformance.

Root cause (verified on HEAD): the unsuffixed literal `3` is eagerly committed to `int` at check time (`visitIntegerLiteralExpr`, slang-check-expr.cpp:2397-2399 — Slang has NO deferred/contextual literal type; the source comment at :2393 admits this). That `int` becomes an ordinary generic constraint `Element=int` which `GenericArgumentSolver::collectSolverConstraints` (slang-check-constraint.cpp:1153) collects and solves BEFORE the interface-conformance WITNESS constraint `Box : IBox<Element>` runs. Once `Element` is solved, the witness substitutes it, so its supertype is the concrete `IBox<int>`; `_tryJoinTypeWithInterface` (:252-285) then unifies `IBox<uint>` vs `IBox<int>` where neither operand is a generic param → `Element=uint` is never discovered. `inspectBox(box)` (no literal arg) succeeds because Element stays a DefaultSubstitutionArg and the witness binds it.

THE TRAP worth remembering: this looks like a type-join tie-break bug (int vs uint → picks int), but it is NOT. `TryJoinTypes(int,uint)` (slang-check-constraint.cpp:302-325) already returns **uint**: costConvertRightToLeft=getConversionCost(int,uint)=uint→int=SameSizeUnsignedToSignedConversion(300) > costConvertLeftToRight=int→uint=SignedToUnsignedConversion(250), and :320 returns `right`(uint) when 300>250. The join machinery would pick the right answer — the two facts (`Element=int` from literal, `Element=uint` from conformance) are just never simultaneously offered to the merge because the literal solves first and blocks discovery. Lesson: before "fixing the join" in a generic-inference conflict, check whether both constraints are even *co-live*; an ordering/eager-commit defect masquerades as a merge/tie-break defect.

Recommended fix (Approach A): defer/deprioritize literal-sourced ordinary constraints (unsuffixed IntegerLiteralExpr, detectable at slang-check-overload.cpp:~2975) below witness inference so the conformance-discovered uint is offered and the existing join accepts the in-range literal — BUT witness discovery only fires while the target arg is still DefaultSubstitutionArg, so deferral must keep Element unsolved until the witness runs. Approach B (a real deferred-representability/contextual literal type, matching the reporter's own suggestion and the :2393 TODO) is the principled long-term fix but has large blast radius across overload resolution/conversion costing.
