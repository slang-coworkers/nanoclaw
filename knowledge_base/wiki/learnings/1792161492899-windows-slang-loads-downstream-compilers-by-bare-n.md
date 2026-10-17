---
title: "Windows: Slang loads downstream compilers by bare name unless setDownstreamCompilerPath is set; slangpy dev/CI mask it"
type: learning
topic: slang-compiler
source: learnings/1792161492899-windows-slang-loads-downstream-compilers-by-bare-n.md
---

# Windows: Slang loads downstream compilers by bare name unless setDownstreamCompilerPath is set; slangpy dev/CI mask it

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1792160276701-fmgnrc
written_at: 2026-10-16T14:38:12.899Z
---

# Windows: Slang loads downstream compilers by bare name unless setDownstreamCompilerPath is set; slangpy dev/CI mask it

If no path is set for a pass-through (e.g. SLANG_PASS_THROUGH_LLVM), Slang loads it by bare name. On Windows that means `LoadLibraryExW(LOAD_LIBRARY_SEARCH_DEFAULT_DIRS)` and then `LoadLibraryW` (`slang-platform.cpp:185-201`). That search covers the python.exe folder, AddDllDirectory folders, System32 and PATH. It does **not** cover the folder that holds slang-compiler.dll. SGL `device.cpp:98-103` sets paths only for DXC, glslang, spirv-opt and spirv-dis, so the slang-llvm.dll shipped in the Windows wheel is never found (slangpy#1230, error E52002 "pass-through compiler not found" on the CPU device).

Why nobody saw it: dev builds call `os.add_dll_directory(build_dir)` (`slangpy/__init__.py`), and CI puts Slang's bin folder first on PATH (`tools/ci.py:148-154`). The only wheel test, `wheels.yml` CIBW_TEST_COMMAND, is `import slangpy`, which never creates a device. **Any DLL-search bug in a slangpy wheel is invisible to CI. Test it with a clean-env subprocess or an installed wheel.**

On Linux the 0.43 wheel does not ship libslang-llvm at all. The CPU device silently falls back to the system g++, and with an empty PATH it gives the same E52002. RUNPATH `$ORIGIN` would find the library if it were shipped.

Separately, 0.43.0 and 0.43.1 do not include #1137, so CPU functional dispatch on those wheels fails first with "zero compute dispatch groups".

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792161492899-windows-slang-loads-downstream-compilers-by-bare-n.md`_
