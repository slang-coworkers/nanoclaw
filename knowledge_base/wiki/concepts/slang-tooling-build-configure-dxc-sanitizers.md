---
title: "Slang build configuration: DXC-from-source on old glibc, slim configure flags, sanitizers, CMake flag scope, and measured build costs"
type: concept
group: slang-tooling
tags: [build, cmake, configure, dxc, glibc, slangc-only, asan, tsan, valgrind, object-library, compile-flags, xcode, build-time, bisect, embed-core-module-source, fetchcontent]
source_count: 16
---

# Slang build configuration: DXC-from-source on old glibc, slim configure flags, sanitizers, CMake flag scope, and measured build costs

This page covers configuring and sizing a Slang build: which flags keep a probe build small, why an old glibc drags in a DXC source build, how sanitizer and per-target flags actually propagate, and what builds cost on the 64-core fixer box. It was split out of [Slang build in worktrees](slang-tooling-f0909b0-build-worktree-cmake.md), which keeps worktree setup, submodules and A/B baselines.

## TL;DR

- **On GLIBC < 2.38, configure clones + builds DXC from source (~500 MB, 10–30 min).** For a
  target-agnostic/SPIR-V fix, pass `-DSLANG_ENABLE_DXIL=OFF -DSLANG_SLANG_LLVM_FLAVOR=DISABLE`;
  `rm -rf build/CMakeCache.txt build/CMakeFiles` before reconfiguring so it takes effect.
  The DXC build did not block building just the `slangc`/`slang-test` targets (~10 min
  release on 64 cores after a ~13 s submodule init). For slangc-only checks, also turn off
  RHI/GFX/examples/tests and build `slangc slang-glslang` (~5 min). `SLANG_ENABLE_TESTS`
  requires `SLANG_ENABLE_SLANG_RHI`, and a cached `-D...=OFF` survives a re-configure that
  merely drops the flag: pass `=ON` explicitly.
- **Rebasing a long-lived worktree can stale the CMake build graph** — a rebase that adds a new
  `.cpp` to a `CMakeLists.txt` leaves `build.ninja` unaware of it → hundreds of `undefined
  reference` at link. Reconfigure (`cmake --preset default`) before rebuilding.
- **When the CUDA driver library is missing at link time** (as during the 09-28→10-16 passthrough outage), configure with `-DCUDA_cuda_driver_LIBRARY=/usr/local/cuda-12.6/lib64/stubs/libcuda.so` so the link doesn't fail on a missing `libcuda.so`. At run time `gfx-smoke` then fails with `Failed to load DLL "gfx"` because `lib/libgfx.so` needs `libcuda.so.1` — environmental; `ldd` before naming a loader cause.
- **Sanitizer gotchas (ASan/TSan) are host-wide:** `LD_LIBRARY_PATH` must include the clang runtime dir; `ASAN_OPTIONS=detect_leaks=0` during the build. valgrind's glibc `ld.so`/`dlopen` `$ORIGIN` errors are false positives — triage by whether the stack references a slang frame.
- **CMake grep-invariant guards must use `git grep`** (skips submodule trees), not `rg`/`grep -r`.
- **Compile-time feature guards use the generated `SGL_HAS_*` define, not the cmake `option()`.**
- **A PRIVATE compile flag (`-fno-exceptions`, a sanitizer flag) does NOT reach a target's
  linked OBJECT libraries** — apply it to each OBJECT target and verify in
  `build/compile_commands.json`; and `cmake --build --target X -k 0` silently no-ops
  (`cmake --build` has no `-k`, so the ninja keep-going flag must follow `--`).
- **Fresh-worktree Release `slangc` builds cost ~12 min each and run well four at a time**; a one-TU bisect step rebuilds in under a minute; `-DSLANG_ENABLE_DXIL=OFF` keeps scratch trees from rebuilding DXC into a shared `_deps`.

## GLIBC, DXC-from-source, and the stale CMake graph

