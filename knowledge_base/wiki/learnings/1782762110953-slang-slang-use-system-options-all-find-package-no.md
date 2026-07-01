---
title: "Slang SLANG_USE_SYSTEM_* options: all find_package, no _ROOT_DIR; three separate dep-locating conventions"
type: learning
topic: slang-compiler
source: learnings/1782762110953-slang-slang-use-system-options-all-find-package-no.md
---

# Slang SLANG_USE_SYSTEM_* options: all find_package, no _ROOT_DIR; three separate dep-locating conventions

For shader-slang/slang #11441 (jkwak asked how the existing SLANG_USE_SYSTEM_* CMake options work). Verified at master d01f9a41a.

**There are exactly 7 `SLANG_USE_SYSTEM_*` options** (all `advanced_option(... OFF)`, declared `CMakeLists.txt:184-210`): MINIZ, LZ4, VULKAN_HEADERS, SPIRV_HEADERS, UNORDERED_DENSE, SPIRV_TOOLS, GLSLANG. When OFF the bundled submodule is built (guards in `external/CMakeLists.txt`); when ON the resolution block `CMakeLists.txt:529-566` calls `find_package(<Pkg> [REQUIRED])`.

**Key fact (corrects a common assumption):** NONE of these options read a Slang-defined `XXX_ROOT_DIR`/`XXX_ROOT`. They ALL delegate to standard `find_package`, so the locator is CMake-standard `<Pkg>_ROOT` / `<Pkg>_DIR` / `CMAKE_PREFIX_PATH`. Package names are inconsistently cased (`miniz`, `lz4`, `VulkanHeaders`, `SPIRV-Headers`, `SPIRV-Tools`, `glslang`, `unordered_dense`), so the exact `-D<Pkg>_DIR=` var differs per dep.

**There are THREE separate dependency-locating conventions in the tree:**
1. `SLANG_USE_SYSTEM_<DEP>` → `find_package` (system/installed config package).
2. `cmake/Find<SDK>.cmake` hand-written modules use `<SDK>_ROOT_DIR` cache vars — but ONLY for OptiX/Aftermath/NVAPI (`FindOptiX.cmake:1`, `FindAftermath.cmake:1`, `FindNVAPI.cmake:1`), which are NOT part of the USE_SYSTEM family. This is where the `_ROOT_DIR` pattern people remember actually lives.
3. `SLANG_OVERRIDE_<DEP>_PATH` (`CMakeLists.txt:242-321`) → `add_subdirectory` at a custom *source* location, still built from source. Covers extra deps (GLM, IMGUI, SLANG_RHI, LUA, MIMALLOC, CMARK, FAST_FLOAT, TINYOBJLOADER) with no USE_SYSTEM twin.

**Family quirks:** unordered_dense uses `find_package(... CONFIG QUIET)` (silently no-ops if missing) vs `REQUIRED` for the other six (`CMakeLists.txt:531`). miniz/lz4/glslang need manual `add_library(... ALIAS ...)` target glue (namespaced→plain name). SPIRV-Headers fabricates `SPIRV-Headers_SOURCE_DIR` for SPIRV-Tools (`external:217-232`) and makes OVERRIDE a no-op+WARNING. No `find_package` call passes a version, so wrong-version system copies are accepted silently — risky for glslang/SPIRV-Tools which are SHA-pinned.

**Worktree sharing answer:** USE_SYSTEM+shared install prefix shares the compiled artifact (fetch+compile saved, needs installed config pkg at matching version); OVERRIDE_PATH shares source only (still recompiles); `-DSLANG_USE_SCCACHE=ON` shares compiled objects transparently with no version pain (often the best lever). Only worth USE_SYSTEM-sharing the expensive deps (SPIRV-Tools, glslang, SPIRV-Headers); the small/header-only ones aren't worth the version risk.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782762110953-slang-slang-use-system-options-all-find-package-no.md`_
