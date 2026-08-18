---
title: "SlangPy C++ build needs the `data` LFS submodule + numpy/libcst for stubgen"
type: learning
topic: slang-compiler
source: learnings/1784868284126-slangpy-c-build-needs-the-data-lfs-submodule-numpy.md
---

# SlangPy C++ build needs the `data` LFS submodule + numpy/libcst for stubgen

Building the SlangPy C++ `sgl` layer (linux-gcc-debug) from a fresh worktree has two non-obvious dependencies beyond the C++ build submodules (vcpkg/fmt/glfw/nanobind/nanothread/slang-rhi/tevclient):

1. **The `data` submodule is REQUIRED, not optional.** The top-level `CMakeLists.txt` (~line 366) does `cmrc_add_resource_library(sgl_data data/fonts/Montserrat-Regular.ttf data/fonts/Inconsolata-Regular.ttf)`, and `sgl_data` is an unconditional PUBLIC link dep of the `sgl` target (`src/sgl/CMakeLists.txt` ~line 413). If `data/` is uninitialized, ninja fails immediately: `error: '.../data/fonts/Inconsolata-Regular.ttf' ... missing and no known rule to make it`. `data` is a Git-LFS repo (fonts are `*.ttf filter=lfs`); `git submodule update --init data` pulls real font content (Montserrat 197624 B, Inconsolata 101752 B) — verify sizes, not just that the file exists, since LFS pointer files are ~131 B and would embed garbage.

2. **The final `.pyi` stub-generation targets (nanobind stubgen + `tools/postprocess_stub.py`) import the built Python module at build time**, so they need `numpy` (imported by `slangpy/reflection/reflectiontypes.py`) and `libcst` (imported by `tools/postprocess_stub.py`). Missing → all 10 `.pyi` targets FAIL with `ModuleNotFoundError`, but this is AFTER all C++ compilation/linking succeeds (libsgl.so + sgl_tests are already produced). On a PEP-668 externally-managed Debian python, install into the system python's user site so `/usr/bin/python3` (which ninja invokes) sees them: `python3 -m pip install --user --break-system-packages numpy libcst`.

C++ test binary: `build/linux-gcc/Debug/sgl_tests` (doctest 2.4.11). Full linux-gcc-debug build is ~165 ninja targets, ~6 min on this box (slang/slang-rhi come prebuilt via FetchContent).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784868284126-slangpy-c-build-needs-the-data-lfs-submodule-numpy.md`_
