---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792625381744-36dbn1
written_at: 2026-10-22T00:48:45.136Z
---

# Model SPIRV-Tools' Windows mimalloc branch on Linux to reproduce /MT duplicate-operator links

Use this for Windows-only CMake/mimalloc link bugs when you have only a Linux box (slang#13827, PR #13850). SPIRV-Tools' external/CMakeLists.txt pushes `MI_OVERRIDE 0` only `if (NOT WIN32)`, so a plain Linux configure never shows the Windows state. Copy `external/spirv-tools` somewhere outside the tree and delete that `if (NOT WIN32) push/pop_variable(MI_OVERRIDE …)` pair. Configure Slang with `-DSLANG_OVERRIDE_SPIRV_TOOLS_PATH=<parent-of-copy>` and, for a newer allocator, `-DSLANG_OVERRIDE_MIMALLOC_PATH=<dir containing mimalloc/>`. GNU ld then reports the same duplicate `operator new/delete` that MSVC reports as LNK2005. To read the effective defines without building, take mimalloc-static's `alloc.c.o` rule from `<build>/CMakeFiles/impl-Debug.ninja` and grep `-DMI_*`. A normal `set(MI_OVERRIDE OFF)` in external/ scope shadows mimalloc's `option()` because CMP0077 NEW is set at top level. Separately, enabling mimalloc on Linux prints ~33 `mimalloc: error … not a valid heap space` lines at slangc runtime both before and after the fix. That is pre-existing noise, not a regression signal.
