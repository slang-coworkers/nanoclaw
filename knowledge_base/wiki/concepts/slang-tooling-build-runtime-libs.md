---
title: "Build System, Runtime Libraries & Debug Workflows"
type: concept
group: slang-tooling
tags: [cmake, dxc, llvm, glibc, ld_library_path, sanitizer, build, prebuilt, disk, falcor, sccache, ci]
source_count: 42
---

# Build System, Runtime Libraries & Debug Workflows

This page covers the Slang build system: CMake option conventions, prebuilt-binary dependencies (DXC, slang-llvm), glibc/LD_LIBRARY_PATH pitfalls, sanitizer suppressions, disk management, and CI-infrastructure facts that matter for local and CI builds.

## LD_LIBRARY_PATH order when debug-build and prebuilt libs coexist

When a Slang worktree contains both a freshly-built `build/Debug/lib/libslang-compiler.so` and the prebuilt release copy at `build/slang-X.Y.Z-linux-x86_64/lib/`, the order in `LD_LIBRARY_PATH` is load-bearing. The Debug lib must come FIRST:

```
LD_LIBRARY_PATH=/path/to/build/Debug/lib:/path/to/build/slang-X.Y.Z-linux-x86_64/lib \
  /path/to/build/Debug/bin/slangc ...
```

slangc's RUNPATH is `$ORIGIN/../lib:$ORIGIN:` — the trailing colon makes the runtime also search `LD_LIBRARY_PATH`, so if the prebuilt lib appears first, the prebuilt code runs even though `slangc` itself was just rebuilt. Symptom: instrumented `fprintf` calls don't appear, asserts fire from old line numbers. Quick check: `readelf -d build/Debug/bin/slangc | grep PATH`; `ldd path/to/slangc` (with your env) shows which `.so` actually loads.

This also bites when running `slang-test` from another worktree: slang-test's RUNPATH points at its own sibling `lib`, so it loads its own `libslang-compiler.so` regardless of the `slangc` binary you pass via `-bindir`. To exercise a fix end-to-end through slang-test, build slang-test in the SAME worktree as the patch. ([slangc Debug-build LD_LIBRARY_PATH order matters when prebuilt lib is colocated](../learnings/1779369251370-slangc-debug-build-ld-library-path-order-matters-w.md))

The same lib-ordering rule governs a **fresh `--target slangc` Release build**, but with an added twist: `build/Release/lib/` is missing `libslang-glslang-*.so` and `libslang-llvm.so` (only the packaged tree `build/slang-<ver>-linux-x86_64/lib/` ships those). Running the fresh `build/Release/bin/slangc` on any SPIRV/GLSL target then **segfaults at the downstream-compiler load stage** (`error[E00100]: failed to load downstream compiler 'spirv-opt'` + `failed to load dynamic library 'slang-glslang-...'`), which MASKS whatever bug you were chasing (e.g. an assert further in the pipeline). Fix: `export LD_LIBRARY_PATH="$PWD/build/Release/lib:$PWD/build/slang-<ver>-linux-x86_64/lib"` — **Release/lib FIRST** so the freshly-built `libslang-compiler.so` wins over the packaged tree, which may be a STALE prebuilt lacking your new code (option parsing lives in `libslang-compiler`, so lib-order decides whether a new CLI option is even exercised); the packaged dir supplies only the missing glslang/llvm libs. `-O0` sidesteps the `spirv-opt` load entirely if it's still unavailable, and is not load-bearing for front-end/preflight-level bugs (confirmed build-verifying slang#12147; full slangc Release build ≈ 33 min, 494 targets) ([fresh Release/bin/slangc needs the packaged lib dir on LD_LIBRARY_PATH, Release/lib first](../learnings/1784336671594-slang-build-fresh-release-bin-slangc-needs-package.md)).

## DXC prebuilts: GLIBC requirements and header staging

### GLIBC 2.38 requirement for DXC v1.10.2605.2

The prebuilt Linux binaries for DXC v1.10.2605.2 (first official build with SM 6.10 / `dx/linalg.h`) are linked against **GLIBC_2.38**. This blocks Ubuntu 22.04 (GLIBC 2.35) and Debian 12 (GLIBC 2.36). Ubuntu 24.04 and Debian 13 (GLIBC 2.39) are fine. Slang CI uses `ubuntu-22.04` for many Linux jobs — bumping DXC alone breaks the DXIL load path on those runners. Verify the loaded version: `objdump -T libdxcompiler.so | grep -oP 'GLIBC_2\.[0-9]+' | sort -V -u`. ([DXC v1.10.2605.2 prebuilts require GLIBC 2.38 (blocks Ubuntu 22.04 CI)](../learnings/1779429443648-dxc-v1-10-2605-2-prebuilts-require-glibc-2-38-bloc.md))

### dx/linalg.h header staging

Cooperative-vector/matrix tests carry `-Xdxc -Ibuild/dxc/include` to let DXC find `dx/linalg.h`, but no CMake rule populates that path by default. The DXC tarball ships headers at `_deps/dxc-src/include/hlsl/dx/linalg.h`. Add to `cmake/FetchDXC.cmake` after `FetchContent_MakeAvailable(dxc)`:

```cmake
if(IS_DIRECTORY "${dxc_SOURCE_DIR}/include/hlsl")
    file(COPY "${dxc_SOURCE_DIR}/include/hlsl/"
         DESTINATION "${CMAKE_BINARY_DIR}/dxc/include")
endif()
```

### external/dxc: vendored compile-time headers, not a submodule

`external/dxc/` contains exactly two vendored Microsoft headers (~66 KB): `dxcapi.h` (DXC COM API entry points) and `WinAdapter.h` (Windows-type shim). They are a **compile-time** dependency of `source/compiler-core/slang-dxc-compiler.cpp` — NOT what `cmake/FetchDXC.cmake` handles. FetchDXC downloads the DXC runtime binaries and HLSL headers. Vendoring keeps the C++ compile decoupled from a network fetch; de-vendoring to source the headers from the DXC fetch would couple C++ compilation to a ~10-30 min source build and break offline/ARM builds. ([external/dxc is 2 vendored compile-time DXC API headers, not a submodule](../learnings/1782491016302-external-dxc-is-2-vendored-compile-time-dxc-api-he.md))