On a host with **GLIBC < 2.38**, configure clones and builds DXC from source (~500 MB, 10–30
min) because the prebuilt DXC needs 2.38 (log: "System GLIBC 2.36 < required 2.38: building DXC
from source"). If your fix is target-agnostic / SPIR-V-tested (not DXIL), skip it with
`-DSLANG_ENABLE_DXIL=OFF -DSLANG_SLANG_LLVM_FLAVOR=DISABLE`, and `rm -rf build/CMakeCache.txt
build/CMakeFiles` before reconfiguring so the options take effect
[disable DXIL on old glibc](../learnings/1787824391934-slang-worktree-build-needs-submodule-init-disable-.md).
As of 2026-10 the default Linux preset source-builds DXC (~30 min). When you only need a
`slangc` to probe, configure with `-DSLANG_ENABLE_DXIL=OFF -DSLANG_ENABLE_SLANG_RHI=OFF
-DSLANG_ENABLE_GFX=OFF -DSLANG_ENABLE_EXAMPLES=OFF -DSLANG_ENABLE_TESTS=OFF` and build the
`slangc slang-glslang` targets, about 5 min on 64 cores
[slangc-only configure](../learnings/1791180810533-check-a-reused-worktree-s-slangc-provenance-before.md).
Those switches don't mix freely: `SLANG_ENABLE_TESTS` requires `SLANG_ENABLE_SLANG_RHI`, so
`cmake --preset default -DSLANG_ENABLE_SLANG_RHI=OFF -DSLANG_ENABLE_GFX=OFF` (tests left at their
default ON) fails at `CMakeLists.txt:618` with "SLANG_ENABLE_TESTS requires SLANG_ENABLE_SLANG_RHI".
A verify worktree that needs `slang-test` must keep RHI on. Dropping the flags on re-configure is
not enough, because the CMake cache keeps the OFF; pass `-DSLANG_ENABLE_SLANG_RHI=ON
-DSLANG_ENABLE_GFX=ON` explicitly or delete `CMakeCache.txt`
[TESTS requires RHI; the cache keeps -D OFF](../learnings/1791499534921-slang-worktree-build-slang-enable-tests-requires-s.md).

Separately, **rebasing a long-lived worktree can stale the CMake build graph.** After
`git rebase origin/master` in a worktree whose `build/` was configured weeks ago,
`cmake --build` failed at link with hundreds of `undefined reference to
Slang::Diagnostics::*::getInfo()` across unrelated `.o` files — because a rebased-in commit
(#12297) split diagnostics into a new `source/slang/slang-rich-diagnostics.cpp` that the
pre-existing `build.ninja` never knew about, so its object was absent from the link edge. The
deterministic fix is `cmake --preset default` to regenerate the graph, then rebuild; verify
with `grep -c slang-rich-diagnostics.cpp build/CMakeFiles/impl-Debug.ninja > 0`
[rebase stales the build graph](../learnings/1787562764446-rebasing-a-long-lived-worktree-can-stale-the-cmake.md).
Two gotchas there: this is Ninja **multi-config**, so the real per-config rules live in
`build/CMakeFiles/impl-Debug.ninja` (and `build-Debug.ninja`), not the top-level `build.ninja`
(grepping the top-level alone gives a false "0 references"); and the rule of thumb is that
whenever a rebase/pull adds or removes a source file (check `git log --stat` for new `.cpp` in
a `CMakeLists.txt`), reconfigure before building — CMake's file-level GLOB re-check does not
reliably fire for explicitly-listed sources when only the build dir is stale.

A related staleness bites the *prebuilt* binary: the `build/Release/bin/slangc` (and Debug) in
the mounted checkout can be many commits behind git HEAD (on 2026-08-27, HEAD was `47e426167`
but the binary reported `-g3649fb982`, 198 commits behind and predating the commit under
investigation). Running it to "observe" a regression introduced *after* the binary silently
shows the pre-regression parent behavior — which looks like a contradiction. Detect with
`slangc -v` (`-g<shortsha>`) + `git merge-base --is-ancestor <regressing-commit> <binary-sha>`;
if it predates, rebuild before any A/B static-emit comparison. (A stale-but-parent binary is
still a free known-good baseline for a bisected regression)
[prebuilt slangc can be stale](../learnings/1787850489737-prebuilt-slangc-in-the-mounted-checkout-can-be-sta.md).
Reconfirmed 2026-09-10 at a 264-commit gap (binary `2026.13.1-61-ga916653b70` vs checkout `928f4010f6`): attribute an observation to the `slangc -v` revision, and keep source inspection distinct from a runtime repro. The same codex OUTPUT_REVIEW also caught an issue-body repro drifting from the standalone repro file (fix both copies) and a verified emitted-MSL mismatch conflated with an unrun on-device Metal failure [prebuilt slangc can lag the source checkout — check `slangc -v` before attributing behavior to a commit](../learnings/1789072949461-prebuilt-slangc-binary-can-lag-the-source-checkout.md).

The version string has its own staleness, in the opposite direction. `slangc -version` prints
the git-describe baked in when the version header was last *generated*, and an incremental
rebuild after checking out a different SHA in the same build tree does not regenerate it: a
build of `4fe660083` printed `2026.18.3-18-gf0dcfb7bc`. So `-v` is trustworthy for a binary
that was never rebuilt (the prebuilt-lag case above), but not for a reused worktree. When you
hand a crash repro to a triager, state the SHA from `git log -1` plus a clean-tracked-files
`git status` in the tree you built, and say that `-version` was not the source.

A clean `git status` describes the source, not the binary, and a revert drill is the usual way
the two part. The drill runs `git checkout <base> -- source/`, rebuilds, then restores the
source. If nobody rebuilds after the restore, the tree reads clean at HEAD while
`build/Release/bin/slangc` is still the reverted build. A week later that binary looks like the
PR head: on #13276, wt-10877's "PR head" results were really the merge base. So rebuild after
every restore (incremental, minutes). Before reusing an old worktree's binary, compare the
library's mtime with the newest source mtime (`stat`). A binary older than the source means
rebuild; checkouts touch mtimes without changing content, so a false alarm only costs a
rebuild. If in doubt, just rebuild
[reused-worktree slangc provenance](../learnings/1791180810533-check-a-reused-worktree-s-slangc-provenance-before.md). The same
container also lacks gdb, lldb, `/usr/bin/time` and `bc`; to test whether a segfault is a stack
overflow, rerun it under different stack limits from Python (`subprocess` with a
`resource.setrlimit(RLIMIT_STACK, …)` `preexec_fn`). A crash at the same point under an 8 MB
and a 1 GB stack is probably not a recursion overflow
[slangc -version in a reused worktree reports configure-time HEAD](../learnings/1790693044766-slangc-version-in-a-reused-worktree-reports-config.md).

## Sanitizers, valgrind, and CMake-content guards

Building with `-DSLANG_ENABLE_ASAN=ON` (or `SLANG_ENABLE_TSAN=ON`) hits environment gotchas
that were initially thought container-specific but are **host-wide** (confirmed on a plain
Ubuntu 24.04 host): `LD_LIBRARY_PATH` must include the clang runtime dir (`$(clang-18
-print-runtime-dir)`) or the instrumented build-time generators (`slang-embed`, `slang-fiddle`)
fail to start with `libclang_rt.asan-x86_64.so: cannot open shared object file`; LSan fires on
instrumented `slang-fiddle` so set `ASAN_OPTIONS=detect_leaks=0` *during the build* or ninja
stops mid-build; and a runtime `lib/` path issue can make `slang-test` silently *ignore* rather
than fail tests (a false-green — verify a nonzero executed count). The takeaway: when a
"gotcha" is observed only inside a CI container, don't assume container-specificity
[ASan gotchas are host-wide](../learnings/1787840677149-slang-asan-ld-library-path-gotcha-is-host-wide-not.md).

For the `-cpu`/host-callable **via-llvm** (LLVM-JIT) path under `valgrind
--track-origins=yes`, memcheck reports errors from `dlopen`ing `slang-llvm` — `strncmp` →
`is_dst` → `decompose_rpath` / `_dl_dst_substitute` (glibc `ld.so` RPATH `$ORIGIN` expansion,
via `Slang::SharedLibrary::loadWithPlatformPath`). **These are known glibc `ld.so` false
positives, not slang bugs**: only errors whose stack references a slang/IR/autodiff/emit/JIT
frame are real, so a run whose every context is the `ld.so`/`dlopen` path is a *clean* result.
Two adjacencies from that atom: valgrind memcheck substitutes for MSan's uninitialized-read
detection when `libclang_rt.msan` isn't installed (it cracked the aarch64 uninitialized
`PathInfo::type` bug), but strict-aliasing/type-punning UB is invisible to *both* memcheck and
MSan — so a clean x86_64 sanitizer sweep narrows an arch-dependent wrong-answer to "aarch64-only
UB or a non-UB codegen difference", it doesn't fully clear it
[valgrind ld.so false positives](../learnings/1788385213783-valgrind-memcheck-of-slang-llvm-jit-glibc-ld-so-dl.md).

When authoring a CI "this token must never appear" guard over Slang's CMake files (e.g. #12790,
forbidding `CMAKE_BINARY_DIR` in first-party CMake), the guard **must use `git grep`** over
tracked files, not `rg`/`grep -r`: `git grep` does not descend into submodule working trees, so
vendored `external/*` sources that legitimately use `CMAKE_BINARY_DIR` are excluded
automatically (git grep returned 22 first-party hits; `rg` returned far more vendored noise).
Scope by the tracked-vs-submodule boundary, not an `external/` path prefix —
`external/CMakeLists.txt` is Slang's *own* first-party file, so a naive `--exclude-dir=external`
would wrongly skip it. The established pattern is a standalone path-filtered non-required PR-lint
job (`.github/workflows/check-submodules.yml`) calling a small `extras/*.sh` script
[git grep for CMake guards](../learnings/1787818174243-cmake-grep-invariant-guards-must-use-git-grep-not-.md).

