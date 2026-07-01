---
title: "Slang macOS DXIL is a CMake-only problem (C++ path already compiled-in)"
type: learning
topic: slang-compiler
source: learnings/1780426302028-slang-macos-dxil-is-a-cmake-only-problem-c-path-al.md
---

# Slang macOS DXIL is a CMake-only problem (C++ path already compiled-in)

When triaging "enable DXC/DXIL on macOS" (issue #11432, follow-up to Linux PR #10935):

**The C++ DXC path is ALREADY compiled-in on macOS — do not "fix" it in C++.**
- `source/compiler-core/slang-dxc-compiler.cpp:21-27` defaults `SLANG_ENABLE_DXIL_SUPPORT 0` on `SLANG_APPLE_FAMILY`, BUT it's guarded by `#ifndef`.
- `cmake/CompilerFlags.cmake:220` ALWAYS defines `SLANG_ENABLE_DXIL_SUPPORT=$<BOOL:${SLANG_ENABLE_DXIL}>`, and `SLANG_ENABLE_DXIL` defaults `ON` unconditionally (`CMakeLists.txt:127`). The CMake-defined macro wins over the `#ifndef` Apple default.
- ⇒ When built via CMake (always), `DXCDownstreamCompiler::locateCompilers` + the full dxcapi path are LIVE on mac. The runtime just `dlopen`s `libdxcompiler` at runtime.

**So enabling DXIL-on-mac is purely a CMake fetch/build/stage problem**, not a compiler/C++ gate. The blocker is in `cmake/FetchDXC.cmake`: its source-build branch (added by #10935) is gated `if(CMAKE_SYSTEM_NAME STREQUAL "Windows" OR ... "Linux")` — Darwin hits the unsupported-platform WARNING+return(). And there's NO Microsoft prebuilt DXC for mac, so source-build is the only route.

**Gotcha:** the byproducts list + copy/stage custom commands hardcode `lib*.so`; macOS DXC produces `.dylib` (`libdxcompiler.dylib`, `libdxil.dylib`). Use `${CMAKE_SHARED_LIBRARY_SUFFIX}`. Also `dxildll` (DXIL validator/signer) is historically Windows-centric — verify it builds a loadable dylib under clang; if not, stage only `dxcompiler` for unsigned DXIL (enough for local text/asm slang-test).

DeepWiki was MISLEADING here: it claimed "DXIL generation is explicitly disabled on macOS" citing the .cpp `#if SLANG_APPLE_FAMILY → 0`. Technically true of the .cpp default, but the CMake override negates it. Always verify the `#ifndef`/CMake-define interplay in source, not just DeepWiki.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780426302028-slang-macos-dxil-is-a-cmake-only-problem-c-path-al.md`_
