---
title: "CI release LTO defeats symbol-hiding that local --preset release keeps (slang #9146/#7722)"
type: learning
topic: slang-compiler
source: learnings/1784380337015-ci-release-lto-defeats-symbol-hiding-that-local-pr.md
---

# CI release LTO defeats symbol-hiding that local --preset release keeps (slang #9146/#7722)

**Context:** slang#9146 — libslang-glslang-*.so re-exports C++ stdlib symbols (std::vector::_M_default_append, std::string::_M_replace, etc.) in the OFFICIAL release ZIPs but NOT in a user's local `cmake --workflow --preset release`. Regression of #7722 (fixed by PR #8089, which added `CXX_VISIBILITY_PRESET hidden` + `VISIBILITY_INLINES_HIDDEN ON` + `-Wl,--exclude-libs,ALL` to slang-glslang / slang-glsl-module / slang-llvm). Those CMake settings are STILL present today, so the fix source is intact — the leak is a build-configuration divergence, not a reverted fix.

**Root cause (directly evidenced):** The `SLANG_ENABLE_RELEASE_LTO` CMake option defaults to **OFF** (`CMakeLists.txt:371`) and is NOT set by any preset in `CMakePresets.json` — so `cmake --workflow --preset release` builds WITHOUT LTO. But the official release workflow `.github/workflows/release.yml:156` passes `-DSLANG_ENABLE_RELEASE_LTO=ON`. LTO/IPO (`INTERPROCEDURAL_OPTIMIZATION_RELEASE TRUE`, applied per-target in `cmake/SlangTarget.cmake:174-181`) changes how `-Wl,--exclude-libs,ALL` and hidden-visibility interact: under LTO, symbols from statically-linked archives (glslang / SPIRV-Tools) are merged/re-emitted at link time in a way that can bypass `--exclude-libs` archive-name matching, so stdlib template instantiations end up exported (dynamic `T`).

**Secondary hypothesis:** `add_supported_cxx_linker_flags` (`cmake/CompilerFlags.cmake:47`) probes each flag with `check_linker_flag` and SILENTLY drops it if unsupported — so a linker/toolchain difference between CI and local could also drop `--exclude-libs,ALL`. But LTO is the primary, directly-confirmed divergence.

**Lesson for future symbol/packaging bugs:** when a symptom appears in release packages but not local `--preset release`, diff `release.yml`'s configure line against the preset — CI adds `-DSLANG_ENABLE_RELEASE_LTO=ON`, `-DSLANG_ENABLE_EXAMPLES=OFF`, `-DSLANG_STANDARD_MODULE_DEVELOP_BUILD=OFF`, and a matrix `SLANG_SLANG_LLVM_FLAVOR`. LTO is the usual culprit for visibility/exclude-libs regressions.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784380337015-ci-release-lto-defeats-symbol-hiding-that-local-pr.md`_
