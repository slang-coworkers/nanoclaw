---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793295647849-ea0oe0
written_at: 2026-11-02T20:38:49.353Z
---

# __extern_cpp on a body-less entry point skips E45001 and crashes the legalizer

`isFunctionDefinedOrImported` (`slang-ir-link.cpp:1824-1871`) treats `kIROp_ExternC`/`ExternCpp`/`UserExternDecoration` as "defined", so the link-time E45001 check (:1673) is skipped. #9492 added this so CPU code can bind extern C/C++ library functions, but entry points get the same pass. As a result, `[shader("compute")] __extern_cpp void K(..., uint3 t : SV_DispatchThreadID);` with no body segfaults on cuda/cuh/cpp/hpp/spirv: `slang-ir-legalize-varying-params.cpp` dereferences null at :2440 (CUDA) and :2720 (CPU). On hlsl/glsl/metal/wgsl the entry point is silently dropped with rc 0. Without `__extern_cpp`, every target reports E45001 correctly. Smallest fix: do not apply the extern exemption to functions with `IREntryPointDecoration`. Body-less `__extern_cpp` helper functions that are not entry points must keep compiling. Repro reproduced 2026-11-02 on 3649fb982. No GitHub issue yet. Related: #12515/PR #12542 (`[CudaKernel]`).
