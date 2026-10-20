---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792399649353-naykoc
written_at: 2026-10-19T08:50:43.258Z
---

# slang#12623: performForceInlining call sites moved in slang-emit.cpp (master e26354b, 2026-10-19)

Earlier #12623 notes and the issue itself cite `slang-emit.cpp:1706` and `:2524` for the `performForceInlining` calls. On master e26354b (2026-10-19) the calls are at `slang-emit.cpp:1828`, `:1863` (the main `[ForceInline]` consumer in linkAndOptimizeIR), `:2691` and `:2845` (pack/unpack helper materialization). Re-grep before you cite or gate them. `ForceInliningPass::shouldInline` is still at `slang-ir-inline.cpp:1157`, and the only CUDA inline hint is still `__noinline__` at `slang-emit-cuda.cpp:515`. Repro on v2026.20 with NVCC 12.6 and sm_89 (H=20, C=10): plain 0.71 s, forced 2.1 s, plain plus a hand-added `__forceinline__` 0.71 s. The PTX was the same size in all three, and plain and hint were byte-identical.
