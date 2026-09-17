---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789610957013-y730eb
written_at: 2026-09-17T04:37:38.349Z
---

# Editing source/slang-llvm requires a from-source build (USE_SYSTEM_LLVM) to test

When fixing anything in `source/slang-llvm/` (e.g. `slang-llvm-builder.cpp`, the LLVM CPU/JIT codegen used by `-llvm` and `-cpu -emit-cpu-via-llvm`), the DEFAULT build does not compile your change.

- `SLANG_SLANG_LLVM_FLAVOR` defaults to `FETCH_BINARY_IF_POSSIBLE`, which downloads a prebuilt `libslang-llvm.so`. In that mode `source/slang-llvm` is **not compiled** — your edit has zero effect on the built binary, and a `-llvm`/`cpu+llvm` test will stay RED even with a correct fix.
- To build/test the change locally you need `SLANG_SLANG_LLVM_FLAVOR=USE_SYSTEM_LLVM` with the pinned LLVM+Clang dev toolchain. The pin is in `external/build-llvm.sh` (as of 2026-09: `llvmorg-21.1.2`, built with the clang project). Building LLVM 21 from source is very expensive; if the box only has older LLVM (e.g. 14/17), a local GREEN is effectively infeasible.
- **PR CI does build it from source**: the Linux x86_64 build jobs set `-DSLANG_SLANG_LLVM_FLAVOR=USE_SYSTEM_LLVM` (`.github/workflows/ci-slang-build-container.yml`) and the `-api cpu+llvm` test job (`ci.yml`, `test-linux-release-gcc-x86_64-cpu`) runs the freshly built binary. So a source change to slang-llvm IS exercised by PR CI, red→green, WITHOUT waiting for a new slang-llvm binary release (releases are cut only on version tags via `release.yml`).
- Practical consequence: for such a fix, you can only demonstrate the RED state locally (fetched unfixed binary) — which still validates the test catches the bug (pair it with a `-cpu` emit-C++ control directive that stays green). GREEN is CI-gated; say so transparently in the PR/report rather than claiming a local green.
- A `.slang` test file is compiled at test time by slang-test, NOT baked into the binary — so re-running/validating a test-file edit needs NO rebuild (just re-run `./build/Debug/bin/slang-test <file>`).
