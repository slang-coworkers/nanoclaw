---
title: "Slang $P vector-min/max fix leaves matrix sibling crash (PR #12249 review)"
type: learning
topic: slang-compiler
source: learnings/1785210150352-slang-p-vector-min-max-fix-leaves-matrix-sibling-c.md
---

# Slang $P vector-min/max fix leaves matrix sibling crash (PR #12249 review)

## Reviewing the #11075 `$P` vector min/max fix (PR #12249) — the matrix sibling is the load-bearing finding

When reviewing PR #12249 (fix for #11075: generic `IComparable`/`IFloat` `min`/`max` specialized on a **vector** ICEs with `E99997` on cpp/cuda via the `$P` prefix expander), the correctness reviewer's 🔴 finding was that the **matrix** case is the identical crash through the identical path and is left unfixed. I verified every link from source at master `15863db4` — it is REAL and reachable:

1. `extension matrix<T,N,M,L> : IFloat` — `core.meta.slang:2459`. So a matrix satisfies an `IFloat`/`IComparable` generic bound.
2. Inside a `T:IFloat` generic, `max(a,b)` binds at check-time (abstract `T`) to the **rank −10** `max<T:IComparable>` overload (`hlsl.meta.slang:12817`), body `if (__isFloat<T>() || __isInt<T>()) return __max_impl(x,y);`. The **concrete** `matrix<T,N,M> max` overloads (12876/12930/13133/13187, which decompose via `MATRIX_MAP_BINARY`) never bind here because `T` is abstract at overload-resolution — same reason the concrete `vector` overloads don't catch the vector case.
3. `__isFloat<matrix<...>>()` folds to **true**: the peephole `Is*` block unwraps *both* vector→element AND matrix→element (`slang-ir-peephole.cpp:1859-1862`) before classifying. So control reaches `__max_impl`.
4. `__max_impl` cpp/cuda body = `__intrinsic_asm "$P_max($0,$1)"` (`hlsl.meta.slang:12770-12771`).
5. The PR's patched `case 'P'` (`slang-intrinsic-expand.cpp:770`) unwraps **only** `as<IRVectorType>` — a matrix argType falls through the `CASE(...)` switch (only scalar element ops have cases) to `default: SLANG_UNEXPECTED("unexpected type in intrinsic definition")`.

**Key nuance for the verdict:** the matrix crash is **pre-existing** (not a regression from this PR) and **outside the authorized vector-scope** (#11075 / maintainer comment 4443874787 authorized the *vector* fix). So whether it blocks *this* PR is a scope judgment, not a defect in what the PR set out to do. Minimal resolutions the reviewer offered: (a) also unwrap `IRMatrixType` + add matrix-arity prelude helpers, or (b) replace the user-reachable `SLANG_UNEXPECTED` with a proper diagnostic so valid Slang fails as a language error, not a compiler crash. Either way add a matrix regression case.

**Reviewer agreement:** correctness (A) flagged it 🔴; Devin (B) clean; clarity (C) independently raised the *same* shared-chokepoint concern (C001) and the coverage-completeness gap (C002) as advisory — three reviewers converged on "the `$P` widening's safety rests on an unstated invariant, and the element/composite-type coverage is narrower than the prefix table." That convergence is strong signal the fix should state the invariant at the code site and decide the matrix contract explicitly.

**Other verified nit:** the added `Vector` fwd-decl comment cites `slang-cpp-types.h`, but `struct Vector` actually lives in `slang-cpp-types-core.h:103` (both in `SLANG_PRELUDE_NAMESPACE`). Include-order reasoning is right; only the filename is wrong.

Cross-ref [[slang-p-prefix-vector-min-max-fix-layer-prelude-em]] (the fixer's own build/embed notes for the same PR).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785210150352-slang-p-vector-min-max-fix-leaves-matrix-sibling-c.md`_
