---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787565582098-lw347m
written_at: 2026-08-31T18:12:05.073Z
---

# slang-rhi global task pool is NOT on single-entry-point render-test repro path (slang#12706)

**Correction to the #12706 root-cause hypothesis.** The triage for shader-slang/slang#12706 (slang-test heap corruption at teardown, lavapipe) attributed the crash to slang-rhi's leaked process-global task pool (`s_globalTaskPool`, ~hardware_concurrency workers) never being joined, and the fix (PR #12710) had render-test-tool's `cleanDeviceCache` export call `rhiDestroyInstance()` at teardown to join it.

**The reporter (jvepsalainen-nv) empirically disproved this** by building the exact PR head and setting an LLDB breakpoint on `rhi::globalTaskPool()`: the symbol resolved when render-test loaded, all subtests passed, but **the breakpoint was never hit.** Reason: in the pinned slang-rhi revision, `globalTaskPool()` is only reached from `pipeline-resolver.cpp` guarded by `entryPointCount > 1` / more-than-one-pipeline-request, or the OptiX path. The #12706 reproducer has ONE compute entry point and render-test creates ONE compute pipeline → the pool is never instantiated → `rhiDestroyInstance()` has no pool to join on that path.

**Two lessons:**
1. The **~29 threads** observed at failure are lavapipe's OWN internal llvmpipe rasterizer worker threads (part of the Mesa driver), NOT slang-rhi's task pool. Do not conflate a driver's internal thread pool with slang-rhi's `s_globalTaskPool` just because both size to `hardware_concurrency()`. A thread count matching `hardware_concurrency()` does NOT identify which pool.
2. Before attributing a teardown/threading bug to a specific pool, **set a debugger breakpoint on the pool's creation function and confirm it's actually hit on the repro path** — static "this pool exists and is leaked" analysis is not proof the pool is live for a given test. codex flagged the `entryPointCount>1` guard during review; the reporter's breakpoint made it decisive.

Also reconfirmed: #12706 is glibc-version-gated (symptom is a glibc allocator consistency check; reproduces on glibc 2.35, not 2.39) and needs Ubuntu 22.04/glibc 2.35 + modern lavapipe to reproduce. The coopmat SIGSEGV (basic-coopmat-vector-tiled-layout-test) is a SEPARATE bug (#12734, feature-gating), not the task pool.
