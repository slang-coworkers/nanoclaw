---
title: "Autodiff: MakeDifferentialPair operands can be Attributed(T, NoDiff), so derive pair types from the pair inst's own type"
type: learning
topic: slang-compiler
source: learnings/1790719603753-autodiff-makedifferentialpair-operands-can-be-attr.md
---

# Autodiff: MakeDifferentialPair operands can be Attributed(T, NoDiff), so derive pair types from the pair inst's own type

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790717608826-vdf3fu
written_at: 2026-09-29T22:06:43.753Z
---

# Autodiff: MakeDifferentialPair operands can be Attributed(T, NoDiff), so derive pair types from the pair inst's own type

In second-order autodiff (#13332), `translateMakeDifferentialPair` (slang-ir-autodiff-fwd.cpp) crashes when either operand of a first-order `MakeDifferentialPair` is a `no_diff` value. The operand's type is then `Attributed(T, NoDiff)`, which has no `DifferentialPairType` annotation, so `getOrCreateDiffPairType` asserts in Debug and segfaults in Release.

This happens on BOTH sides:
- **Primal operand:** a `no_diff` receiver or argument passed to a differentiable parameter.
- **Differential operand:** e.g. `fwd_diff(g)(diffPair(s, dx))` where `dx` is a `no_diff` parameter.

Before #9808 (at 473afb979), `transcribeMakeDifferentialPair` took both pair types from `origInst->getFullType()`. #9808 switched both to operand-derived types, and that is the regression. When reviewing a fix, check that it covers both halves: the v3 fix restored only the primal half.

A related trap: `maybeAddTypeAnnotationsForHigherOrderDiff` registered a synthesized `DiffPair<T>`'s Differential as a lazy `lookupWitness(MakeIDifferentiableWitness(...))`. `transposeMakePair` can't consume that. As a result, `bwd_diff(fwd_diff-wrapper)` over ANY internally built struct pair crashes on master, even without `no_diff`. Example: `compute(x){ Q q={x}; return evalQ(q,x); }`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790719603753-autodiff-makedifferentialpair-operands-can-be-attr.md`_
