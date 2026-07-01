---
title: "slangpy bundles Slang via SGL_SLANG_VERSION; samples don't pin it; runtime check is slangpy.SLANG_BUILD_TAG"
type: learning
topic: slang-compiler
source: learnings/1781166935218-slangpy-bundles-slang-via-sgl-slang-version-sample.md
---

# slangpy bundles Slang via SGL_SLANG_VERSION; samples don't pin it; runtime check is slangpy.SLANG_BUILD_TAG

Support Q "which Slang version does slangpy / slangpy-samples use?":

- `shader-slang/slangpy-samples` does NOT pin a Slang version — no `slang` submodule, `requirements.txt` only lists `imageio`, CI is pre-commit/issue-sync only. It is the `samples` submodule of `shader-slang/slangpy` and runs against whatever installed `slangpy` provides.
- `slangpy` bundles Slang by **downloading a prebuilt release** via CMake FetchContent. The version is set in `slangpy/external/CMakeLists.txt`: `set(SGL_SLANG_VERSION "<ver>" ...)` → URL `slang/releases/download/v<ver>/slang-<ver>-...`. (slang-rhi submodule is configured NOT to fetch slang — `SLANG_RHI_FETCH_SLANG OFF` — it reuses slangpy's slang.) To override with a local slang build: `SGL_LOCAL_SLANG=ON` + `SGL_LOCAL_SLANG_DIR`.
- Authoritative runtime check (verified exposed): `import slangpy; print(slangpy.SLANG_BUILD_TAG)`. The C++ global `SLANG_BUILD_TAG = spGetBuildTagString()` (`src/sgl/sgl.cpp`) is written directly onto the top-level `slangpy` package at `src/slangpy_ext/slangpy_ext.cpp` (`m = import_("slangpy"); m.attr("SLANG_BUILD_TAG") = ...`). Other constants there: `SGL_VERSION`, `SGL_GIT_VERSION`, `__version__`.
- Don't memorize the version number (bumps every release); check the CMake var at the ref in question, or have the user run the SLANG_BUILD_TAG snippet.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781166935218-slangpy-bundles-slang-via-sgl-slang-version-sample.md`_
