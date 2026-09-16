---
title: "LLVM_USE_HOST_TOOLS alone won't force host-native tools when CMAKE_OSX_ARCHITECTURES is an env var"
type: learning
topic: ci-tooling
source: learnings/1789507360762-llvm-use-host-tools-alone-won-t-force-host-native-.md
---

# LLVM_USE_HOST_TOOLS alone won't force host-native tools when CMAKE_OSX_ARCHITECTURES is an env var

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789417978795-ujguig
written_at: 2026-09-15T21:22:40.762Z
---

# LLVM_USE_HOST_TOOLS alone won't force host-native tools when CMAKE_OSX_ARCHITECTURES is an env var

When fixing a universal (fat) macOS build of a vendored LLVM-based dependency (e.g. DXC in Slang's `cmake/FetchDXC.cmake`), enabling `LLVM_USE_HOST_TOOLS=ON` builds TableGen host tools (clang-tblgen/llvm-tblgen) in a nested "NATIVE" build. LLVM's `CrossCompile.cmake` NATIVE configure *omits* `-DCMAKE_OSX_ARCHITECTURES`, on the assumption omission → host-native.

**Trap:** that omission is NOT enough if the arch was set as a *process environment variable* (`os.environ["CMAKE_OSX_ARCHITECTURES"]="x86_64;arm64"`). `CMAKE_OSX_ARCHITECTURES` is a *documented CMake env var* that initializes the cache; the NATIVE `execute_process` inherits the parent env, so the NATIVE build re-picks-up the universal value and the host tool is still non-runnable (`Bad CPU type in executable` on a no-Rosetta arm64 host). Omission ≠ host-native when the value comes from the environment.

**Fix:** explicitly force the NATIVE build host-native by injecting `-DCMAKE_OSX_ARCHITECTURES=<host>` via `CROSS_TOOLCHAIN_FLAGS_NATIVE` (a command-line `-D` overrides env-var cache init). Resolve host = `CMAKE_APPLE_SILICON_PROCESSOR` (authoritative under Rosetta) else `CMAKE_HOST_SYSTEM_PROCESSOR` (macOS `uname -m` → arm64/x86_64, no normalization). Also forward any main-build compiler-flag workarounds (e.g. AppleClang≥21 `-Wno-invalid-specialization`) — the NATIVE build does not inherit `CMAKE_CXX_FLAGS`.

**Escaping gotcha (verified):** `CROSS_TOOLCHAIN_FLAGS_NATIVE` is one cache value expanded *unquoted* by CrossCompile.cmake, so multiple `-D`s must be `;`-joined with the `;` escaped as `\;` — then it survives the outer DXC-configure `execute_process` as ONE argv element, is stored as a 2-element list by the child cmake, and re-splits into two NATIVE configure args. Confirm with a two-layer `cmake -P` harness (outer builds+escapes → execute_process → inner does `list(LENGTH)`).

Ref: shader-slang/slang#13077, PR #13079; DXC CrossCompile.cmake:43-46/55, TableGen.cmake:95-102, CMakeLists.txt:628-630.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1789507360762-llvm-use-host-tools-alone-won-t-force-host-native-.md`_
