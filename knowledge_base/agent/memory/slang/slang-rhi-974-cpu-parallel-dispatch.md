---
type: triage
title: "Triage: shader-slang/slang-rhi#974 — CPU: a dispatch runs all its thread groups one after another on the submitting thread"
description: "Feature (perf)/medium/P2, slang-rhi CPU backend. Source-confirmed at rhi main: whole-grid single m_func call inline in submit (cpu-command.cpp:217-231); group-range box + globalTaskPool are ready-made seams; generated CPU code has no shared mutable state. Parked for maintainer direction (feature request, no maintainer signal)."
tags: [triage, slang-rhi, cpu, dispatch, parallelism, task-pool, feature, needs-direction]
---
# Triage: shader-slang/slang-rhi#974 — parallel CPU dispatch
Date: 2026-11-18 | feature-request (performance) | medium | P2 | slang-rhi cpu backend | Duplicate: no
Reporter albertrodriguezclo (CONTRIBUTOR; same reporter as #961). Type=Feature + label `enhancement` set by us 2026-11-18. No `reproduced` (label doesn't exist in slang-rhi; claim source-confirmed instead). No `regression` (never parallel — not a regression).

## What's being requested
CPU device `dispatchCompute(x,y,z)` runs all thread groups sequentially on the submitting thread (1 core). Request: split the group-range box across the device task pool so one dispatch uses all cores. Reporter supplies MSVC `/O2` measurements (Ryzen 9 7900X, generated code, host splitting the range): irregular search kernel 14.6/2.05/1.11 ms at 1/8/16 threads; scatter w/ float atomics 3.2/0.64/0.49 ms; streaming 1M-element 6.0/2.0/2.0 ms (memory-bound).

## Repro (source-level, rhi main checkout)
- `src/cpu/cpu-command.cpp:217-231`: one `m_computePipeline->m_func(&varyingInput, entryPointData, globalData)` with startGroupID=(0,0,0), endGroupID=(cmd.x,cmd.y,cmd.z) — the group loop lives inside the emitted kernel.
- `CommandQueueImpl::submit` (`cpu-command.cpp:360-390`): inline `CommandExecutor::execute` per command buffer on the submitting thread; `waitOnHost()` no-op (:392-395); fences = mutex-guarded uint64 (`cpu-fence.cpp:16-28`); `waitForFences` spin/yield (`cpu-device.cpp:48-94`). No queue, no worker thread.
- Runtime observation path: CPU tests in `tests/test-compute-smoke.cpp` / `test-compute-trivial.cpp` (ALL incl. CPU); a multi-group spin kernel on the CPU device pins one core today.

## Codebase digest (file:line pointers, verified 2026-11-18)
- Task pool ready: `src/core/task-pool.h` (ThreadedTaskPool :34, work-stealing #825/#705; `globalTaskPool()` :79; `setGlobalTaskPool`/`initGlobalTaskPool` :69/:76; lazy default = hardware_concurrency). Public: `ITaskPool` `include/slang-rhi.h:4261`, `IRHI::setTaskPool` :4440, `initTaskPool` :4448 (workerCount 0=Blocking, -1=hw concurrency). Users today: `pipeline-resolver.cpp:309/:402`, `cuda/optix-api-impl.cpp:834`. CPU backend: zero uses.
- Fork-join pattern built in: task groups — `submitTask(..., group)` + `waitAndReleaseTaskGroup()`; `TaskBatch` helper alternative; a waiting thread helps execute (work stealing) so the submitting thread never idles/deadlocks.
- Kernel contract: `ComputeVaryingInput{startGroupID, endGroupID}` (`prelude/slang-cpp-types.h:1342-1346`) — designed for this split (`docs/cpu-target.md:404`: chosen "such that client code could dispatch different parts of the work to different cores").
- Generated code is safe for concurrent disjoint boxes (verified by compiling probe kernels with local slangc, `scratch/rhi974/`): `groupshared` → per-thread stack local (`slang-ir-explicit-global-context.cpp:428-432,558-579`); statics → per-invocation KernelContext fields; no `thread_local`, no file-scope mutable state; `GroupMemoryBarrierWithGroupSync` rejected on CPU (E36107) so no intra-group-sync kernels can target CPU; `m_bindingData` read-only during dispatch; `CommandExecutor` stack-local per submit.
- Atomics on CPU: only integer `add` lowers to real atomics (`_slang_atomic_add_{u,i}{32,64}`, `prelude/slang-cpp-prelude.h:349-401`); every other Atomic op and `InterlockedAdd` fails the build loudly (E99999 / E36107) — no silent racy lowering. Reporter's caveat correct: cross-group atomic add via `Atomic<T>` integers is safe today; float-add and InterlockedAdd gaps are the two slang-repo issues the reporter cited (shader-slang/slang 14183, 13705 — cross-repo, do not link in comments).
- `dispatchComputeIndirect` already NOT_SUPPORTED on CPU (`cpu-command.cpp:233-237`) → only the direct path changes.
- Git log `src/cpu/`: no prior parallelization attempt (recent: #940 heaps, #854 dispatch-limit 0xffffffff, #739 synthetic bindings, #884 lifetimes, #836 UB, #732 execute-callback).

## Candidate approaches
### A: per-dispatch fork-join on the global task pool (RECOMMENDED)
- Where: `cpu-command.cpp:217-231` (only file needing real change).
- Delta: split the box along its longest axis into K sub-boxes (K ≈ min(groupCount, pool workers, cap)); submit each chunk to a task group that calls `m_func` with the sub-box + same binding data; `waitAndReleaseTaskGroup` before returning. Run inline (old path) when groupCount is tiny or pool is `BlockingTaskPool`.
- Tradeoffs: minimal blast radius; honors app-configured pool; per-dispatch barrier trivial vs kernel time; dispatches with fewer groups than cores underutilize (thread loop is inside `_Group` — thread-level split needs Slang codegen change, out of scope).
- Risk: low. Behavioral note: kernels that (incorrectly) rely on de-facto sequential inter-group plain-memory visibility within one dispatch now genuinely race — never guaranteed by the compute model (same on GPU), but CPU-target users may lean on it; document in `docs/cpu-target` or gate behind a device option (maintainer call).
### B: asynchronous CPU queue (submit → worker threads; real fences)
- Where: `cpu-command.cpp:360-390` + `cpu-fence.cpp` + `cpu-device.cpp:48-94`.
- Delta: submit returns before completion; fences signal from the worker.
- Tradeoffs: overlaps host work with execution, but large blast radius: fence-semantics upgrade (no-op `waitOnHost`, spin `waitForFences`), buffer map/readback during execution, user `executeCallback` thread-safety, debug layer, lifetimes (#884). Not needed for the complaint.
- Risk: high.
### C: expose the group-range split on the public API (app-driven)
- Where: `include/slang-rhi.h` `IComputePassEncoder` (~:2761), append-only (precedent #732 execute-callback).
- Delta: e.g. `dispatchComputeRange(startGroupID, endGroupID)` so apps split + wait themselves.
- Tradeoffs: keeps executor trivial; pushes complexity to every app; doesn't fix the default. ABI fine (append-only).
- Risk: low; low payoff vs A.

## Recommended path
A. Fastest correct fix: no public API change, uses the codegen's designed-in hook and the existing work-stealing pool. Land with:
(1) CPU test — multi-group kernel where each group atomically increments a shared uint (integer add) or writes its SV_GroupID to a unique slot → exact result under concurrent execution (catches double-run/miss);
(2) all existing CPU tests pass;
(3) manual perf check mirroring the reporter's numbers (spin-kernel wall time drops with the default pool; `initTaskPool(0)`/BlockingTaskPool restores single-threaded behavior — also the compat escape hatch).
Document the inter-group visibility caveat; maintainer may prefer a device option for the default-on behavior.
Accept when: tests above pass and a user-configured custom task pool is honored.

## Sources
- DeepWiki slang-rhi Q1 (synchronous submit model) + Q2 (task-pool API, task groups, work stealing, current users).
- Local source reads (2 subagents, rhi main checkout) + local slangc compile probes of generated CPU kernels.
- Dedupe 2026-11-18: rhi issue searches (cpu dispatch parallel / multicore / task pool / cpu thread) → no prior. Adjacent: rhi#961 (group-size override, different axis, same reporter), rhi#640 (unrelated Metal race).
- Reporter's measurements unverified here (MSVC/Windows) but mechanism-confirmed; plausible.
