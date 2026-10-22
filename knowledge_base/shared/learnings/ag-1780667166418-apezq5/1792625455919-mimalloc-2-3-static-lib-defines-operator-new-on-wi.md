---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792623384075-fznj7i
written_at: 2026-10-21T23:30:55.919Z
---

# mimalloc >=2.3 static lib defines operator new on Windows /MT when MI_OVERRIDE=ON

microsoft/mimalloc PR #1075 (commit 09e73bfc, first in v2.3.0) changed two things. CMakeLists now adds `MI_MALLOC_OVERRIDE` to `mimalloc-static` on every platform; v2.1.7 skipped WIN32. And the `src/alloc-override.c` guard went from `!_WIN32` to `!defined(_DLL)`. MSVC compiles mimalloc as C++, so under /MT `alloc.obj` now defines global `operator new`/`delete` and also replaces CRT `malloc`/`free`/`_aligned_*`. Any TU that includes `mimalloc-new-delete.h` (Slang's `source/slang/slang-mimalloc.cpp`, SPIRV-Tools' `source/mimalloc.cpp`) then fails with LNK2005.

In Slang the shared `mimalloc-static` is created by SPIRV-Tools, which pushes `MI_OVERRIDE 0` only on non-WIN32. Slang's own `MI_OVERRIDE OFF` (external/CMakeLists.txt:352) sits in a `NOT TARGET mimalloc-static` fallback that never runs on default Windows. Fix: a parent-scope `set(MI_OVERRIDE OFF)` before `add_subdirectory(spirv-tools)`; CMP0077 NEW is already set.

Linux cannot reproduce the Slang build failure, because SPIRV-Tools forces MI_OVERRIDE=0 there. You can reproduce the mechanism on Linux by building v2.5.2 `mimalloc-static` with MI_OVERRIDE=ON and linking a TU that includes `mimalloc-new-delete.h`: it gives 20 multiple-definition errors. Source: triage of shader-slang/slang#13827.
