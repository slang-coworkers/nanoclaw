---
title: "Build System, Runtime Libraries & Debug Workflows"
type: concept
group: slang-tooling
tags: [cmake, dxc, llvm, glibc, ld_library_path, sanitizer, build, prebuilt, disk, falcor, sccache, ci]
source_count: 25
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

This also bites when running `slang-test` from another worktree: slang-test's RUNPATH points at its own sibling `lib`, so it loads its own `libslang-compiler.so` regardless of the `slangc` binary you pass via `-bindir`. To exercise a fix end-to-end through slang-test, build slang-test in the SAME worktree as the patch. ([[wiki/learnings/1779369251370-slangc-debug-build-ld-library-path-order-matters-w.md]])

## DXC prebuilts: GLIBC requirements and header staging

### GLIBC 2.38 requirement for DXC v1.10.2605.2

The prebuilt Linux binaries for DXC v1.10.2605.2 (first official build with SM 6.10 / `dx/linalg.h`) are linked against **GLIBC_2.38**. This blocks Ubuntu 22.04 (GLIBC 2.35) and Debian 12 (GLIBC 2.36). Ubuntu 24.04 and Debian 13 (GLIBC 2.39) are fine. Slang CI uses `ubuntu-22.04` for many Linux jobs — bumping DXC alone breaks the DXIL load path on those runners. Verify the loaded version: `objdump -T libdxcompiler.so | grep -oP 'GLIBC_2\.[0-9]+' | sort -V -u`. ([[wiki/learnings/1779429443648-dxc-v1-10-2605-2-prebuilts-require-glibc-2-38-bloc.md]])

### dx/linalg.h header staging

Cooperative-vector/matrix tests carry `-Xdxc -Ibuild/dxc/include` to let DXC find `dx/linalg.h`, but no CMake rule populates that path by default. The DXC tarball ships headers at `_deps/dxc-src/include/hlsl/dx/linalg.h`. Add to `cmake/FetchDXC.cmake` after `FetchContent_MakeAvailable(dxc)`:

```cmake
if(IS_DIRECTORY "${dxc_SOURCE_DIR}/include/hlsl")
    file(COPY "${dxc_SOURCE_DIR}/include/hlsl/"
         DESTINATION "${CMAKE_BINARY_DIR}/dxc/include")
endif()
```

### external/dxc: vendored compile-time headers, not a submodule

`external/dxc/` contains exactly two vendored Microsoft headers (~66 KB): `dxcapi.h` (DXC COM API entry points) and `WinAdapter.h` (Windows-type shim). They are a **compile-time** dependency of `source/compiler-core/slang-dxc-compiler.cpp` — NOT what `cmake/FetchDXC.cmake` handles. FetchDXC downloads the DXC runtime binaries and HLSL headers. Vendoring keeps the C++ compile decoupled from a network fetch; de-vendoring to source the headers from the DXC fetch would couple C++ compilation to a ~10-30 min source build and break offline/ARM builds. ([[wiki/learnings/1782491016302-external-dxc-is-2-vendored-compile-time-dxc-api-he.md]])

## DXC CMake: source-build, macOS, and FindDXC design

### FetchDXC decision cascade (master as of early June 2026)

