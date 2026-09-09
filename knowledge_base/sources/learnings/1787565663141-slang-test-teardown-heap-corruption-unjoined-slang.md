---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787564830181-qayil0
written_at: 2026-08-24T10:01:03.141Z
---

# slang-test teardown heap corruption = unjoined slang-rhi global worker pool (not allocator mismatch)

When `slang-test` corrupts the heap and glibc aborts at **teardown** after a Vulkan test passes (varying message each run: `corrupted size vs prev_size`, `free(): invalid next size`, `malloc(): largebin double linked list corrupted`, `double free or corruption`), and it needs many live threads / reproduces standalone but vanishes under `gdb` and ASan — that fingerprint is a **teardown race**, not an allocator mismatch or classic double-free. (Issue shader-slang/slang#12706.)

Root cause found by static analysis: slang-rhi has a process-lifetime global worker pool `s_globalTaskPool` (`slang-rhi/src/core/task-pool.cpp:508`), lazily `new ThreadedTaskPool(-1)` → `std::thread::hardware_concurrency()` workers (on a lavapipe box that's the ~29 llvmpipe threads). It is a **leaked raw addRef'd pointer**. Its workers are `join()`ed ONLY in `~Pool()`. The only path that releases the pool is `RHI::destroy()` (`rhi.cpp:138`, `setGlobalTaskPool(nullptr)`), reachable ONLY via `rhiDestroyInstance()` (`rhi.cpp:501`) — and **no tool calls it** (grep `tools/slang-test`, `tools/render-test`, `tools/gfx` = 0 hits). So the workers are alive during static-destruction / `dlclose` of `render-test-tool.so` (which static-links slang-rhi) → a live worker touches freed/unmapped memory → glibc notices only at teardown. Fix: call `rhiDestroyInstance()` at teardown AFTER `cleanDeviceCache()`/device release (else `RHI::destroy`'s `SLANG_RHI_ASSERT(m_liveDeviceCount==0)` fires) and BEFORE `slang::shutdown()`/module unload — ideally via a new render-test-tool export mirroring the existing `cleanDeviceCache`, since the pool statics live inside that module.

TWO reusable triage discriminators:
1. **"ASan-tracked finding + clean ASan run ⇒ that finding is NOT your bug."** The tempting near-match here was #10893 (dangling `TypeLayoutReflection*` cache key in `slang-rhi/src/device.h:517`, listed in `cmake/expected-sanitizer-findings.txt`). But #10893 is a UAF ASan *detects*; the reporter's 5 ASan runs were clean → it's almost certainly not this repro. Clean-under-ASan + needs-many-threads + varying-glibc-message = race, ASan's blind spot, TSan's strong spot.
2. **mimalloc mixed-allocator is a Linux red herring.** `SLANG_ENABLE_MIMALLOC` is OFF by default and ON only for shared MSVC-Windows non-ASan builds (#12036/#12101). A Linux/clang build uses system malloc/free throughout — no cross-allocator free. Don't chase it on non-Windows.

Also: TSan is currently unbuildable in Slang (sanitizer flags are per-target in `slang_add_target`/`cmake/CompilerFlags.cmake` with `-shared-libsan`+`--no-undefined`; injecting `-fsanitize=thread` via CMAKE_*_FLAGS compiles but never links the runtime → undefined `__tsan_*` rejected). Companion fix: add `SLANG_ENABLE_TSAN` (~20 lines) + install `mesa-vulkan-drivers` on the sanitizer CI runner (the Vulkan *execution* path is currently outside all sanitizer coverage).
