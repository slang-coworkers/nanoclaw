---
type: triage
title: "Triage: shader-slang/slang#14135 — CUDA __launch_bounds__ / __maxnreg__ entry-point attributes"
description: "Feature request, medium/P2, CUDA emit + front-end attrs. Reproduced signature on 6815ed82d (no qualifier). Measured on L40S/CUDA 12.6: qualifiers work via nvcc+NVRTC (80→64 regs, .maxntid/.minnctapersm/.maxnreg in PTX); -Xnvrtc --maxrregcount reaches NVRTC but is a NO-OP on Slang's PTX output; __launch_bounds__+__maxnreg__ on one kernel is a hard nvcc error. Parked for maintainer direction; R6 hold to 2026-11-05T14:29:21Z."
tags: [cuda, launch-bounds, maxnreg, occupancy, attribute, feature, parked]
---
# Triage: shader-slang/slang#14135 — CUDA: no way to emit `__launch_bounds__` (or a per-kernel register cap)
Date: 2026-11-01T14:40Z | feature-request | medium | P2 | target-emit (CUDA) + frontend (attributes)
Master 6815ed82d (local Release slangc rebuilt 2026-11-01; `-version` string stale). Reporter albertrodriguezclo (CONTRIBUTOR), cloth-sim batch (#14026-#14033). Type=Feature set by us 14:35Z. No `reproduced` (feature; nothing broken).

## What's being requested
Opt-in CUDA entry-point attributes: `[CudaLaunchBounds(256, 8)]` → `__launch_bounds__(256, 8)`; `[CudaMaxRegisters(64)]` → `__maxnreg__(64)` (CUDA 12.4+); ignored/warning on other targets; a variant deriving maxThreads from `[numthreads]` (`[CudaLaunchBounds(minBlocks: 8)]`).

## Repro / measurements (scratch: /workspace/agent/scratch-14135/, L40S sm_89, CUDA 12.6.85 nvcc + NVRTC)
- FACT: issue snippet `slangc lb.slang -target cuda -entry solve` → `extern "C" __global__ void solve(float * x_0, float * b_0, uint n_0)` — no qualifier. Proposed attrs today → `warning[E31000]: unknown attribute` ×2, output unchanged.
- FACT: zero hits for launch_bounds/maxnreg/maxrregcount/LaunchBounds in source/ prelude/ include/ docs/ tests/.
- FACT (heavy.slang, 96-float unrolled, numthreads 128): baseline 80 regs. Hand-inserted `__launch_bounds__(128, 8)` → 64 regs (spills 880 B); `__maxnreg__(64)` → 64 regs. Same via NVRTC→PTX→ptxas. PTX carries `.maxntid 128, 1, 1` + `.minnctapersm 8` / `.maxnreg 64`, so the cap survives into Slang's `-target ptx` output and the driver JIT.
- FACT: both placements accepted by nvcc: `__global__ void __launch_bounds__(..) name` and `__launch_bounds__(..) __global__ void name`.
- FACT: `__launch_bounds__` + `__maxnreg__` on the SAME kernel → nvcc error "The __launch_bounds__ and __maxnreg__ qualifiers cannot be applied to the same kernel". The issue's example stacks both → must be a Slang diagnostic.
- FACT: issue's `__launch_bounds__(256, 8)` on sm_89 → ptxas warning ".minnctapersm will be ignored" (256×8 = 2048 > 1536 threads/SM). Reporter's real case (128, 8) is in range. Slang should NOT validate minBlocks vs SM (arch-dependent; ptxas already warns).
- FACT (partial premise correction): `-Xnvrtc --maxrregcount=64` DOES reach nvrtcCompileProgram (bogus option → "unrecognized option" from NVRTC), but is a NO-OP for Slang: Slang's NVRTC output is PTX (`-arch=compute_XX`) and `--maxrregcount` only acts on SASS; slangc `-target ptx` with it → still 80 regs, no `.maxnreg` in PTX. Direct NVRTC `-arch=sm_89 --maxrregcount=64` (cubin) → 64. So the reporter's "not available when Slang drives NVRTC" holds in practice.
- FACT: NVRTC 12.6 defines `__CUDACC_VER_MAJOR__/MINOR__`. NVIDIA 12.4 release notes list `__maxnreg__` as new. `--maxrregcount` is ignored for kernels carrying `__maxnreg__`.
- FACT: attribute named args `[numthreads(x: 64)]` → E20001; `[CudaLaunchBounds(minBlocks: 8)]` spelling is not parseable today.

## Codebase digest
- Signature: `CLikeSourceEmitter::emitSimpleFuncImpl` slang-emit-c-like.cpp:4041 — order: emitEntryPointAttributes (4049) → emitFunctionPreambleImpl (4052) → emitFuncDecorations → emitFuncHeader (`void name(...)`).
- `CUDASourceEmitter::emitEntryPointAttributesImpl` slang-emit-cuda.cpp:435-441 — empty; runs BEFORE `extern "C"`, so not the spot (would yield `__launch_bounds__ extern "C"`). `emitFunctionPreambleImpl` :467-488 writes `extern "C" ` + `__global__ ` (:485) → natural insertion right after `__global__ ` (decl-specifier position, like `__noinline__` :517). `[CudaKernel]` non-entry `__global__` :491-494 could take it too.
- `[numthreads]`: core.meta.slang:4708; AST `NumThreadsAttribute` slang-ast-modifier.h:1279; check slang-check-modifier.cpp:396-447 (spec-const vs link-time); IR `numThreads` slang-ir-insts.lua:2004; lowering slang-lower-to-ir.cpp:14512; `getComputeThreadGroupSize` slang-emit-c-like.cpp:294 (diag 55205 for spec-consts). CUDA ignores numthreads (uses blockDim; slang-ir-legalize-varying-params.cpp:2442).
- Precedent `[WaveSize]`: core.meta.slang:4728, AST :1295, check :448-487, IR lua:2017, lowering :14537, per-target check `checkWaveSizeDecoration` slang-ir-entry-point-decorations.cpp:~80-118 (warns 56113 Metal / 56115 CUDA≠32 at decoration->sourceLoc) — template for "ignored on non-CUDA" + mutual-exclusion + maxThreads<numthreads checks. Simplest int attr: `[maxvertexcount]` core.meta.slang:4660, check :776, IR lua:2001, lower :14504.
- CUDA attr naming precedent: `[CudaKernel]/[CudaHost]/[CudaDeviceExport]` + `CUDA*` aliases core.meta.slang:4918-4945 (no args).
- Version-guard precedent: prelude/slang-cuda-prelude.h:7005-7006 (`__CUDACC_VER_MAJOR__ > 12 || ... >= 5 || CUDA_VERSION >= 12050`). Shared-wiki lesson: never put `#if` gates before the prelude `#include` (silently drops NVRTC `-pch`, slang-nvrtc-compiler.cpp ~:1429) — gate in the prelude.
- NVRTC opts: slang-nvrtc-compiler.cpp:1177-1458; user `-Xnvrtc` args appended :1402-1409; version `m_desc.version` :215.
- Tests to model: tests/cuda/noinline.slang (cuda+ptx, `CHECK-DAG: extern "C" __global__ void computeMain`), tests/hlsl/wave-size.slang (cross-target arms), tests/cuda/nvrtc-architecture-override.slang (empty NVRTC stderr).

## Candidate approaches
### A: Two attributes → two IR decorations → CUDA preamble (recommended)
- Where: core.meta.slang (~:4930 next to CudaKernel), slang-ast-modifier.h, slang-check-modifier.cpp (checkConstantIntVal), slang-ir-insts.lua + stable-names, slang-lower-to-ir.cpp (~:14537), slang-emit-cuda.cpp:485, slang-ir-entry-point-decorations.cpp (diagnostics), slang-diagnostics.lua, prelude macro for `__maxnreg__`.
- Delta: `__launch_bounds__(T[, B])` / `SLANG_CUDA_MAXNREG(R)` after `__global__`; warning on non-CUDA targets; error if both on one kernel; error if T < numthreads product (launch would fail); derived variant = T from numthreads.
- Tradeoffs: purely additive, opt-in; ~10 files; validated ints in IR (no raw strings). Risk: low.
### B: Raw qualifier passthrough (`[CudaKernelQualifier("__launch_bounds__(256,8)")]`)
- Delta: emitter pastes a string. Tradeoffs: tiny, but unvalidated, no numthreads derivation, no mutual-exclusion check, raw strings in IR (against the repo's named-constant/representation guidance). Risk: low code, high misuse. Not recommended.
### C: TU-wide compiler option (`-cuda-max-registers N` / default launch bounds from numthreads)
- Delta: emit `__maxnreg__(N)` (or `__launch_bounds__(numthreads)`) on every kernel; not passing `--maxrregcount` (measured no-op on PTX). Tradeoffs: coarse — the issue's point is per-kernel; auto-deriving by default changes behaviour for raw `-target cuda` users who launch with a different blockDim (numthreads is not enforced on CUDA). Useful only as a complement. Risk: medium (silent behaviour change if default).
- (Runtime-side alternative CU_JIT_MAX_REGISTERS at module load lives in slang-rhi — separate repo, TU-wide, out of scope.)

## Recommended path (tentative; spelling/variant need maintainer direction)
- Hypothesis: purely additive front-end + CUDA emit; no IR pass changes.
- Files: core.meta.slang ~:4930; slang-ast-modifier.h ~:1295; slang-check-modifier.cpp ~:487; slang-ir-insts.lua ~:2022 (+ stable names); slang-lower-to-ir.cpp ~:14544; slang-emit-cuda.cpp:485; slang-ir-entry-point-decorations.cpp ~:118; slang-diagnostics.lua ~:6352; prelude/slang-cuda-prelude.h (SLANG_CUDA_MAXNREG guard).
- Repro: `slangc tests/cuda/launch-bounds.slang -target cuda` and `-target ptx` (filecheck `__launch_bounds__(128, 8)`, PTX `.maxntid 128, 1, 1` / `.minnctapersm 8` / `.maxnreg 64`); `-target spirv` → the new warning.
- Accept: (1) cuda emits qualifier between `__global__ void` and name; (2) ptx carries the directives on NVRTC 12.6 and CI's 13.0; (3) both on one kernel → Slang error (not an nvcc error); (4) maxThreads < numthreads product → error; (5) non-CUDA targets warn and emit unchanged; (6) `__maxnreg__` on NVRTC/nvcc < 12.4 → clear diagnostic, not silent drop.
- Recommended: A — validated, per-kernel, follows the WaveSize precedent end to end.

## Decisions for the maintainer
1. Accept the feature? 2. Spelling: `[CudaLaunchBounds]`/`[CudaMaxRegisters]` (matches `[CudaKernel]`, + `CUDA*` aliases) vs CUDA-literal `[launch_bounds]`/`[maxnreg]` vs target-neutral `[MaxThreadsPerGroup]` (Metal `[[max_total_threads_per_threadgroup]]` is analogous; not emitted today). 3. numthreads-derived variant: named args don't parse — `[CudaLaunchBounds]` with no args + separate `[CudaMinBlocksPerSM(8)]`? or sentinel `[CudaLaunchBounds(0, 8)]`? or one-arg overload meaning minBlocks? 4. `__maxnreg__` gating: prelude feature macro (e.g. `SLANG_CUDA_HAS_MAXNREG` from `__CUDACC_VER_MAJOR__/MINOR__` ≥ 12.4) + an emitted `#if !… #error` line before the kernel (after the prelude include, so `-pch` is unaffected; works for nvcc + NVRTC; recommended) vs Slang-side NVRTC version check (only covers Slang-driven NVRTC) vs silent drop (not recommended). 5. Mutual exclusion → Slang error vs warning. 6. Also apply to non-entry `[CudaKernel]` functions? 7. Optional 3rd `__launch_bounds__` arg (maxBlocksPerCluster, sm_90)?

## Overlap with #14029 (grid sync / cooperative launch)
Same reporter, same cooperative-CG kernel. Complementary, not a duplicate: #14029 = grid-sync intrinsic + cooperative-launch reflection; #14135 = register/occupancy control that sets how big the co-resident grid can be. If #14029 picks its optional `[CooperativeLaunch]` attribute (R-C), keep the two CUDA entry-point attribute spellings consistent and land via the same per-target diagnostic pass. No code dependency either way. #14033 (cuh/numthreads exposure, D asks) is adjacent: same "CUDA ignores numthreads" fact.

## Sources
- DeepWiki Q1: CUDA `extern "C" __global__` from emitFunctionPreambleImpl; numthreads ignored on CUDA; no launch-bounds support. Q2: attribute pattern = attribute_syntax + validateAttribute/checkConstantIntVal + lua decoration; target-unsupported handling is per-attribute (e.g. postdepthcoverage warning).
- Dups: none (slang issues/PRs: launch_bounds, maxnreg, maxrregcount, register count CUDA, CUDA occupancy register; slang-rhi: launch bounds/max registers/CU_JIT_MAX_REGISTERS).
- NVIDIA CUDA 12.4 release notes (`__maxnreg__` new): https://docs.nvidia.com/cuda/archive/12.4.0/cuda-toolkit-release-notes/index.html ; CUDA Programming Guide C++ extensions (mutual exclusion, .maxnreg): https://docs.nvidia.com/cuda/cuda-programming-guide/05-appendices/cpp-language-extensions.html
- Recall: shared wiki slang-backends-f0909b0-cuda-optix (prelude version gating, -pch trap, CI CUDA 13.0.1), slang-test-output-assertions (match signature + `-NOT: error[E`), slang-language-fold20260909-attributes (intArgVals path).