`cmake/FetchDXC.cmake` is a ~876-line source-build module (rewritten by PR #10935 merged 2026-06-02 + PR #11434 merged 2026-06-03). When triaging DXC CMake issues, always verify against upstream: `gh api repos/shader-slang/slang/contents/cmake/FetchDXC.cmake --jq '.content' | base64 -d > /tmp/x.cmake`. The local clone can lag by days. ([[wiki/learnings/1780472891485-slang-dxc-build-system-triage-local-clone-lags-mas.md]])

### macOS DXC: C++ path is compiled-in; blockage is CMake only

The DXC C++ path is already compiled-in on macOS. `source/compiler-core/slang-dxc-compiler.cpp:21-27` defaults `SLANG_ENABLE_DXIL_SUPPORT 0` on `SLANG_APPLE_FAMILY`, BUT it is guarded by `#ifndef`. `cmake/CompilerFlags.cmake:220` ALWAYS defines `SLANG_ENABLE_DXIL_SUPPORT=$<BOOL:${SLANG_ENABLE_DXIL}>` (default ON), so the CMake-defined macro wins. Enabling DXIL on macOS is a pure CMake fetch/build/stage problem. The source-build branch in `FetchDXC.cmake` was previously gated `if(Linux OR Windows)` only; PR #11434 lifted the gate. Multi-config generators (Xcode) require `_dxc_lib_subdir = MinSizeRel/lib` (not plain `lib/` as Ninja uses). Use `${CMAKE_SHARED_LIBRARY_SUFFIX}` for `.dylib` vs `.so`. ([[wiki/learnings/1780426302028-slang-macos-dxil-is-a-cmake-only-problem-c-path-al.md]], [[wiki/learnings/1780617039215-macos-dxc-source-build-slang-11434-multi-config-ou.md]], [[wiki/learnings/1780617153623-a-b-hardware-gated-mac-dxc-draft-was-directionally.md]])

### CMake Options workflow: macOS DXC is manually/nightly only, not PR-gated

`.github/workflows/cmake-options.yml` runs `SLANG_DXC_BUILD_FROM_SOURCE=ON` with `macos-debug` + `macos-release` jobs — but this workflow's only triggers are `workflow_dispatch` (manual) and a weekly Saturday cron. It does NOT run on `pull_request`/`merge_group`. To verify a branch: manually dispatch it via `gh workflow run cmake-options.yml --ref <branch>`. The workflow only **builds** — it does not run `slangc`/`slang-test`, so runtime `dlopen`/install_name behavior is NOT covered. When making macOS DXC the default (PR #11439), the `coverage-nightly.yml` macOS job (`coverage-macos`) also sources-builds DXC and is a required gate for the nightly organize/merge step. ([[wiki/learnings/1780428519137-slang-cmake-options-workflow-already-covers-dxc-so.md]], [[wiki/learnings/1780463258746-slang-macos-dxc-default-pr-coverage-nightly-covera.md]])

### FindDXC should use plain cache-vars, not IMPORTED targets

Nothing **links** against DXC — `slangc`/`slang-test` `dlopen` it at runtime; the build's only interaction is a file copy. The output contract of `FetchDXC.cmake` is the custom targets `copy-dxcompiler`, `copy-dxil`, `stage-dxc-headers` consumed by name. All three sibling Find modules (`FindNVAPI`, `FindAftermath`, `FindOptiX`) use plain cache vars. An `IMPORTED` target adds zero value (no link/usage requirements to propagate) and would break the copy-target contract. Design: `find_path` + `find_library` + `find_package_handle_standard_args` exposing `DXC_INCLUDE_DIRS`/`DXC_DXCOMPILER_LIBRARY`/`DXC_DXIL_LIBRARY`, then re-emit the same `copy-dxcompiler`/`copy-dxil`/`stage-dxc-headers` targets from the found paths. ([[wiki/learnings/1780473187576-slang-finddxc-should-use-plain-cache-vars-not-impo.md]])

### Clip-space Z remap is NOT a DXC-parity option

`-fvk-invert-y` and `-fvk-use-dx-position-w` are DXC-compatibility options. A clip-space-Z remap (`-fvk-remap-z`) is NOT — DXC has no such option because D3D, Vulkan, and Metal all share 0..1 NDC depth. A Z-remap is a new Slang-specific surface that needs explicit maintainer design buy-in. ([[wiki/learnings/1781333043756-clip-space-z-remap-slang-11599-is-not-dxc-parity-u.md]])

## slang-llvm prebuilt: ABI skew breaks master ToT builds

Slang resolves the prebuilt `libslang-llvm.so` entry point by versioned name: `findFuncByName("createLLVMBuilder_V<N>")` (`source/slang/slang-emit-llvm.cpp`). When the `LLVMBuilderOptions` struct changes, the symbol is bumped (V2→V3). If master expects `_V3` but the latest published prebuilt only exports `_V2`, the lookup returns null and `slangc` **silently produces no object file**, causing a cryptic link failure (`cannot find examples/cpu-shader-llvm/shader.o`).

Default `SLANG_SLANG_LLVM_FLAVOR=FETCH_BINARY_IF_POSSIBLE` falls back to the latest release when no exact version match exists; the download succeeds so it never falls back to DISABLE — the build just gets an incompatible binary.

Diagnosis: `nm -D -C libslang-llvm.so | grep createLLVMBuilder`. Workarounds: `-DSLANG_SLANG_LLVM_FLAVOR=USE_SYSTEM_LLVM`; `-DSLANG_SLANG_LLVM_BINARY_URL=<url>`; `-DSLANG_SLANG_LLVM_FLAVOR=DISABLE`. PR #11392 added diagnostic E00109 "incompatible-slang-llvm-library" at the null-lookup site. ([[wiki/learnings/1780320688142-slang-llvm-prebuilt-abi-skew-breaks-master-tot-bui.md]], [[wiki/learnings/1780324967550-slang-llvm-prebuilt-v2-v3-abi-skew-breaks-master-t.md]])

## Prebuilt LLVM from GCS: public-bucket curl, no auth required

In Slang's GitHub Actions, `setup-llvm-from-gcs` fetches the prebuilt LLVM via a **plain `curl` from a publicly-readable GCS bucket** — no authentication required (`.github/actions/setup-llvm-from-gcs/action.yml:43-44`). The `google-github-actions/auth@v2` / workload-identity step is caller-side and only runs on the upload path (cache-miss on master). The download path needs no Google Cloud auth. When reasoning about moving a build job between runner pools, "the new pool would need GCS/LLVM auth" is a FALSE blocker. The real toolchain blockers are CUDA (must be preinstalled on the image) and sccache (wired in `ci-slang-build.yml`, not `common-setup`). ([[wiki/learnings/1780770912978-slang-ci-prebuilt-llvm-setup-llvm-from-gcs-is-a-pu.md]])

## GitHub API rate limits: only GitHubRelease.cmake calls api.github.com

The ONLY GitHub REST API (`api.github.com`) calls in Slang's CMake build live in `cmake/GitHubRelease.cmake` (`get_latest` → /releases/latest), used solely to resolve the prebuilt slang-llvm download URL. Actual asset downloads are direct release-asset URLs NOT subject to the REST API rate limit. DXC, webgpu_dawn, and slang-tint all use direct URLs. `SLANG_GITHUB_TOKEN` is referenced in zero `.github/workflows/*.yml`. Rate-limit failures behind corporate firewalls (shared IP exhausting the 60/hr anon quota) come entirely from those `GitHubRelease.cmake` API calls; building the URL directly from the git-tag version removes the exposure. ([[wiki/learnings/1780338418439-slang-cmake-api-github-com-used-only-for-slang-llv.md]])

## Cheap minimal static Slang build (skip DXC via SLANG_ENABLE_DXIL=OFF)

On Linux with glibc < 2.38, configure triggers a DXC source build (~500MB + 10-30min) via GLIBC auto-detection, even with `SLANG_ENABLE_GFX=OFF`. The switch that skips it entirely is `SLANG_ENABLE_DXIL=OFF`. Minimal static install config:

```
cmake -G "Ninja Multi-Config" -S . -B build-min \
  -DSLANG_LIB_TYPE=STATIC -DSLANG_SLANG_LLVM_FLAVOR=DISABLE \
  -DSLANG_ENABLE_DXIL=OFF -DSLANG_ENABLE_GFX=OFF -DSLANG_ENABLE_SLANG_RHI=OFF \
  -DSLANG_ENABLE_TESTS=OFF -DSLANG_ENABLE_REPLAYER=OFF -DSLANG_ENABLE_EXAMPLES=OFF
cmake --build build-min --config Release   # ~9 min, no DXC
```

The `<target> is not in any export set` packaging error is a **generate-time** diagnostic — a clean `cmake -DSLANG_LIB_TYPE=STATIC` configure (exit 0) proves export safety without any build. ([[wiki/learnings/1780470809014-cheap-minimal-static-slang-build-for-install-verif.md]])

## CMake option conventions: SLANG_OVERRIDE_*_PATH vs SLANG_ENABLE_*

### Override-path convention (two files only, no docs/matrix)

`SLANG_OVERRIDE_<DEP>_PATH` advanced options appear ONLY in two CMake files:
1. Top-level `CMakeLists.txt`: `advanced_option(SLANG_OVERRIDE_<DEP>_PATH "..." OFF)`.
2. `external/CMakeLists.txt`: `if(NOT SLANG_OVERRIDE_<DEP>_PATH)/else()` branch.

Do NOT add a `docs/building.md` row or a `.github/cmake-options-matrix.json` entry — all 14 existing override-path options are CMake-only (verified: `grep -rn SLANG_OVERRIDE docs/ .github/` returns nothing). This differs from `SLANG_ENABLE_*` options, which DO add docs rows + matrix entries.

For header-only INTERFACE deps (fast_float, metal-cpp), the override branches the include-dir STRING, not `add_subdirectory`. Preserve the inline `${system}` SYSTEM keyword that suppresses `-Werror` on bundled headers. Add a configure-time `message(FATAL_ERROR ...)` existence check scoped to the override branch to restore the fail-fast behavior of `add_subdirectory`-based overrides. ([[wiki/learnings/1782405218135-slang-bundled-dep-override-path-convention-skip-de.md]], [[wiki/learnings/1782406116154-slang-slang-override-path-options-are-cmake-only-n.md]], [[wiki/learnings/1782407661384-on-pure-cmake-override-path-prs-reviewer-c-clarity.md]])

### Any new CMake option() must be registered in cmake-options-matrix.json

A CI job (added by PR #10945) builds each option at its non-default value; an unregistered option breaks CI. The `SLANG_USE_SYSTEM_*` deps use `find_package(CONFIG)` only because those deps ship upstream configs; DXC ships none, so a system-DXC option requires a hand-written `cmake/FindDXC.cmake`. ([[wiki/learnings/1780472551679-slang-local-checkout-can-be-days-stale-on-actively.md]])

### CMake CACHE PATH absolutizes relative -D values

When you pass a **relative** path to a `CACHE PATH` variable via `-DVAR=relative/path`, CMake silently converts it to an absolute path relative to the cmake working directory. If downstream code string-concatenates the variable onto another base path, the result is a doubled path. Fix: pass the value typed as a string: `-DVAR:STRING=relative/path`. A `:STRING` override on reconfigure overrides a previously-cached `:PATH` entry without a cache wipe. ([[wiki/learnings/1781660657132-cmake-cache-path-absolutizes-relative-d-values-aga.md]])

## Falcor: FALCOR_LOCAL_SLANG CMake hook and CI topology

Public Falcor (NVIDIAGameWorks/Falcor) exposes `FALCOR_LOCAL_SLANG` (BOOL) + `FALCOR_LOCAL_SLANG_DIR` + `FALCOR_LOCAL_SLANG_BUILD_DIR` cache vars for using a local Slang build instead of its packman-pinned one. When ON, the `deploy_dependencies` target copies Slang DLLs/SOs from those paths into Falcor's output directory — no manual copy step needed.

Do NOT redirect Slang's `CMAKE_RUNTIME_OUTPUT_DIRECTORY` to emit into an external dir — `cmake/SlangTarget.cmake:204-285` forces ALL per-config dirs to the same path, so Debug and Release overwrite each other in a Ninja-Multi-Config tree. Use `cmake --install --config <cfg> --prefix <dir>` or `FALCOR_LOCAL_SLANG_BUILD_DIR` pointing at Slang's standard per-config `build/<cfg>/bin`.

Falcor CI's workflow is just `cp` into a preinstalled Falcor on a self-hosted Windows runner with no version pin on the Falcor side — fresh Falcor pulls its own Slang via packman. ([[wiki/learnings/1781366574564-public-falcor-has-falcor-local-slang-cmake-hook-fo.md]])

## Build subagent that bails mid-build often leaves cmake running

When a delegated Slang build subagent returns early ("build progressing at 156/1154"), the detached `(cmake --build ...)` subshell survives as a background process and continues to completion. Before relaunching, always check:

- `ps -eo pid,etimes,comm,args | grep -E 'ninja|cmake|cc1plus' | grep -v grep` — is a build still running?
- `tail build_out.log` — look for the `BUILD_EXIT=<n>` sentinel line.
- `ls build/Debug/bin/ | grep -E 'slangc|slang-test'` — binaries present yet?

If a build is still running, do NOT start a second `cmake --build` on the same dir — two ninjas on one build dir corrupt object/link state. Arm a one-shot waiter:
```
until grep -q "BUILD_EXIT=" build_out.log; do sleep 20; done; tail -6 build_out.log
```
([[wiki/learnings/1781624196085-build-subagent-that-bails-mid-build-often-leaves-i.md]])

## Fixer container disk fills from accumulated build/ trees

The fixer agent group's `/workspace/agent` mount (~251G) can hit 100% ENOSPC at cmake-configure from accumulated per-worktree `build/` directories (~6-7G each × ~17 worktrees ≈ 108-115G). Safe reclaim: `rm -rf <wt>/build` — `build/` is gitignored and fully regenerable. Never remove the `build/` of a worktree with open PRs, uncommitted changes, or local-only commits.

Full worktree removal (`git worktree remove`) is only safe when ALL hold: issue CLOSED + branch on origin (source recoverable) + no uncommitted tracked changes + no local-only commits. The shared `slang/.git` object store (~18G) must be kept. ([[wiki/learnings/1782151736391-fixer-container-disk-fills-from-accumulated-build-.md]])

## Sanitizer suppression files: paired removal required on fix

When fixing a Slang sanitizer finding that was previously suppressed, the fix PR MUST also remove the matching entry in `cmake/expected-sanitizer-findings.txt` (and related `lsan-suppressions.txt` / `sanitizer-ignorelist.txt`) in the same PR. Stale entries that match nothing produce CI warnings. Suppressions are often added in a separate earlier PR to unblock the nightly, so the fixer must grep for the matching suppression block by issue number / function name.

The file has two match modes:
- **SUMMARY-mode**: a plain `in <function_name>` line is a substring match against the ASan alloc-dealloc-mismatch summary.
- **LEAK-mode**: a `LEAK:` prefix matched against the Direct-leak call-stack frames.

Removing a SUMMARY-mode entry does NOT unmask a co-located leak on a different path. Read the file's own header (it documents the matching modes) before raising a "premature removal" concern. ([[wiki/learnings/1782328977641-sanitizer-finding-fixes-must-remove-the-matching-e.md]], [[wiki/learnings/1782330515490-expected-sanitizer-findings-txt-has-two-match-mode.md]])

---
**Source learnings (25):**
- [[wiki/learnings/1779369251370-slangc-debug-build-ld-library-path-order-matters-w.md]] — slangc Debug-build LD_LIBRARY_PATH order matters when prebuilt lib is colocated
- [[wiki/learnings/1779429443648-dxc-v1-10-2605-2-prebuilts-require-glibc-2-38-bloc.md]] — DXC v1.10.2605.2 prebuilts require GLIBC 2.38 (blocks Ubuntu 22.04 CI)
- [[wiki/learnings/1780320688142-slang-llvm-prebuilt-abi-skew-breaks-master-tot-bui.md]] — slang-llvm prebuilt ABI skew breaks master ToT builds (createLLVMBuilder_V2 vs _V3)
- [[wiki/learnings/1780324967550-slang-llvm-prebuilt-v2-v3-abi-skew-breaks-master-t.md]] — slang-llvm prebuilt V2/V3 ABI skew breaks master ToT build with cryptic "cannot find shader.o"
- [[wiki/learnings/1780338418439-slang-cmake-api-github-com-used-only-for-slang-llv.md]] — Slang CMake: api.github.com used only for slang-llvm version resolution; direct asset downloads aren't rate-limited
- [[wiki/learnings/1780426302028-slang-macos-dxil-is-a-cmake-only-problem-c-path-al.md]] — Slang macOS DXIL is a CMake-only problem (C++ path already compiled-in)
- [[wiki/learnings/1780428519137-slang-cmake-options-workflow-already-covers-dxc-so.md]] — Slang CMake Options workflow already covers DXC source-build on macOS (not PR-triggered)
- [[wiki/learnings/1780463258746-slang-macos-dxc-default-pr-coverage-nightly-covera.md]] — slang macOS DXC-default PR: coverage-nightly coverage-macos is an un-opted-out required gate
- [[wiki/learnings/1780470809014-cheap-minimal-static-slang-build-for-install-verif.md]] — Cheap minimal static Slang build for install verification (skip DXC via SLANG_ENABLE_DXIL=OFF)
- [[wiki/learnings/1780472551679-slang-local-checkout-can-be-days-stale-on-actively.md]] — Slang local checkout can be days-stale on actively-developed CMake files
- [[wiki/learnings/1780472891485-slang-dxc-build-system-triage-local-clone-lags-mas.md]] — Slang DXC/build-system triage: local clone lags master; verify FetchDXC against upstream via gh api
- [[wiki/learnings/1780473187576-slang-finddxc-should-use-plain-cache-vars-not-impo.md]] — Slang FindDXC should use plain cache-vars not IMPORTED target — DXC is dlopen+copy, never linked
- [[wiki/learnings/1780617039215-macos-dxc-source-build-slang-11434-multi-config-ou.md]] — macOS DXC source-build (slang #11434): multi-config output dir is MinSizeRel/lib; no install_name fixup needed
- [[wiki/learnings/1780617153623-a-b-hardware-gated-mac-dxc-draft-was-directionally.md]] — A/B: hardware-gated mac DXC draft was directionally right; the only gap was the multi-config lib subdir
- [[wiki/learnings/1780770912978-slang-ci-prebuilt-llvm-setup-llvm-from-gcs-is-a-pu.md]] — slang CI: prebuilt LLVM (setup-llvm-from-gcs) is a public-bucket curl download with NO auth
- [[wiki/learnings/1781333043756-clip-space-z-remap-slang-11599-is-not-dxc-parity-u.md]] — Clip-space Z remap (slang #11599) is NOT DXC parity — unlike invert-y/position-w
- [[wiki/learnings/1781366574564-public-falcor-has-falcor-local-slang-cmake-hook-fo.md]] — Public Falcor has FALCOR_LOCAL_SLANG CMake hook for a custom Slang build
- [[wiki/learnings/1781624196085-build-subagent-that-bails-mid-build-often-leaves-i.md]] — Build subagent that bails mid-build often leaves its detached cmake running — check before relaunching
- [[wiki/learnings/1781660657132-cmake-cache-path-absolutizes-relative-d-values-aga.md]] — CMake CACHE PATH absolutizes relative -D values against the cmake CWD — pass :STRING to keep them relative
- [[wiki/learnings/1782151736391-fixer-container-disk-fills-from-accumulated-build-.md]] — Fixer container disk fills from accumulated build/ trees (ENOSPC at cmake-configure)
- [[wiki/learnings/1782328977641-sanitizer-finding-fixes-must-remove-the-matching-e.md]] — Sanitizer-finding fixes must remove the matching expected-sanitizer-findings.txt suppression in the same PR
- [[wiki/learnings/1782330515490-expected-sanitizer-findings-txt-has-two-match-mode.md]] — expected-sanitizer-findings.txt has two match modes — SUMMARY-substring vs LEAK-prefix
- [[wiki/learnings/1782405218135-slang-bundled-dep-override-path-convention-skip-de.md]] — Slang bundled-dep override-path convention + skip DeepWiki for pure-CMake triage
- [[wiki/learnings/1782406116154-slang-slang-override-path-options-are-cmake-only-n.md]] — slang SLANG_OVERRIDE_*_PATH options are CMake-only (no docs/matrix), unlike SLANG_ENABLE_*
- [[wiki/learnings/1782407661384-on-pure-cmake-override-path-prs-reviewer-c-clarity.md]] — On pure-CMake override-path PRs, Reviewer C (clarity) is the value-add
- [[wiki/learnings/1782491016302-external-dxc-is-2-vendored-compile-time-dxc-api-he.md]] — external/dxc is 2 vendored compile-time DXC API headers, not a submodule
_Catalog: [[wiki/index.md]]_
