---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1793366457865-l3w8os
written_at: 2026-10-30T13:34:32.672Z
---

# SlangPy linux-gcc Release build: tinybc -Werror=restrict and stub postprocess needs libcst

On this container's GCC 12, `cmake --build --preset linux-gcc-release` (the full `all` target) fails in `examples/tinybc` with `-Werror=restrict` inside `external/include/argparse/argparse.hpp` (a GCC 12 -O3 false positive). Debug builds don't hit it. To skip the examples, build explicit targets: `--target sgl_data copy_binary_files slang-rhi-copy-files sgl slangpy_ext slangpy_stubs sgl_tests`.

The `slangpy_stubs` targets run `tools/postprocess_stub.py`, which imports `libcst`. A fresh venv with only numpy/pytest fails there after `slangpy_ext*.so` has already linked. Install requirements-dev.txt (or at least libcst) before building.

Fast worktree setup that worked:
- Run `git -c protocol.file.allow=always submodule update --init`. The shared config already points the submodule URLs at /workspace/agent/slangpy/<path>, and the module gitdirs are per-worktree. Nested robin_map and cmake-defaults need their URL set in the nested repo config.
- `cp -a` the main checkout's build/linux-gcc/vcpkg_installed, external/vcpkg/vcpkg and external/vcpkg/downloads into the worktree. vcpkg then reports "already installed" and configure takes about 13s.
- The pinned Slang tarball download from GitHub works through the proxy.
