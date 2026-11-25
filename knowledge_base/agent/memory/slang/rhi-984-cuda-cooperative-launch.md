---
type: triage
---
# Triage: shader-slang/slang-rhi#984 — CUDA: support cooperative launch so kernels can use a grid-wide barrier
Date: 2026-11-24 | Category: feature-request | Severity: low | Priority: P3 | Component: CUDA backend + core RHI API
Duplicate: no (git log -S cuLaunchKernelEx / cuLaunchCooperativeKernel: zero hits — never attempted)

## What's being requested
- `ComputePipelineFlags::CooperativeLaunch` (new `flags` field on `ComputePipelineDesc`, default None).
- `Feature::CooperativeLaunch` on CUDA, gated on `CU_DEVICE_ATTRIBUTE_COOPERATIVE_LAUNCH` + optional-symbol `cuLaunchKernelEx` (CUDA 12.0+).
- `IComputePipeline::getMaxCooperativeThreadGroupCount(uint32_t*)` — occupancy/SM × SM count at pipeline creation.
- Dispatch via `cuLaunchKernelEx` + `CU_LAUNCH_ATTRIBUTE_COOPERATIVE`, same `extra` packed param buffer; over-limit dispatch errors and is skipped.
- Other backends: feature unreported; `createComputePipeline` returns `SLANG_E_NOT_AVAILABLE` for the flag.
Author (albertrodriguez) has a ~130-line prototype validated on RTX 4060 Ti and plans to open their own PR. No PR open as of 2026-11-24.

## Codebase digest (file:line pointers)
- Dispatch: `src/cuda/cuda-command.cpp:668-728` `cmdDispatchCompute` — params via `extra` `CU_LAUNCH_PARAM_BUFFER_POINTER/SIZE/END` (706-712), launch at 715-727. Errors are `SLANG_CUDA_ASSERT_ON_FAIL` (assert-style) — dispatch has no Result channel today.
- Pipeline creation: `src/cuda/cuda-pipeline.cpp:33-129` (`cuModuleGetFunction` :84, thread-group size :91, shared-mem query :106-111 → occupancy slots after :111).
- API: `ComputePipelineDesc` at `include/slang-rhi.h:2197-2210` (no flags field today); flags-enum precedent `RayTracingPipelineFlags` slang-rhi.h:2212-2223; `Feature` X-macro list slang-rhi.h:119-208; `IComputePipeline` vtable slang-rhi.h:2336-2342.
- Driver API: mandatory loader `src/cuda-driver-api.cpp:23-178`; **optional-symbol pattern from #982**: `rhiCudaDriverApiGetProcAddress` (include/slang-rhi/cuda-driver-api.h:8-12, impl :297-305) — the right gate for `cuLaunchKernelEx`. `CU_DEVICE_ATTRIBUTE_COOPERATIVE_LAUNCH` already declared (cuda-driver-api.h:236); `cuLaunchKernelEx`/`CUlaunchConfig`/`cuOccupancyMaxActiveBlocksPerMultiprocessor` NOT yet declared.
- Refusal precedent: `SLANG_E_NOT_AVAILABLE` in `cuda-pipeline.cpp:152-155`, `cuda-device.cpp:642-647`, `d3d12-pipeline.cpp:347-348`. No backend currently rejects desc flags (they're translated/ignored) — a flags rejection is new but convention-consistent.
- Tests: flat `tests/` doctest suite; skip idiom `if (!device->hasFeature(...)) SKIP(...)` (tests/testing.h:544-547, e.g. test-bindless.cpp:9-11). No occupancy/launch-limit test exists.
- Debug layer wraps all pipeline creation (`src/debug-layer/debug-device.cpp`) — new method + desc field must be mirrored there; `docs/api.md` needs per-backend support update (AGENTS.md checklist).

## Feasibility & API fit — verdict
Feasible; proposal mirrors existing conventions exactly (RayTracingPipelineFlags clone, Feature X-macro entry, vtable append). slang-rhi carries no ABI/source-compat guarantee statement (dropped post-#895 per shared notes), so the struct + vtable additions are acceptable. No blocking conflicts.

## Candidate approaches (all = author's design with implementation variants)
  ### Approach A: adopt proposal as written (recommended)
    - Where: slang-rhi.h (enum+desc+method), cuda-driver-api.h (opt symbols), cuda-pipeline.cpp (occupancy), cuda-command.cpp:715 (launch branch), per-backend `createComputePipeline` flag check, debug-layer, docs/api.md, tests.
    - Behaviour delta: new opt-in flag; default None = zero behavior change.
    - Tradeoffs: none material — additive, default-off.
    - Risk: low. Watch items: (1) over-limit dispatch needs a real error channel (device error/message queue, not just assert); (2) `cuLaunchKernelEx` must come from optional lookup so older drivers keep working; (3) debug-layer mirroring easily forgotten.
  ### Approach B: reuse `cuLaunchCooperativeKernel` instead of `cuLaunchKernelEx`
    - Ruled out by the author correctly: `cuLaunchCooperativeKernel` takes no `extra` param buffer, so the existing packed-parameter path would need duplication. `cuLaunchKernelEx` with `CU_LAUNCH_ATTRIBUTE_COOPERATIVE` reuses `extraOptions` verbatim.
  ### Approach C: defer the RHI API; rely on `executeCallback`
    - Status quo workaround; keeps grid-barrier kernels out of normal binding flow — exactly the pain the issue reports. Rejected as a resolution.

## Slang-language gap (out of scope of this repo, worth noting)
No grid-barrier intrinsic exists in Slang (`grid_barrier`/cooperative_groups: zero hits in slang prelude + source). Test kernels must be hand-written CUDA/PTX or use interop until a Slang intrinsic lands (would be a separate shader-slang/slang issue).

## Recommended path
Approach A — welcome the author's PR. Routing: DO NOT dispatch fixer (author self-implements). Park with one-shot re-check for the PR; when it opens, route it through review, not a fixer chain.

## Sources
- Local code exploration subagent digest (2026-11-24, HEAD c3e6b26).
- DeepWiki Q&A: API-extension checklist (debug layer, docs/api.md, tests, SLANG_RHI_FEATURES X-macro); CUDA launch/driver-loader confirmation (no optional lookup pre-#982, no cooperative-launch prior art).
- Shared wiki: slang-rhi-backend-runtime.md (post-#895 no-compat policy), slang-backends-compute-thread-group-size-and-dispatch-override.md (launch config precedent #961).
