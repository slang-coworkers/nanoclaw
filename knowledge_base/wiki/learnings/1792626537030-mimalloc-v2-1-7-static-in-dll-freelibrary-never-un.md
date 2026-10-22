---
title: "mimalloc v2.1.7 static-in-DLL: FreeLibrary never unmaps arenas unless destroy_on_exit is set from DllMain"
type: learning
topic: misc
source: learnings/1792626537030-mimalloc-v2-1-7-static-in-dll-freelibrary-never-un.md
---

# mimalloc v2.1.7 static-in-DLL: FreeLibrary never unmaps arenas unless destroy_on_exit is set from DllMain

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792623387740-atznhk
written_at: 2026-10-21T23:48:57.030Z
---

# mimalloc v2.1.7 static-in-DLL: FreeLibrary never unmaps arenas unless destroy_on_exit is set from DllMain

Context: shader-slang/slang#13828. Slang statically links mimalloc v2.1.7 into slang-compiler.dll (SLANG_ENABLE_MIMALLOC, on by default for Windows+MSVC+SHARED) and into slang-glslang.dll (through SPIRV-Tools-opt, SLANG_ENABLE_SPIRV_TOOLS_MIMALLOC).

**What happens at unload today.** In a static lib, mimalloc registers `atexit(mi_process_done)` (init.c:534). On FreeLibrary that function does `FlsFree` and a forced collect. It unmaps arenas only if `mi_option_destroy_on_exit` is set (`_mi_arena_unsafe_destroy_all`, arena.c:693-724). Other live threads' heaps are skipped (init.c:451).

**Measured effect.** A Linux dlopen/dlclose harness using the same lib showed +1 GiB reserved per cycle (the `arena_reserve` default), plus committed pages for each live host thread.

**The fix.** Add `DllMain(DLL_PROCESS_DETACH, lpReserved == NULL)` and call `mi_option_enable(mi_option_destroy_on_exit)` there. This brings growth down to about 8 KiB per extra thread per cycle; that residue is `mi_thread_data_t` from `_mi_os_alloc`.

**Why it works.**
- Option timing: the MSVC CRT calls DllMain, then static destructors, then atexit functions. So mi_process_done sees the option, and the static destructors have already freed their memory by then.
- Process exit: lpReserved is non-NULL there, and that path should stay untouched.

**Harness.** Build mimalloc with `cmake -DMI_OVERRIDE=OFF -DMI_BUILD_STATIC=ON -DCMAKE_POSITION_INDEPENDENT_CODE=ON`, then link it into a .so with `-Wl,--exclude-libs,ALL`. Copy at /workspace/agent/scratch-13828 (slang-triager group).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792626537030-mimalloc-v2-1-7-static-in-dll-freelibrary-never-un.md`_
