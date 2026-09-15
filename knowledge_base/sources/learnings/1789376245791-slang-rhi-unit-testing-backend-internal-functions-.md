---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789372194082-owf8jf
written_at: 2026-09-14T08:57:25.791Z
---

# slang-rhi: unit-testing backend-internal functions + Vulkan access-flag mapping

## slang-rhi GPU-free unit tests can call backend-internal functions directly

When `SLANG_RHI_BUILD_TESTS` is ON, slang-rhi builds **STATIC** (`SLANG_RHI_BUILD_SHARED` OFF is a
precondition for tests — see CMakeLists `if(SLANG_RHI_BUILD_TESTS AND NOT SLANG_RHI_BUILD_SHARED ...)`).
So the `slang-rhi-tests` binary links all internal symbols and a test can call functions like
`rhi::vk::calcAccessFlags` that are declared only in `src/vulkan/vk-utils.h` (not public API).

Pattern for a GPU-free unit test of a backend helper (no device needed):
- File `tests/test-<name>.cpp`, framework is **doctest** (`#include "testing.h"`, `TEST_CASE`, `CHECK`).
- Include the internal header via `#include "../src/<backend>/<hdr>.h"` (idiom: existing
  `test-static-vector.cpp` includes `../src/core/static_vector.h`; `src` is also on the test include path).
- Guard the whole thing in `#if SLANG_RHI_ENABLE_VULKAN` (or the relevant backend macro). Those macros
  come from the generated `slang-rhi-config.h` (`#cmakedefine01`), reachable in tests because
  `testing.h` includes `<slang-rhi.h>` which includes `<slang-rhi-config.h>`.
- **Register the new .cpp** in the `target_sources(slang-rhi-tests PRIVATE ...)` list in CMakeLists.txt —
  it is NOT globbed.
- Vulkan headers use `VK_NO_PROTOTYPES` (`vk-api.h`), so reading `VK_ACCESS_*` constants + calling a pure
  switch function needs no Vulkan loader/runtime.

## Build gotcha (headless / no-root env)
`cmake --preset default` fetches GLFW, whose configure aborts with "Xinerama headers not found" without
`libxinerama-dev` (+ xcursor/xi/xrandr). For a pure unit-test build with no windowing dependency, add
`-DSLANG_RHI_BUILD_TESTS_WITH_GLFW=OFF -DSLANG_RHI_BUILD_EXAMPLES=OFF`. Ninja Multi-Config: build with
`cmake --build build --config Debug --target slang-rhi-tests`; run one test with
`./build/Debug/slang-rhi-tests -tc="<case name>"`.

## Formatting
slang-rhi has NO `extras/formatting.sh`; it uses `.clang-format` (ColumnLimit 120) via pre-commit
pinned to clang-format **v20.1.7**. Local envs often only have clang-format-17 — for simple code the
output matches, but `clang-format-17 --dry-run -Werror <files>` is a cheap conformance check.

## The #859 bug pattern (Vulkan barrier access flags)
`calcAccessFlags(ResourceState::ShaderResource)` returned only `VK_ACCESS_INPUT_ATTACHMENT_READ_BIT`,
missing `VK_ACCESS_SHADER_READ_BIT`. ShaderResource = read-only shader access (storage buffers, uniform
texel buffers, sampled images) → needs SHADER_READ. Fix = union of both bits, mirroring D3D12's
`ShaderResource → PIXEL|NON_PIXEL_SHADER_RESOURCE`. When touching per-state access/stage masks, check the
sibling `d3d12-utils.cpp` mapping as the cross-backend sanity reference.
