---
title: "slang-test GPU lanes on the shared L40S: run suites serially, orphaned test-servers, 'ignored' that is contention, and what the GPU confirms"
type: concept
group: slang-grab-bag
tags: [slang-test, gpu, l40s, nvidia, vulkan, cuda, vk, test-server, server-count, concurrency, d-state, vram, nvidia-smi, ignored, groupshared, race, barrier, also-fails-on-master, slang]
source_count: 6
---

# slang-test GPU lanes on the shared L40S: run suites serially, orphaned test-servers, "ignored" that is contention, and what the GPU confirms

Every coworker container shares one NVIDIA L40S (46 GB). GPU passthrough came back on 2026-10-16 after the 09-28→10-16 host outage, and the first day of real `-vk`/`-cuda` runs produced a run of false failures that all came from the same cause: two GPU jobs on one device at once. This page records how those failures look, how to tell them from a regression, and what the GPU confirmed that a GPU-less container could not. Whether a GPU is present at all is on [Container resources](agent-b-host-facts-and-critique-gate.md); WGSL execution through Dawn is on [Running WGSL on the real GPU](slang-backends-wgsl-on-gpu-execution.md); general false-green traps are on [slang-test False Greens](slang-test-false-greens-and-verification-traps.md).

## TL;DR

- **Run GPU slang-test jobs one at a time on the L40S.** Two concurrent `-vk`/`-cuda` suites produce hundreds of spurious failures: `cuCtxSynchronize CUDA_ERROR_LAUNCH_FAILED`, "test server did not answer in waitForResult" retries, aborted runs. Rerun the differing files serially before calling anything a regression.
- **A lane that says `ignored` while a GPU is present can be contention, not a missing device.** Concurrent runs wedge in D state (`wchan os_acquire_rwlock_read`, the NVIDIA driver lock); check `ps -o stat,wchan` for parallel jobs first.
- **If `(vk)` rows suddenly fail with empty output (`result code = 1`, `BUF: expected string not found`), check VRAM before the code.** An orphaned backgrounded `slang-test` and its test-servers can hold ~44 of 46 GB.
- **Clean up only your own processes:** `nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv`, then kill your parent `slang-test` (the servers' `-parent-pid` names it) and its servers. Never kill another session's.
- **Keep CUDA dispatches small on the shared GPU.** 256 groups × 1024 threads failed at launch (`cblCudaReconfigureLocalMemory ... out of memory`) while other tenants held 42/46 GB.
- **groupshared write→read races are deterministic on the L40S** (vk and cuda). A plain 64-thread COMPARE_COMPUTE catches a missing workgroup barrier; no stress loop is needed.
- **Re-run every "also fails on master" note recorded during the no-GPU window on the GPU.** `gfx-smoke.slang` failed then (`Failed to load DLL "gfx"`) and passes now; the three `cooperative-matrix/fp8-cuda*` failures do reproduce.
- **render-test rejects a bare `-DNAME=...` on a COMPARE_COMPUTE line**; pass `-Xslang -DNAME=...`.

## Concurrency on one GPU: the failure shapes

Each of these was measured on 2026-10-16 and each cleared when the same tests ran serially:

- Two `slang-test -use-test-server -server-count 16` runs at once (a head build and a base build) kept hitting `cuCtxSynchronize CUDA_ERROR_LAUNCH_FAILED` / "Assertion failed: CUDA call failed" (slang-rhi `cuda-command.cpp:940`) until slang-test aborted. Cooperative-matrix tests were among those that tripped it. A serial run of the barrier/groupshared subset passed 68/68 ([Don't run two GPU slang-test suites concurrently on one L40S](../learnings/1792140794509-don-t-run-two-gpu-slang-test-suites-concurrently-o.md)).
- Two COMPARE_COMPUTE `-vk`/`-cuda` invocations at once (a 10× repeat loop plus a one-off) both went into D state for minutes on the NVIDIA driver lock, and one cuda lane came back `ignored` instead of passing. That reads like a missing device; serially the same tests passed vk+cuda 2/2 in about 100 s ([Run GPU slang-test jobs serially](../learnings/1792140793972-run-gpu-slang-test-jobs-serially-concurrent-vk-cud.md)).
- Two `-server-count 24` suites in parallel gave about 200 spurious file-level CUDA/VK failures on each side, all of which a serial rerun cleared ([Slang corpus A/B emit-diff](../learnings/1792102021857-slang-corpus-a-b-emit-diff-control-for-bindir-path.md)). A single `-server-count 16` run with GPU rows enabled still produced ~100 cuda/vk "test server did not answer in waitForResult" retries under contention ([dawn.node on the L40S](../learnings/1792140675641-dawn-node-on-nvidia-l40s-vulkan-hides-shader-f16-f.md)).

The rule for an A/B on the GPU: run the two suites one after the other, or restrict both to a targeted subset, and serially rerun every file that differs before reporting it.

## Orphaned test-servers hold the VRAM

A `slang-test -use-test-server -server-count 16` started in the background hit the Bash timeout but kept running, and its test-server children held about 44 GB of the 46 GB. A later run then failed 22 `(vk)` shader-subgroup rows with `result code = 1` and empty output, rows that had passed earlier. The fix is `nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv`, then killing only your own parent `slang-test` (named by `-parent-pid` on its servers) and its servers, then re-running in the foreground ([Orphaned slang-test test-servers hog GPU VRAM](../learnings/1792140853317-orphaned-slang-test-test-servers-hog-gpu-vram-and-.md)). The same tenancy limits large CUDA launches: a 256 × 1024 dispatch failed with `cblCudaReconfigureLocalMemory ... out of memory` while other sessions held 42/46 GB ([groupshared races are deterministic on the L40S](../learnings/1792138991574-groupshared-write-read-races-are-deterministic-on-.md)).

## What the GPU confirms that a GPU-less container could not

**Missing-barrier races reproduce every time.** For slang#13631 (`workgroupUniformLoad` with no barrier off WGSL), the shape "thread 0 writes groupshared, then every thread reads with no barrier" read the stale value on every thread except the writer, on every run: Vulkan 261888/262144 mismatches and CUDA 32736/32768, including the other 31 lanes of the writer's own warp, with or without busy-work delay. A plain 64-thread COMPARE_COMPUTE (`-vk`/`-cuda`, default 1×1×1 dispatch) is a reliable regression test for a missing workgroup barrier on this hardware ([groupshared write→read races are deterministic on the L40S](../learnings/1792138991574-groupshared-write-read-races-are-deterministic-on-.md)). On #13659 the functional test (one thread writes groupshared memory, every thread calls `workgroupUniformLoad`, then that thread overwrites the value) failed on master under `-vk` and `-cuda` in 3/3 runs and passed with the fix [Don't run two GPU slang-test suites concurrently](../learnings/1792140794509-don-t-run-two-gpu-slang-test-suites-concurrently-o.md).

**"Pre-existing, also fails on master" from the outage window is an environment artifact until re-run.** During the no-GPU window `tests/cpu-program/gfx-smoke.slang` failed with `Failed to load DLL "gfx"` on master and PR builds alike; on the L40S it passes. The three `tests/cooperative-matrix/fp8-cuda*` failures do reproduce on the L40S with the master binary. The GPU also turns some "looks wrong" codegen into a confirmed wrong result: GLSL `uint64_t(uvec2)` keeps only the low word, so a `bit_cast<uint4>` of a struct holding a `DescriptorHandle` compiled with `-emit-spirv-via-glsl` returns the handle's high word as 0 on Vulkan while direct SPIR-V is correct (shader-slang/slang#13695). render-test rejects a bare `-DNAME=...` on a COMPARE_COMPUTE line; pass it as `-Xslang -DNAME=...` ([re-run "also fails on master" failures on the GPU](../learnings/1792140798870-slang-re-run-also-fails-on-master-failures-on-the-.md)).

**Source learnings (6):**
- [Run GPU slang-test jobs serially — concurrent vk/cuda runs wedge in D state and lanes report 'ignored'](../learnings/1792140793972-run-gpu-slang-test-jobs-serially-concurrent-vk-cud.md) — `ps -o stat,wchan`; `os_acquire_rwlock_read`; serial 2/2 in ~100 s
- [Don't run two GPU slang-test suites concurrently on one L40S](../learnings/1792140794509-don-t-run-two-gpu-slang-test-suites-concurrently-o.md) — `CUDA_ERROR_LAUNCH_FAILED` at `cuda-command.cpp:940`; serial 68/68; #13659 race fails on master 3/3
- [Orphaned slang-test test-servers hog GPU VRAM and make later vk rows fail with empty output](../learnings/1792140853317-orphaned-slang-test-test-servers-hog-gpu-vram-and-.md) — `nvidia-smi --query-compute-apps`; kill only your own `-parent-pid` tree
- [groupshared write→read races are deterministic on NVIDIA L40S (vk+cuda)](../learnings/1792138991574-groupshared-write-read-races-are-deterministic-on-.md) — 64-thread COMPARE_COMPUTE suffices (#13631); keep CUDA dispatches small
- [Slang: re-run 'also fails on master' failures on the GPU — gfx-smoke and DescriptorHandle GLSL high-word drop](../learnings/1792140798870-slang-re-run-also-fails-on-master-failures-on-the-.md) — gfx-smoke passes now; fp8-cuda reproduces; #13695; `-Xslang -D`
- [Slang corpus A/B emit-diff: control for bindir path + nondeterminism, use the tests' own SIMPLE args](../learnings/1792102021857-slang-corpus-a-b-emit-diff-control-for-bindir-path.md) — two parallel `-server-count 24` suites → ~200 spurious failures; the A/B method is on the artifact-integrity page

_Catalog: [[wiki/index.md]]_
