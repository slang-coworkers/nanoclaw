---
title: "Slang build in worktrees: submodule init, stale CMake graphs, DXC/glibc, sanitizers, stale binaries"
type: concept
group: slang-tooling
tags: [build, git-worktree, submodule, cmake, dxc, glibc, asan, valgrind, sccache, ninja]
source_count: 11
---

## TL;DR

Building Slang in a per-issue `git worktree` over a shared base clone has a small set of
setup traps that, unhandled, each cost 10–40 minutes — and the CMake build graph can go stale
under you after a rebase.

- **`git worktree add` does NOT populate submodules** (nor *nested* ones). `cmake --preset
  default` then fails at configure with `get_target_property() called with non-existent target
  "SPIRV-Headers::SPIRV-Headers"` or a cascade of `external/<x> does not contain a
  CMakeLists.txt`. Run `git submodule update --init --recursive` in the worktree *before* the
  first configure. This is a one-time-per-worktree step; the base clone has them, so copying
  from it won't help — init in the worktree. Top-level `--init` is enough; `--recursive` also
  works but is not required for the Slang build.
- **A configure that dies on a missing `::` target is almost always an uninitialised nested
  submodule, not a code error** — the nested `external/spirv-tools/external/spirv-headers` is
  the usual culprit even when the top-level shows a SHA.
- **On GLIBC < 2.38, configure clones + builds DXC from source (~500 MB, 10–30 min).** For a
  target-agnostic/SPIR-V fix, pass `-DSLANG_ENABLE_DXIL=OFF -DSLANG_SLANG_LLVM_FLAVOR=DISABLE`;
  `rm -rf build/CMakeCache.txt build/CMakeFiles` before reconfiguring so it takes effect.
- **Rebasing a long-lived worktree can stale the CMake build graph** — a rebase that adds a new
  `.cpp` to a `CMakeLists.txt` leaves `build.ninja` unaware of it → hundreds of `undefined
  reference` at link. Reconfigure (`cmake --preset default`) before rebuilding.
- **The prebuilt `slangc` in the mounted checkout can be many commits behind HEAD** — check
  `slangc -v`'s `-g<sha>` and `git merge-base --is-ancestor` before trusting its emit.
- **Sanitizer gotchas (ASan/TSan) are host-wide, not container-specific:** `LD_LIBRARY_PATH`
  must include the clang runtime dir; `ASAN_OPTIONS=detect_leaks=0` during the build.
- **valgrind memcheck's glibc `ld.so`/`dlopen` `$ORIGIN` errors are false positives** — triage
  by whether the stack references a slang frame.
- **Don't background the build in a subagent** — a detached ninja dies when the subagent's
  shell exits; run in the foreground, or a `run_in_background` grandchild that survives.
- **CMake grep-invariant guards must use `git grep`** (skips submodule trees), not `rg`/`grep -r`.
- **Compile-time feature guards use the generated `SGL_HAS_*` define, not the cmake `option()`.**

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
[the SPIRV-Headers target error](../learnings/1787226980684-fresh-worktree-needs-git-submodule-update-init-bef.md),
[per-worktree init, top-level only](../learnings/1787677680988-slang-git-worktree-needs-per-worktree-submodule-in.md),
[worktree init + DXIL disable](../learnings/1787824391934-slang-worktree-build-needs-submodule-init-disable-.md).

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
[DXC clone on first configure](../learnings/1787226980684-fresh-worktree-needs-git-submodule-update-init-bef.md).

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
matches your own argv and can't see the worktree path).

## GLIBC, DXC-from-source, and the stale CMake graph

