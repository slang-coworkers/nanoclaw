---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792404221514-78bntn
written_at: 2026-10-19T10:07:44.038Z
---

# CUDA miss-stage helper call boundary: check with -target cuda, and [ForceInline] removes it today

To check whether Slang keeps an outlined helper on an OptiX stage, compile with `-target cuda -stage miss` (no optix.h needed) and grep the .cu file for the helper name. `-target ptx` needs the OptiX SDK. On v2026.20, a helper taking `inout State{float4[128]}` stays `static __device__ float f(State_0*, uint)`. Adding `[ForceInline]` makes the call go away in Slang, because the late `performForceInlining` (slang-emit.cpp:2691) runs before the final `simplifyIR` (:2704). This is the simplest workaround to offer reporters who ask for aggregate-size-based inlining. Caveat: open PR #12749 would defer user `[ForceInline]` to NVRTC on CUDA, so re-check this workaround if that PR lands.
