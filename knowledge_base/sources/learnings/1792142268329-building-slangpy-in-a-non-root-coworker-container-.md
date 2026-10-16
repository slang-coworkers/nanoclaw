---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1792141451732-lkncyn
written_at: 2026-10-16T09:17:48.329Z
---

# Building SlangPy in a non-root coworker container (no python3-dev / X11 dev headers)

The container has no Python.h or libxinerama/libxcursor/libxi dev headers and no sudo, but `apt-get download` + `dpkg -x` works without root:

```
mkdir -p /tmp/apt/lists/partial /tmp/apt/cache/archives/partial /tmp/debs && cd /tmp/debs
apt-get -o Dir::State::Lists=/tmp/apt/lists -o Dir::Cache=/tmp/apt/cache -o Debug::NoLocking=1 update
apt-get -o Dir::State::Lists=/tmp/apt/lists -o Dir::Cache=/tmp/apt/cache download libpython3.11-dev python3.11-dev libxinerama-dev libxcursor-dev libxi-dev libxinerama1 libxcursor1 libxi6 libxfixes-dev libxrender-dev
for f in *python3.11-dev*.deb; do dpkg -x $f /tmp/pyheaders; done; for f in libx*.deb; do dpkg -x $f /tmp/x11prefix; done
export CPATH=/tmp/pyheaders/usr/include:/tmp/x11prefix/usr/include   # pyconfig.h includes <x86_64-linux-gnu/python3.11/pyconfig.h>
cmake --preset linux-gcc -DPython_EXECUTABLE=<venv>/bin/python -DPython_INCLUDE_DIR=/tmp/pyheaders/usr/include/python3.11 -DCMAKE_INCLUDE_PATH=/tmp/x11prefix/usr/include -DCMAKE_LIBRARY_PATH=/tmp/x11prefix/usr/lib/x86_64-linux-gnu
cmake --build --preset linux-gcc-release --target slangpy_ext
```
/tmp is wiped between sessions, so redo the extraction every time. For a fresh git worktree, copy `external/vcpkg/vcpkg` (the gitignored bootstrap binary) and `build/linux-gcc/vcpkg_installed` from the main checkout to skip the vcpkg bootstrap and dependency build. A full `cmake --build` fails in `examples/tinybc` with GCC 12 `-Werror=restrict` (a false positive in argparse.hpp). That failure is pre-existing and unrelated to slangpy_ext, so build `--target slangpy_ext` instead. The .so lands in `<worktree>/slangpy/`, so `PYTHONPATH=<worktree>` is all you need. Clean Release build of slangpy_ext on 64 cores: about 90 s.
