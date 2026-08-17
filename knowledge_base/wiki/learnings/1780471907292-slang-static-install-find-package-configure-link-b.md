---
title: "Slang static install: find_package configure ≠ link (BUILD_LOCAL_INTERFACE strips private deps)"
type: learning
topic: slang-compiler
source: learnings/1780471907292-slang-static-install-find-package-configure-link-b.md
---

# Slang static install: find_package configure ≠ link (BUILD_LOCAL_INTERFACE strips private deps)

When reviewing/fixing Slang CMake static-install packaging (e.g. shader-slang/slang#11359 / PR #11440, which removes the `if(NOT SLANG_LIB_TYPE STREQUAL "STATIC")` guard around `install(EXPORT SlangTargets)`):

**Removing the static export guard is safe for the export set** — since #6158, `slang_add_target` wraps private link deps in `$<BUILD_LOCAL_INTERFACE:...>` (CMake ≥3.26) / `$<BUILD_INTERFACE:...>` (fallback) at `cmake/SlangTarget.cmake:433-444`, so internal targets (`core`, `compiler-core`, `prelude`, `slang-capability-*`, `SPIRV-Headers`, …) are stripped from the installed/export link interface. `install(EXPORT)` therefore no longer errors with "not in any export set" on static builds. It also fixes a latent bug: `cmake/SlangConfig.cmake.in:5` unconditionally `include()`s `slangTargets.cmake` (non-Emscripten), so a static install that shipped `slangConfig.cmake` but no `slangTargets.cmake` broke `find_package(slang)`.

**The non-obvious trap — configure ≠ link.** That same `$<BUILD_LOCAL_INTERFACE>` stripping means the *installed* `slang::slang` carries effectively no internal link deps, and `core`/`compiler-core`/etc. are declared STATIC with **no `INSTALL`** keyword (not installed, not exported), and `libslang-compiler.a` does **not** whole-archive-merge them. So on a STATIC install:
- `find_package(slang REQUIRED CONFIG)` → **configures fine** (imported target defined, headers/slangc resolve).
- `target_link_libraries(app PRIVATE slang::slang)` → **link fails** with undefined refs to core/compiler-core symbols.

`docs/building.md:515-524` confirms consumers must manually add `libcompiler-core.a`/`libcore.a`/`libminiz.a`/`liblz4.a`; `extras/pkgconfig/slang-compiler.pc.in:12-13` notes `Libs.private` is empty (pkg-config --static unsupported).

**Why:** A "find_package(slang) → FOUND" verification proves only configure-depth, not linkability. Don't let a PR claim "fixes find_package on static installs" stand unqualified — it makes find_package *configure*; full static linkability needs install+export of internal deps, a whole-archive merge, or populated `Libs.private`.

**How to apply:** When verifying any Slang static-install fix, drive the smoke test past `find_package` configure into an actual `target_link_libraries(... slang::slang)` + build of a consumer. CI's `SLANG_LIB_TYPE=STATIC` matrix entry (`.github/cmake-options-matrix.json:54-57`) only builds — never installs — so this whole path is currently untested in CI.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780471907292-slang-static-install-find-package-configure-link-b.md`_
