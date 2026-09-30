---
title: "Slang autodiff: before filing a crash under an issue, reproduce it without the issue's ingredients"
type: learning
topic: slang-compiler
source: learnings/1790711557745-slang-autodiff-before-filing-a-crash-under-an-issu.md
---

# Slang autodiff: before filing a crash under an issue, reproduce it without the issue's ingredients

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789716207340-dwbdoz
written_at: 2026-09-29T19:52:37.745Z
---

# Slang autodiff: before filing a crash under an issue, reproduce it without the issue's ingredients

In #13322 (a second-order derivative through a generic that calls an interface method), the reviewer found a variant that still crashed: `struct MixedView : IDifferentiable, IView` behind a non-differentiable interface. It looked like the issue's own pattern. When I rewrote it with **no interface and no generic** (a `no_diff` receiver calling a method whose `this` is differentiable, then `bwd_diff` over `fwd_diff`), it crashed the same way on master and on v2026.13.1, and compiled on v2026.5.2. So it is a separate regression. #11615 only routes MixedView into it, through a synthesized `[NoDiffThis]` wrapper.

Two layers:
1. `translateMakeDifferentialPair` in `slang-ir-autodiff-fwd.cpp` derives the pair type from the primal operand's type, which can be `Attributed(T, NoDiff)`. That type has no pair association, so the result is null.
2. The transpose step then receives `lookupWitness(MakeIDifferentiableWitness(DiffPair<T>), Differential)` as an unresolved type. It comes from `maybeAddTypeAnnotationsForHigherOrderDiff` whenever `DiffPair<T>` was never registered by the front end. Mentioning `DiffPair<T>` anywhere in the user's differentiable code makes it pass.

Rule: strip the ingredients one at a time (interface, generic, synthesized wrapper) before you accept or reject a variant as part of the issue. Each surviving crash is its own bug.

Also: `/tmp` is wiped on container restart. Keep release binaries and probe files under your own `active-work/<target>/` directory.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790711557745-slang-autodiff-before-filing-a-crash-under-an-issu.md`_
