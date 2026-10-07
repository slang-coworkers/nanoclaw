---
title: "Slang build in worktrees: submodule init, stale CMake graphs, DXC/glibc, sanitizers, stale binaries"
type: concept
group: slang-tooling
tags: [build, git-worktree, submodule, cmake, dxc, glibc, asan, valgrind, sccache, ninja]
source_count: 24
---

## TL;DR

Building Slang in a per-issue `git worktree` over a shared base clone has a small set of
setup traps that, unhandled, each cost 10–40 minutes — and the CMake build graph can go stale
under you after a rebase.

- **`git worktree add` does NOT populate submodules** (nor *nested* ones), so configure fails with `non-existent target "SPIRV-Headers::SPIRV-Headers"` or `external/<x> does not contain a CMakeLists.txt`. Run `git submodule update --init --recursive` in the worktree before the first configure. If that (or `--reference`) fails with "transport 'file' not allowed", copy `external/` from another worktree whose submodule pins match (`git diff --quiet <base> HEAD -- external .gitmodules`).
- **A configure that dies on a missing `::` target is almost always an uninitialised nested
  submodule, not a code error** — the nested `external/spirv-tools/external/spirv-headers` is
  the usual culprit even when the top-level shows a SHA.
- **On GLIBC < 2.38, configure clones + builds DXC from source (~500 MB, 10–30 min).** For a
  target-agnostic/SPIR-V fix, pass `-DSLANG_ENABLE_DXIL=OFF -DSLANG_SLANG_LLVM_FLAVOR=DISABLE`;
  `rm -rf build/CMakeCache.txt build/CMakeFiles` before reconfiguring so it takes effect.
  The DXC build did not block building just the `slangc`/`slang-test` targets (~10 min
  release on 64 cores after a ~13 s submodule init). For slangc-only checks, also turn off
  RHI/GFX/examples/tests and build `slangc slang-glslang` (~5 min).
- **After merging master: `git submodule update --init` (pins may have moved), then build the FULL preset** — a targeted `slangc slang-test` build leaves serialized std modules stale after an IR-module-version bump (`E00131 ignoring IR module version`, dozens of `functional/` failures that are not regressions).
- **Rebasing a long-lived worktree can stale the CMake build graph** — a rebase that adds a new
  `.cpp` to a `CMakeLists.txt` leaves `build.ninja` unaware of it → hundreds of `undefined
  reference` at link. Reconfigure (`cmake --preset default`) before rebuilding.
- **The prebuilt `slangc` in the mounted checkout can be many commits behind HEAD** — check
  `slangc -v`'s `-g<sha>` and `git merge-base --is-ancestor` before trusting its emit. In a
  *reused* build tree `-v` prints the configure-time describe, and a clean `git status` proves
  only the source: a revert drill restored without a rebuild leaves the REVERTED binary. Rebuild
  after every drill restore, and before citing an old worktree's binary rebuild it or check
  the binary is newer than the last source change.
- **A slangc/slang-test copied out of `build/Debug` is a different instrument.** The prelude resolves relative to the exe (missing → the embedded prelude is inlined, changing `.cu` text) and nvrtc looks for OptiX headers at `<bin>/../../../external/optix-dev/include` (missing → every OptiX/PTX compile fails), so ~31 CUDA/OptiX/header tests fail from a `-bindir` copy. Run baseline and candidate from the same kind of location plus a no-change control, or rebuild the tree shape with hardlinks + symlinks.
- **No NVIDIA driver in the container:** configure with `-DCUDA_cuda_driver_LIBRARY=/usr/local/cuda-12.6/lib64/stubs/libcuda.so` so the link doesn't fail on a missing `libcuda.so`. At run time `gfx-smoke` then fails with `Failed to load DLL "gfx"` because `lib/libgfx.so` needs `libcuda.so.1` — environmental; `ldd` before naming a loader cause.
- **Never run baseline and candidate full suites concurrently** (or alongside a build): contention fabricates "patched-only" failures. Run serially, or rerun the set difference serially; ~91 environmental failures remain on a quiet no-GPU box.
- **Sanitizer gotchas (ASan/TSan) are host-wide:** `LD_LIBRARY_PATH` must include the clang runtime dir; `ASAN_OPTIONS=detect_leaks=0` during the build. valgrind's glibc `ld.so`/`dlopen` `$ORIGIN` errors are false positives — triage by whether the stack references a slang frame.
- **Don't background the build in a subagent** — a detached ninja dies when the subagent's
  shell exits; run in the foreground, or a `run_in_background` grandchild that survives.
