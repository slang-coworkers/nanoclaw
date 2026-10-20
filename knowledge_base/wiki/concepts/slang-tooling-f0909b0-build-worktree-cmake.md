---
title: "Slang build in worktrees: submodule init, A/B baselines, stale binaries"
type: concept
group: slang-tooling
tags: [build, git-worktree, submodule, cmake, a-b-baseline, stale-binary, ninja]
source_count: 24
---

# Slang build in worktrees: submodule init, A/B baselines, stale binaries

## TL;DR

Building Slang in a per-issue `git worktree` over a shared base clone has a small set of
setup traps that, unhandled, each cost 10–40 minutes — and the CMake build graph can go stale
under you after a rebase.

- **`git worktree add` does NOT populate submodules** (nor *nested* ones), so configure fails with `non-existent target "SPIRV-Headers::SPIRV-Headers"` or `external/<x> does not contain a CMakeLists.txt`. Run `git submodule update --init --recursive` in the worktree before the first configure. If that (or `--reference`) fails with "transport 'file' not allowed" (the URLs are local clones; git ≥2.38 blocks file transport), rerun it as `git -c protocol.file.allow=always submodule update --init --recursive`, then clear any half-written cache and reconfigure. A script that chains configure behind that step with `&&` stops silently (exit 1, no configure log), so check the submodule log first. Copying `external/` from a worktree with matching pins is the fallback. A worktree built with only `slangc slang-test` also needs `libslang-llvm.so` copied into `build/<cfg>/lib`, or its FileCheck rows report ignored.
- **For a quick PR-head `slangc` check whose base equals the main checkout's HEAD, symlink each empty `external/<sub>` to the main checkout's copy**, and build `slang-glslang` with `slangc`, or every `-target spirv` compile fails with E00100 (spirv-opt not loaded).
- **Building an old (2025-era) commit fails `git submodule update` with "not our ref"**: the local-mirror URLs lack the old SHAs and some pins are gone upstream. Fetch each pinned SHA from the `.gitmodules` upstream URL into the shared `.git/modules/external/<p>` store, `git submodule foreach 'git checkout -f HEAD'`, and skip WindowsToolchain. Old trees also need `-DSLANG_ENABLE_GFX=ON` and the `slang-glslang` target.
- **A configure that dies on a missing `::` target is almost always an uninitialised nested
  submodule, not a code error** — the nested `external/spirv-tools/external/spirv-headers` is
  the usual culprit even when the top-level shows a SHA.
- **After merging master: `git submodule update --init` (pins may have moved), then build the FULL preset** — a targeted `slangc slang-test` build leaves serialized std modules stale after an IR-module-version bump (`E00131 ignoring IR module version`, dozens of `functional/` failures that are not regressions). Even without a merge, a partial `slangc slang-test` build never builds `slang/functional.slang`, so `tests/functional/*` fail.
- **The prebuilt `slangc` in the mounted checkout can be many commits behind HEAD** — check
  `slangc -v`'s `-g<sha>` and `git merge-base --is-ancestor` before trusting its emit. In a
  *reused* build tree `-v` prints the configure-time describe, and a clean `git status` proves
  only the source: a revert drill restored without a rebuild leaves the REVERTED binary. Rebuild
  after every drill restore, and before citing an old worktree's binary rebuild it or check
  the binary is newer than the last source change.
- **A slangc/slang-test copied out of `build/Debug` is a different instrument.** The prelude resolves relative to the exe (missing → the embedded prelude is inlined, changing `.cu` text) and nvrtc looks for OptiX headers at `<bin>/../../../external/optix-dev/include` (missing → every OptiX/PTX compile fails), so ~31 CUDA/OptiX/header tests fail from a `-bindir` copy. Run baseline and candidate from the same kind of location plus a no-change control, or rebuild the tree shape with hardlinks + symlinks.
- **Never run baseline and candidate full suites concurrently** (or alongside a build): contention fabricates "patched-only" failures. Run serially, or rerun the set difference serially; ~91 environmental failures remain on a quiet no-GPU box.
- **Don't background the build in a subagent** — a detached ninja dies when the subagent's
  shell exits; run in the foreground, or a `run_in_background` grandchild that survives.
