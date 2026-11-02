---
title: "Dispatch-time thread-group size override: what each backend can actually honour (slang-rhi#961)"
type: learning
topic: slang-compiler
source: learnings/1793562885466-dispatch-time-thread-group-size-override-what-each.md
---

# Dispatch-time thread-group size override: what each backend can actually honour (slang-rhi#961)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793561568530-jymbs0
written_at: 2026-11-01T19:54:45.466Z
---

# Dispatch-time thread-group size override: what each backend can actually honour (slang-rhi#961)

Verified 2026-11-01 (slang-rhi main 30250fa, slang 6815ed82d, L40S):
- slang-rhi Metal (`metal-command.cpp:900/911`) and CUDA (`cuda-command.cpp:681`) always launch with the reflected `getComputeThreadGroupSize`; no override, no `dispatchThreads`, no per-pipeline/per-function max check.
- CPU canNOT honour a host override: Slang's CPU codegen bakes the group loop (`for (x = 0; x < 256; ++x)` in `<entry>_Group`) and `ComputeVaryingInput` only carries start/endGroupID. Treat CPU like D3D12/VK (size fixed in the shader).
- CUDA: any block ≤ the FUNCTION limit launches (Slang PTX has no .maxntid/.reqntid). The function limit can be < device 1024 (80-reg kernel → CU_FUNC_ATTRIBUTE_MAX_THREADS_PER_BLOCK=768; 1024 → LAUNCH_OUT_OF_RESOURCES). A future `__launch_bounds__(N)` (slang#14135) would cap it at N. Validate against cuFuncGetAttribute, not DeviceLimits.
- Shader side under an override: `WorkgroupSize()` stays the [numthreads] constant on Metal and CUDA (slang#14136). CUDA `SV_GroupIndex` derives from blockDim (correct for any shape); Metal `SV_GroupIndex` is synthesized from the [numthreads] literals → correct only for x-only overrides. `-capability metallib_4_0` emits `[[required_threads_per_threadgroup(N)]]`, which a different host size violates.
- Metal non-uniform threadgroups (`dispatchThreads:`) need Apple4+ (A11) or a Mac GPU — needs a feature query.
- Workaround that works today: generic value-param entry point `[numthreads(N,1,1)] void k<let N:int>(...)`, specialized as `k<777>` → reflection (777,1,1), slang-rhi launches 777 and `WorkgroupSize()`=777 (one pipeline per size). Unspecialized generic reflects (0,1,1).
Scratch: /workspace/agent/scratch-961/ (drv961.c CUDA driver harness).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793562885466-dispatch-time-thread-group-size-override-what-each.md`_
