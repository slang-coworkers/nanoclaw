---
title: "Editing source/slang-llvm/ — default build fetches a PREBUILT libslang-llvm.so, so your edit is NOT compiled locally"
type: learning
topic: ci-tooling
source: learnings/1784096455719-editing-source-slang-llvm-default-build-fetches-a-.md
---

# Editing source/slang-llvm/ — default build fetches a PREBUILT libslang-llvm.so, so your edit is NOT compiled locally

**Rule:** A change to any file under `source/slang-llvm/` (e.g. `slang-llvm-builder.cpp`) is NOT compiled by the default local build. `cmake --preset default` sets `SLANG_SLANG_LLVM_FLAVOR=FETCH_BINARY_IF_POSSIBLE`, which DOWNLOADS a prebuilt `libslang-llvm.so` (configure.log: "Downloading slang-llvm from …/releases/download/vX/…"). `slang-test`/`slangc` then load that prebuilt .so at runtime — your source edit is invisible to local runs.

**Where the edit IS compiled + validated:**
- `.github/workflows/ci-slang-sanitizer.yml` — `-DSLANG_ENABLE_ASAN=ON -DSLANG_SLANG_LLVM_FLAVOR=USE_SYSTEM_LLVM` (clang-18). This is the ONLY lane that both (a) builds slang-llvm from source (so it includes your edit) AND (b) runs the suite under ASan (so it can catch UAF/lifetime bugs). It's the correct validation surface for slang-llvm lifetime fixes.
- `USE_SYSTEM_LLVM` needs a matching full LLVM+Clang dev install (LLVMConfig.cmake/ClangConfig.cmake). Prod container as of 2026-07 has only LLVM/clang-14 dev — the slang-llvm source uses LLVM 15+ APIs (opaque `PointerType::get(ctx,0)`, ORC `ThreadSafeModule`) that will NOT compile against 14, so a local from-source slang-llvm build is infeasible there.

**How to apply:** When fixing a `source/slang-llvm/` bug, don't claim "verified locally" for the fix's *effect* — the default build can't exercise it. You CAN locally validate any new `.slang` test's syntax/routing (the `-llvm` JIT path runs GPU-free on CPU using the prebuilt .so) and that existing tests still pass. State in the PR that ASan-JIT proof is CI-gated (ci-slang-sanitizer). The `-llvm` directive (NOT `-cpu`) is what routes through the JIT (`generateJITLibrary`); `-cpu` uses an external C++ compiler and never touches slang-llvm.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784096455719-editing-source-slang-llvm-default-build-fetches-a-.md`_
