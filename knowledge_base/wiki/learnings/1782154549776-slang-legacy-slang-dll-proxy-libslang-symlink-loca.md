---
title: "slang legacy slang.dll proxy + libslang symlink: location and opt-out pattern"
type: learning
topic: slang-compiler
source: learnings/1782154549776-slang-legacy-slang-dll-proxy-libslang-symlink-loca.md
---

# slang legacy slang.dll proxy + libslang symlink: location and opt-out pattern

The temporary backward-compat shims from the slang→slang-compiler rename (tracked for end-2026 removal in #9203) live in **`source/slang/CMakeLists.txt`** as two adjacent, self-contained guarded blocks right after the main `slang` target (whose `OUTPUT_NAME` is `slang-compiler`):

- **Windows `slang.dll` proxy** — block ~L365–454. Guard `if(WIN32 AND SLANG_LIB_TYPE STREQUAL "SHARED")` (L369). Generates a stub .cpp + a .def from `slang-compiler.dll` exports, then `add_library(slang-proxy SHARED ...)` with `OUTPUT_NAME slang` (→ `slang.dll`), and `install(TARGETS slang-proxy ...)` (L443).
- **Unix `libslang` symlink** — block ~L456–483. Guard `if(UNIX AND SLANG_LIB_TYPE STREQUAL "SHARED")` (L459). POST_BUILD `create_symlink` → `libslang.{dylib,so}`, plus `install(FILES ...)` (L473).

(Line numbers as of HEAD 2b14ffd06, June 2026 — verify before editing.)

**To add an opt-out toggle (#11687 pattern):** one default-ON option ANDed into BOTH `if()` guards is the clean fix — `if(WIN32 AND SLANG_LIB_TYPE STREQUAL "SHARED" AND SLANG_ENABLE_SLANG_PROXY)` etc. Declare it in the **root `CMakeLists.txt`** near the other `SLANG_ENABLE_*` lines (~:158); `advanced_option(...)` matches the #11652 slang-glslang opt-out precedent, plain `option()` is equally valid. Per the house pattern, also add a `docs/building.md` option-table row and one `.github/cmake-options-matrix.json` entry.

**Gotcha:** the OFF variant is NOT exercised by a PR's own CI — `.github/cmake-options.yml` (consuming the matrix) configures+builds each option only on `workflow_dispatch` + weekly schedule, never on PRs. Verify OFF by local configure (Unix symlink path checkable on Linux; Windows proxy needs Windows configure or manual matrix dispatch).

Don't confuse this DLL "proxy" with the unrelated `source/slang-record-replay/proxy/*` capture/replay concept.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782154549776-slang-legacy-slang-dll-proxy-libslang-symlink-loca.md`_
