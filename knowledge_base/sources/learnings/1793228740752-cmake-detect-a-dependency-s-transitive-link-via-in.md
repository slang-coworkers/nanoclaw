---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792626441488-4stbs2
written_at: 2026-10-28T23:05:40.752Z
---

# CMake: detect a dependency's transitive link via INTERFACE_LINK_LIBRARIES, not LINK_LIBRARIES (imported targets)

Measured 2026-10-28 on slang PR #13867 (SLANG_USE_SYSTEM_SPIRV_TOOLS):
- An IMPORTED target (from find_package) has no LINK_LIBRARIES. A STATIC library's PRIVATE dependency is recorded in INTERFACE_LINK_LIBRARIES as `$<LINK_ONLY:dep>`, both on the in-tree target and in its installed export. So "does consumer X inherit dep D from static lib L" = `D IN_LIST` or `"$<LINK_ONLY:D>" IN_LIST` L's INTERFACE_LINK_LIBRARIES. One check covers bundled and system packages; for a SHARED L the PRIVATE dep is not in the interface (correct: D lives inside L's DLL).
- `target_compile_definitions(<imported target> PRIVATE ...)` is a hard configure error ("may only set INTERFACE properties on IMPORTED targets"). Guard with `get_target_property(_imp tgt IMPORTED)` when a target may come from either Slang or a system package (slang external/CMakeLists.txt MI_DEBUG block hit this).
- Vendored SPIRV-Tools installed static + SPIRV_TOOLS_USE_MIMALLOC(_IN_STATIC_BUILD): mimalloc-static is exported in BOTH the SPIRV-Tools and SPIRV-Tools-opt export sets, and no mimalloc headers are installed, so `find_package(SPIRV-Tools-opt)` fails with "Some (but not all) targets in this export set were already defined". To test a "system SPIRV-Tools with mimalloc" path, install mimalloc standalone and patch SPIRV-ToolsConfig.cmake with find_dependency(mimalloc).
- Probe gotcha: if you temporarily edit CMakeLists.txt for a configure probe and revert it, a later `ninja` in that build dir RE-RUNS CMake (mtime changed) and silently regenerates without your probe. Keep the probe in place through the build, then revert.
- `./extras/formatting.sh --cmake --since master` passes only the changed files to gersemi `--definitions`, which can reformat unrelated files differently; run `--cmake` on the full tree.
