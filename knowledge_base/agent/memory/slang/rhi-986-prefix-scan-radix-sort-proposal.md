---
type: triage
title: "Triage: shader-slang/slang-rhi#986 — Proposal: portable prefix scan and radix sort primitives"
description: "Feature-request / low / P3 — stdlib-modules & slang-rhi placement question. Premise source-verified; parked for maintainer direction on placement (A rhi engines / B slangpy module / C standard module, recommend B). No duplicates; related #984/#961/#974."
tags: [triage, slang-rhi, slangpy, stdlib, scan, radix-sort, feature, needs-direction]
---
# Triage: shader-slang/slang-rhi#986 — Proposal: portable prefix scan and radix sort primitives
Date: 2026-11-24 | feature-request | low | P3 | stdlib/modules + slang-rhi API placement | Duplicate: no
Reporter albertrodriguezclo (same cloth-sim batch as #961/#974/#984). Issue Type=Feature + label `enhancement` set by us (both blank before; matches #974 precedent).

## What's being requested
A scope/placement decision, not a bug: would device-wide `inclusiveScan`/`exclusiveScan`
(u32/i32/f32) and stable `sortPairs` (u32/u32, LSD radix) be welcome — in slang-rhi (like the
built-in clear engines) or as a Slang module shipped with slangpy? Implementation sketch:
reduce-then-scan multi-pass (portable, works on Metal/WebGPU without inter-group forward
progress), single-pass decoupled-look-back behind a capability where forward progress is
guaranteed. CUB users keep `executeCallback` (CUstream).

## Verification (FACT, source-checked 2026-11-24; slang-rhi main, slang checkout local)
- Stdlib tops out at wave-level: `WavePrefixSum` scalar/vector/matrix at
  `source/slang/hlsl.meta.slang:19035/19067/19096`, `WavePrefixProduct` ~18980, `WavePrefixMin/Max`
  19117+, each gated `[require(cuda_glsl_hlsl_metal_spirv_wgsl, subgroup_arithmetic)]` +
  `__spirv_version(1.3)`; `subgroup_arithmetic` alias at `source/slang/slang-capabilities.capdef:2641-2646`.
- No device-wide scan/sort/reduce anywhere: greps of slang stdlib (`prelude/`,
  `source/slang-core-module/`, `source/standard-modules/`), slang-rhi (`src/`, `include/`,
  `tests/`, `examples/`), and slang `tests/` all empty. Greenfield — the reporter's premise is TRUE.
- slang-rhi "clear engines" are NOT a general precedent: backend-specific helpers only where the
  native API can't clear textures — CUDA `src/cuda/cuda-clear-engine.h:14` (NVRTC→PTX, 4x5x2 variant
  grid, `cuLaunchKernel`), Metal `src/metal/metal-clear-engine.h:13` (newLibrary per type), both
  CMakeRC-embedded (`CMakeLists.txt:679-684`). D3D12/Vulkan use native clears; WGPU/CPU NOT_SUPPORTED.
  No Slang-source built-in kernel exists in slang-rhi yet; user .slang goes through the per-device
  Slang session (`src/slang-context.h:15-94`).
- `executeCallback` confirmed: `ExecuteCallbackContext.nativeHandle` carries the live handle
  (CUstream on CUDA, `src/cuda/cuda-command.cpp:920-926`; API `include/slang-rhi.h:2825-2847`).
- Multi-pass portability confirmed: state tracking (`src/state-tracking.h`) + explicit
  `setBufferState`/`globalBarrier` (`include/slang-rhi.h:3023-3035`) sequence dispatches on all
  backends (Vulkan batched `VkBufferMemoryBarrier`s `vk-command.cpp:1782-1849`, D3D12 resource
  transitions `d3d12-command.cpp:1846-1873`, Metal pass end/rebegin `metal-command.cpp:918`,
  CUDA stream order).
