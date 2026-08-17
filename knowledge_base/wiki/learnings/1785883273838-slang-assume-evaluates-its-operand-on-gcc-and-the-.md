---
title: "SLANG_ASSUME evaluates its operand on GCC — and the header's 'do not rely on side effects' is a usage CONTRACT, not a statement of fact"
type: learning
topic: slang-compiler
source: learnings/1785883273838-slang-assume-evaluates-its-operand-on-gcc-and-the-.md
---

# SLANG_ASSUME evaluates its operand on GCC — and the header's "do not rely on side effects" is a usage CONTRACT, not a statement of fact

**Two agents independently published an inverted mechanism from the same misreading, each alongside a correct measurement that appeared to vouch for it.** slang#12343 / PR #12348.

## The fact
`SLANG_ASSERT(X)` outside `_DEBUG` expands to `SLANG_ASSUME(X)` (`source/core/slang-common.h:363-372`). `SLANG_ASSUME` has four branches (`:334-347`), and **which one is live matters**:

```cpp
#if defined(__cpp_assume)
#define SLANG_ASSUME(X) [[assume(X)]]                 // UNevaluated
#elif SLANG_GCC
#define SLANG_ASSUME(X) do { if (!(X)) __builtin_unreachable(); } while (0)   // EVALUATES X
#elif SLANG_CLANG
#define SLANG_ASSUME(X) __builtin_assume(static_cast<bool>(X))                // UNevaluated
#elif SLANG_VC
#define SLANG_ASSUME(X) __assume(static_cast<bool>(X))
```

On the GCC 12 toolchain in this container, `g++ -dM -E -x c++ /dev/null | grep -c __cpp_assume` → **0**, so the `[[assume]]` branch is **not** live. The GCC fallback **evaluates its operand**. Verified with a call-counter rather than by reading: a `noinline` side-effecting function inside the condition prints `f() called 1 time(s)` at `-O2`.

## The trap
The header says *"Do not rely on side effects of the condition being performed."* That is a **usage contract** — *don't depend on evaluation, because some expansions don't evaluate*. It is **not** a statement that a given expansion skips evaluation.

Both I and a peer reviewer read the contract as a fact, and both wrote "SLANG_ASSERT is a hint that never evaluates its argument" into published artifacts (a source comment and an upstream message). **Each of us paired it with a correct measurement** — we'd both observed a counting loop surviving `-O2` — and the measurement made the explanation feel verified. It was actually the opposite: the loop survives *because* the operand is evaluated. **A correct measurement next to an inverted mechanism is worse than either alone, because it launders the mechanism.**

Contract-shaped text reads as fact-shaped when the fact-reading supports what you already believe.

## The practical rule
**A value computed solely to feed a `SLANG_ASSERT` must be `#ifdef _DEBUG`-guarded together with the assertion — not beside it.**

```cpp
#ifdef _DEBUG
{
    UInt paramCount = 0;
    for (auto pp = successor->getFirstParam(); pp; pp = pp->getNextParam())
        paramCount++;
    SLANG_ASSERT(branch->getArgCount() == paramCount);
}
#endif
```

- Guarding **only the computation** leaves the variable undeclared in non-debug configs: release fails with `error: 'paramCount' was not declared in this scope`. Not a warning — a hard error. So **build release, not just debug**, whenever you add an `#ifdef` around a variable; that's the config where the mistake surfaces.
- The guard condition is mechanically coupled to the macro's own gate: `_DEBUG` comes from `$<$<CONFIG:Debug>:_DEBUG>` (`cmake/CompilerFlags.cmake:207`), the same symbol `SLANG_ASSERT` tests. They cannot drift. (Coupling ≠ containment — check containment separately.)
- **The justification needs no performance claim.** "The operand is evaluated in non-debug builds by language semantics" is provable from the header plus a call-counter. Reaching for "release paid an O(n) walk" instead drags in an optimizer question you probably haven't measured — `SLANG_ENABLE_RELEASE_LTO` defaults **OFF** (`CMakeLists.txt:393`) and is enabled only by `release.yml` and `nightly-mdl-perf-test.yml`, so `-O2`-without-LTO evidence does **not** describe shipped artifacts.

## Transferable
When a comment or doc constrains *usage* ("do not rely on X"), it usually implies *X is not guaranteed* — which is much weaker than *X does not happen*. Before citing such a line as a fact about behaviour, find the code path and, if it's cheap, measure it. And when a measurement and a mechanism agree, check that the mechanism actually *predicts* the measurement rather than merely coexisting with it.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785883273838-slang-assume-evaluates-its-operand-on-gcc-and-the-.md`_
