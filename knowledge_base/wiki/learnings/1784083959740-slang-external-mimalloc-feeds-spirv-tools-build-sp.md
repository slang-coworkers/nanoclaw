---
title: "slang external/mimalloc feeds SPIRV-Tools' build; spirv-tools DEPS is NOT a CMake input"
type: learning
topic: slang-compiler
source: learnings/1784083959740-slang-external-mimalloc-feeds-spirv-tools-build-sp.md
---

# slang external/mimalloc feeds SPIRV-Tools' build; spirv-tools DEPS is NOT a CMake input

Resolved during shader-slang/slang#12102 (vendor mimalloc as submodule, drop the configure-time git clone). Two reusable facts for any future mimalloc / spirv-tools / "two versions in one build" triage:

**1. Coupling: there is exactly ONE mimalloc in a Slang build, whatever Slang pins.** When SPIRV-Tools is built as a subdirectory inside Slang, it does NOT fetch its own mimalloc. Slang's `external/CMakeLists.txt` sets `mimalloc_SOURCE_DIR = ${MIMALLOC_PATH}` (Slang's own `external/mimalloc`) and `SPIRV_TOOLS_USE_MIMALLOC` BEFORE `add_subdirectory(spirv-tools)`. SPIRV-Tools' `external/CMakeLists.txt` then does `if(DEFINED mimalloc_SOURCE_DIR) → set(MIMALLOC_DIR ${mimalloc_SOURCE_DIR}) → add_subdirectory(${MIMALLOC_DIR})` — so both Slang and SPIRV-Tools link the SAME single `mimalloc-static` target built from Slang's submodule.

**2. `external/spirv-tools/DEPS` `mimalloc_revision` is a gclient/gn field, NEVER read by CMake.** It's how KhronosGroup's standalone CI fetches mimalloc; it is inert when spirv-tools is built inside Slang. So "match whatever spirv-tools uses" (a maintainer instruction here) means reading the DEPS commit for reference, but pinning Slang's `external/mimalloc` to a DIFFERENT commit than DEPS names is NOT a two-versions mismatch — there's one version, whatever Slang's submodule pins.

**Corollary — verify tag→commit yourself, and version-decode:** mimalloc tags are ANNOTATED (tag object ≠ commit). Deref with `git ls-remote <repo> 'refs/tags/vX.Y.Z^{}'`. Decode the line via `include/mimalloc.h` `MI_MALLOC_VERSION` (e.g. 20302 = v2.3.2 = 2.x line). This chain had a maintainer name "3.3.2" then "match spirv-tools" (which resolved to 2.3.2 `fef6b0dd`), then a SECOND maintainer report a measured perf regression in BOTH 2.3.2 and 3.3.2 → reconciled on v2.1.7 `8c532c32c3c96e5ba1f2283e032f69ead8add00f` (the original pre-#12036 pin). Also: `mimalloc-static` target name is unchanged across 2.1.7/2.3.2/3.3.2, so the `target_link_libraries(slang PRIVATE mimalloc-static)` from #12036 is version-agnostic.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784083959740-slang-external-mimalloc-feeds-spirv-tools-build-sp.md`_
