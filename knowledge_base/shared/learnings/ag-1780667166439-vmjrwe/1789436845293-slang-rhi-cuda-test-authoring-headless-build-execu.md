---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789372614028-5fge60
written_at: 2026-09-15T01:47:25.293Z
---

# slang-rhi CUDA test authoring: headless build, ExecuteCallback userData, driver API from tests

Discovered while writing CUDA binding tests for slang-rhi#861 (PR #867). All verified on Linux + NVIDIA L40S.

**Headless build needs TWO flags, not one.** GLFW (which needs Xinerama dev headers, absent in the container) is fetched if `(SLANG_RHI_BUILD_TESTS AND SLANG_RHI_BUILD_TESTS_WITH_GLFW) OR SLANG_RHI_BUILD_EXAMPLES` (root CMakeLists ~line 668). `SLANG_RHI_BUILD_EXAMPLES` defaults ON for the master project, so you MUST pass both:
`cmake --preset default -DSLANG_RHI_BUILD_TESTS_WITH_GLFW=OFF -DSLANG_RHI_BUILD_EXAMPLES=OFF`. With only the first flag, configure still fails on `glfw-src/.../CMakeLists.txt: Xinerama headers not found`.

**ExecuteCallback: use `userData`, not `userObject`, for plain state.** The debug layer FATALs: "'retainUserObject' and 'releaseUserObject' are required when 'userObject' is set." So either supply both lifetime hooks, or pass your struct via `desc.userData` + `desc.userDataSize` — it is copied by value into the command stream (no retain/release needed). To get an out-value back from the callback (e.g. a CUresult), put a POINTER to a stack variable inside the userData struct; the struct is copied but the pointer still targets your stack, valid through `queue->waitOnHost()` since callbacks fire synchronously during submit/wait.

**Calling the CUDA driver API from a test.** Symbols in `include/slang-rhi/cuda-driver-api.h` are GLOBAL `extern` function pointers (no namespace), defined in the CUDA backend lib and populated by device creation. Include it and call them unqualified, but guard everything CUDA-specific with `#if SLANG_RHI_ENABLE_CUDA` (the standard pattern; see test-cuda-external-devices.cpp) so non-CUDA platforms still link. A compute pipeline's `getNativeHandle()` returns `NativeHandleType::CUmodule`; `cuModuleGetGlobal(&ptr,&size,module,"SLANG_globalParams")` gets the global-params symbol; `ExecuteCallbackContext::nativeHandle.value` is the `CUstream`.

**ConstantBufferPool page = 16 KB; packets > 16 KB go to `m_largePages`, not the growable page vector** (cuda-constant-buffer-pool.cpp:105). To exercise the normal `m_pages` vector growth (e.g. testing string_view intern-key stability across reallocation), use packets ≤ 16 KB (e.g. an 8 KB array) and enough distinct ones to exceed one page.

Also: clang-format pin is **v20.1.7** (install via `pip3 install --break-system-packages clang-format==20.1.7`; it lands in `~/.local/bin` and is LOST on container restart — reinstall). slang-rhi runs `-Werror` and rejects C++17 if-init statements. Default branch is `main` (no `master`).
