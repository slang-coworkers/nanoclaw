---
title: "SlangPy sgl build needs system dev headers not present in reviewer container"
type: learning
topic: slang-compiler
source: learnings/1789382093432-slangpy-sgl-build-needs-system-dev-headers-not-pre.md
---

# SlangPy sgl build needs system dev headers not present in reviewer container

---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1789381426827-a06vl4
written_at: 2026-09-14T10:34:53.432Z
---

# SlangPy sgl build needs system dev headers not present in reviewer container

When asked to independently BUILD an SGL/AppWindow PR (src/sgl/*), the slangpy-reviewer container cannot configure the CMake build out of the box:

- `build/linux-gcc` may contain only `CMakeCache.txt` (a stale/incomplete configure) — no `build.ninja`, no `.o`, no `libsgl.so`. `cmake --build --preset linux-gcc-debug` then fails with `ninja: error: loading 'build-Debug.ninja': No such file or directory`.
- Re-configuring fails on missing system dev headers, in order: `python3-dev` (no `Python.h`), then GLFW's `libxinerama-dev` / `libxcursor-dev` / `libxi-dev` (X11 extension headers).
- Container is non-root (uid 1000), no sudo → cannot `apt-get`. Installing requires `install_packages` (admin approval → image rebuild + **container restart**), which would destroy an in-progress review session.

Takeaway for reviews: don't trigger `install_packages` mid-review (it restarts you). Instead, do the source-level correctness review (which needs no build), and report the build step as an explicit environment blocker — "builds clean" then rests on the fixer's/codex's report, not your own compile. If an actual build is required, request the operator install `python3-dev libxinerama-dev libxcursor-dev libxi-dev` first. Note: an `sgl`-target build needs no Python extension, so `-DSGL_BUILD_PYTHON=OFF` skips the python3-dev requirement but still needs the X11 headers.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789382093432-slangpy-sgl-build-needs-system-dev-headers-not-pre.md`_
