---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792691747093-dyq6ck
written_at: 2026-10-22T18:08:51.203Z
---

# mimalloc v2.1.7→v2.5.2 bump: silent MSVC aligned-new loss, arm64 ISA floor, Windows init moved

These are hidden behaviour changes in a "routine" mimalloc 2.x bump. Each was verified with `git show <tag>:<file>` in a blobless clone (#13875 triage, 2026-10-22).

1. **The aligned new/delete overrides drop out on MSVC.** Upstream commit 7f76037a (2026-07, v2.4.x+) changed the guard at `include/mimalloc-new-delete.h:51` from `__cplusplus > 201402L || defined(__cpp_aligned_new)` to `&&`. MSVC reports `__cplusplus == 199711L` unless `/Zc:__cplusplus` is set, and neither Slang nor SPIRV-Tools passes that flag. So the 10 aligned operator new/delete overloads silently go to the CRT. New and delete still pair up, so nothing crashes, but the override coverage is gone. dev2, main3 and v3.5.4 all keep `&&`.
2. **arm64 builds get a higher ISA floor.** v2.5.2 `CMakeLists.txt:161-165` forces `MI_OPT_ARCH` ON on arm64 unless `MI_NO_OPT_ARCH` is set. It then adds `/arch:armv8.1` (MSVC, not clang-cl) or `-march=armv8.1-a` to the mimalloc sources. v2.1.7 added no arch flags.
3. **MI_USE_CXX is a non-change for MSVC.** It is now a "DEFAULT" string, but v2.1.7 already forced C++ for MSVC (CMakeLists.txt:103-105). Only clang-cl changes.
4. **Windows init/teardown moved.**
   - v2.1.7: `.CRT$XIU` → `atexit(mi_process_done)` in `src/init.c`.
   - v2.5.2: the default is `MI_WIN_INIT_USE_CRT_TLS` in `src/prim/windows/prim.c`. A `.CRT$XIB` initializer calls `atexit(mi_crt_done)` for DLLs only, and TLS callbacks handle threads and EXE detach.
   - `mi_option_enable(destroy_on_exit)` (value 1) still tears memory down. The new value ≥2 skips auto process-done entirely (`init.c:732-735`).
   - On MinGW, the CRT_TLS path applies only if `$ENV{MSYSTEM}==UCRT64` at configure time. Otherwise it uses `__attribute__((constructor/destructor))` in `src/prim/prim.c`.
5. **No renames.** None of the options Slang sets (MI_OVERRIDE, MI_BUILD_*, MI_INSTALL_TOPLEVEL, MI_DEBUG_FULL) was renamed or removed. MI_DEBUG is now an option (default OFF), so the `MI_DEBUG=1` generator expression still works.
6. **Pinning.** v2.5.2 (`2406cc5f`) is reachable only from `dev2`, not the default branch `main3`. Keep `branch = v2.5.2` in `.gitmodules`.
7. **GitHub API access.** `gh api` on microsoft/* returns 401 from this container. Use plain `git ls-remote` plus a blobless clone, and WebFetch for the releases page.
