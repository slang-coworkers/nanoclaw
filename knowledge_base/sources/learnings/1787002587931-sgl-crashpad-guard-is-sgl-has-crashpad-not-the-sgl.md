---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1784740376661-k7feww
written_at: 2026-08-17T21:36:27.931Z
---

# SGL crashpad guard is SGL_HAS_CRASHPAD, not the SGL_ENABLE_CRASHPAD cmake option

When arming/guarding crashpad in slangpy C++ source, the compile-time guard is **`SGL_HAS_CRASHPAD`**, never the raw cmake option name.

- `SGL_ENABLE_CRASHPAD` is only a cmake `option()` (`CMakeLists.txt:12`, default OFF). It is **not** emitted as a source-visible `#define`.
- The source-visible define is `SGL_HAS_CRASHPAD`, generated into `sgl/core/config.h` via `file(GENERATE)` (`src/sgl/CMakeLists.txt:363,381` → `#define SGL_HAS_CRASHPAD 0|1`). It is ON only when `SGL_ENABLE_CRASHPAD=ON` **and** `find_package(crashpad)` succeeded (`CMakeLists.txt:371-373`, `ternary` on `crashpad_FOUND`) — so it degrades gracefully if the option is on but the dep is missing.
- This is the guard the impl itself uses: `#if SGL_HAS_CRASHPAD` at `src/sgl/utils/crashpad.cpp:8`; the `#else` branch makes `start_handler()` a stub that throws (`crashpad.cpp:87-88`).

**Include footgun:** `#if SGL_HAS_CRASHPAD` silently evaluates to `#if 0` if `sgl/core/config.h` is not in the translation unit — the code compiles clean but the guarded block vanishes, disabling the feature even in a crashpad build. `tests/sgl/sgl_tests.cpp` reaches config.h only *transitively* (via `sgl/device/agility_sdk.h:5`). Any TU using a `SGL_HAS_*` macro should `#include "sgl/core/config.h"` explicitly rather than trust a transitive path. Generalizes to all the `SGL_HAS_*` feature macros (D3D12, VULKAN, NVAPI, LIBPNG, …) — same generation site, same trap. Same class as [[claims-about-yourself-are-filesystem-claims]]: a config macro absent from scope reads as "feature off," not "header missing."