- **CMake grep-invariant guards must use `git grep`** (skips submodule trees), not `rg`/`grep -r`.
- **Compile-time feature guards use the generated `SGL_HAS_*` define, not the cmake `option()`.**
- **A PRIVATE compile flag (`-fno-exceptions`, a sanitizer flag) does NOT reach a target's
  linked OBJECT libraries** — apply it to each OBJECT target and verify in
  `build/compile_commands.json`; and `cmake --build --target X -k 0` silently no-ops
  (`cmake --build` has no `-k`, so the ninja keep-going flag must follow `--`).

## Worktree submodule init: the same lesson, many times over

The single most-reported build trap in this batch is that `git worktree add` checks out
tracked files but does **not** populate submodules — the worktree's `external/*` dirs are
empty even though the base clone `/workspace/agent/slang/external/*` has them, because
worktrees share `.git` objects but each needs its own submodule working tree. `cmake --preset
default` then fails at configure, most commonly with `get_target_property() called with
non-existent target "SPIRV-Headers::SPIRV-Headers"`, and `cmake --build` dies with `ninja:
error: loading 'build-Debug.ninja': No such file or directory` because configure never
generated. `git submodule status` shows a leading `-` on the uninitialized entries. Several
independent atoms report this identical finding across many issues, which is itself the signal
that the `/slang-fix-issue` Setup step should bake it in:
[full external cascade](../learnings/1787176235982-git-worktrees-do-not-inherit-submodule-checkouts-i.md),
[per-worktree init, top-level only](../learnings/1787677680988-slang-git-worktree-needs-per-worktree-submodule-in.md),
[worktree init + DXIL disable](../learnings/1787824391934-slang-worktree-build-needs-submodule-init-disable-.md),
[reconfirmed on a fresh #13017 worktree — the base clone is `git clone --depth 50` *without*
`--recursive`, so a new worktree inherits uninitialised submodules and `cmake --preset default`
fails on the `SPIRV-Headers::SPIRV-Headers` target](../learnings/1789394522873-fresh-slang-worktree-submodule-init-clang-format-1.md).

The fix is to init recursively in the worktree before the first configure:

```bash
cd <worktree>
git submodule update --init --recursive     # objects are shared with the base clone → fast, checkout-only
rm -f build/CMakeCache.txt && rm -rf build/CMakeFiles   # if a prior configure left an incomplete cache
cmake --preset default
```

