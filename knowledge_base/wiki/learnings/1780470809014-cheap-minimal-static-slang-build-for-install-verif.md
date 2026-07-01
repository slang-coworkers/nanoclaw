---
title: "Cheap minimal static Slang build for install verification (skip DXC via SLANG_ENABLE_DXIL=OFF)"
type: learning
topic: slang-compiler
source: learnings/1780470809014-cheap-minimal-static-slang-build-for-install-verif.md
---

# Cheap minimal static Slang build for install verification (skip DXC via SLANG_ENABLE_DXIL=OFF)

When you need a real `cmake --install` of a statically-built Slang locally (e.g. verifying CMake packaging fixes like #11359) but want to avoid the full ~15-25 min build plus the DXC-from-source detour:

- On Linux with **glibc < 2.38**, Slang's configure builds **DXC from source** (~500 MB download + 10-30 min) because the prebuilt DXC needs newer glibc. This triggers even with `SLANG_ENABLE_GFX=OFF`/`SLANG_ENABLE_SLANG_RHI=OFF`.
- The switch that gates it is **`SLANG_ENABLE_DXIL`** (default ON). Configure with `-DSLANG_ENABLE_DXIL=OFF` and DXC is skipped entirely.
- Minimal static install config that builds only the `SlangTargets` export set (slang, slangc, slangi, slang-glsl-module, slang-dispatcher, slang-glslang, slang-rt) and installs cleanly:
  ```
  cmake -G "Ninja Multi-Config" -S . -B build-min \
    -DSLANG_LIB_TYPE=STATIC -DSLANG_SLANG_LLVM_FLAVOR=DISABLE \
    -DSLANG_ENABLE_DXIL=OFF -DSLANG_ENABLE_GFX=OFF -DSLANG_ENABLE_SLANG_RHI=OFF \
    -DSLANG_ENABLE_TESTS=OFF -DSLANG_ENABLE_REPLAYER=OFF -DSLANG_ENABLE_EXAMPLES=OFF
  cmake --build build-min --config Release   # ~9 min, no DXC
  cmake --install build-min --config Release --prefix /tmp/inst
  ```
  Then `find_package(slang REQUIRED CONFIG)` with `-G Ninja -DCMAKE_C/CXX_COMPILER=clang` (the default "Unix Makefiles" generator aborts at EnableLanguage if no make/compiler is present, even though find_package itself would pass).

Also: for CMake-packaging fixes, the export-set error "`<target> is not in any export set`" is a **generate-time** diagnostic — a clean `cmake -DSLANG_LIB_TYPE=STATIC` configure (exit 0, no such line) proves export safety without any build; inspect `build/cmake_install.cmake` to confirm which files the install will ship.

CI gap worth knowing: `.github/cmake-options-matrix.json` has a `SLANG_LIB_TYPE=STATIC` entry, but `.github/workflows/cmake-options-build.yml` only **builds** each entry — it never runs `cmake --install`, so static-install packaging is uncovered. Adding it requires a workflow-file edit (the nv-slang-bot App lacks `workflows` push permission, so split to a maintainer).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780470809014-cheap-minimal-static-slang-build-for-install-verif.md`_
