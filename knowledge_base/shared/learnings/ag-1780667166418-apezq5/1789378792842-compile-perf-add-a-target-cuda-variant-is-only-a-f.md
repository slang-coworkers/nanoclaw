---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789378132362-ebuorj
written_at: 2026-09-14T09:39:52.842Z
---

# compile-perf "add a -target cuda variant" is only a flag-swap for mode=target non-RT workloads

When triaging a Slang compile-perf issue that proposes "add a CUDA variant of workload X following the `extra_flags=["-target","cuda"]` flag-swap pattern" (e.g. shader-slang/slang#13054), do NOT accept the premise uniformly — check two things per workload in `tools/compile-perf/lib/manifest.py` first:

1. **`mode=`.** A `mode="target"` workload (like `complexity_ladder`, `codegen_spirv`) genuinely is a mechanical copy with `extra_flags` swapped — the in-tree idiom is `codegen_spirv`↔`emit_cuda` (manifest.py ~:496-505 ↔ :551-560, same `gen`, keep `default_size ∈ sweep_sizes` for the module-load self-check at :599-601). But a `mode="api"` workload (like `rt_renderer`, `api_cmd="rt-composite"`) has NO `extra_flags` to flip — its target is hardcoded in the C++ driver (`native/api-driver.cpp:562`, `target.format = SLANG_SPIRV`), so a CUDA variant needs a C++ api-driver change, not a Python line.

2. **Shader intrinsics.** If the generated/static source uses DXR raytracing intrinsics (`TraceRay`, `[shader("raygen")]`, `RaytracingAccelerationStructure`, `DispatchRaysIndex`, …), a naive `-target cuda` retarget won't work — those lower via OptiX and need OptiX-capable RT lowering (a separate, larger lift). Plain compute shaders (RWStructuredBuffer/generics/sin/cos, no `[[vk::…]]`/SPIR-V-only intrinsics) are CUDA-clean.

Separately: for these workloads the *value* is the comparison SWEEP (CUDA/SPIRV ratio + scaling exponent) on the homogeneous nightly runner — the manifest edit alone is inert, which is a strong reason to defer to the self-assigned perf-initiative owner (jvepsalainen-nv) rather than dispatch a bot PR. Also DeepWiki-confirmed: the load/store redundancy-removal pass (`removeRedundancyInFunc`/`eliminateRedundantLoadStore`) is target-agnostic — run for all backends via `simplifyIR`/`simplifyNonSSAIR` in `linkAndOptimizeIR`, gated by `minimalOptimization` not by target.
