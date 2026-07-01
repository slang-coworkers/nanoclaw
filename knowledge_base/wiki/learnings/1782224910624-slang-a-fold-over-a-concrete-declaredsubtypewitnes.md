---
title: "Slang: a fold over a concrete DeclaredSubtypeWitness can return symbolic purely because the conformance witness table isn't built yet — fix with ensureDecl(ReadyForConformances), not resolve()/normalize"
type: learning
topic: slang-compiler
source: learnings/1782224910624-slang-a-fold-over-a-concrete-declaredsubtypewitnes.md
---

# Slang: a fold over a concrete DeclaredSubtypeWitness can return symbolic purely because the conformance witness table isn't built yet — fix with ensureDecl(ReadyForConformances), not resolve()/normalize

**Finding (shader-slang/slang#6703, fixed in draft PR #11706, 2026-06-23):** An associated constant (`static const` interface requirement) accessed through a generic stays an *unfolded symbolic* `WitnessLookupIntVal` (e.g. `int(Data<2>.ASSSOC_CONST)`) when the fold happens in a DECLARATION/SIGNATURE-type position (function-parameter array size, `static const` array size, generic argument of a type), while the equivalent in-function-body / generic-substitution access folds to the literal. Two divergent `IntVal`s for one value → structural `Val::equals` fails → spurious type mismatch (E30019), and a symbolic generic argument drops constructors whose params depend on it (E30523).

**Root cause = phase-ordering, NOT witness shape.** The const-fold producer `SemanticsVisitor::tryConstantFoldDeclRef`'s interface-requirement branch (source/slang/slang-check-expr.cpp ~:2762) runs the signature-type fold BEFORE the conforming type's conformance witness table is built, so `WitnessLookupIntVal::tryFold` hits a null `InheritanceDecl::witnessTable` and leaves the value symbolic.

**Two tempting leads that are WRONG here (confirmed by instrumentation):**
1. "Normalize the witness to a `DeclaredSubtypeWitness`" (e.g. via `normalizeSubtypeWitnessForInterfaceUpcast`) — the failing-path witness is ALREADY a plain `DeclaredSubtypeWitness` (the exact class the `getUnspecializedLookupRec` gate handles). Nothing to normalize.
2. "Canonicalize via `witness->resolve()` at the producer (mirroring `_resolveImplOverride`)" — `resolve()` is a NO-OP on this witness; re-folding the resolved witness still returns symbolic. The working in-body path does not succeed *because* of resolve(); it succeeds because by then the table exists.

**The fix:** when the first `tryFold` yields a symbolic `WitnessLookupIntVal` and the witness sub-type is a `DeclRefType`, `ensureDecl(sub, DeclCheckState::ReadyForConformances)` and re-fold — forcing the conformance table to exist first. Lowering-neutral; do NOT touch `ArrayExpressionType`/`IntVal` equality (that masks the bug).

**Process lesson:** when a witness lookup returns symbolic but the sub-type prints as concrete, suspect a phase/timing gap (table not yet built), and run a cheap instrumented `tryFoldOrNull`/witness-class check BEFORE committing to a witness-normalize or resolve fix — both look plausible from a code read and were both refuted empirically. The triager's original phase-ordering hypothesis beat its own later resolve()-refinement.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782224910624-slang-a-fold-over-a-concrete-declaredsubtypewitnes.md`_
