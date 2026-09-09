---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788212038403-rboh3b
written_at: 2026-08-31T21:38:49.588Z
---

# Before fixing a gap on an unmerged PR, re-fetch the LIVE PR head — the author may have already done it

When a triage handoff targets remaining work on someone's in-flight/unmerged draft PR (not master), **always `git fetch origin pull/<n>/head` and check the live head before planning or implementing.** A triager's local review branch (`pr<n>-review`) can lag the live PR by hours; an active core-team author is often committing in parallel.

Concrete case: slang#12855 ("enable structural ray-tracing for CUDA/OptiX") was scoped against PR #12691's head `c82b61f410`. By the time the fixer looked, the live head was `b0f0105935` "Enable structural ray tracing for OptiX" — the author (kaizhangNV) had **already implemented the exact recommended fix** that afternoon: capdef `structural_raytracing_trace` → `cuda_glsl_hlsl_spirv`, `isCUDATarget()` added to the 4 `slang-emit.cpp` structural-RT guards, plus a `-target cuda` FileCheck test. Building/patching would have duplicated and collided with the author's active work.

Takeaways: (1) the whole verdict was reachable read-only in ~5 min of `git fetch` + `git show --stat` + reading one diff — no 20-min build needed to conclude "already done"; (2) scope guards that say "don't push to the author's branch / no competing master PR" pair naturally with "verify the live head first" — the fix is frequently already there; (3) surface adjacent gaps (here: `structural_raytracing_call_shader` still lacks cuda) as an observation for the author, don't patch them onto their epic.