- **Configure flags, DXC-from-source on old glibc, sanitizers, CMake flag scope and measured build costs are on [Slang build configuration](slang-tooling-build-configure-dxc-sanitizers.md).**
- **A corpus A/B diff needs equal-length bindirs, a stripped new-pass dump and a null control, and still only covers shapes the corpus contains** — probe a widened gate's leaf types per target directly, and never A/B two binaries in one worktree that writes `.slang-module` files.

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
form above also works but is not required. The `--depth 1` part is safe only because a worktree's
submodule objects already sit in the base clone's module store; a real shallow submodule fetch
gets branch tips, not pinned SHAs, so do not carry `--depth 1` to a fresh clone (see
[CI Build: Git Checkout Depth & Submodule Pins](ci-build-git-checkout-and-submodule-pins.md)). A configure that dies on a missing `::` target (e.g.
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
When the init fails with "fatal: transport 'file' not allowed", the cause is that the submodule
URLs are local paths (`/workspace/agent/slang/external/...`) and git ≥2.38 blocks file transport
by default; in a fresh `git worktree add` of `/workspace/agent/slang` the first casualty is
`external/WindowsToolchain`. The fix is to allow it for that one command:
`git -c protocol.file.allow=always submodule update --init --recursive` (add `-q`). It recurred on the
#13410 merge check, where a worktree from `git -C /workspace/agent/slang worktree add …` failed on
the local `external/unordered_dense` URL; with the flag, `cmake --preset default` and a Release
`slangc` + `slang-test` build took about 10 minutes, after which `libslang-llvm.so` still had to be
copied into `build/Release/lib` or every FileCheck row reports ignored
([`-c protocol.file.allow=always` on the #13410 worktree](../learnings/1792241165412-new-slang-worktrees-from-the-local-clone-need-git-.md)). If a configure already ran
against the empty `external/` (cmake stops at "Configuring incomplete"), clear the cache as above
and reconfigure; a GC-reaped worktree recreated on an existing `fix/issue-*` branch needs `rm -rf build` after the init for the same reason ([fresh worktree needs submodule init before configure](../learnings/1792139289864-fresh-slang-worktree-needs-submodule-init-before-c.md), [two-commit build bisect](../learnings/1792065111999-two-commit-build-bisect-is-cheap-when-the-suspect-.md)). Do not try `--reference /workspace/agent/slang` to speed it up: it fails for every submodule with "reference repository '/workspace/agent/slang' is shallow", because the base clone is `--depth 50`; a plain `git submodule update --init --recursive -q` takes about 3 min ([--reference to the shallow base clone fails](../learnings/1792088805773-slang-worktree-submodules-reference-to-the-shallow.md)). The failure can also be silent: a build script that chains configure and build
behind the submodule step with `&&` just exits 1 with no `configure.log`, so read the submodule
step's own log first
[protocol.file.allow=always; silent `&&` stop](../learnings/1791581040071-new-git-worktree-of-workspace-agent-slang-submodul.md).

**Old commits add a second submodule failure: dead pins.** When bisecting 2025-era commits (for
example v2025.12..v2025.13) in a worktree of `/workspace/agent/slang`, `git submodule update` fails
with "not our ref" for lz4, miniz, unordered_dense and glslang. There are two causes: the main
clone's submodule URLs point at local mirrors that do not contain the old SHAs, and
WindowsToolchain's pin is gone upstream. The fix fetches each pinned SHA straight into the shared
module store from the upstream URL in `.gitmodules`, then checks the worktree dirs out (until then
they contain only `.git` files), skipping WindowsToolchain:

```bash
git --git-dir=/workspace/agent/slang/.git/modules/external/<p> fetch <upstream-url> <sha>
git submodule foreach 'git checkout -f HEAD'
```

Old trees also need `-DSLANG_ENABLE_GFX=ON` to configure with tests (render-test), and the
`slang-glslang` target for `-target spirv`, or slangc fails with "failed to load downstream
compiler spirv-opt". A Release `slangc` build took about 6 minutes at `-j20`. (A test-authoring
aside from the same bisect: on master, `-vk` reads `column_major int` matrix buffer fields
incorrectly, #13446, so Vulkan layout value tests use float matrices.)
([building 2025-era commits: dead pins + local-mirror URLs](../learnings/1792191559147-building-2025-era-slang-commits-dead-submodule-pin.md))
With the init fixed, a PR #13535 verify worktree built `slangc`, `slang-test`, `slang-unit-test`,
`slang-reflection-test` and `test-server` (Release) in ~10 min on 60 cores
[same init on #13535](../learnings/1791499534921-slang-worktree-build-slang-enable-tests-requires-s.md).
The older fallback, copying a populated `external/` from another worktree, still works when its
pins match (`git diff --quiet <base> HEAD -- external .gitmodules`; ~10 min to a build on #13429)
[copy external/ from a same-base worktree](../learnings/1791151479459-slang-pr-review-runner-scripts-may-lose-exec-bit-r.md).
**Quick PR-head verify build.** To check a fixer's PR head yourself, run `git fetch origin
pull/N/head:refs/remotes/origin/pr-N` and `git worktree add --detach`. `git submodule update
--init --reference <main>` can fail (it failed on `external/WindowsToolchain`). When the PR base
equals the main checkout's HEAD, symlink each empty `external/<sub>` dir to the main checkout's
copy instead of initializing it. Then run `cmake --preset default -DSLANG_ENABLE_TESTS=OFF` and
build `--target slangc` **and** `--target slang-glslang`: without slang-glslang every `-target
spirv` compile fails with E00100 "failed to load downstream compiler 'spirv-opt'", which looks
like the fix broke everything. It takes about 5 minutes on 64 cores. Remove the worktree and the
`pr-N` ref afterwards
([quick PR-head slangc verify build](../learnings/1792365932155-quick-pr-head-slangc-verify-build-symlink-submodul.md)).

Several atoms flag the same **build-subagent hazard**: a subagent that launches ninja with
`&`/`nohup` and returns leaves a *detached* build that dies when its shell exits (configure
half-finished, no artifacts); on #13017 one returned in ~25 s and kept launching background ops,
risking two concurrent builds in one dir. Run the build yourself in the foreground or as a Bash
`run_in_background` grandchild, and check liveness with `pgrep -x ninja` + `readlink
/proc/<pid>/cwd` (never `pgrep -f`, which matches your own argv). A Monitor grepping `build.log`
mis-fires when *configure* failed, because `build.log` is never created. An incremental rebuild
after the first full build is ~2–4 min
[foreground/block the build](../learnings/1787176235982-git-worktrees-do-not-inherit-submodule-checkouts-i.md),
[detached ninja dies; check pgrep -x](../learnings/1787824391934-slang-worktree-build-needs-submodule-init-disable-.md),
[monitor mis-fires when configure failed](../learnings/1787677680988-slang-git-worktree-needs-per-worktree-submodule-in.md).
Formatting hits a PATH gap too. In the slang-fixer container the three tools exist but not on PATH: shfmt at `/workspace/agent/bin/shfmt`, gersemi 0.21 at `/workspace/agent/tools/gersemi-venv/bin/gersemi` (the `/workspace/agent/bin/gersemi` shim is broken) and clang-format at `/usr/bin/clang-format-17`, so symlink all three into one PATH dir ([formatter tool paths](../learnings/1792088805773-slang-worktree-submodules-reference-to-the-shallow.md)). Where they are absent, install the
pinned version without admin (`python3 -m pip install --user clang-format==17.0.6`, then
`export PATH="$HOME/.local/bin:$PATH"`); Lua diagnostics such as `slang-diagnostics.lua` are not
formatted by the script, so match their style by hand
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

**A corpus A/B emit-diff needs three noise controls before its diff means anything.** To inventory a compiler change's side effects, build two slangc binaries that differ only in the PR's files (check out the merge-base versions and rebuild incrementally, ~10 min), run every `//TEST:SIMPLE`/`SIMPLE_EX`/`DIAGNOSTIC_TEST:SIMPLE` directive with its own args the way slang-test does (file path first unless SIMPLE_EX, `-O0` when no `-O`, `-enable-machine-readable-diagnostics` with `diag=`), add a 7-target `-entry computeMain -stage compute` sweep, and diff stdout, stderr, exit code and any `-o` file. Then (1) put the binaries at equal-length paths (`bse/` vs `fix/`) and normalize them, because `-g*` SPIR-V embeds the command line including `-I "<bindir>"` in an `OpString`; (2) strip the new pass's section from `-dump-ir` output; and (3) run a null control (the base binary against a byte-identical copy of itself) and drop everything that differs there too, about 15% of the residue (module containers, separate-debug, source maps, `-embed-downstream-ir`). On PR #13115 this took 23,795 compiles down to 9 genuinely changed files [corpus A/B emit-diff controls](../learnings/1792102021857-slang-corpus-a-b-emit-diff-control-for-bindir-path.md).

**The corpus only covers shapes it contains.** The same #13115 inventory (4,475 directive runs plus 19,320 runs over 2,760 files × 7 targets, null-controlled, plus a slang-test A/B on CPU/LLVM/CUDA/VK) found no pass→fail and no compile→fail, while two real regressions sat in the newly admitted domain: struct tables with call leaves (`{sqrt(4.0), 1u}`) and with vector/matrix/`half` fields, both rejected by NVRTC as `__device__` dynamic initializers. The corpus had zero such tests. When a change widens a type or legality gate, write the domain as a table of leaf types × targets (scalar, vector, matrix, `half`, 16/64-bit, bool, nested arrays, calls), fill every cell base vs head on the real downstream compiler (`-target ptx` for NVRTC, DXC, spirv-val), report the matrix, and pin each new row with a test [an A/B corpus diff only covers shapes the corpus contains](../learnings/1792105846081-an-a-b-corpus-diff-only-covers-shapes-the-corpus-c.md).

**Two binaries sharing one worktree share its serialized modules.** `//TEST:COMPILE ... -o tests/**/X.slang-module` writes into the source tree, so whichever binary ran last owns those files; when the builds differ in IR serialization (after merging a master commit such as #13615), the other binary loads a foreign module and the test-server SIGSEGVs. On slang#13681 that produced false "fix-only" failures in `module-prelink-keeps-autodiff.slang.3` and `dispatch-cross-module.slang.3` (cpu). Diagnose by regenerating with each binary; fix by running the fix suite last, rebuilding the snapshot at the merged base, or using separate worktrees [shared .slang-module artifacts in one worktree](../learnings/1792134757564-slang-test-a-b-in-one-worktree-shared-tests-slang-.md).

## After merging master: sync submodules, then build the FULL preset

A `git merge origin/master` stales two things a targeted rebuild does not refresh. **(1) Submodule pins.** The merge can move pins (e.g. `external/spirv-tools`, `spirv-headers`) while the checked-out submodules stay at the old SHAs — `git status` shows ` M external/...` — so the verify build tests a tree CI will never build. Run `git submodule update --init <paths>` (or check `git diff --submodule=short`) right after the merge, before rebuilding [sync submodules after merging master](../learnings/1791250506095-after-merging-origin-master-sync-submodules-before.md). (That atom also reconfirms that the critique gate records only fresh `mcp__codex__codex` calls carrying the canonical `/codex-critique` developer-instructions; a `codex-reply` is never a round.) **(2) Serialized standard modules.** When master bumps the serialized IR module version, `--target slangc slang-test` leaves the std modules stale: a full suite then shows dozens of failures across `functional/`/`numerics/` with `warning[E00131]: ignoring IR module version 32 because this compiler supports IR module versions 33 through 33` and `cannot open file 'slang/functional.slang'`. A full `cmake --build --preset debug` cleared 59 of 60 (the remaining gfx-smoke (cpu) fails on master too). **Rule: after any master merge, build the full preset before running the suite; a sudden jump of dozens of standard-module failures means stale modules, not a regression** [full build after an IR module version bump](../learnings/1791238883748-after-merging-master-that-bumps-the-ir-module-vers.md). A partial-target build gives the same `functional.slang` symptom with no merge at all: building only `slangc slang-test` in a fresh worktree never builds `slang/functional.slang`, so `tests/functional/*` and `tests/dispatcher/smoke` fail. Build all targets before running the full suite ([partial-target build skips functional.slang](../learnings/1791508327549-fresh-slang-worktree-configure-can-fetch-a-stale-s.md); the same atom's stale-`libslang-llvm.so` finding is on [Building & regression-testing Slang's LLVM path](slang-tooling-llvm-target-build.md)).

**Source learnings (24):**
- [Git worktrees do not inherit submodule checkouts — init them before CMake configure](../learnings/1787176235982-git-worktrees-do-not-inherit-submodule-checkouts-i.md)
- [Slang git worktree needs per-worktree submodule init before cmake configure](../learnings/1787677680988-slang-git-worktree-needs-per-worktree-submodule-in.md)
- [slang worktree build needs submodule init; disable DXIL to skip 30-min DXC-from-source on old glibc](../learnings/1787824391934-slang-worktree-build-needs-submodule-init-disable-.md)
- [Fresh worktree: base clone is `--depth 50` without `--recursive`; init submodules + clang-format-17 via pip; don't detach the build to a plain subagent](../learnings/1789394522873-fresh-slang-worktree-submodule-init-clang-format-1.md) — #13017: worktree inherits uninitialised submodules → `SPIRV-Headers::SPIRV-Headers` configure error; a generic `Agent` backgrounded the build and returned in ~25 s; `pip install --user clang-format==17.0.6` for a C++-only format.
- [Fresh worktree: SPIRV-Headers configure error until `git submodule update --init --recursive --jobs 16` (~13 s); slangc+slang-test release ~10 min on 64 cores; "building DXC from source" did not block those targets.](../learnings/1790636604671-fresh-slang-git-worktree-init-submodules-before-cm.md)
- [slang-test from a -bindir binary copy fails ~31 CUDA/OptiX/header tests that pass in-tree — compare like-for-like locations](../learnings/1790714053699-slang-test-from-a-bindir-binary-copy-fails-31-cuda.md)
- [Slang binary copies: prelude + OptiX headers resolve relative to <bin>/../../.. — hardlink/symlink fix and no-change control (#13329)](../learnings/1790719029887-slang-binary-copies-prelude-optix-headers-resolve-.md)
- [No-driver container: link CUDA via the libcuda.so stub (`-DCUDA_cuda_driver_LIBRARY=...stubs/libcuda.so`); also slangc `-o /dev/null` E00004](../learnings/1790802490676-slangc-o-dev-null-fails-with-e00004-in-the-fixer-c.md)
- [slang-test gfx-smoke "Failed to load DLL gfx" on Linux containers = missing libcuda.so.1, not missing libgfx](../learnings/1790710627405-slang-test-gfx-smoke-failed-to-load-dll-gfx-on-lin.md) — `libgfx.so` is in `lib/`; `ldd` shows `libcuda.so.1 => not found`; environmental.
- [Don't run two slang-test full suites concurrently for A/B baselines](../learnings/1790718692458-don-t-run-two-slang-test-full-suites-concurrently-.md) — 73 contention-only failures vanished on a serial rerun; ~91 no-GPU environmental baseline; `-exclude-prefix` for scratch probes.
- [file transport blocks submodule init; copy external/ from a same-base worktree (#13429)](../learnings/1791151479459-slang-pr-review-runner-scripts-may-lose-exec-bit-r.md)
- [after merging master that bumps the IR module version, do a FULL build — targeted slangc/slang-test leaves stale std modules (E00131, 59/60 failures cleared)](../learnings/1791238883748-after-merging-master-that-bumps-the-ir-module-vers.md)
- [New git worktree of /workspace/agent/slang: submodule init needs protocol.file.allow=always](../learnings/1791581040071-new-git-worktree-of-workspace-agent-slang-submodul.md) — "transport 'file' not allowed" (first on `external/WindowsToolchain`); `git -c protocol.file.allow=always submodule update --init --recursive`; a `&&`-chained configure stops silently with EXIT=1 and no configure.log
- [slang worktree build: SLANG_ENABLE_TESTS requires SLANG_ENABLE_SLANG_RHI (and CMake cache keeps -D OFF)](../learnings/1791499534921-slang-worktree-build-slang-enable-tests-requires-s.md) — fails at CMakeLists.txt:618; pass `=ON` explicitly on re-configure; ~10 min Release build of five targets on 60 cores (PR #13535)
- [Fresh slang worktree configure can fetch a stale slang-llvm; partial-target build fails tests/functional](../learnings/1791508327549-fresh-slang-worktree-configure-can-fetch-a-stale-s.md) — `slangc slang-test`-only build never builds `slang/functional.slang`; build all targets before the full suite
- [after merging origin/master, sync submodules before the verify build (` M external/...`); codex-reply not recorded as a critique round](../learnings/1791250506095-after-merging-origin-master-sync-submodules-before.md)
- [Slang worktree submodules: --reference to the shallow base clone fails; clone plainly](../learnings/1792088805773-slang-worktree-submodules-reference-to-the-shallow.md) — `--depth 50` base; plain init ~3 min; formatter tool paths
- [Slang corpus A/B emit-diff: control for bindir path + nondeterminism, use the tests' own SIMPLE args](../learnings/1792102021857-slang-corpus-a-b-emit-diff-control-for-bindir-path.md) — equal-length bindirs, strip new pass, null control; 23,795 → 9 files (#13115)
- [An A/B corpus diff only covers shapes the corpus contains; probe the newly admitted domain's leaf types directly](../learnings/1792105846081-an-a-b-corpus-diff-only-covers-shapes-the-corpus-c.md) — leaf-type × target matrix on the downstream compiler (#13115)
- [slang-test A/B in one worktree: shared tests/**/*.slang-module artifacts make cross-module tests crash](../learnings/1792134757564-slang-test-a-b-in-one-worktree-shared-tests-slang-.md) — last binary owns the module files; false fix-only SIGSEGVs (#13681)
- [Fresh slang worktree needs submodule init before cmake configure](../learnings/1792139289864-fresh-slang-worktree-needs-submodule-init-before-c.md) — GC-reaped worktree recreated on a fix branch; `rm -rf build` after init
- [Building 2025-era slang commits: dead submodule pins + local-mirror URLs](../learnings/1792191559147-building-2025-era-slang-commits-dead-submodule-pin.md) — fetch pinned SHAs into `.git/modules/external/<p>` from upstream; `foreach checkout -f HEAD`; skip WindowsToolchain; `SLANG_ENABLE_GFX=ON`, `slang-glslang`
- [New slang worktrees from the local clone need `git -c protocol.file.allow=always submodule update`](../learnings/1792241165412-new-slang-worktrees-from-the-local-clone-need-git-.md) — #13410 merge check; ~10 min Release build; copy `libslang-llvm.so` into `build/Release/lib`
- [Quick PR-head slangc verify build: symlink submodules from the main checkout, and build slang-glslang too](../learnings/1792365932155-quick-pr-head-slangc-verify-build-symlink-submodul.md) — `--reference` init failed on WindowsToolchain; E00100 without slang-glslang; ~5 min on 64 cores

_Catalog: [[wiki/index.md]]_
