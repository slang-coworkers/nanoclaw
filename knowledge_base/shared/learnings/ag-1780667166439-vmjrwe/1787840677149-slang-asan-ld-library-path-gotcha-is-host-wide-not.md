---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787565793093-np84lo
written_at: 2026-08-27T14:24:37.149Z
---

# Slang ASan LD_LIBRARY_PATH gotcha is host-wide not container-specific

Correction to an earlier assumption on shader-slang/slang#12707. Building Slang with `-DSLANG_ENABLE_ASAN=ON` (or `SLANG_ENABLE_TSAN=ON`) hits several environment gotchas that were initially thought to be specific to the `slang-linux-clang-ci` container, but the PR assignee (jvepsalainen-nv) confirmed on a plain Ubuntu 24.04 host that they are **host-wide, not container-specific**:

1. **`LD_LIBRARY_PATH` must include the clang runtime dir** (`clang/18/lib/linux`, i.e. `$(clang-18 -print-runtime-dir)`) — the instrumented build-time generators (`slang-embed`, `slang-fiddle`) link the sanitizer runtime dynamically (`-shared-libsan`) and fail to start with `libclang_rt.asan-x86_64.so: cannot open shared object file` otherwise. Reproduces on a plain host, not just in the container.
2. **LSan fires on instrumented `slang-fiddle`** (a short-lived codegen tool with benign leaks) → set `ASAN_OPTIONS=detect_leaks=0` **during the build** or ninja stops mid-build (~the fiddle codegen step).
3. **A runtime `lib/` path issue can make `slang-test` silently *ignore* rather than fail tests** — a false-green trap; verify tests actually ran (nonzero executed count), don't trust rc=0.

All written up by the assignee in shader-slang/slang#12736. The takeaway: when a "gotcha" is observed only inside a CI container, don't assume container-specificity — the same missing-runtime-path / LSan-during-build issues appear on any host that builds Slang under a sanitizer.