- Capability gating is established (`[require(...)]`, `__requireCapability`), but NO
  "forward-progress" atom exists in capdef — a look-back gate would need a NEW alias composed
  from existing atoms (e.g. `_sm_6_0 | spirv_1_3 | _cuda_sm_7_0`). Also: no CUDA grid-sync /
  cooperative launch in slang today (that's the reporter's own #984, filed 6 min later).
- slangpy delivery path exists: `slangpy/slang/slangpy.slang` aggregator (core/atomics/tensor),
  `slangpy.SHADER_PATH` at import, `compose_modules` + `link` composition in
  `slangpy/core/module.py` — but no dedicated kernel-library packaging convention yet (DeepWiki).
- Thread-group facts (from #961 probe): sizes reflection-driven, no dispatch-time override;
  relevant to scan/sort tail-block handling. CPU dispatch is sequential today (#974) — scan/sort
  remain CORRECT on CPU, just serial.

## Codebase digest
- Slang building blocks present: `groupshared` + `GroupMemoryBarrierWithGroupSync`
  (`hlsl.meta.slang:12853`), `AllMemoryBarrierWithGroupSync` (8647, SPIR-V `OpControlBarrier
  Workgroup Device` 8657 — device-scope visibility a look-back needs), scoped coherent
  load/store generics (`core.meta.slang:1640-1656`), `__atomic_add` + `MemoryOrder`
  (`hlsl.meta.slang:6398`), `MemoryScope::Device` (`core.meta.slang:1469-1477`).
- Prior art for a shipped optional module: `slang.neural` standard module
  (`source/standard-modules/`) — imported by tests; the capability system gates optional
  implementations elsewhere (e.g. VulkanMemoryModelDeviceScopeKHR at `hlsl.meta.slang:29922`).
- No wave-op IR opcodes (wave intrinsics are stdlib asm/intrinsics) — a scan/sort built on wave
  ops ships as .slang source, not an IR pass (shared learning, wave-vm/inliner).

## Candidate approaches
### Approach A: built-in engines in slang-rhi (like clear engines, generalized)
- Where: new `ScanEngine`/`SortEngine` per the ClearEngine pattern but compiling one embedded
  `.slang` module through the per-device session (`src/slang-context.h`) into ordinary compute
  pipelines; dispatched via encoder with state-tracking barriers between passes.
- Behaviour delta: new public RHI API (append-only per `executeCallback` precedent #732;
  README.md:35-38 says ABI explicitly not guaranteed, but scope is still public surface).
- Tradeoffs: reaches every C++ embedding, not just Python; BUT grows the hardware abstraction
  with algorithm code, every consumer pays, per-backend maintenance, API-commit before the
  algorithm design is proven.
- Risk: maintainer resistance to algorithm code in the RHI layer; premature API freeze.
### Approach B: Slang module shipped with slangpy (+ thin host orchestration) [RECOMMENDED]
- Where: package `.slang` sources with the Python distribution via the established
  `slangpy.slang`/`SHADER_PATH`/`link` path; small Python helpers issue the multi-pass
  reduce-then-scan dispatches + barriers (like existing tensor/clear helpers).
- Behaviour delta: zero RHI API/ABI change; Python users get scan/sort on every backend
  (Slang codegen), Metal/WebGPU covered by reduce-then-scan; iteration decoupled from RHI releases.
- Tradeoffs: C++ embeddings don't get it; host-side multi-pass orchestration is on the caller
  (helpers mitigate); new packaging convention (no dedicated precedent — needs one small decision).
- Risk: low — worst case the module is also vendored by C++ users manually.
### Approach C: compiler standard module (like slang.neural)
- Where: `source/standard-modules/`; usable from any embedding via import; look-back variant
  gated by a new capdef alias (compiler-side ask, small).
- Behaviour delta: widest reach; algorithm library versioned with the compiler.
- Tradeoffs: couples a still-experimental algorithm library to compiler release cadence; host
  multi-pass orchestration still lives in each embedding; stdlib scope decision belongs to
  shader-slang maintainers, not slang-rhi.
- Risk: premature standardization before the API shape is proven by real users.

## Recommended path
B first (slangpy-shipped module + host helpers), promote to C if non-Python embeddings want it,
A only if maintainers want first-class RHI ops. Rationale: zero RHI surface growth; the reporter's
own sketch is portable .slang, which the slangpy delivery path already handles; f32 scan needs an
order-preserving integer transform and sort needs staging buffers — design iteration is better
outside a frozen C ABI. The look-back variant is a later capability-gated addition (new capdef
alias); reduce-then-scan works everywhere today. Related infra stays independent: #984
(cooperative launch) is an alternative single-pass mechanism, #961 (dispatch override) affects
tail-block handling, #974 (CPU parallel dispatch) is perf-only for these kernels.

## Design risks (for whoever implements)
- f32 scan: IEEE floats aren't monoid-friendly for prefix ops in general — use integer
  order-preserving mapping (monotonic bit transform) per pass, or restrict to non-negative
  and document error bounds.
- LSD radix stability: stable by construction if each digit pass is a stable scan — keep the
  invariant explicit in tests.
- WGPU/Metal: no inter-group forward progress → reduce-then-scan only (proposal already says this).
- Tail blocks: partial last group handling needs #961-style dispatch flexibility or padded
  dispatches with predication.

## Sources
- Local: slang-rhi main (clear engines, executeCallback, barriers, slang-context); slang checkout
  (hlsl.meta.slang wave intrinsics, capdef aliases, barriers, standard-modules).
- DeepWiki shader-slang/slang-rhi: per-device Slang session + clear-engine precedent, device-level
  engine as natural integration point, encoder for multi-pass recording.
- DeepWiki shader-slang/slangpy: slangpy.slang aggregator, SHADER_PATH, compose_modules/link —
  established module delivery path; no dedicated kernel-library packaging convention yet.
- gh: no duplicates (searched scan/sort/radix in slang-rhi all-state; device-wide scan in slang);
  shader-slang/slang#986 is an unrelated 2016-era merged PR.
- Shared learnings: thread-group-size/dispatch-override facts (#961 probe); parked-chain mechanics
  (timeline re-check, webhook-only after one silent re-check); wave intrinsics have no IR opcodes.
