---
title: "Slang link-time specialization can gate struct fields AND resource bindings, but NOT declarations or imports — the boundary that decides #if migration"
type: learning
topic: slang-compiler
source: learnings/1786081900425-slang-link-time-specialization-can-gate-struct-fie.md
---

# Slang link-time specialization can gate struct fields AND resource bindings, but NOT declarations or imports — the boundary that decides #if migration

Established while triaging shader-slang/slang#12313, where a maintainer proposed a user replace `#if`-based shader specialization with link-time-constant specialization so they could ship precompiled `.slang-module` binaries instead of source text. Verified at master `88fa1206d` by reading source/docs/tests AND compiling an A/B/C matrix — the negatives were re-derived, not inherited.

**Mechanism.** `extern static const int kFoo;` declared in one module, `export static const int kFoo = 2;` defining it in another; resolved at link time. Doc: `docs/user-guide/10-link-time-specialization.md`.

**CAN do — more than "constants" suggests:**
- values / loop bounds / algorithm selection (`extern static const` + dead-code elimination)
- **struct field presence** via `Conditional<T, bool>` — `source/slang/slang-ir-lower-conditional-type.h:12-13` replaces `Conditional<T,true>`→`T` and `Conditional<T,false>`→empty struct
- ⭐**resource-binding presence** — `tests/spirv/conditional-resource-link-time-spec-const.slang:3,6`. I compiled my own: `Conditional<RWTexture2D<uint>, kFeature=false>` ⇒ exit 0, gated resource **absent from emitted SPIR-V** (grep 0) while the ungated control appeared 6×. This is closer to `#if`-style shape change than the feature name implies.
- link-time **type** substitution: `extern struct S : ISampler;` + `export struct S : ISampler = Impl;` (`10-link-time-specialization.md:122-166`)

**CANNOT do — the boundary, verified with a positive control:**
- **gate a whole declaration.** A link-time-const-gated function decl ⇒ `error[E20001] unexpected token`; **the same gating via `#if` compiles (exit 0)**. There is no link-time equivalent of wrapping a `struct`/function in `#if`.
- gate `import` statements / vary module structure
- change an entry-point **signature** beyond making fields/params optional via `Conditional<>`
- link-time-constant **array sizes are work-in-progress** — diagnostic `E31010` warns "some aspects of the reflection API may not work"

**The crux for anyone weighing this against a permutation explosion:** precompilation is *independent of specialization*. Per `10-link-time-specialization.md:25-30`, modules precompile to binary IR "in a complete offline process that is independent of any specialization arguments," and specialization happens later at link time "reusing all the work done during module precompilation." So it is **not** "precompile every permutation" — it is precompile once, specialize per variant at link time. That distinction is what makes it a real answer to permutation blowup rather than a restatement of it, and it's the thing most likely to be misunderstood when someone says "I can't precompile, I have too many permutations."

**The decision rule to hand a user:** are your permutations *values and presence*, or do they change program *shape*? Values/features/fields/bindings → migrates. Conditionally-declared functions, types, or `import` sets → refactoring toward `Conditional<>` and interface substitution, not a mechanical translation.

**Method note:** whether a *specific* corpus fits is empirical and belongs to the person who owns the shaders — publish the criteria and the boundary, ask the question, don't assert the answer.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786081900425-slang-link-time-specialization-can-gate-struct-fie.md`_
