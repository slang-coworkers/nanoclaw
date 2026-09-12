---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789105128512-qutur1
written_at: 2026-09-11T06:55:52.943Z
---

# Nested-loop autodiff checkpoint transposition (#13000) + confirm-fail-at-HEAD without a build

## Root cause (slang#13000)
`bwd_diff` through two NESTED non-unrolled `[MaxIters]` loops with **unequal** iteration counts returned wrong input gradients (silent on CPU/Vulkan; `CUDA_ERROR_ILLEGAL_ADDRESS` on CUDA). Long-standing, not a regression.

In `source/slang/slang-ir-autodiff-primal-hoist.cpp` the per-iteration reverse-mode checkpoint array was **sized in the opposite dimension order from how it is addressed**:
- `getTypeForLocalStorage` folded `defBlockIndices` FORWARD with `getArrayType(elem, n)` — which wraps a new **outermost** dim each step — so the outermost dim ended up sized by the OUTER loop's `[MaxIters]` bound.
- `emitIndexedStoreAddressForVar` / `emitIndexedLoadAddressForVar` peel with `emitElementAddress`, which removes the **outermost** dim FIRST using `defBlockIndices[0]` = the INNER loop's counter (`getAllAncestorRegions` returns regions innermost-first).
- ⇒ outermost dim (sized by outer bound) indexed by inner counter → transposition. `inner>outer` overruns (OOB/CUDA); `outer>inner` aliases (silent wrong); equal bounds happen to be correct (why the only pre-existing nested `[MaxIters]` test used equal bounds 17,17 and masked the bug).

**Fix (Approach A, one site):** reverse the fold in `getTypeForLocalStorage` so each dimension is sized by the same index that peels it. Store/load are untouched and stay consistent by construction. Invariant to document: "dimension i is both sized by AND indexed by `defBlockIndices[i]`." PR #13002.

**Trigger nuance:** the bug only appears when the per-iteration weight is CHECKPOINTED — read a **differentiable input array through a `[Differentiable]` accessor**. An inline-constant weight is recomputed in reverse (never stored → no bug); a `no_diff`/`[BackwardDerivativeOf]` buffer load gives all-zero dx (unusable to show it).

## Reusable technique: confirm a repro FAILS at HEAD without a 20-min build
A slang-test `.slang` file is consumed at RUNTIME, not compiled into the binary. So you can validate that your authored regression test fails at HEAD (for the right reason) using the ALREADY-BUILT base-clone binary — zero build time — before spending ~20-30 min building your worktree with the fix:
```
cp mytest.slang /workspace/agent/slang/tests/<area>/_tmp.slang   # base clone has a built binary
cd /workspace/agent/slang && ./build/Debug/bin/slang-test -v verbose tests/<area>/_tmp.slang   # -v shows the "type: float" buffer dump
rm tests/<area>/_tmp.slang tests/<area>/_tmp.slang.actual.txt     # clean up
```
`-v verbose` prints the actual computed buffer ("type: float\n<values>") so you can read the wrong values AND confirm your CHECK expectations against a `[ForceUnroll]`/ground-truth control in the same kernel. This caught that my analytic answer was right (control) while the buggy path was wrong — before any build. Then build the worktree ONCE with the fix and confirm PASS.

## Env notes
- Formatting tools aren't on PATH under bare names, but `/usr/bin/clang-format-17` IS present — run it directly. `.slang` tests are NOT clang-formatted by `extras/formatting.sh` (its C++ glob is `*.cpp/*.hpp/*.c/*.h`; existing test files fail clang-format), so don't clang-format `.slang`.
- Fresh worktree build needs `git submodule update --init --depth 1` first, else cmake configure fails with `SPIRV-Headers::SPIRV-Headers` non-existent-target.
- `diffPair(T primal)` (diff.meta.slang) zero-inits the differential for any differentiable T incl. arrays — no need for the 2-arg form when the initial differential is zero.
