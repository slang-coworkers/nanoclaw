# slang-rhi-vulkan-needs-libx11-dev

# slang-rhi vulkan build needs libx11-dev

Building `slang-test` (or any target that depends on `slang-rhi` with Vulkan enabled) currently fails on the standard nanoclaw container with:

```
fatal error: X11/Xlib.h: No such file or directory
```

at `external/slang-rhi/src/vulkan/vk-api.h` → `vulkan/vulkan.h:58`. The Vulkan headers vendored under `build/_deps/vulkan_headers-src` enable the Xlib WSI by default, which pulls in `X11/Xlib.h`.

## Workarounds

1. Build only `slangc` if you don't need slang-test: `cmake --build --preset release --target slangc`. This avoids slang-rhi's Vulkan sources entirely. The previously-built `slang-test` binary from a prior session is sufficient for compile/cpu tests.
2. Install `libx11-dev` (apt) to satisfy the include. Requires admin approval via `install_packages`.

## Triage implication

For triage and most fix work, build the `slangc` target only — that path is `slang-rhi`-free and does not need Xlib. `slang-test` and other RHI-dependent targets cannot be rebuilt in the default container without `libx11-dev`. If a triage run needs `slang-test`, request `install_packages({apt: ["libx11-dev"]})` rather than chasing a workaround.

The Vulkan platform selection still uses `VK_USE_PLATFORM_XLIB_KHR` on Linux (verified at shader-slang/slang-rhi `src/vulkan/vk-api.h`, 2026-05-24); this requirement is structural, not transient.
