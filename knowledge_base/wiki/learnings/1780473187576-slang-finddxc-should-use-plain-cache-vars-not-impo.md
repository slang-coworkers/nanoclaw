---
title: "Slang FindDXC should use plain cache-vars not IMPORTED target — DXC is dlopen+copy, never linked"
type: learning
topic: slang-compiler
source: learnings/1780473187576-slang-finddxc-should-use-plain-cache-vars-not-impo.md
---

# Slang FindDXC should use plain cache-vars not IMPORTED target — DXC is dlopen+copy, never linked

For any CMake work adding a `SLANG_USE_SYSTEM_DXC` / `FindDXC.cmake` to shader-slang/slang (issue #11441), the right design is **plain cache vars + re-emit the existing custom targets**, NOT a modern `IMPORTED` target (`DXC::dxcompiler`). The "modern CMake = IMPORTED" reflex is wrong here.

**Why (verified against master `FetchDXC.cmake`):**
- Nothing **links** against DXC. `slangc`/`slang-test` `dlopen` `libdxcompiler` at runtime; the build's only interaction is a **file copy**.
- `FetchDXC.cmake`'s output contract to the rest of the build is the **custom targets** `copy-dxcompiler`, `copy-dxil`, `stage-dxc-headers` (consumed by name via `add_dependencies(slangc ...)` and `slang-test` `OPTIONAL_REQUIRES`). There is no `DXC_*` path cache-var and no IMPORTED target today.
- The copy is `cmake -E copy_if_different "<literal src path>" "<dst>"` — a path string, **not** `$<TARGET_FILE:...>`. No DXC artifact is a real CMake target, so `$<TARGET_FILE>` is unavailable anyway.
- All three sibling hand-written Find modules use plain cache vars, no IMPORTED targets: `FindNVAPI` (`NVAPI_INCLUDE_DIRS`/`NVAPI_LIBRARIES`), `FindAftermath` (`Aftermath_INCLUDE_DIRS`/`Aftermath_LIBRARIES`), `FindOptiX` (`OptiX_INCLUDE_DIRS`, header-only).

So: `FindDXC.cmake` → `find_path`+`find_library`+`find_package_handle_standard_args` exposing cache vars (`DXC_INCLUDE_DIRS`/`DXC_DXCOMPILER_LIBRARY`/`DXC_DXIL_LIBRARY`), then re-emit the SAME `copy-dxcompiler`/`copy-dxil`/`stage-dxc-headers` targets from the found paths → downstream wiring needs zero changes. An IMPORTED target's only value (propagating link/usage requirements) never applies to a dlopen+copy dep.

**Related design calls settled on #11441 (2026-06-03):** (1) system-DXC is NOT redundant with source-build — precedence `SLANG_USE_SYSTEM_DXC > SLANG_DXC_BUILD_FROM_SOURCE > SLANG_DXC_BINARY_URL > auto-detect/download`, and when system is ON skip `include(FetchDXC)` entirely. (2) version mismatch policy = WARN (print detected vs pinned `v1.9.2602`), FATAL only for missing-required (`dxcompiler` always; `dxil` Windows-only, optional elsewhere — that's the staging relaxation). Note `SLANG_DXC_BUILD_FROM_SOURCE`/`SLANG_DXC_BINARY_URL` are plain vars read inside FetchDXC, NOT declared options; `SLANG_DXC_BUILD_FROM_SOURCE` is tri-state (ON/OFF/unset). DXC version is hard to detect at configure time (no compile-time constant; canonical query is runtime COM `IDxcVersionInfo`), so version check must be best-effort.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780473187576-slang-finddxc-should-use-plain-cache-vars-not-impo.md`_
