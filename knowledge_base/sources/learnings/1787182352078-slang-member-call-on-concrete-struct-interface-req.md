---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787181872429-xxs8wb
written_at: 2026-08-19T23:32:32.078Z
---

# Slang member call on concrete struct: interface-requirement default-arg vs lowering witness-resolve mismatch

Scenario: `interface IFoo { void func(float A = 1.0); } struct Foo:IFoo { void func(float A){...} } Foo f; f.func();` — checker ACCEPTS 0 args but lowering crashes on a null `initExpr`. Root-cause chain, all file:line in shader-slang/slang at master (verified 2026-08-19):

1. Member lookup on a concrete struct returns BOTH candidates: the Self-facet `Foo::func` AND the interface-facet `IFoo::func` (reached through a SuperType breadcrumb carrying the subtype witness). See `_lookupMembersInSuperTypeFacets` slang-lookup.cpp:393-511; `AddToLookupResult` (slang-lookup.cpp:95) does NOT dedup.
2. There IS a tie-break that favors the concrete method over the interface requirement — `CompareOverloadCandidates` slang-check-overload.cpp:1944-1968 (`isInterfaceRequirement`). BUT it is gated: it only runs when both candidates have `status==Applicable` (slang-check-overload.cpp:2315), because status is compared FIRST at slang-check-overload.cpp:2310-2311.
3. Arity is checked per-candidate BEFORE comparison: `TryCheckOverloadCandidate` runs `TryCheckOverloadCandidateArity` first (slang-check-overload.cpp:1430). Arity reads `candidate.item.declRef` params via `CountParameters` (slang-check-overload.cpp:26-70,155), which uses `param->initExpr` to decide required-vs-optional. So with 0 args: `Foo::func` (1 required, no default) FAILS arity → status below Applicable; `IFoo::func` (default=1.0) PASSES → Applicable. `IFoo::func` wins by STATUS, never reaching the concrete-preference tie-break.
4. The checked InvokeExpr callee is built from the winning `candidate.item` via `ConstructLookupResultExpr` (slang-check-overload.cpp:1656) → the callee DeclRef is `IFoo::func` as a `LookupDeclRef` (interface requirement + subtype witness). Default args are NOT materialized at check time (only supplied args are stored, slang-check-overload.cpp:1678-1679).
5. At lowering, `visitInvokeExpr` calls `tryResolveDeclRefForCall` (slang-lower-to-ir.cpp:5042) then `resolvedInfo.funcDeclRef.declRefBase->resolve()` (slang-lower-to-ir.cpp:5561-5562). `LookupDeclRef::_resolveImplOverride`/`tryResolve` (slang-ast-decl-ref.cpp:232,391) resolves the interface-requirement LookupDeclRef THROUGH the concrete witness table to the satisfying decl `Foo::func` (`Flavor::declRef` case slang-ast-decl-ref.cpp:324-341).
6. `addDirectCallArgs(expr, funcDeclRef=Foo::func, ...)` (slang-lower-to-ir.cpp:5705,5240-5255) iterates `Foo::func` params; for the omitted arg it reads `getInitExpr(Foo::func param)` = null → `SLANG_ASSERT(argExpr)` fires / null-deref crash at slang-lower-to-ir.cpp:5183-5184.

Net: arity check sees `IFoo::func` (has default, accepts 0 args); lowering sees `Foo::func` (no default) after witness-resolve. The two see DIFFERENT decls for the same call — that is the mismatch. The user's premise ("lookup should pick Foo::func because f is concrete") is only true AFTER the concrete-vs-interface tie-break, which never runs here because Foo::func was eliminated at arity first. Fix likely belongs in default-arg semantics: either the concrete satisfying method must inherit the requirement's default, or arity/default handling must be consistent between check and lower.
