---
title: "slang generic-container covariance unsupported — _coerce has no type-arg recursion (Optional Derived to Base, #7406)"
type: learning
topic: slang-compiler
source: learnings/1783523269992-slang-generic-container-covariance-unsupported-coe.md
---

# slang generic-container covariance unsupported — _coerce has no type-arg recursion (Optional Derived to Base, #7406)

**Finding (verified @slang bfe6a7f14, issue #7406):** Slang does NOT implicitly convert `Optional<Derived>` to `Optional<Base>` (interface) even though the single-value `Derived -> Base` existential boxing works. This generalizes: there is **no covariant conversion of a generic type's type arguments anywhere** — not Optional, not arrays, not tuples, not user generics.

**Why (the mechanism, reusable for any generic-container-covariance triage):**
- The coercion engine is `SemanticsVisitor::_coerce` @`source/slang/slang-check-conversion.cpp:1659` (probed via `canCoerce` :2934 / `getConversionCost` :3189).
- Concrete→interface works via the subtype-witness branch @:2119: `tryGetSubtypeWitness(from,to)` → `createCastToSuperTypeExpr` → wraps `MakeExistential` for interface targets; cost `kConversionCost_CastToInterface`.
- But `tryGetSubtypeWitness(Optional<Derived>, Optional<Base>)` returns **null**. `checkAndConstructSubtypeWitness` (slang-check-conformance.cpp:210) scans `getInheritanceInfo(subType).facets` for a facet whose type `equals(superType)` nominally. `Optional<Derived>`'s facet list holds only its *own* declared conformances (IDefaultInitializable, etc.); the generic parameter `T` is **invariant/opaque** to the facet system, so there is no facet linking the two instantiations.
- The one generic-app path in `_coerce` (@:1776-1819) is an equality-modulo-witness-argument fallback: same base decl + all **non-witness** type args `equals()`. `Derived` vs `Base` are non-witness and unequal → fails. It never *recurses coercion* into the args.
- This gap is explicitly acknowledged as a known TODO at `slang-check-inheritance.cpp:1732-1746` ("we would need to treat facets for `IEnumerable<Derived>` and `IEnumerable<Base>` as matching ... consistent with the variance of the corresponding parameter").

**Fix menu:**
- (A, targeted) A bespoke `_coerce` branch for `Optional<A> -> Optional<B>` gated on `tryGetSubtypeWitness(A,B)`, synthesizing `hasValue ? Optional<B>(cast<B>(value)) : none`. Reuses `.value`/`.hasValue` (kIROp_GetOptionalValue/OptionalHasValue), `createCastToSuperTypeExpr`/`emitMakeExistential`, and `MakeOptionalExpr` — **no new IR op** (MakeOptionalExpr lowering @slang-lower-to-ir.cpp:6936; existential boxing @:7146-7228 already exist). Optional legalization (struct/ptr/existential) is later @slang-ir-lower-optional-type.cpp, so a synthesized unwrap/cast/rewrap sees a normal IROptionalType. Mirrors how the codebase already handles every other "container" coercion (bespoke branch, not general variance).
- (B, general) Per-parameter covariant facets in the inheritance system (the :1732 TODO) — solves the whole class but needs a variance model (in/out annotations) the language lacks; language-design project, not a bug fix.

**Watch-outs when fixing:** `Optional<T>` is a builtin magic struct @core.meta.slang:1822 (`__magic_type(OptionalType)`); `T->Optional<T>` is a core-module `__implicit_conversion` ctor, NOT a `_coerce` branch; the existing `_coerce` Optional branch @:2016 handles ONLY the bare `none` literal (with an opaque-handle guard). Confirm overload-cost ranking + `canCoerce` probe parity (probe passes outExpr==null — prior art of probe/real divergence causing false-negative viability). optional-ifoo-{1,2,3}.slang test *construction* of `Optional<IFoo>` (init-list boxing), NOT covariance — no covariance regression test exists yet.

**Maintainer stance (public on #7406):** csyonghe wants it supported (symmetry with `Foo -> dyn IFoo`, cites Swift). jkwak (assignee) treats it as nice-to-have sugar. So this is a maintainer-owned language decision (Optional-only-A vs general-variance-B), not a pure engineering call — draft A but confirm before landing non-draft.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783523269992-slang-generic-container-covariance-unsupported-coe.md`_
