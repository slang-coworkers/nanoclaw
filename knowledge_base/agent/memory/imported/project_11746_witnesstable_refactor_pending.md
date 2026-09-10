---
name: PENDING — #11746 WitnessTable-as-SubtypeWitness refactor
description: csyonghe self-filed compiler refactor #11746; design converged on ConcreteSubtypeWitness; bot-vs-maintainer ownership clarification outstanding — do NOT auto-dispatch fixer
type: project
originSessionId: 32ec0fbd-6cc9-4f77-88f8-19ba607ee618
---
shader-slang/slang #11746 — "Refactor concrete interface conformance to use WitnessTable as SubtypeWitness". Self-filed by maintainer **csyonghe** 2026-06-25. Triaged P3 / low / frontend(type-system Val)+IR(lower-to-IR), parked. csyonghe replied (comment 4797040157) **converging on a design**: first PR does **steps 1+4**; introduce a new **`ConcreteSubtypeWitness`** = a `SubtypeWitness` storing a declref to the `InheritanceDecl`, which later becomes just a `WitnessTable` (steps 2/3/5, separate PR).

**Why:** High blast radius — a prior naive witness-class canonicalization regressed ~13 dynamic-dispatch / generic-inlining tests (#11464); the witness `Val`-class is load-bearing at *lowering*, not just type identity. This is also csyonghe's own active interface/witness cluster (PR #11615, #11492, #11722) — "should do step1 and 4 in the first PR" reads as a maintainer planning their own work as much as delegating to the bot.

**How to apply:** Do NOT dispatch slang-fixer to implement unless csyonghe **explicitly** asks the bot to take it. Clarifying offer posted to GitHub via slang-triager (closest-to-state). If csyonghe says go, fixer scope for the first PR:
- step1: producers at `slang-check-inheritance.cpp:815-818` emit `ConcreteSubtypeWitness`; narrow `DeclaredSubtypeWitness` (`slang-ast-val.h:979`) to symbolic `GenericTypeConstraintDecl`/assoc-type sites (`:1050/:1158`).
- step4: `LookupSubtypeWitness`-shaped rep at the `normalizeSubtypeWitnessForInterfaceUpcast` seam (`slang-check-conversion.cpp:3042/3070`).
- lowering: add `visitConcreteSubtypeWitness` emitting the same static table `visitDeclaredSubtypeWitness` does for concrete (`slang-lower-to-ir.cpp:2255`).
- VERIFY on dynamic-dispatch / interface-extension / generic-inlining / autodiff suites (the #11464 risk). Phase-ordering caveat: `InheritanceDecl::witnessTable` can be null pre-conformance-check (#6703). Keep PR draft.

Canonical thread: `gh-issue-shader-slang/slang-11746`. Verified at HEAD `1161c3520`.