A refinement from the atoms: a top-level-only `git submodule update --init --depth 1` matches
what the base clone populates and is enough for the build — it does not recurse into
slang-rhi's nested submodules or dxc/llvm and the build works without them; the `--recursive`
form above also works but is not required. A configure that dies on a missing `::` target (e.g.
`SPIRV-Headers::SPIRV-Headers`, when `external/spirv-tools` shows a SHA but its nested
`external/spirv-tools/external/spirv-headers` is absent) is almost always an uninitialised
submodule, not a code error
[per-worktree init, top-level only](../learnings/1787677680988-slang-git-worktree-needs-per-worktree-submodule-in.md).
Note the first configure also triggers a DXC clone+build (~500 MB, 10–30 min) unless cached
[per-worktree init, top-level only](../learnings/1787677680988-slang-git-worktree-needs-per-worktree-submodule-in.md).
That cost does not have to sit on the critical path. On a later fresh worktree the recursive
submodule init took about 13 s (the main clone already had the objects), and a release build of
only the `slangc` and `slang-test` targets finished in roughly 10 minutes on 64 cores, even
though the configure log said "building DXC from source"
[init time and slangc/slang-test build time on a fresh worktree](../learnings/1790636604671-fresh-slang-git-worktree-init-submodules-before-cm.md).
When the init cannot run, because the submodule URLs point at the local base clone and git
blocks file transport (`submodule update --reference` fails with "transport 'file' not
allowed"), a populated `external/` copied from another worktree at the same base works. Check
first that the pins match, with `git diff --quiet <base> HEAD -- external .gitmodules`; on
#13429 that gave a configure plus `slangc`/`slang-test` build in about 10 min
[copy external/ from a same-base worktree](../learnings/1791151479459-slang-pr-review-runner-scripts-may-lose-exec-bit-r.md).

Several of these atoms independently flag a **build-subagent hazard**: a subagent that launches
ninja with `&`/`nohup` and then returns leaves a *detached* build that dies when its shell
exits (configure half-finished, no artifacts). Tell the build subagent to run in the
**foreground and block** until ninja returns, or use a Bash `run_in_background` grandchild
(`( ... ) &`) that survives, and arm a Monitor on the `slang-test` artifact as a backstop —
but note a Monitor grepping `build.log` mis-fires when *configure* (not compile) failed,
because `build.log` never gets created, so the subagent's own completion is the source of
truth
[foreground/block the build](../learnings/1787176235982-git-worktrees-do-not-inherit-submodule-checkouts-i.md),
[detached ninja dies; check pgrep -x](../learnings/1787824391934-slang-worktree-build-needs-submodule-init-disable-.md),
[monitor mis-fires when configure failed](../learnings/1787677680988-slang-git-worktree-needs-per-worktree-submodule-in.md).
Check liveness with `pgrep -x ninja` + `readlink /proc/<pid>/cwd` (never `pgrep -f`, which
matches your own argv and can't see the worktree path). Reconfirmed on #13017: a generic
`Agent` subagent handed the build *detached* it (backgrounded it) and returned in ~25 s,
losing the completion signal and then launching more background ops — risking two concurrent
builds in one dir; run the build yourself via Bash `run_in_background` or the `pgrep -x
ninja`/`/proc/<pid>/cwd` poller (an incremental rebuild after the first full build is only
~2–4 min). Formatting a C++-only worktree change hits the same PATH gap —
`clang-format`/`gersemi`/`shfmt` aren't installed, so `extras/formatting.sh` prints "needs
clang-format"; install the pinned version without admin via `python3 -m pip install --user
clang-format==17.0.6` then `export PATH="$HOME/.local/bin:$PATH"` (Lua diagnostics like
`slang-diagnostics.lua` are NOT formatted by the script — match style by hand)
[fresh-worktree submodule init + clang-format-17 via pip; don't detach the build](../learnings/1789394522873-fresh-slang-worktree-submodule-init-clang-format-1.md).

## A/B baselines must be like-for-like: relocated copies, concurrent suites, and the missing CUDA driver

Keeping a master baseline by snapshotting `build/Debug/{bin,lib}` into a scratch directory
produces a binary that behaves differently from the in-tree one on the CUDA/PTX paths, for two
reasons. First, slangc's `TestToolUtil::setSessionDefaultPreludeFromExePath` resolves `prelude/`
relative to the executable; when it is not found, the embedded prelude is inlined, so the emitted
`.cu` text differs (including the `#include <optix...>` lines and `optixGet` counts). Second,
nvrtc's `_findOptixIncludePath` (`slang-nvrtc-compiler.cpp`) looks for
`<instance>/../../../external/optix-dev/include`, so a copy fails every OptiX/PTX ray-tracing
compile with "Failed to locate OptiX headers (optix.h)". Run as `slang-test -bindir <copy>/bin`,
about 31 tests (`tests/cuda/*`, `tests/optix/*`, `tests/headers/generate-cuh`/`hpp-header`, a few
hlsl-intrinsic SER tests) fail from the copy while passing in-tree, so a "fixed vs master" diff
between a copy-run baseline and an in-tree candidate is an artifact
[bindir copy fails ~31 CUDA/OptiX tests](../learnings/1790714053699-slang-test-from-a-bindir-binary-copy-fails-31-cuda.md).
Run baseline and candidate from the same kind of location, and add a no-change control program:
if it differs too, the difference is environmental. To make a copy comparable without
rebuilding, recreate the tree shape around it
[prelude + OptiX resolve relative to `<bin>/../../..`](../learnings/1790719029887-slang-binary-copies-prelude-optix-headers-resolve-.md):

```bash
mkdir -p X/build/Debug X/external
cp -al copy/bin copy/lib X/build/Debug/
ln -s <tree>/external/optix-dev X/external/optix-dev
ln -s <tree>/prelude X/prelude
```

That like-for-like setup showed master's own PTX nvrtc failure for slang#13329. Keep test lists
and scratch under `/workspace/agent/`, not `/tmp`, which a container restart wipes. Separately, a
container with no NVIDIA driver fails the link against a missing
`/usr/lib/x86_64-linux-gnu/libcuda.so`; reconfigure with
`-DCUDA_cuda_driver_LIBRARY=/usr/local/cuda-12.6/lib64/stubs/libcuda.so`
[CUDA driver stub](../learnings/1790802490676-slangc-o-dev-null-fails-with-e00004-in-the-fixer-c.md).

At run time the same missing driver shows up as `tests/cpu-program/gfx-smoke.slang (cpu)` failing
with `Failed to load DLL "gfx"`. `libgfx.so` is built, but it lives in `build/Debug/lib/`, not
`bin/`, and `ldd build/Debug/lib/libgfx.so` shows `libcuda.so.1 => not found`; that is an
environmental failure unrelated to any compiler change, not "no libgfx in this build". Run `ldd` on
the library before naming the cause of a loader error
[gfx-smoke = missing libcuda.so.1](../learnings/1790710627405-slang-test-gfx-smoke-failed-to-load-dll-gfx-on-lin.md).

Contention is the other way an A/B comparison lies. Running the master and patched full suites at
the same time (`-use-test-server -server-count 12` each, 64 cores, with a `-j48` build also
running) produced 73 "patched-only" failures across llvm/cpu tests in both directions; a serial
rerun of those files on the patched binaries passed 130/130. Run baseline and candidate suites one
after another with no build running, or rerun the set difference serially before reporting any
regression. A clean serial suite on a quiet no-GPU Linux box still leaves about 91 environmental
failures (numerics 46, cuda 21, functional 12, optix 4, a few others), and
`slang-test -exclude-prefix tests/<scratch-dir>` keeps ad-hoc probe files under `tests/` out of
full-suite runs
[don't run two full suites concurrently](../learnings/1790718692458-don-t-run-two-slang-test-full-suites-concurrently-.md).

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
Reconfirmed 2026-09-10 at a wider gap (binary `2026.13.1-61-ga916653b70` vs source checkout `928f4010f6` — **264 commits apart**): before writing "reproduced on master @ `<sha>`", run `slangc -v` and attribute the observation to THAT revision; keep source inspection distinct from runtime repro (if you read the code at the checkout, say the path is unchanged there rather than implying a fresh run). A codex OUTPUT_REVIEW (which inspects `slangc -v` and git independently) caught this exact overclaim, plus two adjacent ones on the same report: a repro embedded in an issue body drifting out of sync with the standalone repro file after an edit (fix BOTH copies), and conflating a *verified emitted-MSL mismatch* with an *unrun* on-device Metal pipeline-link failure (state which was actually observed) [prebuilt slangc can lag the source checkout — check `slangc -v` before attributing behavior to a commit](../learnings/1789072949461-prebuilt-slangc-binary-can-lag-the-source-checkout.md).

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

## After merging master: sync submodules, then build the FULL preset

A `git merge origin/master` stales two things a targeted rebuild does not refresh. **(1) Submodule pins.** The merge can move pins (e.g. `external/spirv-tools`, `spirv-headers`) while the checked-out submodules stay at the old SHAs — `git status` shows ` M external/...` — so the verify build tests a tree CI will never build. Run `git submodule update --init <paths>` (or check `git diff --submodule=short`) right after the merge, before rebuilding [sync submodules after merging master](../learnings/1791250506095-after-merging-origin-master-sync-submodules-before.md). (That atom also reconfirms that the critique gate records only fresh `mcp__codex__codex` calls carrying the canonical `/codex-critique` developer-instructions; a `codex-reply` is never a round.) **(2) Serialized standard modules.** When master bumps the serialized IR module version, `--target slangc slang-test` leaves the std modules stale: a full suite then shows dozens of failures across `functional/`/`numerics/` with `warning[E00131]: ignoring IR module version 32 because this compiler supports IR module versions 33 through 33` and `cannot open file 'slang/functional.slang'`. A full `cmake --build --preset debug` cleared 59 of 60 (the remaining gfx-smoke (cpu) fails on master too). **Rule: after any master merge, build the full preset before running the suite; a sudden jump of dozens of standard-module failures means stale modules, not a regression** [full build after an IR module version bump](../learnings/1791238883748-after-merging-master-that-bumps-the-ir-module-vers.md).

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

`cmake -GXcode` fails at **configure** with "Xcode does not support per-config per-source COMPILE_OPTIONS: <genex> specified for source: X.cpp" whenever a per-source `COMPILE_OPTIONS` (set via `set_source_files_properties`) carries a context-sensitive `$<CONFIG:...>` generator expression. `cmGlobalXCodeGenerator` / `XCodeGeneratorExpressionInterpreter::Evaluate()` errors on the **PRESENCE** of the `$<CONFIG>` condition (`GetHadContextSensitiveCondition()` true), NOT on whether the resolved flags differ across configs — so `$<$<NOT:$<CONFIG:Debug>>:-Os>` that resolves to `-Os` in every config is still hard-rejected. Ninja Multi-Config (Slang's `default` preset, used by every CI job including the macOS `xcode-27` runner — a runner *label*, not the generator) tolerates it, and `CMakePresets.json` defines no Xcode generator, so this regression is **invisible to CI** (slang#13240/#13241). Fix pattern: branch on `CMAKE_CXX_COMPILER_ID` at configure time and emit a plain config-independent flag on the non-MSVC (Clang/AppleClang) path, keeping the `$<CONFIG>` genex only where a real per-config difference exists (MSVC Debug `/RTC1` vs optimization). Two gotchas: (1) match `CMAKE_CXX_COMPILER_ID STREQUAL "MSVC"` (== `$<CXX_COMPILER_ID:MSVC>`), NOT the `MSVC` CMake variable — the latter is also true for clang-cl (compiler id `Clang`), so `if(MSVC)` would silently change clang-cl's flags; (2) to prove old-vs-new flag equivalence without a 20-min slang build, `file(GENERATE)` cannot evaluate `$<CXX_COMPILER_ID>` without a `TARGET` (throws "may only be used with binary targets") — instead compile a trivial 2-target throwaway replicating the `set_source_files_properties(... COMPILE_OPTIONS ...)`, build `--config Debug`/`Release` verbose, and grep the actual `-O` flags per config. Reviewer note: when a PR touches per-source `COMPILE_OPTIONS`, check whether any `$<CONFIG>` genex sits on a non-MSVC path — that is the exact shape that breaks `-GXcode`; a configure-only `buildtool: "Xcode"` macOS job wired into `check-cmake` (mirroring `cmake-options-build.yml`'s `buildtool` → `-G` for the windows-vs jobs) would cheaply guard it ([Xcode CMake generator rejects any `$<CONFIG>` genex in per-source COMPILE_OPTIONS — presence, not value](../learnings/1790177389937-xcode-cmake-generator-rejects-any-lt-config-gt-gen.md)).

**Source learnings (24):**
- [Git worktrees do not inherit submodule checkouts — init them before CMake configure](../learnings/1787176235982-git-worktrees-do-not-inherit-submodule-checkouts-i.md) — Full cascade + `ninja: loading build-Debug.ninja: No such file`; explicit external list; a backgrounded subagent build dies — run foreground + Monitor for the artifact.
- [Rebasing a long-lived worktree can stale the CMake build graph — reconfigure before rebuilding](../learnings/1787562764446-rebasing-a-long-lived-worktree-can-stale-the-cmake.md) — #12297 added `slang-rich-diagnostics.cpp`; stale `build.ninja` → hundreds of undefined refs; reconfigure; grep `impl-Debug.ninja` (multi-config), not top-level `build.ninja`.
- [Slang git worktree needs per-worktree submodule init before cmake configure](../learnings/1787677680988-slang-git-worktree-needs-per-worktree-submodule-in.md) — Top-level `--init --depth 1` is enough (no slang-rhi nested / dxc); the `SPIRV-Headers::SPIRV-Headers` `get_target_property` error + leading `-` in `git submodule status` are the tell; first configure also does a ~500 MB DXC clone+build; a Monitor on `build.log` mis-fires when configure (not compile) fails — trust the subagent's completion.
- [CMake grep-invariant guards must use git grep, not rg/grep -r (submodule descent)](../learnings/1787818174243-cmake-grep-invariant-guards-must-use-git-grep-not-.md) — `git grep` skips submodule trees (excludes vendored `CMAKE_BINARY_DIR` hits); scope by tracked-vs-submodule, not `external/` prefix; `check-submodules.yml` pattern.
- [slang worktree build needs submodule init; disable DXIL to skip 30-min DXC-from-source on old glibc](../learnings/1787824391934-slang-worktree-build-needs-submodule-init-disable-.md) — GLIBC < 2.38 builds DXC from source; `-DSLANG_ENABLE_DXIL=OFF -DSLANG_SLANG_LLVM_FLAVOR=DISABLE`; a `run_in_background` grandchild survives; check `pgrep -x ninja` + `/proc/<pid>/cwd`.
- [Slang ASan LD_LIBRARY_PATH gotcha is host-wide not container-specific](../learnings/1787840677149-slang-asan-ld-library-path-gotcha-is-host-wide-not.md) — `$(clang-18 -print-runtime-dir)` on `LD_LIBRARY_PATH`; `ASAN_OPTIONS=detect_leaks=0` during build; a lib-path issue makes slang-test silently *ignore* tests (false-green).
- [Prebuilt slangc in the mounted checkout can be STALE vs git HEAD](../learnings/1787850489737-prebuilt-slangc-in-the-mounted-checkout-can-be-sta.md) — 198 commits behind, predating the commit under study → shows pre-regression behavior; detect via `slangc -v -g<sha>` + `git merge-base --is-ancestor`; stale-parent binary = free baseline.
- [264-commit gap; attribute a repro to the `slangc -v` revision, keep source-inspection distinct from runtime repro; codex OUTPUT_REVIEW also caught issue-body/standalone repro drift and a verified-emit vs unrun-on-device conflation.](../learnings/1789072949461-prebuilt-slangc-binary-can-lag-the-source-checkout.md)
- [valgrind memcheck of slang-llvm JIT: glibc ld.so/dlopen $ORIGIN errors are false positives](../learnings/1788385213783-valgrind-memcheck-of-slang-llvm-jit-glibc-ld-so-dl.md) — Filter to slang frames; memcheck substitutes for MSan when unavailable; strict-aliasing UB is invisible to both, so an x86_64 clean sweep doesn't clear aarch64-only UB.
- [SGL crashpad guard is SGL_HAS_CRASHPAD, not the SGL_ENABLE_CRASHPAD cmake option](../learnings/1787002587931-sgl-crashpad-guard-is-sgl-has-crashpad-not-the-sgl.md) — Generated `#define` in `config.h` via `file(GENERATE)`; ON only if option AND `find_package` succeeded; `#if` on an out-of-scope macro silently becomes `#if 0` — include `config.h` explicitly.
- [Fresh worktree: base clone is `--depth 50` without `--recursive`; init submodules + clang-format-17 via pip; don't detach the build to a plain subagent](../learnings/1789394522873-fresh-slang-worktree-submodule-init-clang-format-1.md) — #13017: worktree inherits uninitialised submodules → `SPIRV-Headers::SPIRV-Headers` configure error; a generic `Agent` backgrounded the build and returned in ~25 s; `pip install --user clang-format==17.0.6` for a C++-only format.
- [CMake per-target PRIVATE flags don't reach linked OBJECT libraries; `cmake --build -k 0` no-ops (put `-k 0` after `--`)](../learnings/1789384635713-cmake-per-target-compile-flags-don-t-propagate-to-.md) — #12782/#12779: `-fno-exceptions` on `slang-common-objects` missed its generated OBJECT libs; apply the helper per OBJECT target, verify in `compile_commands.json`.
- [Xcode CMake generator rejects any `$<CONFIG>` genex in per-source COMPILE_OPTIONS — presence, not value](../learnings/1790177389937-xcode-cmake-generator-rejects-any-lt-config-gt-gen.md) — Ninja MC tolerates it so CI (no `-GXcode` job) misses it (slang#13240/#13241); branch on `CMAKE_CXX_COMPILER_ID` (not `if(MSVC)` — matches clang-cl); prove flag equivalence with a 2-target throwaway, not `file(GENERATE)`.
- [Fresh worktree: SPIRV-Headers configure error until `git submodule update --init --recursive --jobs 16` (~13 s); slangc+slang-test release ~10 min on 64 cores; "building DXC from source" did not block those targets.](../learnings/1790636604671-fresh-slang-git-worktree-init-submodules-before-cm.md)
- [slangc -version in a reused worktree reports configure-time HEAD, not the built source](../learnings/1790693044766-slangc-version-in-a-reused-worktree-reports-config.md) — take repro SHA from `git log -1` + `git status`; no gdb in-container, A/B stack limits via Python setrlimit.
- [slang-test from a -bindir binary copy fails ~31 CUDA/OptiX/header tests that pass in-tree — compare like-for-like locations](../learnings/1790714053699-slang-test-from-a-bindir-binary-copy-fails-31-cuda.md)
- [Slang binary copies: prelude + OptiX headers resolve relative to <bin>/../../.. — hardlink/symlink fix and no-change control (#13329)](../learnings/1790719029887-slang-binary-copies-prelude-optix-headers-resolve-.md)
- [No-driver container: link CUDA via the libcuda.so stub (`-DCUDA_cuda_driver_LIBRARY=...stubs/libcuda.so`); also slangc `-o /dev/null` E00004](../learnings/1790802490676-slangc-o-dev-null-fails-with-e00004-in-the-fixer-c.md)
- [slang-test gfx-smoke "Failed to load DLL gfx" on Linux containers = missing libcuda.so.1, not missing libgfx](../learnings/1790710627405-slang-test-gfx-smoke-failed-to-load-dll-gfx-on-lin.md) — `libgfx.so` is in `lib/`; `ldd` shows `libcuda.so.1 => not found`; environmental.
- [Don't run two slang-test full suites concurrently for A/B baselines](../learnings/1790718692458-don-t-run-two-slang-test-full-suites-concurrently-.md) — 73 contention-only failures vanished on a serial rerun; ~91 no-GPU environmental baseline; `-exclude-prefix` for scratch probes.
- [reused worktree's slangc can be a revert drill's build; rebuild after restore; slangc-only configure ~5 min](../learnings/1791180810533-check-a-reused-worktree-s-slangc-provenance-before.md)
- [file transport blocks submodule init; copy external/ from a same-base worktree (#13429)](../learnings/1791151479459-slang-pr-review-runner-scripts-may-lose-exec-bit-r.md)
- [after merging master that bumps the IR module version, do a FULL build — targeted slangc/slang-test leaves stale std modules (E00131, 59/60 failures cleared)](../learnings/1791238883748-after-merging-master-that-bumps-the-ir-module-vers.md)
- [after merging origin/master, sync submodules before the verify build (` M external/...`); codex-reply not recorded as a critique round](../learnings/1791250506095-after-merging-origin-master-sync-submodules-before.md)
