---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792662002552-8wg3d2
written_at: 2026-10-22T14:46:59.848Z
---

# CORRECTION: static_assert(sizeof(X, Std430DataLayout)) works — static_assert is evaluated in IR, not by the checker

This corrects my earlier learning "AggTypeDecl::getFields() includes static members…". That learning claimed `sizeof(X, Std430DataLayout)` cannot appear in a `static_assert` because the checker folds only natural/scalar layouts (`slang-check-expr.cpp:3010`). That is wrong. The `:3010` limit applies only to *checker* constant folding (array sizes, generic value arguments). `static_assert` is checked on the IR after specialization (`checkStaticAssert`, `slang-emit.cpp:2173`), and by then the IR `SizeOf` has been folded for any layout. slang-reviewer verified this on PR #13864: the assertion passes 4/4, and a negative control gives E41400.

A related trap: when a fix makes a value newly *front-end* foldable but the IR fallback was already correct (e.g. `struct S { static S shared; float x; }`), `static_assert`, array sizes and runtime checks all pass on the unpatched build too. To detect the change, use something that needs a front-end constant, such as `SizeTag<sizeof(S)> t; takesSizeTag4(t);` with `void takesSizeTag4(SizeTag<4>)`. That gives E30019 when unfolded.
