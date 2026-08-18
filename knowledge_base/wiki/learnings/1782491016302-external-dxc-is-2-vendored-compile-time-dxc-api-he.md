---
title: "external/dxc is 2 vendored compile-time DXC API headers, not a submodule"
type: learning
topic: slang-compiler
source: learnings/1782491016302-external-dxc-is-2-vendored-compile-time-dxc-api-he.md
---

# external/dxc is 2 vendored compile-time DXC API headers, not a submodule

**Context:** Triaging shader-slang/slang#11786 ("Remove external/dxc directory"), verified at master HEAD 1a0c2a6d1.

**Findings (non-obvious):**
- `external/dxc/` is NOT a git submodule. It is exactly two vendored Microsoft headers (~66 KB): `dxcapi.h` (DXC COM API entry points) and `WinAdapter.h` (Windows-type shim so dxcapi.h compiles on non-Windows). `dxcapi.h:37` includes `"WinAdapter.h"` with a **flattened** path (upstream DXC nests it under `dxc/Support/`), so the vendored copies are locally adapted — not a verbatim package drop-in.
- They are a **compile-time** dependency: `source/compiler-core/slang-dxc-compiler.cpp:38` `#include "../../external/dxc/dxcapi.h"` under `#if SLANG_ENABLE_DXIL_SUPPORT`. So `external/dxc` cannot be "simply deleted" — it's needed to build the compiler's DXC downstream integration.
- These C++ API headers are DISTINCT from what `cmake/FetchDXC.cmake` handles. FetchDXC downloads the DXC **runtime** binaries (dxcompiler/dxil .dll/.so, prebuilt or build-from-source) and stages DXC's **HLSL** headers (`dx/linalg.h`) via `_dxc_stage_hlsl_headers`. It does NOT provide dxcapi.h/WinAdapter.h.
- Only 2 repo references to external/dxc total: the include above + `REUSE.toml:36-40` (UOI-NCSA license, annotates only dxcapi.h — WinAdapter.h is a REUSE gap). No CI/workflow references.

**Key tradeoff for de-vendoring (the load-bearing point):** vendoring these tiny, years-stable headers keeps the core C++ compile fully decoupled from the DXC fetch (offline-buildable; works on platforms where FetchDXC early-returns, e.g. ARM Linux with no prebuilt). Sourcing the headers from the fetch instead would couple C++ compilation to a network fetch / 10-30 min source build and break those paths. So "download via CMake" is feasible but trades negligible cost for real build-robustness regressions. Related: #11441 (Add SLANG_USE_SYSTEM_DXC, Dev Reviewed) is the same DXC-as-external-dependency surface; #11441's body confirms "DXC releases ship only headers + libdxcompiler" (so the headers ARE in the packages).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782491016302-external-dxc-is-2-vendored-compile-time-dxc-api-he.md`_
