---
title: "slang associated-constant fold gated on DeclaredSubtypeWitness; eager tryConstantFoldDeclRef skips normalize"
type: learning
topic: slang-compiler
source: learnings/1782215625162-slang-associated-constant-fold-gated-on-declaredsu.md
---

# slang associated-constant fold gated on DeclaredSubtypeWitness; eager tryConstantFoldDeclRef skips normalize

Triaging shader-slang/slang#6703 ("associated constants fail to evaluate with generics"). An interface `static const` requirement accessed on a concrete conforming type is folded to a literal via `WitnessLookupIntVal::tryFoldOrNull` (slang-ast-val.cpp:3190) -> `getUnspecializedLookupRec` (slang-ast-decl-ref.cpp:227).

KEY GATE: `getUnspecializedLookupRec` only processes a `DeclaredSubtypeWitness` (slang-ast-decl-ref.cpp:242); for ANY other SubtypeWitness subclass (TransitiveSubtypeWitness, etc.) it returns an empty `RequirementWitness()` -> no fold -> the value stays symbolic and renders as `int(Data<2>.ASSSOC_CONST)` (WitnessLookupIntVal::_toTextOverride = `getSub() . keyName`). Per DeepWiki the DESIGN INTENT is that non-Declared witnesses are normalized to DeclaredSubtypeWitness BEFORE this fold, via `normalizeSubtypeWitnessForInterfaceUpcast` (slang-check-conversion.cpp:3015, a SemanticsVisitor method — NOT reachable from AST-level slang-ast-val.cpp).

THE ASYMMETRY (why the same value folds on one path, not another): the generic-parameter-substitution path goes through `WitnessLookupIntVal::_substituteImplOverride`/`_resolveImplOverride` (slang-ast-val.cpp:3167/3146) which call `getWitness()->resolve()` and re-fold — so a concrete DeclaredSubtypeWitness reaches the gate. The value-access / static-const-member-initializer path (`VALUE::ASSSOC_CONST`) reaches the fold via `SemanticsVisitor::tryConstantFoldDeclRef` interface-requirement branch (slang-check-expr.cpp:2756-2767), which passes the `findThisTypeWitness` (slang-syntax.cpp:1138) result straight to `WitnessLookupIntVal::tryFold` WITHOUT any resolve/normalize step -> a non-canonical witness fails the gate.

When you see a symbolic `int(Type.MEMBER)` IntVal causing spurious `type mismatch`/`too many initializers` on valid code mixing associated constants + generics, suspect this missing normalization at the eager constant-fold producer. Note `Wrapper::ASSSOC_CONST = T::ASSSOC_CONST` is NOT itself an interface requirement (Wrapper doesn't conform) -> Case B init-expr recursion (slang-check-expr.cpp:2769-2774), which then hits the interface-requirement branch on the inner `T::C`.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782215625162-slang-associated-constant-fold-gated-on-declaredsu.md`_
