---
title: "Building slangpy from source in the fixer container: python3-dev, PEP-668, torch bridge, submodule/ENOSPC gotchas"
type: learning
topic: slang-compiler
source: learnings/1782324519820-building-slangpy-from-source-in-the-fixer-containe.md
---

# Building slangpy from source in the fixer container: python3-dev, PEP-668, torch bridge, submodule/ENOSPC gotchas

Building the slangpy native extension on the slangpy-fixer GPU box (L40S, linux-gcc, Ninja Multi-Config), verified 2026-06-24:

- **Needs `python3-dev`/`python3.11-dev`** (admin `install_packages` apt). Without it CMake `find_package(Python ... Development.Module)` fails ("missing Python_INCLUDE_DIRS"), nanobind can't compile. nvcc is NOT required (CUDA backend uses the driver API at runtime). libx11-dev + libvulkan loader are already present.
- **PEP-668 (externally-managed):** every `pip install` needs `--break-system-packages`. `python3 tools/ci.py install-slangpy-torch` FAILS because its internal `pip install wheel` / `pip install src/slangpy_torch` omit the flag — install the torch bridge manually: `pip install --break-system-packages wheel && pip install --break-system-packages --no-build-isolation ./src/slangpy_torch`.
- **After a container rebuild** (any install_packages call) the image's pip site-packages reset — reinstall `requirements-dev.txt` (numpy, pytest, pytest-xdist) with `--break-system-packages`. The /workspace worktree (submodules, vcpkg cache, build dir) persists across rebuild; pip packages do not.
- **slangpy_torch import** needs `import torch` first in-process or you get `ImportError: libc10.so` (LD_LIBRARY_PATH). Tests/probes that import torch before using the bridge are fine.
- **Interrupted (ENOSPC) submodule checkout** leaves a gitlink with an EMPTY working tree, yet `git submodule status` reports it "initialized" so `git submodule update --init` skips it → configure dies ("external/tevclient does not contain a CMakeLists.txt"). Fix: `git submodule update --init --force --recursive`.
- **Disk:** vcpkg build is ~21 min and ~1GB; `build/buildtrees` (vcpkg intermediates) is regenerable — safe to `rm -rf` after configure to reclaim ~765MB. Build only the `slangpy_ext` target (`cmake --build build/linux-gcc --config Release --target slangpy_ext`, ~304 steps) to skip the heavy C++ test/example binaries; it links straight to `slangpy/slangpy_ext.cpython-*.so`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782324519820-building-slangpy-from-source-in-the-fixer-containe.md`_
