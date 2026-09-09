---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788069592247-za446u
written_at: 2026-09-01T07:03:22.939Z
---

# Testing downstream-compiler "no path" (SLANG_E_NOT_AVAILABLE): avoid GENERIC_C_CPP

When writing a unit test that must exercise the "loaded compiler but no recoverable shared-library path" case (e.g. `IGlobalSession::getDownstreamCompilerPath` → `SLANG_E_NOT_AVAILABLE`), **do NOT use `SLANG_PASS_THROUGH_GENERIC_C_CPP`.** Its resolution funnel (`Session::getOrLoadDownstreamCompiler(GenericCCpp)` in slang-check.cpp) loads Clang/Gcc/VisualStudio **and LLVM** as candidates, then picks `getDefaultCompiler(CPP)` = the compiler closest to the one Slang was built with. On any build/CI host where the prebuilt `slang-llvm` (`libslang-llvm.so`) is present, the default can resolve to the **LLVM downstream compiler, which IS a shared library with a recoverable path → returns `SLANG_OK`**, not `SLANG_E_NOT_AVAILABLE`. That makes a `== SLANG_E_NOT_AVAILABLE` assertion flaky. (A peer/codex reviewer suggested GENERIC_C_CPP; it was wrong for this reason — verify suggested test targets against the resolution code.)

Use the **concrete executable pass-throughs** instead: `SLANG_PASS_THROUGH_GCC`, `SLANG_PASS_THROUGH_CLANG`, `SLANG_PASS_THROUGH_VISUAL_STUDIO`. Each locator produces a `CommandLineDownstreamCompiler` (derives `DownstreamCompilerBase`, no `getPath` override) → base default → deterministic `SLANG_E_NOT_AVAILABLE`. Loop over all three (gated on `checkPassThroughSupport`) so at least one runs on POSIX (g++/clang) and on Windows (cl) — GPU-free.

Two more from the same task (shader-slang/slang#12838 / PR #12841):
- To prove an out-param is *left untouched* on a failure return, seed a **non-null sentinel** raw pointer and assert it survives (`ISlangBlob* p = sentinel; api(&p); CHECK(p == sentinel)`). A default-null `ComPtr` cannot distinguish "untouched" from "explicitly cleared to null".
- To verify a returned library path is the *exact loadable library* (not just non-empty), reload it with `SharedLibrary::loadWithPlatformPath(path, handle)` (core/slang-platform.h) and `findSymbolAddressByName` an entry point (NVRTC: `nvrtcVersion`, cross-check vs `getDownstreamCompilerVersion`; glslang: accept ANY of `glslang_compile`/`_1_1`/`_1_2`/`_1_3`, since init binds whichever the lib exposes — requiring only the unversioned name rejects versioned-only builds).

Env: clang-format-17 is at `/usr/lib/llvm-17/bin` (not on PATH by default); prepend it and run `./extras/formatting.sh --cpp --no-version-check`. And never let a build log land in the worktree — `git add -A` will commit it; write build logs to `/tmp`.
