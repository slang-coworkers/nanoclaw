---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1785193405041-bcwn14
written_at: 2026-08-18T18:56:25.346Z
---

# Building SlangPy headless on a rootless Linux box (issue #827 repro)

Building SlangPy at HEAD on a rootless Linux container (no sudo/apt-install) for a headless GPU repro. Several non-obvious blockers, all solvable in userspace:

1. **Python dev headers missing.** System `python3.11` has no `Python.h`; cmake's `find_package(Python ... Development.Module)` fails. Fix without root: `uv python install 3.11` fetches a python-build-standalone CPython that *ships* `include/python3.11/Python.h`. Make a venv from it (`uv venv --python <that python>`), install deps with `uv pip` (NOTE: uv venvs have **no `pip` module** — `python -m pip ...` fails, so `tools/ci.py install-slangpy-torch` breaks; use `uv pip install ./src/slangpy_torch --no-build-isolation` instead).

2. **GLFW forces X11 on Linux (glfw 3.3.10, no Null platform).** `sgl` core lib links glfw unconditionally, and `slangpy_ext`→`sgl`, so even a headless build needs X11 *dev* headers. Missing on the box: `Xinerama.h`, `Xcursor/Xcursor.h`, `XInput2.h` + dev `.so` symlinks (runtime `.so.N` exist). Fix without root: `curl` the bookworm `-dev` debs from `deb.debian.org/debian/pool/main/libx/...` (libxinerama-dev, libxcursor-dev, libxi-dev, libxfixes-dev), `dpkg-deb -x` into a prefix, repoint the extracted `libX*.so` symlinks to the absolute `/usr/lib/x86_64-linux-gnu/libX*.so.N`, then `cmake --preset linux-gcc --fresh -DCMAKE_PREFIX_PATH=<prefix>/usr -DCMAKE_INCLUDE_PATH=... -DCMAKE_LIBRARY_PATH=...`.

3. **`examples/tinybc` fails to compile under gcc 12** with a spurious `-Werror=restrict` in libstdc++ `char_traits.h`. This aborts the full `cmake --build`. The Python extension is unaffected — just build the target directly: `cmake --build build/linux-gcc --config Release --target slangpy_ext`.

4. **Import path:** `slangpy_ext.<pyver>.so` is emitted into the *source* `slangpy/` package dir (SLANGPY_PACKAGE_DIR), so `PYTHONPATH=/workspace/agent/slangpy python3 ...` imports it; other .so's are found via rpath to `build/linux-gcc/Release`.

5. **Repro must use `spy.create_device(...)`, not raw `spy.Device(...)`** — only create_device injects the `slangpy/slang` include path so `import slangpy;`/`ITensor` resolve. And torch-tensor args need `slangpy_torch` installed OR `SLANGPY_ALLOW_TORCH_FALLBACK=1`.
