---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787674519569-5ex2n6
written_at: 2026-08-25T16:23:02.285Z
---

# Slang generic inference: unsuffixed int literal commits to int before conformance can infer uint

Root-caused (source + live repro on top-of-tree, 2026-08-25) why `acceptBox(box, 3)` fails with `UIntBox does not conform to IBox<int>` for `void acceptBox<Element, Box : IBox<Element>>(Box, Element)` with `struct UIntBox : IBox<uint>`.

**Mechanism (post-refactor solver — `GenericArgumentSolver` class in `source/slang/slang-check-constraint.cpp:997`):**
- Unsuffixed decimal int literals commit to `BaseType::Int` at PARSE time (`slang-parser.cpp:8508`, `_determineIntegerLiteralType`) and `visitIntegerLiteralExpr` (`slang-check-expr.cpp:2399`) sets `expr->type = int`. There is NO polymorphic/leptonic literal type — comment at 2393 says so explicitly ("long-term solution ... requires a more sophisticated type system than we have today").
- `inferGenericArguments` (`slang-check-overload.cpp:2866`) unifies each arg's committed type against the param. For `3` vs `Element`, `TryUnifyTypeParam` (`slang-check-constraint.cpp:3695`) records ordinary constraint `Element=int`, priority Required, mergeMode TypeJoin — added to `discoveredConstraints` BEFORE the witness constraint.
- Collection order (`collectSolverConstraints`): discovered ordinary constraints first (`Element=int`, `Box=UIntBox`), then witness `Box : IBox<Element>` last. Work-list solves `Element=int` first → `Element` becomes `SolvedOrdinaryArg`, `m_args[Element]=int`.
- Witness constraint then substitutes its sup via `buildSubstDeclRef` reading `m_args` → sup is `IBox<int>` (Element already fixed). `tryInferOrdinaryArgsFromWitnessConstraint`→`_tryJoinTypeWithInterface(UIntBox, IBox<int>)` (`slang-check-constraint.cpp:139,252-285`) finds UIntBox's facet `IBox<uint>` and calls `TryUnifyTypes(IBox<uint>, IBox<int>)` — but neither uint nor int is a generic param, so NOTHING binds. No `Element=uint` is ever discovered. Proof `UIntBox : IBox<int>` then fails at isSubtype → candidate rejected.

**Why the literal "wins":** it isn't a type-join tie-break — the conformance's `uint` is never even offered to the merge, because `Element` was already substituted to `int` in the sup before the witness ran. The cheap literal conversion cost (`kConversionCost_InRangeIntLitSignedToUnsignedConversion=32`, `slang-check-conversion.cpp:1686-1695`) is gated on having the `IntegerLiteralExpr` (`as<IntegerLiteralExpr>(arg)`), so it is INVISIBLE to the type-only `TryJoinTypes`/`getConversionCost(Type*,QualType)` path used in the solver.

**Fix direction:** either (a) hold the literal arg as a representability/contextual constraint rather than committing `int` at the type level, or (b) let a witness-discovered ordinary constraint (`Element=uint`) override/re-open a literal-sourced `Element=int` when the literal value is representable in the discovered type. Option (b) is smaller: give literal-derived ordinary constraints a weaker priority (below Required) OR defer their merge until after witness inference, so `Element=uint` from the conformance takes precedence and the literal `3` coerces to `uint` (in-range).