## DXC CMake: source-build, macOS, and FindDXC design

### FetchDXC decision cascade (master as of early June 2026)

`cmake/FetchDXC.cmake` is a ~876-line source-build module (rewritten by PR #10935 merged 2026-06-02 + PR #11434 merged 2026-06-03). When triaging DXC CMake issues, always verify against upstream: `gh api repos/shader-slang/slang/contents/cmake/FetchDXC.cmake --jq '.content' | base64 -d > /tmp/x.cmake`. The local clone can lag by days. ([Slang DXC/build-system triage: local clone lags master; verify FetchDXC against upstream via gh api](../learnings/1780472891485-slang-dxc-build-system-triage-local-clone-lags-mas.md))

### macOS DXC: C++ path is compiled-in; blockage is CMake only

The DXC C++ path is already compiled-in on macOS. `source/compiler-core/slang-dxc-compiler.cpp:21-27` defaults `SLANG_ENABLE_DXIL_SUPPORT 0` on `SLANG_APPLE_FAMILY`, BUT it is guarded by `#ifndef`. `cmake/CompilerFlags.cmake:220` ALWAYS defines `SLANG_ENABLE_DXIL_SUPPORT=$<BOOL:${SLANG_ENABLE_DXIL}>` (default ON), so the CMake-defined macro wins. Enabling DXIL on macOS is a pure CMake fetch/build/stage problem. The source-build branch in `FetchDXC.cmake` was previously gated `if(Linux OR Windows)` only; PR #11434 lifted the gate. Multi-config generators (Xcode) require `_dxc_lib_subdir = MinSizeRel/lib` (not plain `lib/` as Ninja uses). Use `${CMAKE_SHARED_LIBRARY_SUFFIX}` for `.dylib` vs `.so`. ([Slang macOS DXIL is a CMake-only problem (C++ path already compiled-in)](../learnings/1780426302028-slang-macos-dxil-is-a-cmake-only-problem-c-path-al.md), [macOS DXC source-build (slang #11434): multi-config output dir is MinSizeRel/lib; no install_name fixup needed](../learnings/1780617039215-macos-dxc-source-build-slang-11434-multi-config-ou.md), [A/B: hardware-gated mac DXC draft was directionally right; the only gap was the multi-config lib subdir](../learnings/1780617153623-a-b-hardware-gated-mac-dxc-draft-was-directionally.md))

### CMake Options workflow: macOS DXC is manually/nightly only, not PR-gated

`.github/workflows/cmake-options.yml` runs `SLANG_DXC_BUILD_FROM_SOURCE=ON` with `macos-debug` + `macos-release` jobs — but this workflow's only triggers are `workflow_dispatch` (manual) and a weekly Saturday cron. It does NOT run on `pull_request`/`merge_group`. To verify a branch: manually dispatch it via `gh workflow run cmake-options.yml --ref <branch>`. The workflow only **builds** — it does not run `slangc`/`slang-test`, so runtime `dlopen`/install_name behavior is NOT covered. When making macOS DXC the default (PR #11439), the `coverage-nightly.yml` macOS job (`coverage-macos`) also sources-builds DXC and is a required gate for the nightly organize/merge step. ([Slang CMake Options workflow already covers DXC source-build on macOS (not PR-triggered)](../learnings/1780428519137-slang-cmake-options-workflow-already-covers-dxc-so.md), [slang macOS DXC-default PR: coverage-nightly coverage-macos is an un-opted-out required gate](../learnings/1780463258746-slang-macos-dxc-default-pr-coverage-nightly-covera.md))

### FindDXC should use plain cache-vars, not IMPORTED targets

Nothing **links** against DXC — `slangc`/`slang-test` `dlopen` it at runtime; the build's only interaction is a file copy. The output contract of `FetchDXC.cmake` is the custom targets `copy-dxcompiler`, `copy-dxil`, `stage-dxc-headers` consumed by name. All three sibling Find modules (`FindNVAPI`, `FindAftermath`, `FindOptiX`) use plain cache vars. An `IMPORTED` target adds zero value (no link/usage requirements to propagate) and would break the copy-target contract. Design: `find_path` + `find_library` + `find_package_handle_standard_args` exposing `DXC_INCLUDE_DIRS`/`DXC_DXCOMPILER_LIBRARY`/`DXC_DXIL_LIBRARY`, then re-emit the same `copy-dxcompiler`/`copy-dxil`/`stage-dxc-headers` targets from the found paths. ([Slang FindDXC should use plain cache-vars not IMPORTED target — DXC is dlopen+copy, never linked](../learnings/1780473187576-slang-finddxc-should-use-plain-cache-vars-not-impo.md))

### Clip-space Z remap is NOT a DXC-parity option

`-fvk-invert-y` and `-fvk-use-dx-position-w` are DXC-compatibility options. A clip-space-Z remap (`-fvk-remap-z`) is NOT — DXC has no such option because D3D, Vulkan, and Metal all share 0..1 NDC depth. A Z-remap is a new Slang-specific surface that needs explicit maintainer design buy-in. ([Clip-space Z remap (slang #11599) is NOT DXC parity — unlike invert-y/position-w](../learnings/1781333043756-clip-space-z-remap-slang-11599-is-not-dxc-parity-u.md))

## slang-llvm prebuilt: ABI skew breaks master ToT builds

Slang resolves the prebuilt `libslang-llvm.so` entry point by versioned name: `findFuncByName("createLLVMBuilder_V<N>")` (`source/slang/slang-emit-llvm.cpp`). When the `LLVMBuilderOptions` struct changes, the symbol is bumped (V2→V3). If master expects `_V3` but the latest published prebuilt only exports `_V2`, the lookup returns null and `slangc` **silently produces no object file**, causing a cryptic link failure (`cannot find examples/cpu-shader-llvm/shader.o`).

Default `SLANG_SLANG_LLVM_FLAVOR=FETCH_BINARY_IF_POSSIBLE` falls back to the latest release when no exact version match exists; the download succeeds so it never falls back to DISABLE — the build just gets an incompatible binary.

Diagnosis: `nm -D -C libslang-llvm.so | grep createLLVMBuilder`. Workarounds: `-DSLANG_SLANG_LLVM_FLAVOR=USE_SYSTEM_LLVM`; `-DSLANG_SLANG_LLVM_BINARY_URL=<url>`; `-DSLANG_SLANG_LLVM_FLAVOR=DISABLE`. PR #11392 added diagnostic E00109 "incompatible-slang-llvm-library" at the null-lookup site. ([slang-llvm prebuilt ABI skew breaks master ToT builds (createLLVMBuilder_V2 vs _V3)](../learnings/1780320688142-slang-llvm-prebuilt-abi-skew-breaks-master-tot-bui.md), [slang-llvm prebuilt V2/V3 ABI skew breaks master ToT build with cryptic 'cannot find shader.o](../learnings/1780324967550-slang-llvm-prebuilt-v2-v3-abi-skew-breaks-master-t.md))

## slang-llvm Windows JIT & teardown crashes (three distinct mechanisms)

Two Windows-only `slang-llvm.dll` crash classes surface as intermittent `test-server.exe` aborts and must not be conflated with each other (or with the AVX-512 SIGILL of #11062, or the compile-time DIBuilder/IRBuilder UAF fixed by PR #12114). **(1) COFF ordered-section relocation abort (#12283).** `createAVX512SafeLLJIT()` (`slang-llvm-jit-shared-library.cpp:63-68`) builds an LLJIT with the DEFAULT object-linking layer, so on Windows x64 each object gets a fresh `SectionMemoryManager` allocating code/rodata/writable as separate VM regions; `IMAGE_REL_AMD64_ADDR32NB` is an unsigned 32-bit image-relative offset that RuntimeDyld requires be laid out in increasing address order, and long-lived-worker address-space fragmentation can defeat that → LLVM fatal `IMAGE_REL_AMD64_ADDR32NB relocation requires an ordered section layout` (fires even in compile-only tests). Both JIT paths funnel through the one helper, so the fix (a Windows-x64 memory manager overriding `reserveAllocationSpace` to reserve ONE contiguous code→rodata→writable region per object) has a single insertion point ([slang-llvm JIT COFF ordered-section crash on Windows (default LLJIT, #12283)](../learnings/1785398074059-slang-llvm-jit-coff-ordered-section-crash-on-windo.md)). **(2) Process-teardown execute-AV from surviving LLVM callbacks (#12292).** A `cpu`/host-callable test prints all output then crashes at process exit with `0xc0000005` in `slang-llvm.dll_unloaded`: the plugin registers process-global LLVM state (`RegisterCodeGenFlags`, `ParseCommandLineOptions`, `InitializeAllTargets`, `InitializeNativeTarget*`) whose `ManagedStatic`/atexit cleanup callbacks live inside the DLL, but there is no `llvm_shutdown()` under `source/slang-llvm/` and Windows `SharedLibrary::unload()` is an unconditional `FreeLibrary` — so the callbacks fire into unmapped memory at CRT exit. This is NOT a `Session`/`ComPtr` destruction-order bug (the process-global atexit runs after the member sweep already unloaded the DLL — reject any "reorder m_slangLLVM" fix); fix by explicit `llvm_shutdown()` before unload, or by pinning the DLL (in-tree precedent: POSIX `RTLD_NODELETE` for libdxcompiler in `slang-platform.cpp:237-249`, plus a Windows `GetModuleHandleExW(...FLAG_PIN...)` equivalent) ([slang-llvm.dll teardown AV = LLVM ManagedStatic/atexit callbacks survive FreeLibrary](../learnings/1785420752652-slang-llvm-dll-teardown-av-llvm-managedstatic-atex.md)). Both classes only reproduce in the source-linked `SLANG_SLANG_LLVM_FLAVOR=USE_SYSTEM_LLVM` config (default builds fetch a prebuilt `libslang-llvm`), so edits to `source/slang-llvm/*.cpp` are not verifiable in a default preset build — the prebuilt must be re-rolled to reach CI.

## Prebuilt LLVM from GCS: public-bucket curl, no auth required

In Slang's GitHub Actions, `setup-llvm-from-gcs` fetches the prebuilt LLVM via a **plain `curl` from a publicly-readable GCS bucket** — no authentication required (`.github/actions/setup-llvm-from-gcs/action.yml:43-44`). The `google-github-actions/auth@v2` / workload-identity step is caller-side and only runs on the upload path (cache-miss on master). The download path needs no Google Cloud auth. When reasoning about moving a build job between runner pools, "the new pool would need GCS/LLVM auth" is a FALSE blocker. The real toolchain blockers are CUDA (must be preinstalled on the image) and sccache (wired in `ci-slang-build.yml`, not `common-setup`). ([slang CI: prebuilt LLVM (setup-llvm-from-gcs) is a public-bucket curl download with NO auth — not a blocker for moving builds between self-hosted pools](../learnings/1780770912978-slang-ci-prebuilt-llvm-setup-llvm-from-gcs-is-a-pu.md))

## GitHub API rate limits: only GitHubRelease.cmake calls api.github.com

The ONLY GitHub REST API (`api.github.com`) calls in Slang's CMake build live in `cmake/GitHubRelease.cmake` (`get_latest` → /releases/latest), used solely to resolve the prebuilt slang-llvm download URL. Actual asset downloads are direct release-asset URLs NOT subject to the REST API rate limit. DXC, webgpu_dawn, and slang-tint all use direct URLs. `SLANG_GITHUB_TOKEN` is referenced in zero `.github/workflows/*.yml`. Rate-limit failures behind corporate firewalls (shared IP exhausting the 60/hr anon quota) come entirely from those `GitHubRelease.cmake` API calls; building the URL directly from the git-tag version removes the exposure. ([Slang CMake: api.github.com used only for slang-llvm version resolution; direct asset downloads aren't rate-limited](../learnings/1780338418439-slang-cmake-api-github-com-used-only-for-slang-llv.md))

## Cheap minimal static Slang build (skip DXC via SLANG_ENABLE_DXIL=OFF)

On Linux with glibc < 2.38, configure triggers a DXC source build (~500MB + 10-30min) via GLIBC auto-detection, even with `SLANG_ENABLE_GFX=OFF`. The switch that skips it entirely is `SLANG_ENABLE_DXIL=OFF`. Minimal static install config:

```
cmake -G "Ninja Multi-Config" -S . -B build-min \
  -DSLANG_LIB_TYPE=STATIC -DSLANG_SLANG_LLVM_FLAVOR=DISABLE \
  -DSLANG_ENABLE_DXIL=OFF -DSLANG_ENABLE_GFX=OFF -DSLANG_ENABLE_SLANG_RHI=OFF \
  -DSLANG_ENABLE_TESTS=OFF -DSLANG_ENABLE_REPLAYER=OFF -DSLANG_ENABLE_EXAMPLES=OFF
cmake --build build-min --config Release   # ~9 min, no DXC
```

The `<target> is not in any export set` packaging error is a **generate-time** diagnostic — a clean `cmake -DSLANG_LIB_TYPE=STATIC` configure (exit 0) proves export safety without any build. ([Cheap minimal static Slang build for install verification (skip DXC via SLANG_ENABLE_DXIL=OFF)](../learnings/1780470809014-cheap-minimal-static-slang-build-for-install-verif.md))

## CMake option conventions: SLANG_OVERRIDE_*_PATH vs SLANG_ENABLE_*

### Override-path convention (two files only, no docs/matrix)

`SLANG_OVERRIDE_<DEP>_PATH` advanced options appear ONLY in two CMake files:
1. Top-level `CMakeLists.txt`: `advanced_option(SLANG_OVERRIDE_<DEP>_PATH "..." OFF)`.
2. `external/CMakeLists.txt`: `if(NOT SLANG_OVERRIDE_<DEP>_PATH)/else()` branch.

Do NOT add a `docs/building.md` row or a `.github/cmake-options-matrix.json` entry — all 14 existing override-path options are CMake-only (verified: `grep -rn SLANG_OVERRIDE docs/ .github/` returns nothing). This differs from `SLANG_ENABLE_*` options, which DO add docs rows + matrix entries.

For header-only INTERFACE deps (fast_float, metal-cpp), the override branches the include-dir STRING, not `add_subdirectory`. Preserve the inline `${system}` SYSTEM keyword that suppresses `-Werror` on bundled headers. Add a configure-time `message(FATAL_ERROR ...)` existence check scoped to the override branch to restore the fail-fast behavior of `add_subdirectory`-based overrides. ([Slang bundled-dep override-path convention + skip DeepWiki for pure-CMake triage](../learnings/1782405218135-slang-bundled-dep-override-path-convention-skip-de.md), [slang SLANG_OVERRIDE_*_PATH options are CMake-only (no docs/matrix), unlike SLANG_ENABLE_*](../learnings/1782406116154-slang-slang-override-path-options-are-cmake-only-n.md), [On pure-CMake override-path PRs, Reviewer C (clarity) is the value-add](../learnings/1782407661384-on-pure-cmake-override-path-prs-reviewer-c-clarity.md))

### Any new CMake option() must be registered in cmake-options-matrix.json

A CI job (added by PR #10945) builds each option at its non-default value; an unregistered option breaks CI. The `SLANG_USE_SYSTEM_*` deps use `find_package(CONFIG)` only because those deps ship upstream configs; DXC ships none, so a system-DXC option requires a hand-written `cmake/FindDXC.cmake`. ([Slang local checkout can be days-stale on actively-developed CMake files; verify against master + options-matrix CI gate](../learnings/1780472551679-slang-local-checkout-can-be-days-stale-on-actively.md))

### CMake CACHE PATH absolutizes relative -D values

When you pass a **relative** path to a `CACHE PATH` variable via `-DVAR=relative/path`, CMake silently converts it to an absolute path relative to the cmake working directory. If downstream code string-concatenates the variable onto another base path, the result is a doubled path. Fix: pass the value typed as a string: `-DVAR:STRING=relative/path`. A `:STRING` override on reconfigure overrides a previously-cached `:PATH` entry without a cache wipe. ([CMake CACHE PATH absolutizes relative -D values against the cmake CWD — pass :STRING to keep them relative](../learnings/1781660657132-cmake-cache-path-absolutizes-relative-d-values-aga.md))

## Falcor: FALCOR_LOCAL_SLANG CMake hook and CI topology

Public Falcor (NVIDIAGameWorks/Falcor) exposes `FALCOR_LOCAL_SLANG` (BOOL) + `FALCOR_LOCAL_SLANG_DIR` + `FALCOR_LOCAL_SLANG_BUILD_DIR` cache vars for using a local Slang build instead of its packman-pinned one. When ON, the `deploy_dependencies` target copies Slang DLLs/SOs from those paths into Falcor's output directory — no manual copy step needed.

Do NOT redirect Slang's `CMAKE_RUNTIME_OUTPUT_DIRECTORY` to emit into an external dir — `cmake/SlangTarget.cmake:204-285` forces ALL per-config dirs to the same path, so Debug and Release overwrite each other in a Ninja-Multi-Config tree. Use `cmake --install --config <cfg> --prefix <dir>` or `FALCOR_LOCAL_SLANG_BUILD_DIR` pointing at Slang's standard per-config `build/<cfg>/bin`.

Falcor CI's workflow is just `cp` into a preinstalled Falcor on a self-hosted Windows runner with no version pin on the Falcor side — fresh Falcor pulls its own Slang via packman. ([Public Falcor has FALCOR_LOCAL_SLANG CMake hook for a custom Slang build](../learnings/1781366574564-public-falcor-has-falcor-local-slang-cmake-hook-fo.md))

## Build subagent that bails mid-build often leaves cmake running

When a delegated Slang build subagent returns early ("build progressing at 156/1154"), the detached `(cmake --build ...)` subshell survives as a background process and continues to completion. Before relaunching, always check:

- `ps -eo pid,etimes,comm,args | grep -E 'ninja|cmake|cc1plus' | grep -v grep` — is a build still running?
- `tail build_out.log` — look for the `BUILD_EXIT=<n>` sentinel line.
- `ls build/Debug/bin/ | grep -E 'slangc|slang-test'` — binaries present yet?

If a build is still running, do NOT start a second `cmake --build` on the same dir — two ninjas on one build dir corrupt object/link state. Arm a one-shot waiter:
```
until grep -q "BUILD_EXIT=" build_out.log; do sleep 20; done; tail -6 build_out.log
```
([Build subagent that bails mid-build often leaves its detached cmake running — check before relaunching](../learnings/1781624196085-build-subagent-that-bails-mid-build-often-leaves-i.md))

## Fixer container disk fills from accumulated build/ trees

The fixer agent group's `/workspace/agent` mount (~251G) can hit 100% ENOSPC at cmake-configure from accumulated per-worktree `build/` directories (~6-7G each × ~17 worktrees ≈ 108-115G). Safe reclaim: `rm -rf <wt>/build` — `build/` is gitignored and fully regenerable. Never remove the `build/` of a worktree with open PRs, uncommitted changes, or local-only commits.

Full worktree removal (`git worktree remove`) is only safe when ALL hold: issue CLOSED + branch on origin (source recoverable) + no uncommitted tracked changes + no local-only commits. The shared `slang/.git` object store (~18G) must be kept. ([Fixer container disk fills from accumulated build/ trees (ENOSPC at cmake-configure)](../learnings/1782151736391-fixer-container-disk-fills-from-accumulated-build-.md))

The volume can accumulate ~45 sibling `wt-slang-*` worktrees at ~7G each (~210G) and hit 98-100% full, at which point `cmake --build` fails with `No space left on device` on assorted *unrelated* .cpp files (NOT a code error) and even `git add`/commit fails ("index.lock write error"). Recognize it: every ninja `FAILED:` line ends in "No space left on device", your edited file never appears in an error line, and `df -h /workspace/agent` shows ~100%. Correct handling: confirm it's disk (grep the log), free ONLY your OWN `build/` (never touch sibling `wt-slang-*/` — worktree isolation), then durably preserve the work (`git commit` + `git show HEAD --format="" > patches/fix-<n>.patch`) so a teardown doesn't lose it, and if a rebuild still won't fit, send a `blocked` `[Fix Report]` with `df -h` — you cannot resolve it yourself ([Shared build volume fills at ~45 worktrees; commit+patch-back, report blocked, never reclaim siblings](../learnings/1783473828121-shared-build-volume-fills-at-45-worktrees-commit-p.md)). Two non-obvious escalation facts: (1) the overlay `/` and `/dev/vdb` are the **same device** (251G), so at ~5G free any coworker's memory write / `git fetch` / build can fail silently — prefer CI fallback over local builds until the operator confirms health, and no coworker can prune other containers' layers or expand the volume (there's no docker CLI inside containers) ([Shared /dev/vdb volume disk-full hazard (98%, 2026-07-08)](../learnings/1783474045764-shared-dev-vdb-volume-disk-full-hazard-98-2026-07-.md)); (2) the standing "reap merged-PR worktrees" grant frequently **frees nothing** — at any moment the fleet's trees are almost all OPEN/parked with few merged-but-unreaped (checked all 42 siblings once: zero reapable), so authorizing the reap and expecting relief is often a no-op. What actually clears it is disk self-recovering as sibling builds finish; a blocked fixer should attempt an *incremental* rebuild (far less headroom) and NOT force-delete open/parked siblings — escalate disk-VOLUME growth to the operator only if the incremental *also* aborts on ENOSPC ([Disk-full on fixer /dev/vdb: reap grant often frees nothing; disk self-recovers](../learnings/1783473857394-disk-full-on-fixer-dev-vdb-reap-grant-often-frees-.md)).

## Sanitizer suppression files: paired removal required on fix

When fixing a Slang sanitizer finding that was previously suppressed, the fix PR MUST also remove the matching entry in `cmake/expected-sanitizer-findings.txt` (and related `lsan-suppressions.txt` / `sanitizer-ignorelist.txt`) in the same PR. Stale entries that match nothing produce CI warnings. Suppressions are often added in a separate earlier PR to unblock the nightly, so the fixer must grep for the matching suppression block by issue number / function name.

The file has two match modes:
- **SUMMARY-mode**: a plain `in <function_name>` line is a substring match against the ASan alloc-dealloc-mismatch summary.
- **LEAK-mode**: a `LEAK:` prefix matched against the Direct-leak call-stack frames.

Removing a SUMMARY-mode entry does NOT unmask a co-located leak on a different path. Read the file's own header (it documents the matching modes) before raising a "premature removal" concern. ([Sanitizer-finding fixes must remove the matching expected-sanitizer-findings.txt suppression in the same PR](../learnings/1782328977641-sanitizer-finding-fixes-must-remove-the-matching-e.md), [expected-sanitizer-findings.txt has two match modes — SUMMARY-substring vs LEAK-prefix](../learnings/1782330515490-expected-sanitizer-findings-txt-has-two-match-mode.md))

## slangc -v version string is stale on incremental builds

`slangc -v` prints a git-describe string (e.g. `2026.10.2-33-g5230a81f2`) that is **baked at CMake CONFIGURE time**, not at compile time. An incremental rebuild (`cmake --build` after new source, without reconfiguring) recompiles the changed code but leaves the version string stale — so never use `slangc -v` to identify which commit a binary was built from ([slangc -v version string is stale on incremental builds — don't use it to identify a binary's commit](../learnings/1782864395490-slangc-v-version-string-is-stale-on-incremental-bu.md)).

## Re-run submodule update after every rebase in a worktree (gitlink staleness)

Run `git submodule update --init --recursive` **after every rebase** in a Slang worktree, not just at worktree creation. A rebase that moves your base onto newer master frequently bumps submodule gitlinks (`external/vulkan`, `external/slang-rhi`, `external/spirv-*`, etc.), but the rebase does NOT check out the new submodule commits — your worktree keeps the OLD ones and the build fails with errors that look unrelated to your change (e.g. `error: 'VkPhysicalDeviceShaderFloat8FeaturesEXT' does not name a type` in slang-rhi's vk-api.h, seen on slang#11315 / PR #11323). A fresh-worktree `git submodule update --init --recursive` can also silently MISS a submodule (`fatal error: fast_float/fast_float.h: No such file` — only 5 submodules listed; fix with an explicit `git submodule update --init external/fast_float`). The gitlink-vs-checkout drift is invisible in `git status` (submodules show clean at the recorded ref only if updated); diagnose by comparing `git ls-tree HEAD external/vulkan` (recorded gitlink) against `git -C external/vulkan rev-parse HEAD` (checked-out) — a mismatch means stale. Shortcut: `slangc` does NOT link `slang-rhi`, so a `--target slangc` build sidesteps the slang-rhi/vulkan-headers mismatch entirely when you only need slangc to verify a compile-only test (SIMPLE/filecheck/DIAGNOSTIC directives) ([Re-run submodule update after every rebase in a worktree (gitlink bumps go stale)](../learnings/1784078101643-re-run-submodule-update-after-every-rebase-in-a-wo.md)).

---
## Release-Build Divergences: LTO Symbol Leaks and LD_LIBRARY_PATH Shadowing (2026-07-20 fold)

Two build/runtime traps where a locally-green result diverges from CI or ships stale logic. **(1) CI release LTO defeats symbol-hiding.** When a symptom appears in the official release ZIPs but not a local `cmake --workflow --preset release` (slang#9146: `libslang-glslang` re-exports C++ stdlib symbols), diff `release.yml`'s configure line against the preset — CI adds `-DSLANG_ENABLE_RELEASE_LTO=ON` (the option defaults **OFF** and no preset sets it). Under LTO, `-Wl,--exclude-libs,ALL` archive-name matching is bypassed because statically-linked archive symbols are merged/re-emitted at link time. LTO is the usual culprit for visibility/exclude-libs regressions ([CI release LTO defeats symbol-hiding that local --preset release keeps](../learnings/1784380337015-ci-release-lto-defeats-symbol-hiding-that-local-pr.md)). **(2) A local slangc can silently run STALE logic via `LD_LIBRARY_PATH`.** The build tree has two lib copies — fresh `build/Debug/lib/` and a days-old packaging staging dir `build/slang-<ver>-<arch>/lib/`; putting the package dir first resolves to the stale lib with no warning (cost ~30 min on slang#11803, seeing a retired diagnostic). Fix: run with NO `LD_LIBRARY_PATH` (rpath already points at `build/Debug/lib`), or list `build/Debug/lib` first; freshness self-check by confirming a recently-changed diagnostic emits its NEW message ([local slangc can silently run stale logic via LD_LIBRARY_PATH lib shadowing](../learnings/1784435219287-local-slangc-can-silently-run-stale-logic-via-ld-l.md)).

## external/ Dependency Kinds at HEAD + Build-Subagent Concurrent-Corruption (2026-07-22 fold)

**`external/` has FOUR content kinds and the enable/config option for a submodule is not always in `external/CMakeLists.txt` — verify at HEAD.** Two stale beliefs corrected while triaging #12176: (1) **lua IS consumed** by the build (backs `slang-fiddle`, wired via `SLANG_OVERRIDE_LUA_PATH` in `tools/CMakeLists.txt:59`) — a code-reader grepping only `external/CMakeLists.txt` misses it because lua's consumer lives under `tools/`; same for glm and tinyobjloader (graphics examples). (2) **mimalloc is now a real SHA-pinned submodule** (`.gitmodules:67`), not the earlier configure-time git-clone download — cite HEAD, not the old download-fetch learning. The four kinds: git submodules (18 at HEAD), vendored checked-in headers (dxc/, stb/, spirv/), build-time generated (glslang-generated/), and fetched-prebuilt-binary (DXC, slang-tint, webgpu_dawn, slang-llvm). Knob families: `SLANG_ENABLE_*`, `SLANG_USE_SYSTEM_*` (→ find_package), `SLANG_OVERRIDE_*_PATH`, plus `.gitmodules` pin-policy overrides ([external/ deps at HEAD: lua IS consumed (slang-fiddle), mimalloc is now a real submodule](../learnings/1784655012400-external-deps-at-head-lua-is-consumed-slang-fiddle.md)).

**A build `Agent` subagent auto-relaunches `cmake --build` on ANY failure — two concurrent builds on ONE build dir corrupt shared archives.** Symptom: `ranlib: <lib>.a: malformed archive` / `FAILED: …/libSPIRV-Tools-opt.a` on a dependency you didn't touch — easy to misread as a real compile break, but it's concurrency (disk is fine; `df -h` healthy). The subagent can relaunch repeatedly AND keep old trees alive (2-3 concurrent builds on one dir), and it fabricated a confident-but-WRONG root cause ("GLIBC too old, DXC can't build from source") that a sibling worktree's same-day slang-test binary immediately disproved. Takeaways: (1) prefer `Bash(run_in_background=true)` you OWN over a build subagent — one process, no hidden relaunch, same completion notification, and you can Monitor the logfile; (2) sanity-check any dramatic environment root cause against a sibling worktree binary mtime; (3) recover isolation-safely — confirm `/proc/<pid>/cwd` is under YOUR worktree before `kill`, NEVER `pkill ninja` globally (kills sibling fixers), `rm -f` the corrupt `.a`, relaunch ONE non-retrying build; (4) `pgrep -fc "cmake --build" > 1` may just be sibling fixers on their own dirs — only concurrency on the SAME dir corrupts ([build subagent auto-relaunch → concurrent-build archive corruption](../learnings/1784659482124-build-subagent-auto-relaunch-on-failure-concurrent.md), [build subagents relaunch builds — use run_in_background you control instead](../learnings/1784660385128-build-subagents-relaunch-builds-use-run-in-backgro.md)).

## -Og Debug Builds (#12140) Break Debugging → Gate Behind a CMake Option (2026-07-24 fold)

`#12223` (regression/P2, build-system): after PR #12140 (merged, skiminki-nv), GCC/Clang **Debug** builds compile at `-Og` instead of `-O0`, producing `<optimized out>` locals and single-steps that jump across functions. Mechanism verified from source (`cmake/CompilerFlags.cmake:195`): `target_compile_options(... $<$<CONFIG:Debug>:-Og>)` is appended *after* `CMAKE_CXX_FLAGS_DEBUG` (`-O0 -g`), so by last-`-O`-wins the Debug config actually compiles at `-Og` (which permits inlining + variable-lifetime opts + line-table reordering), with no opt-out short of editing source. Two triage learnings: (1) the fix *mechanism* is settled — gate `-Og` behind a new `option(SLANG_ENABLE_DEBUG_OPTIMIZATION ...)` AND-ed into the guard, mirroring the `SLANG_ENABLE_RELEASE_LTO` convention — but the **default is a maintainer design gate** (ON keeps #12140's ~4× Debug-build speedup for CI; OFF makes a config named "Debug" debuggable by default since `RelWithDebInfo` already = fast+debug-info); a straight revert discards a benchmarked win. When two core members hold opposing values (reporter vs PR author), PARK-at-triaged + forward the fixer handoff as **HELD/do-not-implement** rather than baking in an unresolved default. (2) Reproducing a build-flag regression's *severity* needs the reporter's toolchain — the flag change is verifiable from source (→ label `regression`), but the `<optimized out>` symptom severity scales with optimizer aggressiveness (GCC 15) + codebase complexity, so withhold `reproduced` and label the symptom-severity a hypothesis when you can't match the reporter's GCC / do a full Debug build ([-Og Debug builds (#12140) break debugging → gate behind SLANG_ENABLE_* option; default is a design gate (#12223)](../learnings/1784925326386-og-debug-builds-12140-break-debugging-gate-behind-.md)).

**Two coupled gotchas make `SLANG_ASSERT` inert in this container's default build.** `SLANG_ASSERT(cond)` is `#ifdef _DEBUG`; in a non-`_DEBUG` build it expands to `SLANG_ASSUME`/`__builtin_assume(cond)` — the optimizer is told `cond` is always true and may **delete any code that only runs when `cond` is false**. And the stock `debug` CMake preset here actually produces `CMAKE_BUILD_TYPE=Release` (check `build/CMakeCache.txt`), so a `SLANG_ASSERT` you add will not fire locally even when its predicate is false — a violation is silently skipped, your tests pass, but a real `_DEBUG`/CI build aborts (this cost a review round on PR #12263, where an inert `getConstant` shape-assert only codex caught) ([local Debug preset builds Release → SLANG_ASSERT is inert](../learnings/1785342311498-local-slang-debug-preset-builds-cmake-build-type-r.md)). The coding consequence: **never assert a precondition you also runtime-guard on** — `SLANG_ASSERT(x); if(!x) return fallback;` lets release prove the fallback dead and delete it. Use a plain `if/else` runtime guard (with a rationale comment) for any condition that is a real discriminant now or under a future PR; reserve `SLANG_ASSERT` for genuinely-impossible states and `SLANG_RELEASE_ASSERT` for "crash loudly in release" ([SLANG_ASSERT becomes __builtin_assume in release — never assert a precondition you also guard on](../learnings/1785335639560-slang-assert-becomes-builtin-assume-in-release-nev.md)). To actually exercise asserts locally, configure `-DCMAKE_BUILD_TYPE=Debug`.

**Source learnings (42):**
- [slang-llvm JIT COFF ordered-section crash on Windows (default LLJIT, #12283); single insertion point via createAVX512SafeLLJIT](../learnings/1785398074059-slang-llvm-jit-coff-ordered-section-crash-on-windo.md)
- [slang-llvm.dll teardown AV on Windows = LLVM ManagedStatic/atexit callbacks survive FreeLibrary (#12292); not a ComPtr order bug; fix via llvm_shutdown or DLL pin](../learnings/1785420752652-slang-llvm-dll-teardown-av-llvm-managedstatic-atex.md)
- [-Og Debug builds (#12140) break debugging → gate behind SLANG_ENABLE_* option; default is a design gate (#12223); last-`-O`-wins mechanism](../learnings/1784925326386-og-debug-builds-12140-break-debugging-gate-behind-.md)
- [CI `-DSLANG_ENABLE_RELEASE_LTO=ON` defeats hidden-visibility/`--exclude-libs` that local `--preset release` keeps](../learnings/1784380337015-ci-release-lto-defeats-symbol-hiding-that-local-pr.md)
- [local slangc runs STALE logic when `LD_LIBRARY_PATH` puts the package staging lib dir before `build/Debug/lib`](../learnings/1784435219287-local-slangc-can-silently-run-stale-logic-via-ld-l.md)
- [slangc Debug-build LD_LIBRARY_PATH order matters when prebuilt lib is colocated](../learnings/1779369251370-slangc-debug-build-ld-library-path-order-matters-w.md)
- [DXC v1.10.2605.2 prebuilts require GLIBC 2.38 (blocks Ubuntu 22.04 CI)](../learnings/1779429443648-dxc-v1-10-2605-2-prebuilts-require-glibc-2-38-bloc.md)
- [slang-llvm prebuilt ABI skew breaks master ToT builds (createLLVMBuilder_V2 vs _V3)](../learnings/1780320688142-slang-llvm-prebuilt-abi-skew-breaks-master-tot-bui.md)
- [slang-llvm prebuilt V2/V3 ABI skew breaks master ToT build with cryptic "cannot find shader.o"](../learnings/1780324967550-slang-llvm-prebuilt-v2-v3-abi-skew-breaks-master-t.md)
- [Slang CMake: api.github.com used only for slang-llvm version resolution; direct asset downloads aren't rate-limited](../learnings/1780338418439-slang-cmake-api-github-com-used-only-for-slang-llv.md)
- [Slang macOS DXIL is a CMake-only problem (C++ path already compiled-in)](../learnings/1780426302028-slang-macos-dxil-is-a-cmake-only-problem-c-path-al.md)
- [Slang CMake Options workflow already covers DXC source-build on macOS (not PR-triggered)](../learnings/1780428519137-slang-cmake-options-workflow-already-covers-dxc-so.md)
- [slang macOS DXC-default PR: coverage-nightly coverage-macos is an un-opted-out required gate](../learnings/1780463258746-slang-macos-dxc-default-pr-coverage-nightly-covera.md)
- [Cheap minimal static Slang build for install verification (skip DXC via SLANG_ENABLE_DXIL=OFF)](../learnings/1780470809014-cheap-minimal-static-slang-build-for-install-verif.md)
- [Slang local checkout can be days-stale on actively-developed CMake files](../learnings/1780472551679-slang-local-checkout-can-be-days-stale-on-actively.md)
- [Slang DXC/build-system triage: local clone lags master; verify FetchDXC against upstream via gh api](../learnings/1780472891485-slang-dxc-build-system-triage-local-clone-lags-mas.md)
- [Slang FindDXC should use plain cache-vars not IMPORTED target — DXC is dlopen+copy, never linked](../learnings/1780473187576-slang-finddxc-should-use-plain-cache-vars-not-impo.md)
- [macOS DXC source-build (slang #11434): multi-config output dir is MinSizeRel/lib; no install_name fixup needed](../learnings/1780617039215-macos-dxc-source-build-slang-11434-multi-config-ou.md)
- [A/B: hardware-gated mac DXC draft was directionally right; the only gap was the multi-config lib subdir](../learnings/1780617153623-a-b-hardware-gated-mac-dxc-draft-was-directionally.md)
- [slang CI: prebuilt LLVM (setup-llvm-from-gcs) is a public-bucket curl download with NO auth](../learnings/1780770912978-slang-ci-prebuilt-llvm-setup-llvm-from-gcs-is-a-pu.md)
- [Clip-space Z remap (slang #11599) is NOT DXC parity — unlike invert-y/position-w](../learnings/1781333043756-clip-space-z-remap-slang-11599-is-not-dxc-parity-u.md)
- [Public Falcor has FALCOR_LOCAL_SLANG CMake hook for a custom Slang build](../learnings/1781366574564-public-falcor-has-falcor-local-slang-cmake-hook-fo.md)
- [Build subagent that bails mid-build often leaves its detached cmake running — check before relaunching](../learnings/1781624196085-build-subagent-that-bails-mid-build-often-leaves-i.md)
- [CMake CACHE PATH absolutizes relative -D values against the cmake CWD — pass :STRING to keep them relative](../learnings/1781660657132-cmake-cache-path-absolutizes-relative-d-values-aga.md)
- [Fixer container disk fills from accumulated build/ trees (ENOSPC at cmake-configure)](../learnings/1782151736391-fixer-container-disk-fills-from-accumulated-build-.md)
- [Sanitizer-finding fixes must remove the matching expected-sanitizer-findings.txt suppression in the same PR](../learnings/1782328977641-sanitizer-finding-fixes-must-remove-the-matching-e.md)
- [expected-sanitizer-findings.txt has two match modes — SUMMARY-substring vs LEAK-prefix](../learnings/1782330515490-expected-sanitizer-findings-txt-has-two-match-mode.md)
- [Slang bundled-dep override-path convention + skip DeepWiki for pure-CMake triage](../learnings/1782405218135-slang-bundled-dep-override-path-convention-skip-de.md)
- [slang SLANG_OVERRIDE_*_PATH options are CMake-only (no docs/matrix), unlike SLANG_ENABLE_*](../learnings/1782406116154-slang-slang-override-path-options-are-cmake-only-n.md)
- [On pure-CMake override-path PRs, Reviewer C (clarity) is the value-add](../learnings/1782407661384-on-pure-cmake-override-path-prs-reviewer-c-clarity.md)
- [external/dxc is 2 vendored compile-time DXC API headers, not a submodule](../learnings/1782491016302-external-dxc-is-2-vendored-compile-time-dxc-api-he.md)
- [slangc -v version string is stale on incremental builds — don't use it to identify a binary's commit](../learnings/1782864395490-slangc-v-version-string-is-stale-on-incremental-bu.md)
- [Shared build volume fills at ~45 worktrees; commit+patch-back, report blocked, never reclaim siblings](../learnings/1783473828121-shared-build-volume-fills-at-45-worktrees-commit-p.md)
- [Shared /dev/vdb volume disk-full hazard (98%, 2026-07-08)](../learnings/1783474045764-shared-dev-vdb-volume-disk-full-hazard-98-2026-07-.md)
- [Disk-full on fixer /dev/vdb: reap grant often frees nothing; disk self-recovers](../learnings/1783473857394-disk-full-on-fixer-dev-vdb-reap-grant-often-frees-.md)
- [Re-run submodule update after every rebase in a worktree (gitlink bumps go stale)](../learnings/1784078101643-re-run-submodule-update-after-every-rebase-in-a-wo.md)
- [fresh Release/bin/slangc needs the packaged lib dir on LD_LIBRARY_PATH (Release/lib first) else segfault masks the real bug](../learnings/1784336671594-slang-build-fresh-release-bin-slangc-needs-package.md)
- [external/ deps at HEAD: lua IS consumed (slang-fiddle, wired in tools/), mimalloc is now a real submodule; four content kinds](../learnings/1784655012400-external-deps-at-head-lua-is-consumed-slang-fiddle.md)
- [build subagent auto-relaunch on failure → concurrent-build archive corruption (malformed .a); isolation-safe recovery](../learnings/1784659482124-build-subagent-auto-relaunch-on-failure-concurrent.md)
- [build subagents relaunch builds + fabricate env root causes — prefer run_in_background you own; sanity-check vs sibling binary mtime](../learnings/1784660385128-build-subagents-relaunch-builds-use-run-in-backgro.md)
- [the container's `debug` preset builds `CMAKE_BUILD_TYPE=Release` → `SLANG_ASSERT` is inert (compiles to `__builtin_assume`); test assert logic under real `-DCMAKE_BUILD_TYPE=Debug` or by reasoning](../learnings/1785342311498-local-slang-debug-preset-builds-cmake-build-type-r.md)
- [never assert a precondition you also runtime-guard on — release `__builtin_assume` proves the fallback dead and deletes it; use `if/else` for real discriminants, `SLANG_RELEASE_ASSERT` to crash loudly](../learnings/1785335639560-slang-assert-becomes-builtin-assume-in-release-nev.md)

_Catalog: [catalog](../index.md)_
