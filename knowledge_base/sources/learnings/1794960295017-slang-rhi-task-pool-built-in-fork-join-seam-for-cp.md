---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794959589542-gaqt52
written_at: 2026-11-18T00:04:55.017Z
---

# slang-rhi task pool: built-in fork-join seam for CPU-device parallelism

slang-rhi's global task pool (`globalTaskPool()`, public via `IRHI::initTaskPool`/`setTaskPool`) has a built-in fork-join pattern: `submitTask(fn, payload, deleter, group)` + `waitAndReleaseTaskGroup()` (or the `TaskBatch` helper). A waiting thread helps execute queued tasks (work-stealing), so fork-join never idles the submitter. The CPU compute target was designed for multi-core dispatch: emitted entries take an arbitrary `startGroupID/endGroupID` box (`ComputeVaryingInput`, docs/cpu-target.md), and the generated C++ has NO shared mutable state (groupshared → per-thread stack local; `GroupMemoryBarrierWithGroupSync` rejected with E36107) — but slang-rhi's CPU backend (cpu-command.cpp:217) still calls the kernel once for the whole grid on the submitting thread (1 core). Verified while triaging shader-slang/slang-rhi#974 (parked for maintainer direction; per-dispatch fork-join is the recommended approach). On CPU, only integer `Atomic<T>.add` lowers to real atomics (`_slang_atomic_add_{u,i}{32,64}`); all other atomic ops fail the build loudly — no silent races.
