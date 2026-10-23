---
title: "mimalloc >= 2.5 (since 7f76037a) drops aligned operator new/delete on MSVC unless /Zc:__cplusplus"
type: learning
topic: misc
source: learnings/1792701407276-mimalloc-2-5-since-7f76037a-drops-aligned-operator.md
---

# mimalloc >= 2.5 (since 7f76037a) drops aligned operator new/delete on MSVC unless /Zc:__cplusplus

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792692415480-dgnjiu
written_at: 2026-10-22T20:36:47.276Z
---

# mimalloc >= 2.5 (since 7f76037a) drops aligned operator new/delete on MSVC unless /Zc:__cplusplus

mimalloc-new-delete.h now guards the 10 aligned new/delete overloads with `__cplusplus > 201402L && defined(__cpp_aligned_new)` (it was `||`). MSVC reports `__cplusplus` as 199711L unless `/Zc:__cplusplus` is passed, and `/permissive-` does not enable it. So any TU that includes the header (Slang's source/slang/slang-mimalloc.cpp, and SPIRV-Tools' source/mimalloc.cpp in SPIRV-Tools-opt and SPIRV-Tools-diff) silently stops overriding aligned new on MSVC. The pairs stay matched with the CRT, so nothing crashes, but over-aligned allocations bypass mimalloc. Fix used in slang PR #13879: a per-file `COMPILE_OPTIONS "$<$<CXX_COMPILER_ID:MSVC>:/Zc:__cplusplus>"` plus `SKIP_PRECOMPILE_HEADERS ON`, with `set_source_files_properties(... TARGET_DIRECTORY SPIRV-Tools-opt SPIRV-Tools-diff ...)` for the submodule file.

Two more v2.5.2 surprises:
- (a) It forces MI_OPT_ARCH on arm64, which adds -march=armv8.1-a or /arch:armv8.1. `set(MI_NO_OPT_ARCH ON)` keeps the old baseline.
- (b) In single-config Debug it adds MI_DEBUG=2. CMake SORTS compile definitions (they live in a std::set), so a consumer's `-DMI_DEBUG=1` override loses to `=2`, with redefinition warnings. Multi-config presets are unaffected, because mimalloc then defaults its own CMAKE_BUILD_TYPE to Release.

To verify where a per-source option lands without the target compiler, temporarily swap the genex to `$<$<CXX_COMPILER_ID:GNU>:-DPROBE=1>`, configure into a scratch dir, and grep `CMakeFiles/impl-Debug.ninja` (Ninja Multi-Config) for the objects that carry it.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792701407276-mimalloc-2-5-since-7f76037a-drops-aligned-operator.md`_
