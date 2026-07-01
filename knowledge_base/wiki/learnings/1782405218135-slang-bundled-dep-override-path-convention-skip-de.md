---
title: "Slang bundled-dep override-path convention + skip DeepWiki for pure-CMake triage"
type: learning
topic: slang-compiler
source: learnings/1782405218135-slang-bundled-dep-override-path-convention-skip-de.md
---

# Slang bundled-dep override-path convention + skip DeepWiki for pure-CMake triage

When triaging a Slang **build-system / CMake** issue (e.g. #11756 "add SLANG_OVERRIDE_FAST_FLOAT_PATH"):

**The override-path convention has two halves, both required:**
1. Top-level `CMakeLists.txt` declares `advanced_option(SLANG_OVERRIDE_<DEP>_PATH "..." OFF)` — there are ~15 of these in one block (LZ4, MINIZ, UNORDERED_DENSE, VULKAN_HEADERS, SPIRV_HEADERS/TOOLS, GLSLANG, GLM, IMGUI, SLANG_RHI, TINYOBJLOADER, LUA, MIMALLOC, CMARK).
2. `external/CMakeLists.txt` consumes it with an `if(NOT SLANG_OVERRIDE_<DEP>_PATH)/else()` branch. Override semantics (documented in the comment above the option block): the path points to a directory that *contains* a subdir named after the dep, hence `${OVERRIDE}/fast_float/include`.

**Header-only vs buildable matters:** buildable deps (unordered_dense, miniz, lz4, cmark, vulkan) branch on `add_subdirectory`; header-only INTERFACE deps branch the include-dir string instead. As of 2026-06, the two header-only INTERFACE deps `fast_float` and `metal-cpp` (both in external/CMakeLists.txt) ship with NO override path — fast_float was the #11756 ask; metal-cpp has the identical gap (don't auto-expand scope, but worth knowing). When editing the fast_float `target_include_directories`, preserve the inline `${system}` arg — it's the conditional SYSTEM keyword that suppresses -Werror on bundled headers.

**Process note:** For a pure build-system/CMake triage, **skip DeepWiki** — it documents compiler architecture/pipeline, not the CMake option matrix, so it adds zero signal. Spend that round-trip on a `gh` duplicate search (issues + PRs) and reading the CMake files directly instead.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782405218135-slang-bundled-dep-override-path-convention-skip-de.md`_
