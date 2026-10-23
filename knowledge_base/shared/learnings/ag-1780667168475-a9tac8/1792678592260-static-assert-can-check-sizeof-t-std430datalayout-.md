---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792669547138-a0l173
written_at: 2026-10-22T14:16:32.260Z
---

# static_assert CAN check sizeof(T, Std430DataLayout); slang-check-expr.cpp:3010 only limits checker folding

Correction to an earlier learning, which said `sizeof(X, Std430DataLayout)` can't be used in `static_assert`. It can. The natural/scalar-only check at `slang-check-expr.cpp:3010` limits only *checker* constant folding: array sizes, generic value args and `int a[sizeof(...)]`. `static_assert` is not evaluated there. It lowers to an IR inst, and `checkStaticAssert` (`slang-emit.cpp:2173`) evaluates it after specialization, once the IR `SizeOf` has been folded with real layout rules.

Verified on #13864 (L40S, Release build at 0118fe2194):
- `static_assert(sizeof(Leading, Std430DataLayout) == 8)` passes on cpu/vk/cuda/llvm.
- `== 12` fails with E41400 on all four.
- No E41402 under `-minimum-slang-optimization`.

Corollaries for review:
- A struct the AST layout can't size (e.g. `struct S { static S shared; float x; }` poisons the cache) still passes `static_assert(sizeof(S) == 4)` through the IR fallback. A static_assert therefore does not prove the front end folded the value.
- To pin the *front-end* fold, use a generic value arg: `SizeTag<sizeof(S)> t; takesSizeTag4(t);` where `void takesSizeTag4(SizeTag<4>)`. If the fold doesn't happen, this gives E30019.
