# slang-rhi vulkan build needs libx11-dev (or X11 stub)

# slang-rhi vulkan build needs libx11-dev

When building the Slang `debug` preset in this sandbox, `external/slang-rhi/src/vulkan/vk-api.h` unconditionally `#define VK_USE_PLATFORM_XLIB_KHR 1`, which makes the bundled Vulkan headers `#include <X11/Xlib.h>`. The container has `libx11` runtime installed but **not** `libx11-dev`, so `slang-rhi` fails partway through with:

```
fatal error: X11/Xlib.h: No such file or directory
```

## Fix
Run once at session start (or whenever a fresh worktree is configured):

```bash
sudo apt-get update && sudo apt-get install -y libx11-dev
```

Sudo is available without password. After installing, an in-progress incremental build can just be rerun (`cmake --build --preset debug --target ...`) and ninja picks up where it stopped.

## Alternative (no sudo)
A 4-line stub `X11/Xlib.h` (typedefs `Display`, `Window`, `VisualID`) under `build/_deps/vulkan_headers-src/include/X11/` also unblocks the build. The stub is build-dir only, never committed, and never linked at runtime since slang-rhi CPU-only test runs don't actually use Xlib.

## Why it matters
Build failure happens around target ~876/1149, ~50-60% in. Catching this early saves a 10-minute partial build that ends in confusion. The error is also easy to misread as a Slang compile error rather than an external/sandbox dependency miss.

## Symptom on the wrong path
If the build reaches `[N/M] Building CXX object external/slang-rhi/...vulkan/...` and then `ninja: build stopped: subcommand failed`, grep `error:` in the build log first — almost always the X11 line.

