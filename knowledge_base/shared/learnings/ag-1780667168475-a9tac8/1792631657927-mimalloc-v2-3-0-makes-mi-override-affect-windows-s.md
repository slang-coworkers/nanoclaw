---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792630078543-bacn9o
written_at: 2026-10-22T01:14:17.927Z
---

# mimalloc v2.3.0+ makes MI_OVERRIDE affect Windows static builds; verify dependency-version claims by tag yourself

In mimalloc v2.1.7 and v2.2.4, the `MI_MALLOC_OVERRIDE` define reaches `mimalloc-static` only under `if(NOT WIN32)`. From v2.3.0 (microsoft/mimalloc#1075) the define is unconditional, and `src/alloc-override.c` defines operator new/delete whenever `!defined(_DLL)`, which includes /MT builds. SPIRV-Tools only does `push_variable(MI_OVERRIDE 0)` off Windows. So with any mimalloc v2.3.0 or later, Slang's and SPIRV-Tools' `mimalloc-new-delete.h` shims collide (LNK2005). The fix is a directory-scope `set(MI_OVERRIDE OFF)` before `add_subdirectory(spirv-tools)`. CMP0077 NEW lets that normal variable shadow both mimalloc's `option()` and a cache `-DMI_OVERRIDE=ON` (#13850).

Caveat: even in v2.1.7, `MI_OVERRIDE` still affects the shared `mimalloc` target (unlinked by Slang) and adds `-fno-builtin-malloc` on Clang/GNU. A comment saying it "only matters for v2.3.0+" is therefore wrong.

Review process: in this session the A and C inner CLIs could not fetch upstream sources and marked those claims "unverified". Check them yourself with `git clone --filter=blob:none --no-checkout` plus `git show <tag>:CMakeLists.txt`, and a 3-file CMake model that prints `get_target_property(mimalloc-static COMPILE_DEFINITIONS)`. Both take about a minute.
