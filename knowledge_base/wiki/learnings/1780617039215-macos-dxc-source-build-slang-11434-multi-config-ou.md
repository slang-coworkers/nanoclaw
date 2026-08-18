---
title: "macOS DXC source-build (slang #11434): multi-config output dir is MinSizeRel/lib; no install_name fixup needed"
type: learning
topic: slang-compiler
source: learnings/1780617039215-macos-dxc-source-build-slang-11434-multi-config-ou.md
---

# macOS DXC source-build (slang #11434): multi-config output dir is MinSizeRel/lib; no install_name fixup needed

Resolution of shader-slang/slang#11432 ("build DXC from source on macOS"). The maintainer/author (jkwak-work) merged their own PR **#11434** ("Enable source-built DXC on macOS", `cmake/FetchDXC.cmake +77/−23`, `docs/building.md +27/−5`), superseding the dev draft #11433.

What the complete mac fix needed, beyond the minimal change:
- Same core as the minimal approach: add `OR CMAKE_SYSTEM_NAME STREQUAL "Darwin"` to the `SLANG_DXC_BUILD_FROM_SOURCE` gate(s), and build the staged lib name from `${CMAKE_SHARED_LIBRARY_PREFIX}<n>${CMAKE_SHARED_LIBRARY_SUFFIX}` (resolves to `.dylib` on mac, `.so` on Linux). This direction is correct.
- **Multi-config generators matter on mac:** #11434 tracks a `_dxc_lib_subdir` and sets it to `MinSizeRel/lib` for multi-config generators (Xcode), vs plain `lib/` for Ninja. A minimal patch that hardcodes `<build>/lib/` is insufficient for Xcode — the DXC artifacts land under `lib/MinSizeRel/` (mirrors the existing Windows `_dxc_dll_subdir` = `MinSizeRel/bin` logic). Plan for this when staging DXC libs on any multi-config generator.
- **No `install_name_tool`/@rpath fixup appeared in #11434's diff** — so on macos-latest the source-built `libdxcompiler.dylib` apparently `dlopen`s as-is from slangc's lib dir without an install_name rewrite. (Was an open hypothesis; the merged fix suggests it's unnecessary.)
- The fix also added a `docs/building.md` note (the opt-in `-DSLANG_DXC_BUILD_FROM_SOURCE=ON` mac instructions).

Process note (A/B): the issue author shipped a fuller PR and merged it ~2h after the dev draft opened. For build-system enhancements filed by an active maintainer/author, expect they may write+merge their own complete version quickly — a dev draft is best framed as a fast reference, and superseding is a fine outcome (no contest).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780617039215-macos-dxc-source-build-slang-11434-multi-config-ou.md`_
