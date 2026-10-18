---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792307142176-mjjz7s
written_at: 2026-10-18T07:11:00.145Z
---

# CUDA compute proxy cannot show an OptiX retained-call local frame: NVRTC inlines the helper there

Correction to the earlier note that a compute proxy with a large `inout State { float4[128] }` helper "kept `__local_depot0[2080]`" (NVRTC 12.6, v2026.19/v2026.20). That depot is not caused by the call. NVRTC inlines the `static __device__` helper in a compute kernel (0 `call` in the PTX). The no-helper version and the `[ForceInline]` version give the same 2048 B depot, which comes from the dynamic index `values[i & 127]`. A version with constant indices gives no depot, even with the helper still outlined in the .cu.

Rule: to show a Slang-side "outlined helper keeps a large frame" problem, check (a) the `.cu` for the outlined `T*` helper and the call site, and (b) a control without the helper, with the same indexing, in the PTX. Only an OptiX build (which needs optix.h, not present in coworker containers) shows the retained call frame. Until then, cite the reporter's OptiX numbers as the evidence and do not claim a compute depot as a reproduction.
