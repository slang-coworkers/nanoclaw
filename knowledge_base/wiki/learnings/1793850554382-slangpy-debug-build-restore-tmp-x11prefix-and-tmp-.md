---
title: "SlangPy Debug build: restore /tmp/x11prefix and /tmp/pyheaders after a container restart"
type: learning
topic: slang-compiler
source: learnings/1793850554382-slangpy-debug-build-restore-tmp-x11prefix-and-tmp-.md
---

# SlangPy Debug build: restore /tmp/x11prefix and /tmp/pyheaders after a container restart

---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1793850132806-n9s7rf
written_at: 2026-11-05T03:49:14.382Z
---

# SlangPy Debug build: restore /tmp/x11prefix and /tmp/pyheaders after a container restart

The slangpy-reviewer build cache (build/linux-gcc/CMakeCache.txt) points CMAKE_INCLUDE_PATH / X11_* at /tmp/x11prefix and Python_INCLUDE_DIR at /tmp/pyheaders. /tmp is wiped on container restart, so the next incremental build fails in glfw (`X11/Xcursor/Xcursor.h: No such file`) and then in nanobind (`Python.h`). Restore without root:

```
mkdir -p /tmp/apt/lists/partial /tmp/apt/cache/archives/partial /tmp/x11debs
APTO="-o Dir::State::Lists=/tmp/apt/lists -o Dir::Cache=/tmp/apt/cache"
apt-get $APTO -o Debug::NoLocking=1 update
cd /tmp/x11debs; for p in libxcursor-dev libxfixes-dev libxi-dev libxinerama-dev libxkbcommon-dev libpython3.11-dev; do apt-get $APTO download $p; done
for d in lib[xX]*.deb; do dpkg -x "$d" /tmp/x11prefix; done
cd /tmp/x11prefix/usr/lib/x86_64-linux-gnu; for f in libXcursor.so.1.0.2 libXfixes.so.3.1.0 libXi.so.6.1.0 libXinerama.so.1.0.0 libxkbcommon.so.0; do ln -sf /usr/lib/x86_64-linux-gnu/$f $f; done
dpkg -x /tmp/x11debs/libpython3.11-dev_*.deb /tmp/pyheaders
cp /tmp/pyheaders/usr/include/x86_64-linux-gnu/python3.11/pyconfig.h /tmp/pyheaders/usr/include/python3.11/pyconfig.h
```
Download packages one at a time: `apt-get download` fails when the list includes an already-installed package.

Second lesson: several sessions of the same coworker group share /workspace/agent/slangpy. A `git checkout` there can switch the branch under another session's build or tests (seen 2026-11-05: #1263 and #1264 reviews collided). Review each PR in its own `git worktree` with its own build dir.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793850554382-slangpy-debug-build-restore-tmp-x11prefix-and-tmp-.md`_
