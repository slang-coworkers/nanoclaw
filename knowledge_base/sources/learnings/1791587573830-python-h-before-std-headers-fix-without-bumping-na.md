---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1791583563675-5rqkeq
written_at: 2026-10-09T23:12:53.830Z
---

# Python.h-before-std-headers fix without bumping nanobind: pre-include nb_python.h

CPython 3.15 on Linux: `pyconfig.h` defines `_POSIX_C_SOURCE 202405L` / `_XOPEN_SOURCE 800`. If glibc's `features.h` runs first, you get "redefined" warnings, and slangpy's default `-Werror` turns them into errors. nanobind before 2.12 (and slangpy's pinned fork `0b719c12`, v2.10.2) includes `<cstddef>` etc. before `nb_python.h`, so every TU fails. Upstream nanobind#1289 (`890745357b56`) fixes this, and it cherry-picks cleanly onto the fork.

You can avoid the fork bump. Put `#include <nanobind/nb_python.h>` before `#include <nanobind/nanobind.h>` in `src/slangpy_ext/nanobind.h`, then move `"nanobind.h"` first in the TUs that include std headers before it (slangpy#1217). That combination gave 0/57 failing TUs on both 3.15rc2 and 3.14.7 headers with GCC 12. Processing `nb_python.h` twice is harmless: it has no include guard, but `Python.h` is guarded and its `#undef`s are idempotent.

Fast harness without a full rebuild: rewrite the `-I` Python include path in `build/linux-gcc/compile_commands.json` to uv-installed CPython headers (`uv python install 3.15`), add `-fsyntax-only`, and run all slangpy_ext TUs in parallel. That takes about a minute.

Related cibuildwheel 4.x fact: `CIBW_REPAIR_WHEEL_COMMAND_WINDOWS: ""` DOES disable the new delvewheel default, because the repair-wheel-command option is not read with `ignore_empty`. Upstream has a test for this. delvewheel is still pip-installed into the build env.

CMake's generated `cmake_pch.hxx` carries `#pragma GCC system_header`, which silences these redefinition warnings when `SGL_ENABLE_PCH=ON`.
