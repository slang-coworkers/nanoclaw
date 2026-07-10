---
title: "slang#11985 2nd cause: slang-rhi FetchContent-downloads Vulkan-Headers despite vendored external/vulkan submodule"
type: learning
topic: slang-compiler
source: learnings/1783619348986-slang-11985-2nd-cause-slang-rhi-fetchcontent-downl.md
---

# slang#11985 2nd cause: slang-rhi FetchContent-downloads Vulkan-Headers despite vendored external/vulkan submodule

**Symptom:** shader-slang/slang macOS CI intermittently fails at the **CMake configure** step trying to download Vulkan-Headers. Maintainer asked "why download when we already have them in external/spirv-headers/?"

**Root cause (code-proven @ a97110a43):** TWO independent Vulkan-Headers sources in the build.
- Slang **core** vendors Vulkan-Headers with NO download: `external/CMakeLists.txt:145-159` does `add_subdirectory(vulkan)` on the `external/vulkan` submodule (`.gitmodules`: name `external/vulkan-headers`, path `external/vulkan`, KhronosGroup/Vulkan-Headers) → `Vulkan::Headers` target.
- **slang-rhi** (vendored submodule) independently NETWORK-fetches it: `external/slang-rhi/CMakeLists.txt:574-578` `FetchPackage(vulkan_headers URL .../Vulkan-Headers/archive/refs/tags/v1.4.318.zip)`, gated `if(SLANG_RHI_ENABLE_VULKAN)` which is ON for Darwin (`SLANG_RHI_HAS_VULKAN` :82-88). It builds its own `slang-rhi-vulkan-headers` INTERFACE target and never reuses `Vulkan::Headers`; Slang doesn't redirect the fetch. `FetchPackage` = wrapper over CMake `FetchContent` (external/slang-rhi/cmake/FetchPackage.cmake).

**Why intermittent on free runners:** CI never sets `SLANG_GITHUB_TOKEN` (0 hits in `.github/`), so `FetchPackage`'s auth-header branch is skipped → the GitHub archive fetch is ANONYMOUS. Anonymous github.com is rate-limited per source IP; free GitHub-hosted macOS runners share NAT'd IP pools → intermittent 403/timeout → configure fails. Network flake on an UNNECESSARY download.

**Correction to the common premise:** the vendored copy that makes the download redundant is `external/vulkan/` (**Vulkan-Headers**), NOT `external/spirv-headers/`. SPIR-V-Headers (KhronosGroup/SPIRV-Headers) is a SEPARATE Khronos upstream (SPIR-V enums/grammar), can't satisfy the Vulkan API-headers dep. Easy to conflate the two Khronos "headers" submodules.

**Fix (recommended A):** set `FETCHCONTENT_SOURCE_DIR_VULKAN_HEADERS` (CMake built-in override for the `vulkan_headers` FetchContent name) to `${CMAKE_SOURCE_DIR}/external/vulkan` before `add_subdirectory(slang-rhi)` → slang-rhi populates from the on-disk submodule, no network. GUARD: submodule pin VK_HEADER_VERSION 307 vs slang-rhi's v1.4.318 pin — bump submodule if a newer symbol is needed. Fallbacks: B (CI export SLANG_GITHUB_TOKEN + FetchContent cache/retry — symptom only), C (upstream slang-rhi: `if(NOT TARGET Vulkan::Headers) FetchPackage else reuse` — durable but cross-repo).

**General pattern:** when a vendored submodule (slang-rhi, glslang, etc.) does its OWN FetchContent for a dependency the parent already vendors, you get a redundant network dependency at configure time. `FETCHCONTENT_SOURCE_DIR_<UPPERCASE_NAME>` is the standard local-redirect escape hatch. Check for token-less anonymous GitHub fetches as an intermittency source in CI.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783619348986-slang-11985-2nd-cause-slang-rhi-fetchcontent-downl.md`_
