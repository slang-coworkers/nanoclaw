---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1788473993637-kuwy9q
written_at: 2026-09-04T00:13:26.317Z
---

# SlangPy CPU dispatch: zero DeviceLimits + stale local checkout + pytest device classification

From fixing slangpy#1136 (CPU compute dispatch throwing "Device reports zero compute dispatch groups in X", 0.43.0 regression). PR: shader-slang/slangpy#1137.

**Root cause / fix pattern.** The slang-rhi CPU backend (`src/cpu/cpu-device.cpp` `DeviceImpl::initialize`) never populates `DeviceLimits.maxComputeDispatchThreadGroups`, and `DeviceLimits` has no default member initializers, so it stays `{0,0,0}`. CPU is the ONLY backend that omits this. Since PR #995's large-dispatch clamp, slangpy computes `min(0, ceiling)=0` groups and throws. Gotcha: fixing only the X clamp (`src/slangpy_ext/utils/slangpy.cpp` dispatch_thread_count_from_total_threads) just moves the throw to the Y check `SGL_CHECK(dispatch_y <= limits.y)` (0 there too). Also `slangpy/core/generator.py` emits BOTH `dispatch_group_x_stride` AND `dispatch_thread_x_stride` = 0. slangpy-side fix = treat 0 as unbounded (X→ceiling, Y→UINT32_MAX); canonical fix is in slang-rhi (set the CPU limit to 0xFFFFFFFF, mirroring Metal). The slangpy fallback is a provable no-op once rhi reports a real limit.

**[HIGH VALUE] Local slangpy checkout can be far behind origin/main.** My worktree base was 68 commits behind origin/main, with an OLDER slang-rhi submodule (ee078c7 vs upstream pin 22239042). The "work from a current checkout" rule is not theoretical — ALWAYS `git fetch origin main` + rebase before building/opening a PR, and re-run the build after the rebase (the submodule bump recompiles). The bug/fix regions happened to be stable, but the submodule pointer changed.

**[HIGH VALUE] slangpy pytest device classification.** `slangpy/testing/plugin.py` `pytest_runtest_setup` treats a test as a *device* test ONLY if its function has a `device_type` parameter. Without it, the test is classed *non-device* and SKIPPED under any `--device-types` selection (incl. `--device-types cpu`). So a CPU-specific test MUST be `@pytest.mark.parametrize("device_type", [DeviceType.cpu])` (and take `device_type`) to run under scoped selections; it still runs in the default unscoped `pytest slangpy/tests` job (which passes no `--device-types`). `DEFAULT_DEVICE_TYPES` never includes cpu on any platform.

**CPU backend has known Linux issues.** slang-rhi disables CPU in its OWN test harness on Linux (`external/slang-rhi/tests/testing.cpp`: "Known issues with CPU backend on linux") — but that's a harness gate, NOT a slangpy runtime restriction (slangpy `create_device(type=cpu)` + a scalar/grid dispatch works on Linux). However, `test_pass_float_array` (Python list → `float x[3]`) SEGFAULTS in CPU array marshalling once the dispatch throw is removed — a separate pre-existing CPU defect, previously masked.

**Build in container (no GPU).** apt prereqs: libgl-dev libegl-dev libvulkan-dev + X11 dev libs (NOT libGLU). System python is PEP668-managed → make a venv. `NO_CMAKE_BUILD=1 pip install -e . --no-build-isolation` avoids setup.py's redundant RelWithDebInfo rebuild. Build: `cmake --preset linux-gcc` then `cmake --build --preset linux-gcc-debug` (~1 min incremental; slang is prebuilt-fetched). The Debug `.so` lands directly in the source `slangpy/` dir — no reinstall after a C++ edit, just re-run pytest.
