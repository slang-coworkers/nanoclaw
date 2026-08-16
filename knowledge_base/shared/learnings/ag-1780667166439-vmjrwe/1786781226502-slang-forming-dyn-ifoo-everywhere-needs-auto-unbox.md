---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786762423483-d1mkxe
written_at: 2026-08-15T08:07:06.502Z
---

# Slang: forming dyn IFoo everywhere needs auto-unboxing + make-existential to be ExistentialType-aware

When implementing Tim Foley's `IFoo`/`dyn IFoo` split (issue #12430, PR #12555): the correct chokepoint to form the existential is `CoerceToProperTypeImpl` (slang-check-type.cpp) — the single funnel for all proper/data-type positions (var/field/param/return/generic-arg/container-element). Maintainer confirmed: "an interface is not a proper type, an existential is." Contexts that name an interface AS an interface bypass it via `TranslateTypeNode` (plain `T:IFoo` constraints, simple inheritance) — EXCEPT the constraint SUPERTYPE re-enters CoerceToProperTypeImpl during default-generic-arg filling (slang-check-type.cpp:422), which will wrap `ITexelElement`→`dyn ITexelElement` and break the CORE MODULE build (`float4 ⊄ dyn ITexelElement` on `Texture2D<T:ITexelElement=float4>`). Exempt it: use the already-resolved `constraintParam->sup.type`, don't re-coerce.

Forming `dyn IFoo` in all contexts breaks ~85+ tests, in predictable buckets that are the DEFERRED front-end existential machinery, NOT random breakage:
- Member access on an interface/existential value fails E30027 — because auto-unboxing `maybeOpenExistential` (slang-check-expr.cpp:240, guard :250-256) ONLY matches `DeclRefType`→`InterfaceDecl`, not the new `ExistentialType` node. Fix = make it recognize/open `ExistentialType`. (Zero `as<ExistentialType>` in check-expr/overload/conversion.)
- Assign/pass concrete `X` into interface slot fails E30019 — make-existential coercion (`X → dyn IFoo` when `X:IFoo`) is not implemented in the conversion machinery.
- Interface conjunctions: `visitAndTypeExpr` checks operands separately, so `IFoo & IBar` becomes `(dyn IFoo)&(dyn IBar)` not `dyn(IFoo&IBar)` → ICE + `struct S:IFoo&IBar` gives E30811.
- autodiff: type mangling has no ExistentialType case (`unimplemented case in type mangling` ICE); `tryGetDifferentialType` has no ExistentialType case (dropped diff-return arg → E39999).

E33180 vs E38029: the front-end rejection of `dyn IFoo` for `T:IFoo` is E38029 (via the reflexive-only conformance rule at slang-check-conformance.cpp:266-272 that makes dyn IFoo ⊄ IFoo). E33180 is a SEPARATE IR-pass diagnostic; its predicate `isExistentialDerived` already classifies BOTH bare `kIROp_InterfaceType` and `kIROp_ExtractExistentialType`. Don't conflate them.

Distinct from a value-member lookup: `IV.dzero()` (static-member on `typeof(IV)`) also gives E30027 but via `_lookupStaticMember`, a different path — same diagnostic ≠ same root cause.
