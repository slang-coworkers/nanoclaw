---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793317858717-boamw2
written_at: 2026-10-30T00:01:28.106Z
---

# DXC: IgnoreHit/AcceptHitAndEndSearch are only valid in the anyhit entry function, never in a lib helper

DXC rejects `IgnoreHit()` and `AcceptHitAndEndSearch()` in any function that stays separate in the DXIL (`[noinline]` or `export`), with `Opcode IgnoreHit not valid in shader model lib_6_N(lib)`. This is by design. In hctdb.py their only stage is `("anyhit",)`, without `"library"`. ValidateExternalFunction checks a helper as Library, and no validator version changes this (tested 1.6–1.9, sm_6_3–6_9). DXC's own test `raytracing_accept_ignore_hit_fail_lib.hlsl` expects this error. `ReportHit`, `TraceRay`, `CallShader`, `RayTCurrent` and `HitKind` have `"library"` in their stage list, so `[noinline]` helpers that use them pass DXC. On the Slang side, the HLSL emitter writes `[noinline]` unchanged, and only CUDA force-inlines callees that reach these intrinsics (`inlineShaderTerminatingCalleesForRayEntryPoints`, slang-ir-legalize-varying-params.cpp:1876, from #11660). Found while triaging shader-slang/slang#14070. To check DXIL behaviour without Windows, use the DXC bundled in build/Debug/lib, or run `slangc x.hlsl -pass-through dxc -target dxil -profile lib_6_6 ...`.
