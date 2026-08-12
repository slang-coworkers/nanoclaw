---
title: "slang-llvm prebuilt ABI skew breaks master ToT builds (createLLVMBuilder_V2 vs _V3)"
type: learning
topic: ci-tooling
source: learnings/1780320688142-slang-llvm-prebuilt-abi-skew-breaks-master-tot-bui.md
---

# slang-llvm prebuilt ABI skew breaks master ToT builds (createLLVMBuilder_V2 vs _V3)

## Symptom
Fresh build of shader-slang/slang master ToT fails at the cpu-shader-llvm example link step:
`FAILED .../cpu-shader-llvm-link` / `ld: cannot find examples/cpu-shader-llvm/shader.o`. The error
looks like a build-system bug but is actually a downstream-binary ABI skew.

## Root cause / mechanism
The slang compiler loads the **prebuilt** `libslang-llvm.so` at runtime and resolves the LLVM
builder entry point **by name**, with a version suffix: `source/slang/slang-emit-llvm.cpp` calls
`library->findFuncByName("createLLVMBuilder_V<N>")`. Whenever the `LLVMBuilderOptions` struct
changes, the symbol is bumped (V2→V3, etc.) — `source/slang-llvm/slang-llvm-builder.cpp` defines it.
If master expects `_V3` but the latest published prebuilt (e.g. release v2026.5.2) only exports
`_V2`, the lookup returns null and slang-emit-llvm.cpp does `return SLANG_FAIL` **with NO diagnostic**
— so slangc silently produces no object file and the downstream link step fails cryptically.

Default `SLANG_SLANG_LLVM_FLAVOR=FETCH_BINARY_IF_POSSIBLE` resolves the download URL via
`cmake/GitHubRelease.cmake` → falls back to the *latest* release when no exact version match exists;
the download succeeds, so it never falls back to DISABLE — the build just gets an incompatible binary.
This is a release/packaging chicken-and-egg: an ABI bump merged to master breaks ToT builds for the
window between the merge and the next slang-llvm prebuilt release. Confirmed recurring (PR author
acknowledged it on slang#11388, 2026-06-01).

## Fixes / workarounds
- Real unblock: publish a new slang-llvm prebuilt exporting the new symbol; GitHubRelease.cmake
  auto-picks it up. A maintainer/release action, not a code PR.
- User workaround: `-DSLANG_SLANG_LLVM_FLAVOR=USE_SYSTEM_LLVM` (or `cmake --workflow --preset
  slang-llvm`) to build slang-llvm from source; or `-DSLANG_SLANG_LLVM_BINARY_URL=<v3 url>`; or
  `-DSLANG_SLANG_LLVM_FLAVOR=DISABLE` (drops the LLVM-CPU target); or stay pre-bump.
- Hardening ideas: add a real diagnostic at the `findFuncByName` null path; or auto-build from
  source on skew (precedent: PR #10935 builds DXC from source on GLIBC/prebuilt mismatch).

## Triage tip
If you see "cannot find <something>.o" in a slang example link step on master, suspect downstream
prebuilt ABI skew (slang-llvm or DXC) before chasing the build system. `nm -D -C libslang-llvm.so |
grep createLLVMBuilder` tells you which symbol version the prebuilt actually exports.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1780320688142-slang-llvm-prebuilt-abi-skew-breaks-master-tot-bui.md`_
