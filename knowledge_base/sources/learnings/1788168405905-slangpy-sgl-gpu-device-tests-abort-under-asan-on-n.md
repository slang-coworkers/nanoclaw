---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1788165418361-kthyu5
written_at: 2026-08-31T09:26:45.905Z
---

# slangpy/sgl GPU device tests abort under ASan on NVIDIA driver (RTLD_DEEPBIND)

**Symptom:** Running slangpy/sgl device tests (or the sanitizers.yml `asan-ubsan (linux)` leg) locally on an NVIDIA GPU box aborts with SIGABRT (exit 134) at `slangpy/testing/helpers.py get_device()` — i.e. at GPU device creation, before any test/fix code runs. Message: `You are trying to dlopen a libnvidia-gpucomp.so.<ver> ... with RTLD_DEEPBIND flag which is incompatible with sanitizer runtime`. Happens for BOTH Vulkan (`libnvidia-gpucomp.so`) and CUDA (`libcuda.so`).

**Cause:** The NVIDIA driver/Vulkan-loader dlopens internal libs with `RTLD_DEEPBIND`. AddressSanitizer's dlopen interceptor rejects DEEPBIND and calls `Die()`; with `abort_on_error=1` (which `tools/setup-sanitizer-env.py` sets) that becomes SIGABRT. See google/sanitizers#611. slang-rhi itself only uses `RTLD_NOW/LAZY/GLOBAL` — the DEEPBIND is inside the driver, unfixable from the project. LLVM (through 22.x) exposes **no `handle_deepbind` ASan flag** to bypass it. Driver observed: 565.57.01.

**Implications for verifying the #1130 LSan leak fix locally:** you CANNOT reproduce the two project leak roots (they come from functional-API GPU device tests) on such a box — the device never gets created under ASan. "0 project roots" from `filter-lsan-reports.py` in that state is VACUOUS (leak-producing tests didn't run), not a pass. The CI `nvrgfx-kernelvm-bridge` runner evidently has a driver/loader that doesn't take the DEEPBIND path under ASan.

**Workarounds:** (1) Use the CPU backend (`spy.Device(type=spy.DeviceType.cpu)`) — the functional-API cache cycle and `NativeBoundCallRuntime.m_args` are backend-independent, so a CPU device exercises the same Python ownership cycle without dlopening the NVIDIA driver (no DEEPBIND). Validates the fix MECHANISM (weakref-None discriminator tests + revert-drill) though not the exact GPU byte-counts. (2) Otherwise run on a runner whose GPU driver/loader doesn't use RTLD_DEEPBIND under ASan (as CI does), or trigger sanitizers.yml via workflow_dispatch on the branch.

**Toolchain note (same task):** Debian bookworm clang-14 ships NO compiler-rt sanitizer runtime (`/usr/lib/llvm-14/lib/clang/14.0.6/lib/linux/` absent; `libclang-rt-14-dev` unavailable). Download a self-contained LLVM release tarball (e.g. LLVM 22.1.8 from github.com/llvm/llvm-project releases) into the workspace and PATH-prepend it — no apt/admin/restart. The shared asan runtime lives at `<llvm>/lib/clang/22/lib/x86_64-unknown-linux-gnu/libclang_rt.asan.so` (per-target layout; the `-x86_64.so` name variant does not exist there — `setup-sanitizer-env.py` resolves the right one via `clang++ --print-file-name`).
