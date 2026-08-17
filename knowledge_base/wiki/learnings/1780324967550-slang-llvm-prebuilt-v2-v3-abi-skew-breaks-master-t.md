---
title: "slang-llvm prebuilt V2/V3 ABI skew breaks master ToT build with cryptic 'cannot find shader.o'"
type: learning
topic: slang-compiler
source: learnings/1780324967550-slang-llvm-prebuilt-v2-v3-abi-skew-breaks-master-t.md
---

# slang-llvm prebuilt V2/V3 ABI skew breaks master ToT build with cryptic "cannot find shader.o"

## Symptom
Building shader-slang/slang master ToT from a fresh checkout fails at an example link step with a misleading error, e.g.:
```
FAILED: RelWithDebInfo/bin/cpu-shader-llvm-link
/usr/bin/ld: cannot find examples/cpu-shader-llvm/shader.o: No such file or directory
```
The error looks like a missing object file but is actually a downstream LLVM-compiler load failure.

## Root cause (the real one)
The slang compiler loads the **prebuilt** `libslang-llvm.so` at runtime and resolves the LLVM builder entry point **by versioned symbol name**: `source/slang/slang-emit-llvm.cpp` does `findFuncByName("createLLVMBuilder_V<N>")`. Whenever `LLVMBuilderOptions` changes (an ABI change), that symbol is version-bumped (`_V2`→`_V3`, …) in `source/slang-llvm/slang-llvm-builder.cpp`.

If master expects a **newer** version than the latest *published* prebuilt exports (e.g. master wants `_V3` but release `v2026.5.2` only exports `_V2`), the lookup returns null and the code does `return SLANG_FAIL` **with no diagnostic emitted** (slang-emit-llvm.cpp ~line 713). `slangc` then silently produces no `.o`, and the next link step fails with the cryptic "cannot find shader.o".

Why the bad binary gets picked: default `SLANG_SLANG_LLVM_FLAVOR=FETCH_BINARY_IF_POSSIBLE`. `cmake/GitHubRelease.cmake` resolves the download URL from the slang version, and with no exact match for master ToT it **falls back to the latest release** — which can be older than master's expected symbol. The download *succeeds*, so it never falls back to DISABLE; the build just gets an incompatible binary. This is a release/packaging chicken-and-egg between an ABI bump landing on master and a new slang-llvm prebuilt being published.

## Fixes / workarounds
- **Real unblock (maintainer):** publish a new slang-llvm prebuilt exporting the new symbol; `GitHubRelease.cmake` auto-picks it up. (Or temporarily revert the ABI-bump PR on master.)
- **User workaround, no revert:** `-DSLANG_SLANG_LLVM_FLAVOR=USE_SYSTEM_LLVM` (or `cmake --workflow --preset slang-llvm`) to build slang-llvm from source; or `-DSLANG_SLANG_LLVM_BINARY_URL=<url>` to point at a matching binary; or `-DSLANG_SLANG_LLVM_FLAVOR=DISABLE` to drop the LLVM-CPU target.
- **Self-diagnosing fix (landed as Approach B):** slang #11388 → PR #11392 added diagnostic `E00109 incompatible-slang-llvm-library` at the null-lookup site so the failure names the version skew instead of surfacing as a link error.

## Precedent for the recurring pattern
PR #10935 builds DXC from source when system GLIBC doesn't match the prebuilt `libdxcompiler.so` — same class of "prebuilt downstream-compiler binary skew breaks builds." An analogous auto-build-from-source-on-skew path is the robust long-term answer, but the prebuilt's exported symbol version isn't knowable at CMake configure time, so the trigger has to be a recorded interface-version artifact, not a runtime probe.

Refs: slang issue #11388, PR #11108 (the `_V2`→`_V3` bump), PR #11392 (the diagnostic).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780324967550-slang-llvm-prebuilt-v2-v3-abi-skew-breaks-master-t.md`_
