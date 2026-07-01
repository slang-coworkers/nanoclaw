---
title: "CONSOLIDATED: slang-rhi Vulkan build needs libx11-dev (X11/Xlib.h)"
type: learning
topic: slang-compiler
source: learnings/1780330247261-CONSOLIDATED-slang-rhi-vulkan-build-needs-libx11-dev.md
---

# CONSOLIDATED: slang-rhi Vulkan build needs libx11-dev (X11/Xlib.h)

Building any target that pulls in `slang-rhi` with Vulkan enabled (`slang-test` and all RHI-dependent targets) fails on a stock container with:

```
fatal error: X11/Xlib.h: No such file or directory
```

at `external/slang-rhi/src/vulkan/vk-api.h` → vendored `vulkan/vulkan.h:58`. `vk-api.h` unconditionally `#define VK_USE_PLATFORM_XLIB_KHR 1`, so the bundled Vulkan headers (`build/_deps/vulkan_headers-src/...`) include `<X11/Xlib.h>`. Runtime `libx11` is present but `libx11-dev` (the header) is not. This is **structural, not transient** (verified at shader-slang/slang-rhi `src/vulkan/vk-api.h`). The break lands ~55% in (target ~876/1149); grep `error:` in the build log first — it's easy to misread as a Slang compile error rather than a missing sandbox dep.

## Status (slang-fixer): already fixed
`libx11-dev` is in slang-fixer's persistent config (`packages_apt: ["libx11-dev"]`) as of 2026-05-29 — see `1780060974231-ncl-group-container-fixes-bookworm-package-gaps-ap.md`. The workarounds below are for OTHER agent images, or as a fallback when libx11-dev is missing.

## Fixes / workarounds (in preference order)
1. **Install the dev package** (durable): `install_packages({ apt: ["libx11-dev"] })` (admin approval → image rebuild). Bundle related needs in one request: `libx11-dev libxcb1-dev` (+ `libxrandr-dev` if WSI-XRandR), and the formatters CI expects (`clang-format-17` — Bookworm has no generic `clang-format` and only `-17`, not `-18`; `gersemi prettier shfmt`). A prior request bundling `clang-format-18` failed for this reason.
2. **Ad-hoc apt** (sudo is passwordless): `sudo apt-get update && sudo apt-get install -y libx11-dev`, then rerun the incremental build (`cmake --build --preset debug --target ...`) — ninja resumes.
3. **Build slangc only, skip slang-rhi** (no install needed): `cmake --build --preset <release|debug> --target slangc`. Sufficient for filecheck/diagnostic tests (invoke slangc directly, grep output). `slang-test` does NOT build this way (the runner depends on slang-rhi); note in the PR body that runner verification was deferred to CI. To drop slang-rhi entirely at configure time: `-DSLANG_ENABLE_TESTS=OFF -DSLANG_ENABLE_SLANG_RHI=OFF -DSLANG_ENABLE_GFX=OFF -DSLANG_ENABLE_EXAMPLES=OFF`.
4. **No-sudo header stub:** a 4-line `X11/Xlib.h` (typedefs `Display`, `Window`, `VisualID`) under `build/_deps/vulkan_headers-src/include/X11/`. Build-dir only, never committed, never linked at runtime (CPU-only slang-rhi test runs don't use Xlib).

## Caveat (2026-05-21, slang#10747)
After a successful slangc-only partial build, the resulting `slangc` exited 1 silently on every invocation (incl. `-help`/`-version`). Never root-caused (`LD_DEBUG`, `SLANG_ASSERT` variants, split stdout/stderr — none surfaced it). Time-box this at ~10 min; if it's environment-side, pivot to upstream-CI evidence for endorsement rather than chasing the local binary.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780330247261-CONSOLIDATED-slang-rhi-vulkan-build-needs-libx11-dev.md`_
