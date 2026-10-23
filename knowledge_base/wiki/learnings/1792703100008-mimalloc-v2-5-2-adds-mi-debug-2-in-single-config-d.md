---
title: "mimalloc v2.5.2 adds MI_DEBUG=2 in single-config Debug, overriding Slang's MI_DEBUG=1; multi-config forces MI_BUILD_RELEASE"
type: learning
topic: slang-compiler
source: learnings/1792703100008-mimalloc-v2-5-2-adds-mi-debug-2-in-single-config-d.md
---

# mimalloc v2.5.2 adds MI_DEBUG=2 in single-config Debug, overriding Slang's MI_DEBUG=1; multi-config forces MI_BUILD_RELEASE

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792701292744-37hz4d
written_at: 2026-10-22T21:05:00.008Z
---

# mimalloc v2.5.2 adds MI_DEBUG=2 in single-config Debug, overriding Slang's MI_DEBUG=1; multi-config forces MI_BUILD_RELEASE

Found while reviewing shader-slang/slang#13879 (mimalloc v2.1.7 → v2.5.2), 2026-10-22.

- v2.5.2 `CMakeLists.txt:326-330` adds `MI_DEBUG=2` to `mi_defines` when `CMAKE_BUILD_TYPE MATCHES "Debug"`. v2.1.7 never did this; it added `MI_DEBUG=3` only for `MI_DEBUG_FULL`.
- Slang sets `$<$<CONFIG:Debug>:MI_DEBUG=1>` on `mimalloc-static` (`external/CMakeLists.txt` ~368).
- In a single-config `-G Ninja -DCMAKE_BUILD_TYPE=Debug` build, the compile line becomes `-DMI_DEBUG=1 -DMI_DEBUG=2`. CMake sorts the definitions, so level 2 wins and every mimalloc source prints a "MI_DEBUG redefined" warning (16 in total).
- Fix (tested in a model project): before mimalloc is added, `if(CMAKE_BUILD_TYPE MATCHES "Debug" AND NOT MI_DEBUG_FULL) set(MI_DEBUG ON) endif()`. mimalloc's `elseif(MI_DEBUG)` branch then emits `MI_DEBUG=1`, which agrees with Slang's value.
- Multi-config generators (Slang's presets and CI) are not affected, but there is a trap. When `CMAKE_BUILD_TYPE` is empty, mimalloc forces its directory-scoped `CMAKE_BUILD_TYPE` to Release, so `MI_BUILD_RELEASE` is defined in every config, Debug included. The v2.5.2 `types.h:71` default is then `MI_DEBUG 0` unless something defines `MI_DEBUG` explicitly. Slang's genex does, which is the only reason Debug keeps level 1.

Also in v2.5.2:
- The default Windows init is `MI_WIN_INIT_USE_CRT_TLS`, which uses TLS callbacks and `DLL_THREAD_DETACH`. FLS is used only under the deprecated `MI_WIN_USE_FLS`. Any Slang comment that says mimalloc registers an `FlsAlloc` destructor became stale with the bump (for example `slang-platform.cpp` and the unclosable-library unit test).
- Fast way to verify claims like these: `git clone --filter=blob:none` mimalloc, `git worktree add <dir> v2.5.2`, then a 15-line model CMake project. Read the defines with `ninja -t commands mimalloc-static`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792703100008-mimalloc-v2-5-2-adds-mi-debug-2-in-single-config-d.md`_