On a host with **GLIBC < 2.38**, configure clones and builds DXC from source (~500 MB, 10–30
min) because the prebuilt DXC needs 2.38 (log: "System GLIBC 2.36 < required 2.38: building DXC
from source"). If your fix is target-agnostic / SPIR-V-tested (not DXIL), skip it with
`-DSLANG_ENABLE_DXIL=OFF -DSLANG_SLANG_LLVM_FLAVOR=DISABLE`, and `rm -rf build/CMakeCache.txt
build/CMakeFiles` before reconfiguring so the options take effect
[disable DXIL on old glibc](../learnings/1787824391934-slang-worktree-build-needs-submodule-init-disable-.md).

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

**Source learnings (11):**
- [Git worktrees do not inherit submodule checkouts — init them before CMake configure](../learnings/1787176235982-git-worktrees-do-not-inherit-submodule-checkouts-i.md) — Full cascade + `ninja: loading build-Debug.ninja: No such file`; explicit external list; a backgrounded subagent build dies — run foreground + Monitor for the artifact.
- [Fresh worktree needs git submodule update --init before cmake configure](../learnings/1787226980684-fresh-worktree-needs-git-submodule-update-init-bef.md) — `get_target_property() ... "SPIRV-Headers::SPIRV-Headers"`; leading `-` in `git submodule status`; first configure also does a ~500 MB DXC clone+build.
- [Rebasing a long-lived worktree can stale the CMake build graph — reconfigure before rebuilding](../learnings/1787562764446-rebasing-a-long-lived-worktree-can-stale-the-cmake.md) — #12297 added `slang-rich-diagnostics.cpp`; stale `build.ninja` → hundreds of undefined refs; reconfigure; grep `impl-Debug.ninja` (multi-config), not top-level `build.ninja`.
- [Slang git worktree needs per-worktree submodule init before cmake configure](../learnings/1787677680988-slang-git-worktree-needs-per-worktree-submodule-in.md) — Top-level `--init --depth 1` is enough (no slang-rhi nested / dxc); a Monitor on `build.log` mis-fires when configure (not compile) fails — trust the subagent's completion.
- [CMake grep-invariant guards must use git grep, not rg/grep -r (submodule descent)](../learnings/1787818174243-cmake-grep-invariant-guards-must-use-git-grep-not-.md) — `git grep` skips submodule trees (excludes vendored `CMAKE_BINARY_DIR` hits); scope by tracked-vs-submodule, not `external/` prefix; `check-submodules.yml` pattern.
- [slang worktree build needs submodule init; disable DXIL to skip 30-min DXC-from-source on old glibc](../learnings/1787824391934-slang-worktree-build-needs-submodule-init-disable-.md) — GLIBC < 2.38 builds DXC from source; `-DSLANG_ENABLE_DXIL=OFF -DSLANG_SLANG_LLVM_FLAVOR=DISABLE`; a `run_in_background` grandchild survives; check `pgrep -x ninja` + `/proc/<pid>/cwd`.
- [Slang ASan LD_LIBRARY_PATH gotcha is host-wide not container-specific](../learnings/1787840677149-slang-asan-ld-library-path-gotcha-is-host-wide-not.md) — `$(clang-18 -print-runtime-dir)` on `LD_LIBRARY_PATH`; `ASAN_OPTIONS=detect_leaks=0` during build; a lib-path issue makes slang-test silently *ignore* tests (false-green).
- [Prebuilt slangc in the mounted checkout can be STALE vs git HEAD](../learnings/1787850489737-prebuilt-slangc-in-the-mounted-checkout-can-be-sta.md) — 198 commits behind, predating the commit under study → shows pre-regression behavior; detect via `slangc -v -g<sha>` + `git merge-base --is-ancestor`; stale-parent binary = free baseline.
- [264-commit gap; attribute a repro to the `slangc -v` revision, keep source-inspection distinct from runtime repro; codex OUTPUT_REVIEW also caught issue-body/standalone repro drift and a verified-emit vs unrun-on-device conflation.](../learnings/1789072949461-prebuilt-slangc-binary-can-lag-the-source-checkout.md)
- [valgrind memcheck of slang-llvm JIT: glibc ld.so/dlopen $ORIGIN errors are false positives](../learnings/1788385213783-valgrind-memcheck-of-slang-llvm-jit-glibc-ld-so-dl.md) — Filter to slang frames; memcheck substitutes for MSan when unavailable; strict-aliasing UB is invisible to both, so an x86_64 clean sweep doesn't clear aarch64-only UB.
- [SGL crashpad guard is SGL_HAS_CRASHPAD, not the SGL_ENABLE_CRASHPAD cmake option](../learnings/1787002587931-sgl-crashpad-guard-is-sgl-has-crashpad-not-the-sgl.md) — Generated `#define` in `config.h` via `file(GENERATE)`; ON only if option AND `find_package` succeeded; `#if` on an out-of-scope macro silently becomes `#if 0` — include `config.h` explicitly.
