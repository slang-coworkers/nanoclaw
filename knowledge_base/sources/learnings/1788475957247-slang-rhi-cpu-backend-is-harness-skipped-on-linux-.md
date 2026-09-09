---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788474121768-qnlzzc
written_at: 2026-09-03T22:52:37.247Z
---

# slang-rhi CPU backend is harness-skipped on Linux — CPU-scoped rhi tests can't run locally there

In shader-slang/slang-rhi, the test harness **unconditionally marks the CPU device unavailable on Linux**: `tests/testing.cpp` (~L919) `#if SLANG_LINUX_FAMILY { RETURN_NOT_AVAILABLE("CPU backend not supported on linux"); }` ("known issues"). Consequences when fixing/adding CPU behavior:

- A `GPU_TEST_CASE(..., CPU)` **is registered** on Linux (CPU is in `kPlatformDeviceTypes` for all 3 platforms in `tests/testing.h`) but its `.cpu` variant is **SKIPPED** — so you cannot exercise it on a Linux container. It runs only on **Windows + macOS CI** (which do create the CPU device). doctest counts a harness-`SKIP` (early return) as "passed", so an aggregate "N passed" can hide that every `.cpu` case was skipped — always isolate the `.cpu` variant (`-tc="*name.cpu*"`) to see `SKIPPED (device not available)`.
- `isDeviceTypeSupported(CPU)` still returns true (backend compiled in when `SLANG_RHI_HAS_CPU`/`SLANG_RHI_ENABLE_CPU` are ON) — the block is purely the harness guard, not "CPU compiled out". Don't confuse the two: the "backend not supported" message vs the "CPU backend not supported on linux" message distinguish them.
- Practical: for a deterministic CPU init fix (e.g. populating a `DeviceLimits` field), verify by (1) source inspection of `initialize()` before/after, (2) the invariant passing on the GPU backends that DO run locally (Vulkan/CUDA present in the container; WGPU errors on XDG_RUNTIME_DIR), and state honestly that the CPU variant runs on Windows/macOS CI. Scope the regression test to `CPU` (not `ALL`) — an `ALL` `>0` dispatch-limit assertion over-asserts for D3D11 feature levels 9_1–9_3, which legitimately report a zero Z dispatch limit.

Also: `cmake --preset default` (Ninja Multi-Config, artifact `build/Debug/slang-rhi-tests`) configured+built fine on the current container — the older "fails on Xinerama, need `-DSLANG_RHI_BUILD_TESTS_WITH_GLFW=OFF -DSLANG_RHI_BUILD_EXAMPLES=OFF`" note no longer reproduces. clang-format is pinned v20.1.7 (not slang's 17); base branch is `main`; only a `pr: non-breaking` label exists; CI auto-runs on draft PRs.
