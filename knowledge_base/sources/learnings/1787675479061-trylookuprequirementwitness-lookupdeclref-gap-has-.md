---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787673880300-wa2fir
written_at: 2026-08-25T16:31:19.061Z
---

# tryLookUpRequirementWitness LookupDeclRef gap has no natural .slang repro (self-resolves via tryResolve)

**Context:** slang#12751 — `tryLookUpRequirementWitness` (source/slang/slang-syntax.cpp:715) returns `Flavor::none` when a `DeclaredSubtypeWitness`'s declRef base is a `LookupDeclRef` (an associated conformance reached *through* another witness, e.g. `Context.Primitive : IPrimitive` via the `Context : IContext` witness), because the branch only handles `.as<InheritanceDecl>()`.

**Non-obvious finding — why no standalone master repro exists:** I wrote 12 natural `.slang` shapes (nested assoc-type through a generic fn return, method dispatch, generic-arg projection `attrId<C.Primitive>()`, interface default method, `This.Primitive.Attributes` return types, 3-level nesting) — **all compile fine on unfixed master** (tested via prebuilt `slangi`). Reason: a `LookupDeclRef` is not consumed via the buggy direct call in normal compilation. It resolves through `LookupDeclRef::_resolveImplOverride → tryResolve → getUnspecializedLookupRec` (slang-ast-decl-ref.cpp:391), which DOES handle all 3 declRef shapes (LookupDeclRef/InheritanceDecl/GenericTypeConstraintDecl). The direct buggy call fires only from `_tryLookupConcreteAssociatedTypeFromThisTypeSubst` (slang-syntax.cpp:1173) via `DeclRefType::_createCanonicalTypeOverride` (slang-check-resolve-val.cpp:36) on an *already-resolved* declRef — and in that abstract-generic context, `none` is actually the correct answer (type stays abstract until specialization); concrete specialization collapses the middle witness to a direct InheritanceDecl witness before the direct call ever sees a LookupDeclRef base.

**Takeaway:** The failing consumer that motivated the issue is #12691's structural-RT lowering, which calls `tryLookUpRequirementWitness` **directly** on a still-symbolic witness chain — a path only the draft branch exercises. For such "internal-resolver-only" gaps, don't burn time hunting a `.slang` repro first; the fixed binary is the better discriminator (sweep for behavioral deltas), and a slang-unit-test or coordinating with the PR author to land alongside their tests may be the only master-reachable option. The fix itself (delegate the LookupDeclRef arm to the canonical `getUnspecializedLookupRec`/`specializeLookedUpRec` pair) is still correct and principled — it collapses the drift where syntax.cpp knew 1 of 3 declRef shapes and decl-ref.cpp knew all 3.
