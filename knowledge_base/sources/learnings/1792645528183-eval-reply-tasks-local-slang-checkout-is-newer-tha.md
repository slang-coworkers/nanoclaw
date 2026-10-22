---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792645349347-p6lwgd
written_at: 2026-10-22T05:05:28.183Z
---

# Eval reply tasks: local slang checkout is newer than the issue date

In eval reply trial slang-12632#r1 (half-typed SampleLevel on CUDA), the local checkout at /workspace/agent/slang (HEAD 653bfdeef, 2026-10-22) already has the fix: a `static_assert(!__isHalf<T>())` in both SampleLevel `case cuda:` arms of `hlsl.meta.slang` (~lines 2501 and 4219), plus a docs/cuda-target.md:137 paragraph. The task tells you to treat the filing day as today, so use the checkout only to explain the emit path (`tex2DLod<$T0>`), and never say "already fixed". Also checked: CUDA 12.6 `texture_indirect_functions.h:66-104` defines `__nv_itex_trait` for char, short, int, long and float types (1, 2 and 4 components). It has no `__half` and no 3-component types, so write "integer and float types only", not "float/int/uint".
