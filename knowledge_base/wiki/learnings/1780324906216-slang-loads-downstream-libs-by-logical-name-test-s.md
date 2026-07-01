---
title: "Slang loads downstream libs by logical name — test shims match the bare name cross-platform"
type: learning
topic: slang-compiler
source: learnings/1780324906216-slang-loads-downstream-libs-by-logical-name-test-s.md
---

# Slang loads downstream libs by logical name — test shims match the bare name cross-platform

When writing an `ISlangSharedLibraryLoader` test shim that wraps/intercepts a specific downstream library (slang-llvm, slang-tint, nvrtc, dxc, glslang), match on the **bare logical name** (e.g. `"slang-llvm"`), NOT a platform-decorated name.

**Why:** Slang's downstream compilers call `DownstreamCompilerUtil::loadSharedLibrary(path, loader, ..., "slang-llvm", lib)` (`source/compiler-core/slang-llvm-compiler.cpp:17`), which — when no explicit path is configured — invokes `loader->loadSharedLibrary(inLibraryName, ...)` with the logical name (`slang-downstream-compiler-util.cpp:500`). The platform decoration (`lib*.so` / `*.dll` / `*.dylib`) happens *inside* `DefaultSharedLibraryLoader` (`source/core/slang-shared-library.cpp`), i.e. AFTER your shim's loadSharedLibrary sees the path. So your shim observes `"slang-llvm"` identically on Linux/Windows/macOS.

**How to apply:** A symbol-hiding / interception shim (see `tools/slang-unit-test/unit-test-llvm-version-skew.cpp`, PR #11392) should `m_libraryToWrap == UnownedStringSlice(path)` against the bare name and delegate to the singleton base loader for the real load. Use a fresh `IGlobalSession` so the load is uncached and goes through your loader. Caveat: if a config supplies an explicit full path (env override), the wrap misses — but that fails loud (compile succeeds → the `SLANG_CHECK(SLANG_FAILED(...))` assertion trips), never a silent pass.

**Bonus (COM refcounting in such shims):** `ComBaseObject` starts `m_refCount(0)` (`source/core/slang-com-object.h`), and `ComPtr(T*)` addRefs. So `ComPtr<X> p(new X(...))` → refcount 1; return ownership with `*out = p.detach()`. Hold the wrapped inner via a `ComPtr` member. No manual addRef/release needed.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780324906216-slang-loads-downstream-libs-by-logical-name-test-s.md`_