Finally, a compile-time build-config guard convention (from slangpy's SGL): the source-visible
define is the **generated `SGL_HAS_CRASHPAD`**, never the raw cmake `option()` name
`SGL_ENABLE_CRASHPAD` (which is not emitted as a `#define`). `SGL_HAS_CRASHPAD` is written into
`sgl/core/config.h` via `file(GENERATE)` and is ON only when the option is ON *and*
`find_package(crashpad)` succeeded — so it degrades gracefully. The footgun: `#if
SGL_HAS_CRASHPAD` silently evaluates to `#if 0` if `config.h` isn't in the translation unit, so
the guarded block vanishes (compiles clean, feature off) — any TU using an `SGL_HAS_*` macro
should `#include "sgl/core/config.h"` explicitly rather than trust a transitive include. This
generalizes to all `SGL_HAS_*` feature macros (D3D12, VULKAN, NVAPI, LIBPNG, …)
[SGL_HAS_CRASHPAD, not the cmake option](../learnings/1787002587931-sgl-crashpad-guard-is-sgl-has-crashpad-not-the-sgl.md).

## Per-target compile flags don't reach linked OBJECT libraries

A **PRIVATE compile option** applied to a target that is assembled from separate **OBJECT
libraries** does NOT reach those object libraries — each OBJECT library compiles its own TUs
with its OWN target properties, so a consuming library's private options apply only to sources
compiled directly into it. Concrete case (#12782 / #12779): `-fno-exceptions` on
`slang-common-objects` left the generated OBJECT libs it links via `LINK_WITH_PRIVATE`
(`slang-capability-lookup`, `slang-lookup-tables`, plus `slang-spirv-core-grammar-embed.cpp`)
compiling *with* exceptions. Fix: apply the flag helper (`slang_apply_disable_exceptions(...)`)
directly to each generated OBJECT target, and VERIFY with `build/compile_commands.json` (grep
the flag on the generated TU) rather than assume inheritance. For any whole-library flag
requirement, enumerate every OBJECT library in the target's `LINK_WITH_PRIVATE` and flag each;
a header-only OBJECT lib (e.g. `slang-capability-defs`, sources = headers) has no TU so needs
none. A build-driver gotcha travels with it: `cmake --build <dir> --target X -k 0` silently
does nothing — `cmake --build` has no `-k`, it prints `--help` and exits; the ninja keep-going
flag must go after `--`: `cmake --build <dir> --target X -- -k 0`. Keep-going compiles all TUs
and collects every failure instead of stopping at the first — the way to prove one remaining
break is the *only* remaining one
[per-target flags don't reach linked OBJECT libraries; `-k 0` must follow `--`](../learnings/1789384635713-cmake-per-target-compile-flags-don-t-propagate-to-.md).

## The Xcode Generator Rejects Any `$<CONFIG>` Genex in a Per-Source `COMPILE_OPTIONS` (Presence, Not Value)

`cmake -GXcode` fails at **configure** with "Xcode does not support per-config per-source COMPILE_OPTIONS: <genex> specified for source: X.cpp" whenever a per-source `COMPILE_OPTIONS` (`set_source_files_properties`) carries a `$<CONFIG:...>` generator expression. `XCodeGeneratorExpressionInterpreter::Evaluate()` errors on the **presence** of the context-sensitive condition, not on whether the flags differ by config, so `$<$<NOT:$<CONFIG:Debug>>:-Os>` is rejected even though it yields `-Os` everywhere. Ninja Multi-Config (the `default` preset, used by every CI job including the macOS `xcode-27` runner — a runner label, not the generator) tolerates it, and `CMakePresets.json` has no Xcode generator, so the regression is invisible to CI (slang#13240/#13241). The fix branches on `CMAKE_CXX_COMPILER_ID` at configure time and emits a plain flag on the Clang/AppleClang path, keeping the genex only where a real per-config difference exists (MSVC Debug `/RTC1`). Match `CMAKE_CXX_COMPILER_ID STREQUAL "MSVC"`, not the `MSVC` variable, which is also true for clang-cl. To prove flag equivalence without a full build, compile a trivial two-target project with the same `set_source_files_properties` under `--config Debug`/`Release` verbose and grep the `-O` flags (`file(GENERATE)` can't evaluate `$<CXX_COMPILER_ID>` without a `TARGET`). A configure-only `buildtool: "Xcode"` macOS job in `check-cmake` would guard it ([Xcode CMake generator rejects any `$<CONFIG>` genex in per-source COMPILE_OPTIONS — presence, not value](../learnings/1790177389937-xcode-cmake-generator-rejects-any-lt-config-gt-gen.md)).

## Measured build costs and cheap counterfactual builds

**Fresh-worktree costs on the 64-core fixer box (2026-10-15/16).** Four concurrent Release `slangc` builds of fresh worktrees, each `cmake --preset default -DSLANG_ENABLE_TESTS=OFF -DSLANG_ENABLE_EXAMPLES=OFF` then `cmake --build --preset release --target slangc -j16`, finished in about 12.5 min (submodule init ~16 s, configure ~40 s on GLIBC 2.36 with no DXC-from-source, build ~11.5 min). The tail drops to about 5 `cc1plus` processes because core-module generation is mostly serial, so several worktrees in parallel use the machine better than one `-j64` build. A `BUILD_EXIT=` marker per log plus a `run_in_background` until-loop waits reliably, and `slangc -version` (`<tag>-N-g<sha9>`) plus `ldd` confirm each binary loads its own `build/Release/lib` ([four concurrent Release builds ~12 min](../learnings/1792138931353-four-concurrent-release-slangc-worktree-builds-tak.md)). A plain Debug build after submodule init took about 6 min with `-DCUDA_cuda_driver_LIBRARY=/usr/local/cuda/targets/x86_64-linux/lib/stubs/libcuda.so` [--reference fails](../learnings/1792088805773-slang-worktree-submodules-reference-to-the-shallow.md).

**A two-commit build bisect is cheap when the suspect touches one `.cpp`.** For #13603, a worktree at `<sha>^` with LLVM/tests/examples/gfx/rhi/slangd/slangi/dxil OFF built `--target slangc` in about 15 min; `git checkout <sha>` and a rebuild then recompiled only the touched TU (13 steps, under 1 min), giving a built counterfactual instead of "by code trace". The finding itself: #11430 folded base+immediate in `slang-ir-byte-address-legalize`, so float3 struct members at literal base 0 now hit `emitSimpleLoad`'s offset/12 divide on an ArrayStride-16 alias (wrong bytes on SPIR-V/GLSL std430; `-fvk-use-scalar-layout` is the workaround) [two-commit build bisect](../learnings/1792065111999-two-commit-build-bisect-is-cheap-when-the-suspect-.md).

**Non-embedded core-module source reproduces natively in about 5 min, no emsdk.** `cmake --preset default -B /tmp/b -DSLANG_EMBED_CORE_MODULE_SOURCE=OFF -DSLANG_ENABLE_DXIL=OFF -DSLANG_ENABLE_TESTS=OFF -DSLANG_ENABLE_GFX=OFF -DSLANG_ENABLE_SLANG_RHI=OFF -DFETCHCONTENT_BASE_DIR=<main>/build/_deps -DFETCHCONTENT_FULLY_DISCONNECTED=ON`, then build `slangd slangc slang-glsl-module`; `slangd --print-builtin-module core` goes through the same `Slang::getBuiltinModuleSource` as slang-wasm (slang#13664). Leaving out `-DSLANG_ENABLE_DXIL=OFF` makes every scratch tree that shares `FETCHCONTENT_BASE_DIR` rebuild DXC from source into the shared `_deps/dxc_source-build`, and two such builds collide (llvm-tblgen / `Intrinsics.gen` FAILED). That slangc lacks slang-glslang, so sanity-compile with `-target hlsl`. Deleting `lib/libslang-glsl-module-*.so` forces the `slang-api.cpp:244` compile-from-source fallback, which writes `lib/slang-glsl-module.bin` [SLANG_EMBED_CORE_MODULE_SOURCE=OFF repro](../learnings/1792085283366-repro-slang-embed-core-module-source-off-natively-.md).

**Source learnings (16):**
- [Rebasing a long-lived worktree can stale the CMake build graph — reconfigure before rebuilding](../learnings/1787562764446-rebasing-a-long-lived-worktree-can-stale-the-cmake.md)
- [CMake grep-invariant guards must use git grep, not rg/grep -r (submodule descent)](../learnings/1787818174243-cmake-grep-invariant-guards-must-use-git-grep-not-.md)
- [slang worktree build needs submodule init; disable DXIL to skip 30-min DXC-from-source on old glibc](../learnings/1787824391934-slang-worktree-build-needs-submodule-init-disable-.md)
- [Slang ASan LD_LIBRARY_PATH gotcha is host-wide not container-specific](../learnings/1787840677149-slang-asan-ld-library-path-gotcha-is-host-wide-not.md)
- [Prebuilt slangc in the mounted checkout can be STALE vs git HEAD](../learnings/1787850489737-prebuilt-slangc-in-the-mounted-checkout-can-be-sta.md) — 198 commits behind, predating the commit under study → shows pre-regression behavior; detect via `slangc -v -g<sha>` + `git merge-base --is-ancestor`; stale-parent binary = free baseline.
- [264-commit gap; attribute a repro to the `slangc -v` revision, keep source-inspection distinct from runtime repro; codex OUTPUT_REVIEW also caught issue-body/standalone repro drift and a verified-emit vs unrun-on-device conflation.](../learnings/1789072949461-prebuilt-slangc-binary-can-lag-the-source-checkout.md)
- [valgrind memcheck of slang-llvm JIT: glibc ld.so/dlopen $ORIGIN errors are false positives](../learnings/1788385213783-valgrind-memcheck-of-slang-llvm-jit-glibc-ld-so-dl.md)
- [SGL crashpad guard is SGL_HAS_CRASHPAD, not the SGL_ENABLE_CRASHPAD cmake option](../learnings/1787002587931-sgl-crashpad-guard-is-sgl-has-crashpad-not-the-sgl.md)
- [CMake per-target PRIVATE flags don't reach linked OBJECT libraries; `cmake --build -k 0` no-ops (put `-k 0` after `--`)](../learnings/1789384635713-cmake-per-target-compile-flags-don-t-propagate-to-.md) — #12782/#12779: `-fno-exceptions` on `slang-common-objects` missed its generated OBJECT libs; apply the helper per OBJECT target, verify in `compile_commands.json`.
- [Xcode CMake generator rejects any `$<CONFIG>` genex in per-source COMPILE_OPTIONS — presence, not value](../learnings/1790177389937-xcode-cmake-generator-rejects-any-lt-config-gt-gen.md) — Ninja MC tolerates it so CI (no `-GXcode` job) misses it (slang#13240/#13241); branch on `CMAKE_CXX_COMPILER_ID` (not `if(MSVC)` — matches clang-cl); prove flag equivalence with a 2-target throwaway, not `file(GENERATE)`.
- [slangc -version in a reused worktree reports configure-time HEAD, not the built source](../learnings/1790693044766-slangc-version-in-a-reused-worktree-reports-config.md) — take repro SHA from `git log -1` + `git status`; no gdb in-container, A/B stack limits via Python setrlimit.
- [reused worktree's slangc can be a revert drill's build; rebuild after restore; slangc-only configure ~5 min](../learnings/1791180810533-check-a-reused-worktree-s-slangc-provenance-before.md)
- [slang worktree build: SLANG_ENABLE_TESTS requires SLANG_ENABLE_SLANG_RHI (and CMake cache keeps -D OFF)](../learnings/1791499534921-slang-worktree-build-slang-enable-tests-requires-s.md) — fails at CMakeLists.txt:618; pass `=ON` explicitly on re-configure; ~10 min Release build of five targets on 60 cores (PR #13535)
- [Four concurrent Release slangc worktree builds take about 12 minutes on 64 cores](../learnings/1792138931353-four-concurrent-release-slangc-worktree-builds-tak.md) — serial core-module tail; parallel worktrees beat one -j64
- [Two-commit build bisect is cheap when the suspect touches one .cpp](../learnings/1792065111999-two-commit-build-bisect-is-cheap-when-the-suspect-.md) — <1 min rebuild for the second commit; #11430 byte-address float3 regression (#13603)
- [Repro SLANG_EMBED_CORE_MODULE_SOURCE=OFF natively in ~5 min; avoid parallel DXC-from-source builds](../learnings/1792085283366-repro-slang-embed-core-module-source-off-natively-.md) — `slangd --print-builtin-module core`; shared `_deps` DXC collision (#13664)

_Catalog: [[wiki/index.md]]_
