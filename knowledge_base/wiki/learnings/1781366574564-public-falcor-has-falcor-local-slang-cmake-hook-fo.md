---
title: "Public Falcor has FALCOR_LOCAL_SLANG CMake hook for a custom Slang build"
type: learning
topic: ci-tooling
source: learnings/1781366574564-public-falcor-has-falcor-local-slang-cmake-hook-fo.md
---

# Public Falcor has FALCOR_LOCAL_SLANG CMake hook for a custom Slang build

From triaging shader-slang/slang#11601 (add `extras/falcor.sh` to test Slang against public Falcor locally). Three non-obvious facts for any future "build/test Slang against Falcor" tooling:

1. **Public Falcor (NVIDIAGameWorks/Falcor) exposes CMake cache vars to use a LOCAL Slang build instead of its packman-pinned one** (pinned `2024.1.34` in `dependencies.xml`):
   - `FALCOR_LOCAL_SLANG` (BOOL) — enable local Slang.
   - `FALCOR_LOCAL_SLANG_DIR` — local Slang **source** dir.
   - `FALCOR_LOCAL_SLANG_BUILD_DIR` — local Slang **build** dir.
   When ON, Falcor's `deploy_dependencies` target (`deploycommon.bat`/`.sh`) copies Slang DLLs/SOs from those paths into `FALCOR_OUTPUT_DIRECTORY` = `build/<preset>/bin` (single-config) or `build/<preset>/bin/<CONFIG>` (multi-config). So a manual "copy Slang binaries into Falcor" install step is usually **unnecessary** — prefer the hook. (Source: DeepWiki on NVIDIAGameWorks/Falcor; verify against the live clone, DeepWiki can lag.)

2. **Don't redirect Slang's `CMAKE_RUNTIME_OUTPUT_DIRECTORY` to emit into an external dir for mix-Debug/Release.** `cmake/SlangTarget.cmake:204-285` honors a user-set value but forces ALL per-config dirs (DEBUG/RELEASE/...) to the SAME path → Debug and Release overwrite each other in one Ninja-Multi-Config tree. Use Falcor's `FALCOR_LOCAL_SLANG_BUILD_DIR` pointing at Slang's standard per-config `build/<cfg>/bin`, or `cmake --install --config <cfg> --prefix <dir>` (Slang wires `install(TARGETS)` + exports `SlangConfig.cmake` via `source/slang/CMakeLists.txt:285-286`).

3. **Falcor CI's install is just `cp` into a PREINSTALLED Falcor, not clone+build.** `.github/workflows/falcor-test.yml`: builds Slang with the functional flag set (`SLANG_SLANG_LLVM_FLAVOR=USE_SYSTEM_LLVM, CMAKE_COMPILE_WARNING_AS_ERROR=true, SLANG_ENABLE_CUDA=1, ENABLE_EXAMPLES=0, ENABLE_GFX=0, ENABLE_TESTS=0, EXCLUDE_DAWN=1, EXCLUDE_TINT=1, ENABLE_SLANG_RHI=0`, :48-59), uploads `build/Release/bin/`, then `cp --recursive --target-directory ./FalcorBin/build/windows-vs2022/bin/Release slang-bin/*` (:105-107) into a Falcor copied from `C:\Falcor`. Tests: `run_unit_tests.py --config windows-vs2022-Release -t "-slow"` + `run_image_tests.py --config windows-vs2022-Release --run-only`. CI is Windows-only; a clone+build script (esp. on Linux bots) must instead use the FALCOR_LOCAL_SLANG hook (#1) since fresh Falcor pulls its own Slang via packman.

Closest existing precedent for the script: `extras/repro-remix.sh` (clone dxvk-remix, packman-disable Slang dep + `cp build/.../bin/*`, `set -eu` no pipefail). `.gitignore` convention for external clones = per-clone explicit lines at `.gitignore:86-91` (add `/external/falcor/`).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1781366574564-public-falcor-has-falcor-local-slang-cmake-hook-fo.md`_
