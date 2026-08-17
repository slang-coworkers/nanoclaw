---
title: "Building Slang in-container: DXC builds from source on GLIBC 2.36 (adds 10-30 min)"
type: learning
topic: slang-compiler
source: learnings/1785748477641-building-slang-in-container-dxc-builds-from-source.md
---

# Building Slang in-container: DXC builds from source on GLIBC 2.36 (adds 10-30 min)

# Slang `cmake -B build --preset default` triggers a 500MB DXC source build on Debian 12

Observed building shader-slang/slang (PR #11225 head) inside the slangpy coworker container
(Debian 12, GLIBC 2.36).

## What happens

During **configure** (not compile), `FetchDXC.cmake` probes the prebuilt DXC binary's GLIBC
requirement and falls back to a full source build:

```
-- DXC prebuilt binary (v1.9.2602) requires GLIBC >= 2.38
-- Detected system GLIBC version: 2.36
-- System GLIBC 2.36 < required 2.38: building DXC from source (v1.9.2602)
-- Cloning DXC v1.9.2602 from source (first run: ~500 MB download + 10-30 min build;
   subsequent runs are skipped via stamp files)...
```

So `cmake -B build --preset default` alone can take ~30 min and `build/CMakeCache.txt` does not
exist for most of it — it is NOT hung. Check progress with
`du -sh build/_deps/dxc_source-src` (grows to 200MB+) rather than assuming a stall.

## If you don't need DXIL

DXC/DXIL is only for HLSL/D3D12 DXIL output. It is cleanly gated:

```cmake
option(SLANG_ENABLE_DXIL "Enable generating DXIL with DXC" ON)   # CMakeLists.txt:127
if(SLANG_ENABLE_DXIL)
    include(FetchDXC)                                            # CMakeLists.txt:577
endif()
```

For a **Vulkan/SPIRV-only** goal on Linux (e.g. reproducing a SPIRV-target diagnostic), add
`-DSLANG_ENABLE_DXIL=OFF` to skip the whole download+build. Only worth it if you configure from
scratch — the stamp files make subsequent configures cheap.

## Reference: what CI actually runs

`shader-slang/slangpy/.github/actions/build-and-test-with-slang/action.yml`:

```bash
cd slang && mkdir build
cmake -B build --preset default
cmake --build build --config Release --parallel
```

The `default` preset is **Ninja Multi-Config**, so `-DCMAKE_BUILD_TYPE=Release` is inert —
`--config Release` selects the config, and outputs land in `build/Release/`
(`lib/libslang*.so`, and `include/slang-tag-version.h` generated per-config from
`source/slang/CMakeLists.txt`). That is exactly what slangpy's
`-DSGL_LOCAL_SLANG_BUILD_DIR=build/Release` expects.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785748477641-building-slang-in-container-dxc-builds-from-source.md`_
