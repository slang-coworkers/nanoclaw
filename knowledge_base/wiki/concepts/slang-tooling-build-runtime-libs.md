---
title: "Build System, Prebuilt Deps (DXC/LLVM) & CMake Options"
type: concept
group: slang-tooling
tags: [cmake, dxc, llvm, glibc, ld_library_path, prebuilt, falcor, sccache, ci]
source_count: 25
---

# Build System, Prebuilt Deps (DXC/LLVM) & CMake Options

This page covers the Slang build system's dependency and option surface: CMake option conventions, prebuilt-binary dependencies (DXC, slang-llvm), glibc/LD_LIBRARY_PATH pitfalls, and CI-infrastructure facts that matter for local and CI builds. Build-workflow hazards (disk, build subagents, sanitizer suppressions, staleness, debug flags) live on the sibling page [Build Workflow Hazards, Sanitizers & Debug Flags](slang-tooling-build-runtime-libs-2.md).

## TL;DR

- **LD_LIBRARY_PATH order is load-bearing** when a Debug/fresh build and a prebuilt release copy coexist: put the freshly-built `build/<cfg>/lib` FIRST, or the stale prebuilt code runs silently (slangc RUNPATH ends in a trailing colon, so it also searches `LD_LIBRARY_PATH`). A fresh `--target slangc` Release build is missing glslang/llvm libs, so it needs the packaged tree APPENDED (Release/lib first) or SPIRV/GLSL targets segfault at downstream-compiler load and mask the real bug.
- **DXC prebuilts:** v1.10.2605.2 needs GLIBC 2.38 (blocks Ubuntu 22.04 / Debian 12 CI). `dx/linalg.h` header staging needs a manual `file(COPY ...)` in `FetchDXC.cmake`. `external/dxc/` is 2 vendored compile-time headers, NOT a submodule or the FetchDXC runtime.
- **DXC CMake:** `FetchDXC.cmake` is a ~876-line source-build module — verify against upstream via `gh api`, the local clone lags. macOS DXIL is a CMake-only problem (C++ path is compiled-in). `FindDXC` should use plain cache-vars, not IMPORTED targets — DXC is dlopen+copy, never linked. Clip-space Z remap is NOT DXC parity.
- **slang-llvm prebuilt ABI skew** (`createLLVMBuilder_V2` vs `_V3`) silently produces no object file → cryptic `cannot find shader.o` link failure; the FETCH_BINARY fallback downloads an incompatible binary rather than DISABLE. Windows slang-llvm has three distinct crash classes (COFF ordered-section #12283, teardown execute-AV #12292, AVX-512 SIGILL #11062) — do not conflate.
- **CI infra facts:** prebuilt LLVM (`setup-llvm-from-gcs`) is a public-bucket curl, NO auth (a false blocker for moving build pools). `api.github.com` is called only by `GitHubRelease.cmake` for slang-llvm version resolution; asset downloads are direct URLs, not rate-limited.
- **CMake options:** `SLANG_OVERRIDE_*_PATH` are CMake-only (no docs/matrix rows), unlike `SLANG_ENABLE_*` which need a `cmake-options-matrix.json` entry (CI builds each at non-default). `CACHE PATH` absolutizes relative `-D` values — pass `:STRING` to keep them relative. Cheap minimal static build skips DXC via `SLANG_ENABLE_DXIL=OFF`.
- **Falcor** exposes `FALCOR_LOCAL_SLANG` cache vars for a custom Slang build; do NOT redirect Slang's `CMAKE_RUNTIME_OUTPUT_DIRECTORY` (all per-config dirs collapse to one path).

## LD_LIBRARY_PATH order when debug-build and prebuilt libs coexist

When a Slang worktree contains both a freshly-built `build/Debug/lib/libslang-compiler.so` and the prebuilt release copy at `build/slang-X.Y.Z-linux-x86_64/lib/`, the order in `LD_LIBRARY_PATH` is load-bearing. The Debug lib must come FIRST:

```
LD_LIBRARY_PATH=/path/to/build/Debug/lib:/path/to/build/slang-X.Y.Z-linux-x86_64/lib \
  /path/to/build/Debug/bin/slangc ...
```

slangc's RUNPATH is `$ORIGIN/../lib:$ORIGIN:` — the trailing colon makes the runtime also search `LD_LIBRARY_PATH`, so if the prebuilt lib appears first, the prebuilt code runs even though `slangc` itself was just rebuilt. Symptom: instrumented `fprintf` calls don't appear, asserts fire from old line numbers. Quick check: `readelf -d build/Debug/bin/slangc | grep PATH`; `ldd path/to/slangc` (with your env) shows which `.so` actually loads.

This also bites when running `slang-test` from another worktree: slang-test's RUNPATH points at its own sibling `lib`, so it loads its own `libslang-compiler.so` regardless of the `slangc` binary you pass via `-bindir`. To exercise a fix end-to-end through slang-test, build slang-test in the SAME worktree as the patch. ([slangc Debug-build LD_LIBRARY_PATH order matters when prebuilt lib is colocated](wiki/learnings/1779369251370-slangc-debug-build-ld-library-path-order-matters-w.md))

The same lib-ordering rule governs a **fresh `--target slangc` Release build**, but with an added twist: `build/Release/lib/` is missing `libslang-glslang-*.so` and `libslang-llvm.so` (only the packaged tree `build/slang-<ver>-linux-x86_64/lib/` ships those). Running the fresh `build/Release/bin/slangc` on any SPIRV/GLSL target then **segfaults at the downstream-compiler load stage** (`error[E00100]: failed to load downstream compiler 'spirv-opt'` + `failed to load dynamic library 'slang-glslang-...'`), which MASKS whatever bug you were chasing (e.g. an assert further in the pipeline). Fix: `export LD_LIBRARY_PATH="$PWD/build/Release/lib:$PWD/build/slang-<ver>-linux-x86_64/lib"` — **Release/lib FIRST** so the freshly-built `libslang-compiler.so` wins over the packaged tree, which may be a STALE prebuilt lacking your new code (option parsing lives in `libslang-compiler`, so lib-order decides whether a new CLI option is even exercised); the packaged dir supplies only the missing glslang/llvm libs. `-O0` sidesteps the `spirv-opt` load entirely if it's still unavailable, and is not load-bearing for front-end/preflight-level bugs (confirmed build-verifying slang#12147; full slangc Release build ≈ 33 min, 494 targets) ([fresh Release/bin/slangc needs the packaged lib dir on LD_LIBRARY_PATH, Release/lib first](wiki/learnings/1784336671594-slang-build-fresh-release-bin-slangc-needs-package.md)).

## DXC prebuilts: GLIBC requirements and header staging

### GLIBC 2.38 requirement for DXC v1.10.2605.2

The prebuilt Linux binaries for DXC v1.10.2605.2 (first official build with SM 6.10 / `dx/linalg.h`) are linked against **GLIBC_2.38**. This blocks Ubuntu 22.04 (GLIBC 2.35) and Debian 12 (GLIBC 2.36). Ubuntu 24.04 and Debian 13 (GLIBC 2.39) are fine. Slang CI uses `ubuntu-22.04` for many Linux jobs — bumping DXC alone breaks the DXIL load path on those runners. Verify the loaded version: `objdump -T libdxcompiler.so | grep -oP 'GLIBC_2\.[0-9]+' | sort -V -u`. ([DXC v1.10.2605.2 prebuilts require GLIBC 2.38 (blocks Ubuntu 22.04 CI)](wiki/learnings/1779429443648-dxc-v1-10-2605-2-prebuilts-require-glibc-2-38-bloc.md))

### dx/linalg.h header staging

Cooperative-vector/matrix tests carry `-Xdxc -Ibuild/dxc/include` to let DXC find `dx/linalg.h`, but no CMake rule populates that path by default. The DXC tarball ships headers at `_deps/dxc-src/include/hlsl/dx/linalg.h`. Add to `cmake/FetchDXC.cmake` after `FetchContent_MakeAvailable(dxc)`:

```cmake
if(IS_DIRECTORY "${dxc_SOURCE_DIR}/include/hlsl")
    file(COPY "${dxc_SOURCE_DIR}/include/hlsl/"
         DESTINATION "${CMAKE_BINARY_DIR}/dxc/include")
endif()
```

### external/dxc: vendored compile-time headers, not a submodule

`external/dxc/` contains exactly two vendored Microsoft headers (~66 KB): `dxcapi.h` (DXC COM API entry points) and `WinAdapter.h` (Windows-type shim). They are a **compile-time** dependency of `source/compiler-core/slang-dxc-compiler.cpp` — NOT what `cmake/FetchDXC.cmake` handles. FetchDXC downloads the DXC runtime binaries and HLSL headers. Vendoring keeps the C++ compile decoupled from a network fetch; de-vendoring to source the headers from the DXC fetch would couple C++ compilation to a ~10-30 min source build and break offline/ARM builds. ([external/dxc is 2 vendored compile-time DXC API headers, not a submodule](wiki/learnings/1782491016302-external-dxc-is-2-vendored-compile-time-dxc-api-he.md))

## DXC CMake: source-build, macOS, and FindDXC design

### FetchDXC decision cascade (master as of early June 2026)

`cmake/FetchDXC.cmake` is a ~876-line source-build module (rewritten by PR #10935 merged 2026-06-02 + PR #11434 merged 2026-06-03). When triaging DXC CMake issues, always verify against upstream: `gh api repos/shader-slang/slang/contents/cmake/FetchDXC.cmake --jq '.content' | base64 -d > /tmp/x.cmake`. The local clone can lag by days. ([Slang DXC/build-system triage: local clone lags master; verify FetchDXC against upstream via gh api](wiki/learnings/1780472891485-slang-dxc-build-system-triage-local-clone-lags-mas.md))

### macOS DXC: C++ path is compiled-in; blockage is CMake only

The DXC C++ path is already compiled-in on macOS. `source/compiler-core/slang-dxc-compiler.cpp:21-27` defaults `SLANG_ENABLE_DXIL_SUPPORT 0` on `SLANG_APPLE_FAMILY`, BUT it is guarded by `#ifndef`. `cmake/CompilerFlags.cmake:220` ALWAYS defines `SLANG_ENABLE_DXIL_SUPPORT=$<BOOL:${SLANG_ENABLE_DXIL}>` (default ON), so the CMake-defined macro wins. Enabling DXIL on macOS is a pure CMake fetch/build/stage problem. The source-build branch in `FetchDXC.cmake` was previously gated `if(Linux OR Windows)` only; PR #11434 lifted the gate. Multi-config generators (Xcode) require `_dxc_lib_subdir = MinSizeRel/lib` (not plain `lib/` as Ninja uses). Use `${CMAKE_SHARED_LIBRARY_SUFFIX}` for `.dylib` vs `.so`. ([Slang macOS DXIL is a CMake-only problem (C++ path already compiled-in)](wiki/learnings/1780426302028-slang-macos-dxil-is-a-cmake-only-problem-c-path-al.md), [macOS DXC source-build (slang #11434): multi-config output dir is MinSizeRel/lib; no install_name fixup needed](wiki/learnings/1780617039215-macos-dxc-source-build-slang-11434-multi-config-ou.md), [A/B: hardware-gated mac DXC draft was directionally right; the only gap was the multi-config lib subdir](wiki/learnings/1780617153623-a-b-hardware-gated-mac-dxc-draft-was-directionally.md))

### CMake Options workflow: macOS DXC is manually/nightly only, not PR-gated

`.github/workflows/cmake-options.yml` runs `SLANG_DXC_BUILD_FROM_SOURCE=ON` with `macos-debug` + `macos-release` jobs — but this workflow's only triggers are `workflow_dispatch` (manual) and a weekly Saturday cron. It does NOT run on `pull_request`/`merge_group`. To verify a branch: manually dispatch it via `gh workflow run cmake-options.yml --ref <branch>`. The workflow only **builds** — it does not run `slangc`/`slang-test`, so runtime `dlopen`/install_name behavior is NOT covered. When making macOS DXC the default (PR #11439), the `coverage-nightly.yml` macOS job (`coverage-macos`) also sources-builds DXC and is a required gate for the nightly organize/merge step. ([Slang CMake Options workflow already covers DXC source-build on macOS (not PR-triggered)](wiki/learnings/1780428519137-slang-cmake-options-workflow-already-covers-dxc-so.md), [slang macOS DXC-default PR: coverage-nightly coverage-macos is an un-opted-out required gate](wiki/learnings/1780463258746-slang-macos-dxc-default-pr-coverage-nightly-covera.md))

### FindDXC should use plain cache-vars, not IMPORTED targets

Nothing **links** against DXC — `slangc`/`slang-test` `dlopen` it at runtime; the build's only interaction is a file copy. The output contract of `FetchDXC.cmake` is the custom targets `copy-dxcompiler`, `copy-dxil`, `stage-dxc-headers` consumed by name. All three sibling Find modules (`FindNVAPI`, `FindAftermath`, `FindOptiX`) use plain cache vars. An `IMPORTED` target adds zero value (no link/usage requirements to propagate) and would break the copy-target contract. Design: `find_path` + `find_library` + `find_package_handle_standard_args` exposing `DXC_INCLUDE_DIRS`/`DXC_DXCOMPILER_LIBRARY`/`DXC_DXIL_LIBRARY`, then re-emit the same `copy-dxcompiler`/`copy-dxil`/`stage-dxc-headers` targets from the found paths. ([Slang FindDXC should use plain cache-vars not IMPORTED target — DXC is dlopen+copy, never linked](wiki/learnings/1780473187576-slang-finddxc-should-use-plain-cache-vars-not-impo.md))

### Clip-space Z remap is NOT a DXC-parity option

`-fvk-invert-y` and `-fvk-use-dx-position-w` are DXC-compatibility options. A clip-space-Z remap (`-fvk-remap-z`) is NOT — DXC has no such option because D3D, Vulkan, and Metal all share 0..1 NDC depth. A Z-remap is a new Slang-specific surface that needs explicit maintainer design buy-in. ([Clip-space Z remap (slang #11599) is NOT DXC parity — unlike invert-y/position-w](wiki/learnings/1781333043756-clip-space-z-remap-slang-11599-is-not-dxc-parity-u.md))

## slang-llvm prebuilt: ABI skew breaks master ToT builds

Slang resolves the prebuilt `libslang-llvm.so` entry point by versioned name: `findFuncByName("createLLVMBuilder_V<N>")` (`source/slang/slang-emit-llvm.cpp`). When the `LLVMBuilderOptions` struct changes, the symbol is bumped (V2→V3). If master expects `_V3` but the latest published prebuilt only exports `_V2`, the lookup returns null and `slangc` **silently produces no object file**, causing a cryptic link failure (`cannot find examples/cpu-shader-llvm/shader.o`).

Default `SLANG_SLANG_LLVM_FLAVOR=FETCH_BINARY_IF_POSSIBLE` falls back to the latest release when no exact version match exists; the download succeeds so it never falls back to DISABLE — the build just gets an incompatible binary.

Diagnosis: `nm -D -C libslang-llvm.so | grep createLLVMBuilder`. Workarounds: `-DSLANG_SLANG_LLVM_FLAVOR=USE_SYSTEM_LLVM`; `-DSLANG_SLANG_LLVM_BINARY_URL=<url>`; `-DSLANG_SLANG_LLVM_FLAVOR=DISABLE`. PR #11392 added diagnostic E00109 "incompatible-slang-llvm-library" at the null-lookup site. ([slang-llvm prebuilt ABI skew breaks master ToT builds (createLLVMBuilder_V2 vs _V3)](wiki/learnings/1780320688142-slang-llvm-prebuilt-abi-skew-breaks-master-tot-bui.md), [slang-llvm prebuilt V2/V3 ABI skew breaks master ToT build with cryptic 'cannot find shader.o](wiki/learnings/1780324967550-slang-llvm-prebuilt-v2-v3-abi-skew-breaks-master-t.md))

## slang-llvm Windows JIT & teardown crashes (three distinct mechanisms)

Two Windows-only `slang-llvm.dll` crash classes surface as intermittent `test-server.exe` aborts and must not be conflated with each other (or with the AVX-512 SIGILL of #11062, or the compile-time DIBuilder/IRBuilder UAF fixed by PR #12114). **(1) COFF ordered-section relocation abort (#12283).** `createAVX512SafeLLJIT()` (`slang-llvm-jit-shared-library.cpp:63-68`) builds an LLJIT with the DEFAULT object-linking layer, so on Windows x64 each object gets a fresh `SectionMemoryManager` allocating code/rodata/writable as separate VM regions; `IMAGE_REL_AMD64_ADDR32NB` is an unsigned 32-bit image-relative offset that RuntimeDyld requires be laid out in increasing address order, and long-lived-worker address-space fragmentation can defeat that → LLVM fatal `IMAGE_REL_AMD64_ADDR32NB relocation requires an ordered section layout` (fires even in compile-only tests). Both JIT paths funnel through the one helper, so the fix (a Windows-x64 memory manager overriding `reserveAllocationSpace` to reserve ONE contiguous code→rodata→writable region per object) has a single insertion point ([slang-llvm JIT COFF ordered-section crash on Windows (default LLJIT, #12283)](wiki/learnings/1785398074059-slang-llvm-jit-coff-ordered-section-crash-on-windo.md)). **(2) Process-teardown execute-AV from surviving LLVM callbacks (#12292).** A `cpu`/host-callable test prints all output then crashes at process exit with `0xc0000005` in `slang-llvm.dll_unloaded`: the plugin registers process-global LLVM state (`RegisterCodeGenFlags`, `ParseCommandLineOptions`, `InitializeAllTargets`, `InitializeNativeTarget*`) whose `ManagedStatic`/atexit cleanup callbacks live inside the DLL, but there is no `llvm_shutdown()` under `source/slang-llvm/` and Windows `SharedLibrary::unload()` is an unconditional `FreeLibrary` — so the callbacks fire into unmapped memory at CRT exit. This is NOT a `Session`/`ComPtr` destruction-order bug (the process-global atexit runs after the member sweep already unloaded the DLL — reject any "reorder m_slangLLVM" fix); fix by explicit `llvm_shutdown()` before unload, or by pinning the DLL (in-tree precedent: POSIX `RTLD_NODELETE` for libdxcompiler in `slang-platform.cpp:237-249`, plus a Windows `GetModuleHandleExW(...FLAG_PIN...)` equivalent) ([slang-llvm.dll teardown AV = LLVM ManagedStatic/atexit callbacks survive FreeLibrary](wiki/learnings/1785420752652-slang-llvm-dll-teardown-av-llvm-managedstatic-atex.md)). Both classes only reproduce in the source-linked `SLANG_SLANG_LLVM_FLAVOR=USE_SYSTEM_LLVM` config (default builds fetch a prebuilt `libslang-llvm`), so edits to `source/slang-llvm/*.cpp` are not verifiable in a default preset build — the prebuilt must be re-rolled to reach CI.

## Prebuilt LLVM from GCS: public-bucket curl, no auth required

In Slang's GitHub Actions, `setup-llvm-from-gcs` fetches the prebuilt LLVM via a **plain `curl` from a publicly-readable GCS bucket** — no authentication required (`.github/actions/setup-llvm-from-gcs/action.yml:43-44`). The `google-github-actions/auth@v2` / workload-identity step is caller-side and only runs on the upload path (cache-miss on master). The download path needs no Google Cloud auth. When reasoning about moving a build job between runner pools, "the new pool would need GCS/LLVM auth" is a FALSE blocker. The real toolchain blockers are CUDA (must be preinstalled on the image) and sccache (wired in `ci-slang-build.yml`, not `common-setup`). ([slang CI: prebuilt LLVM (setup-llvm-from-gcs) is a public-bucket curl download with NO auth — not a blocker for moving builds between self-hosted pools](wiki/learnings/1780770912978-slang-ci-prebuilt-llvm-setup-llvm-from-gcs-is-a-pu.md))

## GitHub API rate limits: only GitHubRelease.cmake calls api.github.com

The ONLY GitHub REST API (`api.github.com`) calls in Slang's CMake build live in `cmake/GitHubRelease.cmake` (`get_latest` → /releases/latest), used solely to resolve the prebuilt slang-llvm download URL. Actual asset downloads are direct release-asset URLs NOT subject to the REST API rate limit. DXC, webgpu_dawn, and slang-tint all use direct URLs. `SLANG_GITHUB_TOKEN` is referenced in zero `.github/workflows/*.yml`. Rate-limit failures behind corporate firewalls (shared IP exhausting the 60/hr anon quota) come entirely from those `GitHubRelease.cmake` API calls; building the URL directly from the git-tag version removes the exposure. ([Slang CMake: api.github.com used only for slang-llvm version resolution; direct asset downloads aren't rate-limited](wiki/learnings/1780338418439-slang-cmake-api-github-com-used-only-for-slang-llv.md))

## Cheap minimal static Slang build (skip DXC via SLANG_ENABLE_DXIL=OFF)

On Linux with glibc < 2.38, configure triggers a DXC source build (~500MB + 10-30min) via GLIBC auto-detection, even with `SLANG_ENABLE_GFX=OFF`. The switch that skips it entirely is `SLANG_ENABLE_DXIL=OFF`. Minimal static install config:

```
cmake -G "Ninja Multi-Config" -S . -B build-min \
  -DSLANG_LIB_TYPE=STATIC -DSLANG_SLANG_LLVM_FLAVOR=DISABLE \
  -DSLANG_ENABLE_DXIL=OFF -DSLANG_ENABLE_GFX=OFF -DSLANG_ENABLE_SLANG_RHI=OFF \
  -DSLANG_ENABLE_TESTS=OFF -DSLANG_ENABLE_REPLAYER=OFF -DSLANG_ENABLE_EXAMPLES=OFF
cmake --build build-min --config Release   # ~9 min, no DXC
```

The `<target> is not in any export set` packaging error is a **generate-time** diagnostic — a clean `cmake -DSLANG_LIB_TYPE=STATIC` configure (exit 0) proves export safety without any build. ([Cheap minimal static Slang build for install verification (skip DXC via SLANG_ENABLE_DXIL=OFF)](wiki/learnings/1780470809014-cheap-minimal-static-slang-build-for-install-verif.md))

## CMake option conventions: SLANG_OVERRIDE_*_PATH vs SLANG_ENABLE_*

### Override-path convention (two files only, no docs/matrix)

`SLANG_OVERRIDE_<DEP>_PATH` advanced options appear ONLY in two CMake files:
1. Top-level `CMakeLists.txt`: `advanced_option(SLANG_OVERRIDE_<DEP>_PATH "..." OFF)`.
2. `external/CMakeLists.txt`: `if(NOT SLANG_OVERRIDE_<DEP>_PATH)/else()` branch.

Do NOT add a `docs/building.md` row or a `.github/cmake-options-matrix.json` entry — all 14 existing override-path options are CMake-only (verified: `grep -rn SLANG_OVERRIDE docs/ .github/` returns nothing). This differs from `SLANG_ENABLE_*` options, which DO add docs rows + matrix entries.

For header-only INTERFACE deps (fast_float, metal-cpp), the override branches the include-dir STRING, not `add_subdirectory`. Preserve the inline `${system}` SYSTEM keyword that suppresses `-Werror` on bundled headers. Add a configure-time `message(FATAL_ERROR ...)` existence check scoped to the override branch to restore the fail-fast behavior of `add_subdirectory`-based overrides. ([Slang bundled-dep override-path convention + skip DeepWiki for pure-CMake triage](wiki/learnings/1782405218135-slang-bundled-dep-override-path-convention-skip-de.md), [slang SLANG_OVERRIDE_*_PATH options are CMake-only (no docs/matrix), unlike SLANG_ENABLE_*](wiki/learnings/1782406116154-slang-slang-override-path-options-are-cmake-only-n.md), [On pure-CMake override-path PRs, Reviewer C (clarity) is the value-add](wiki/learnings/1782407661384-on-pure-cmake-override-path-prs-reviewer-c-clarity.md))

### Any new CMake option() must be registered in cmake-options-matrix.json

A CI job (added by PR #10945) builds each option at its non-default value; an unregistered option breaks CI. The `SLANG_USE_SYSTEM_*` deps use `find_package(CONFIG)` only because those deps ship upstream configs; DXC ships none, so a system-DXC option requires a hand-written `cmake/FindDXC.cmake`. ([Slang local checkout can be days-stale on actively-developed CMake files; verify against master + options-matrix CI gate](wiki/learnings/1780472551679-slang-local-checkout-can-be-days-stale-on-actively.md))

### CMake CACHE PATH absolutizes relative -D values

When you pass a **relative** path to a `CACHE PATH` variable via `-DVAR=relative/path`, CMake silently converts it to an absolute path relative to the cmake working directory. If downstream code string-concatenates the variable onto another base path, the result is a doubled path. Fix: pass the value typed as a string: `-DVAR:STRING=relative/path`. A `:STRING` override on reconfigure overrides a previously-cached `:PATH` entry without a cache wipe. ([CMake CACHE PATH absolutizes relative -D values against the cmake CWD — pass :STRING to keep them relative](wiki/learnings/1781660657132-cmake-cache-path-absolutizes-relative-d-values-aga.md))

## Falcor: FALCOR_LOCAL_SLANG CMake hook and CI topology

Public Falcor (NVIDIAGameWorks/Falcor) exposes `FALCOR_LOCAL_SLANG` (BOOL) + `FALCOR_LOCAL_SLANG_DIR` + `FALCOR_LOCAL_SLANG_BUILD_DIR` cache vars for using a local Slang build instead of its packman-pinned one. When ON, the `deploy_dependencies` target copies Slang DLLs/SOs from those paths into Falcor's output directory — no manual copy step needed.

Do NOT redirect Slang's `CMAKE_RUNTIME_OUTPUT_DIRECTORY` to emit into an external dir — `cmake/SlangTarget.cmake:204-285` forces ALL per-config dirs to the same path, so Debug and Release overwrite each other in a Ninja-Multi-Config tree. Use `cmake --install --config <cfg> --prefix <dir>` or `FALCOR_LOCAL_SLANG_BUILD_DIR` pointing at Slang's standard per-config `build/<cfg>/bin`.

Falcor CI's workflow is just `cp` into a preinstalled Falcor on a self-hosted Windows runner with no version pin on the Falcor side — fresh Falcor pulls its own Slang via packman. ([Public Falcor has FALCOR_LOCAL_SLANG CMake hook for a custom Slang build](wiki/learnings/1781366574564-public-falcor-has-falcor-local-slang-cmake-hook-fo.md))

**Source learnings (25):**
- [slangc Debug-build LD_LIBRARY_PATH order matters when prebuilt lib is colocated](wiki/learnings/1779369251370-slangc-debug-build-ld-library-path-order-matters-w.md)
- [fresh Release/bin/slangc needs the packaged lib dir on LD_LIBRARY_PATH (Release/lib first) else segfault masks the real bug](wiki/learnings/1784336671594-slang-build-fresh-release-bin-slangc-needs-package.md)
- [DXC v1.10.2605.2 prebuilts require GLIBC 2.38 (blocks Ubuntu 22.04 CI)](wiki/learnings/1779429443648-dxc-v1-10-2605-2-prebuilts-require-glibc-2-38-bloc.md)
- [external/dxc is 2 vendored compile-time DXC API headers, not a submodule](wiki/learnings/1782491016302-external-dxc-is-2-vendored-compile-time-dxc-api-he.md)
- [Slang DXC/build-system triage: local clone lags master; verify FetchDXC against upstream via gh api](wiki/learnings/1780472891485-slang-dxc-build-system-triage-local-clone-lags-mas.md)
- [Slang macOS DXIL is a CMake-only problem (C++ path already compiled-in)](wiki/learnings/1780426302028-slang-macos-dxil-is-a-cmake-only-problem-c-path-al.md)
- [Slang CMake Options workflow already covers DXC source-build on macOS (not PR-triggered)](wiki/learnings/1780428519137-slang-cmake-options-workflow-already-covers-dxc-so.md)
- [slang macOS DXC-default PR: coverage-nightly coverage-macos is an un-opted-out required gate](wiki/learnings/1780463258746-slang-macos-dxc-default-pr-coverage-nightly-covera.md)
- [Slang local checkout can be days-stale on actively-developed CMake files](wiki/learnings/1780472551679-slang-local-checkout-can-be-days-stale-on-actively.md)
- [Slang FindDXC should use plain cache-vars not IMPORTED target — DXC is dlopen+copy, never linked](wiki/learnings/1780473187576-slang-finddxc-should-use-plain-cache-vars-not-impo.md)
- [macOS DXC source-build (slang #11434): multi-config output dir is MinSizeRel/lib; no install_name fixup needed](wiki/learnings/1780617039215-macos-dxc-source-build-slang-11434-multi-config-ou.md)
- [A/B: hardware-gated mac DXC draft was directionally right; the only gap was the multi-config lib subdir](wiki/learnings/1780617153623-a-b-hardware-gated-mac-dxc-draft-was-directionally.md)
- [Clip-space Z remap (slang #11599) is NOT DXC parity — unlike invert-y/position-w](wiki/learnings/1781333043756-clip-space-z-remap-slang-11599-is-not-dxc-parity-u.md)
- [slang-llvm prebuilt ABI skew breaks master ToT builds (createLLVMBuilder_V2 vs _V3)](wiki/learnings/1780320688142-slang-llvm-prebuilt-abi-skew-breaks-master-tot-bui.md)
- [slang-llvm prebuilt V2/V3 ABI skew breaks master ToT build with cryptic "cannot find shader.o"](wiki/learnings/1780324967550-slang-llvm-prebuilt-v2-v3-abi-skew-breaks-master-t.md)
- [slang-llvm JIT COFF ordered-section crash on Windows (default LLJIT, #12283); single insertion point via createAVX512SafeLLJIT](wiki/learnings/1785398074059-slang-llvm-jit-coff-ordered-section-crash-on-windo.md)
- [slang-llvm.dll teardown AV on Windows = LLVM ManagedStatic/atexit callbacks survive FreeLibrary (#12292); not a ComPtr order bug; fix via llvm_shutdown or DLL pin](wiki/learnings/1785420752652-slang-llvm-dll-teardown-av-llvm-managedstatic-atex.md)
- [slang CI: prebuilt LLVM (setup-llvm-from-gcs) is a public-bucket curl download with NO auth](wiki/learnings/1780770912978-slang-ci-prebuilt-llvm-setup-llvm-from-gcs-is-a-pu.md)
- [Slang CMake: api.github.com used only for slang-llvm version resolution; direct asset downloads aren't rate-limited](wiki/learnings/1780338418439-slang-cmake-api-github-com-used-only-for-slang-llv.md)
- [Cheap minimal static Slang build for install verification (skip DXC via SLANG_ENABLE_DXIL=OFF)](wiki/learnings/1780470809014-cheap-minimal-static-slang-build-for-install-verif.md)
- [Slang bundled-dep override-path convention + skip DeepWiki for pure-CMake triage](wiki/learnings/1782405218135-slang-bundled-dep-override-path-convention-skip-de.md)
- [slang SLANG_OVERRIDE_*_PATH options are CMake-only (no docs/matrix), unlike SLANG_ENABLE_*](wiki/learnings/1782406116154-slang-slang-override-path-options-are-cmake-only-n.md)
- [On pure-CMake override-path PRs, Reviewer C (clarity) is the value-add](wiki/learnings/1782407661384-on-pure-cmake-override-path-prs-reviewer-c-clarity.md)
- [CMake CACHE PATH absolutizes relative -D values against the cmake CWD — pass :STRING to keep them relative](wiki/learnings/1781660657132-cmake-cache-path-absolutizes-relative-d-values-aga.md)
- [Public Falcor has FALCOR_LOCAL_SLANG CMake hook for a custom Slang build](wiki/learnings/1781366574564-public-falcor-has-falcor-local-slang-cmake-hook-fo.md)

_Catalog: [[wiki/index.md]]_
