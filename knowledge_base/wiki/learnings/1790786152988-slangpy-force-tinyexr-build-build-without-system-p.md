---
title: "SlangPy: force TinyEXR build + build without system Python headers (Linux)"
type: learning
topic: slang-compiler
source: learnings/1790786152988-slangpy-force-tinyexr-build-build-without-system-p.md
---

# SlangPy: force TinyEXR build + build without system Python headers (Linux)

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1790785183867-c2khc8
written_at: 2026-09-30T16:35:52.988Z
---

# SlangPy: force TinyEXR build + build without system Python headers (Linux)

- `-DCMAKE_DISABLE_FIND_PACKAGE_OpenEXR=ON` alone FAILS configure: CMakeLists.txt:373 `ternary(SGL_HAS_OPENEXR ${OpenEXR_FOUND} ON OFF)` gets an empty arg ("ternary Macro invoked with incorrect arguments"). Add `-DOpenEXR_FOUND=OFF` too; then config.h shows `#define SGL_HAS_OPENEXR 0`.
- Container has no Python.h: `curl` libpython3.11-dev / python3.11-dev / libpython3.11 `_3.11.2-6+deb12u8_amd64.deb` from http://deb.debian.org/debian/pool/main/p/python3.11/, `dpkg -x` into a dir R, pass `-DPython_INCLUDE_DIR=$R/usr/include/python3.11 -DPython_LIBRARY=$R/usr/lib/x86_64-linux-gnu/libpython3.11.so`, and `export CPATH=$R/usr/include` (pyconfig.h includes `<x86_64-linux-gnu/python3.11/pyconfig.h>`).
- Worktree submodules without network: `git -c protocol.file.allow=always -c submodule.external/X.url=<main>/.git/modules/external/X submodule update external/X` (nested: nanobind ext/robin_map, nanothread ext/cmake-defaults need `--init` inside them; the `data` submodule IS required — cmrc embeds data/fonts). Reuse vcpkg: `-DVCPKG_INSTALLED_DIR=<other build>/vcpkg_installed -DVCPKG_MANIFEST_INSTALL=OFF` when vcpkg.json/triplets/overlays/vcpkg commit match. slangpy_ext Release built in ~40s at -j60.
- Python 3.11 `PyErr_SetString` with invalid UTF-8 yields a bare `RuntimeError()` (no args) — an empty RuntimeError from a nanobind call hints the C++ what() contained garbage bytes (e.g. use-after-free of an error string).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790786152988-slangpy-force-tinyexr-build-build-without-system-p.md`_
