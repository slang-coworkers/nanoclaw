---
title: "A generic constraint and a runtime enum parameter can be two independent axes — measure both before calling one a blocker"
type: learning
topic: slang-compiler
source: learnings/1786049811729-a-generic-constraint-and-a-runtime-enum-parameter-.md
---

# A generic constraint and a runtime enum parameter can be two independent axes — measure both before calling one a blocker

On shader-slang/slang#12411 (BFloat16 for cooperative vectors), a maintainer's well-researched report listed three blockers as a chain. Measurement showed two of them sit on **independent axes**, which changed the sequencing advice:

- `CoopVecComponentType` (a Slang `enum` passed as a `constexpr` argument) is the **memory interpretation** of the matrix/input/bias operands.
- `CoopVec<T,N>`'s `T` is the **register element type**, bound by `T : __BuiltinArithmeticType`.

Nothing constrains them to agree. **The decisive cell was a type that fails on one axis and works on the other**: `CoopVec<FloatE4M3,4>` fails `E38029` (doesn't conform), yet `coopVecMatMul<float,4,4>(vec, ::Float16, matrix, 0, ::FloatE4M3, ...)` compiles and emits `dx::linalg::ComponentType::F8_E4M3`. So the conformance failure was not BFloat16-specific (FloatE4M3/E5M2 fail identically) and did not gate the interpretation feature.

**But the check that kept this honest was reading the signatures of every API the issue named.** `coopVecLoad<let N, T : __BuiltinArithmeticType>(buffer, offset)` returns `CoopVec<T,N>` and takes **no interpretation parameter** — so for that API the constraint *is* the only gate. Concluding "blocker 2 is not on the critical path" full stop would have silently dropped part of the requested scope. Correct framing: *independent of axis A, still required for the full surface.*

Reusable rules:
1. When a report chains blockers, test whether each one gates the others — a type that passes one and fails the other settles it in one command.
2. Before declaring a blocker off the critical path, enumerate **every API the issue names** and check which ones lack the escape hatch. "Not on the path" is a claim about a *set* of entry points.
3. An in-tree precedent (`CoopMat<T : ICoopElement,...>` accepts BFloat16 today) is evidence about the interface, not proof a swap works: `CoopVec` also inherits `IArithmetic`→`IComparable`, whose `equals`/`lessThan` do **per-element scalar** `!=`/`<`/`>` on `T` — and BFloat16 has none (`E39999 ambiguous call`; `half` control clean). Check the *whole* contract the type must satisfy, not just the bound being changed.

Also worth knowing: a hand-written core-module struct outside `FOREACH_BASE_TYPE` (`slang-type-system-shared.h`) cannot inherit conformance via the generated loop in `core.meta.slang`, so "just add the conformance" is never a one-liner for those types.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786049811729-a-generic-constraint-and-a-runtime-enum-parameter-.md`_
