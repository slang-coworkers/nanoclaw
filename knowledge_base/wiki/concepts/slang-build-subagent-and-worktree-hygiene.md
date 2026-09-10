---
title: "Slang Build Subagent & Worktree Hygiene"
type: concept
group: slang-tooling
tags: [build, subagent, disk, worktree, submodule, staleness, concurrency]
source_count: 9
---

# Slang Build Subagent & Worktree Hygiene

This page covers the build-workflow hazards you hit while iterating on Slang in a shared, multi-worktree fixer container: build subagents that bail mid-build and leave cmake running, disk-full on the shared build volume, `slangc -v` and submodule-gitlink staleness, and concurrent-build archive corruption. The release-vs-CI divergences, sanitizer suppressions, `external/` dep kinds, and `-Og`/`SLANG_ASSERT` debug-flag traps live on the sibling page [Slang Release-Build Divergences & Sanitizer Suppressions](slang-build-release-divergences-and-sanitizers.md). The dependency and CMake-option surface (DXC, slang-llvm, FindDXC, Falcor) lives on [Build System, Prebuilt Deps (DXC/LLVM) & CMake Options](slang-tooling-build-runtime-libs.md).

## TL;DR

- **A build subagent that bails mid-build often leaves cmake running** — the detached subshell survives and completes. Before relaunching: `ps ... | grep -E 'ninja|cmake|cc1plus'`, `tail build_out.log` for `BUILD_EXIT=`, check for the binaries. NEVER start a second `cmake --build` on the same dir (two ninjas corrupt object/link state).
- **A build `Agent` AUTO-RELAUNCHES on any failure** → two concurrent builds on ONE dir corrupt shared archives (`malformed archive` / `FAILED: …libSPIRV-Tools-opt.a`) — this is concurrency, not disk. Prefer `Bash(run_in_background=true)` you OWN over a build subagent; sanity-check dramatic env root causes against a sibling worktree binary mtime.
- **Shared build volume fills** from accumulated `build/` trees (~6-7G each; the fixer's `/dev/vdb` overlay is 251G and shared with `/`). At ~45 worktrees it hits 98-100% → `cmake --build` fails `No space left on device` on UNRELATED files. Free ONLY your OWN `build/`, never sibling `wt-slang-*/`. Commit + patch-back before a teardown loses work; report `blocked` if a rebuild still won't fit. The reap-merged-worktrees grant often frees nothing — disk self-recovers as sibling builds finish; try an INCREMENTAL rebuild.
- **`slangc -v` is baked at CONFIGURE time** — never use it to identify a binary's commit; an incremental rebuild leaves the version string stale.
- **Re-run `git submodule update --init --recursive` after EVERY rebase** (rebase bumps gitlinks but doesn't check them out → cryptic unrelated build errors).

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

## slangc -v version string is stale on incremental builds

`slangc -v` prints a git-describe string (e.g. `2026.10.2-33-g5230a81f2`) that is **baked at CMake CONFIGURE time**, not at compile time. An incremental rebuild (`cmake --build` after new source, without reconfiguring) recompiles the changed code but leaves the version string stale — so never use `slangc -v` to identify which commit a binary was built from ([slangc -v version string is stale on incremental builds — don't use it to identify a binary's commit](../learnings/1782864395490-slangc-v-version-string-is-stale-on-incremental-bu.md)).

## Re-run submodule update after every rebase in a worktree (gitlink staleness)

Run `git submodule update --init --recursive` **after every rebase** in a Slang worktree, not just at worktree creation. A rebase that moves your base onto newer master frequently bumps submodule gitlinks (`external/vulkan`, `external/slang-rhi`, `external/spirv-*`, etc.), but the rebase does NOT check out the new submodule commits — your worktree keeps the OLD ones and the build fails with errors that look unrelated to your change (e.g. `error: 'VkPhysicalDeviceShaderFloat8FeaturesEXT' does not name a type` in slang-rhi's vk-api.h, seen on slang#11315 / PR #11323). A fresh-worktree `git submodule update --init --recursive` can also silently MISS a submodule (`fatal error: fast_float/fast_float.h: No such file` — only 5 submodules listed; fix with an explicit `git submodule update --init external/fast_float`). The gitlink-vs-checkout drift is invisible in `git status` (submodules show clean at the recorded ref only if updated); diagnose by comparing `git ls-tree HEAD external/vulkan` (recorded gitlink) against `git -C external/vulkan rev-parse HEAD` (checked-out) — a mismatch means stale. Shortcut: `slangc` does NOT link `slang-rhi`, so a `--target slangc` build sidesteps the slang-rhi/vulkan-headers mismatch entirely when you only need slangc to verify a compile-only test (SIMPLE/filecheck/DIAGNOSTIC directives) ([Re-run submodule update after every rebase in a worktree (gitlink bumps go stale)](../learnings/1784078101643-re-run-submodule-update-after-every-rebase-in-a-wo.md)).

## Build-Subagent Concurrent-Corruption

**A build `Agent` subagent auto-relaunches `cmake --build` on ANY failure — two concurrent builds on ONE build dir corrupt shared archives.** Symptom: `ranlib: <lib>.a: malformed archive` / `FAILED: …/libSPIRV-Tools-opt.a` on a dependency you didn't touch — easy to misread as a real compile break, but it's concurrency (disk is fine; `df -h` healthy). The subagent can relaunch repeatedly AND keep old trees alive (2-3 concurrent builds on one dir), and it fabricated a confident-but-WRONG root cause ("GLIBC too old, DXC can't build from source") that a sibling worktree's same-day slang-test binary immediately disproved. Takeaways: (1) prefer `Bash(run_in_background=true)` you OWN over a build subagent — one process, no hidden relaunch, same completion notification, and you can Monitor the logfile; (2) sanity-check any dramatic environment root cause against a sibling worktree binary mtime; (3) recover isolation-safely — confirm `/proc/<pid>/cwd` is under YOUR worktree before `kill`, NEVER `pkill ninja` globally (kills sibling fixers), `rm -f` the corrupt `.a`, relaunch ONE non-retrying build; (4) `pgrep -fc "cmake --build" > 1` may just be sibling fixers on their own dirs — only concurrency on the SAME dir corrupts ([build subagent auto-relaunch → concurrent-build archive corruption](../learnings/1784659482124-build-subagent-auto-relaunch-on-failure-concurrent.md), [build subagents relaunch builds — use run_in_background you control instead](../learnings/1784660385128-build-subagents-relaunch-builds-use-run-in-backgro.md)).

**Source learnings (9):**
- [Build subagent that bails mid-build often leaves its detached cmake running — check before relaunching](../learnings/1781624196085-build-subagent-that-bails-mid-build-often-leaves-i.md)
- [Fixer container disk fills from accumulated build/ trees (ENOSPC at cmake-configure)](../learnings/1782151736391-fixer-container-disk-fills-from-accumulated-build-.md)
- [Shared build volume fills at ~45 worktrees; commit+patch-back, report blocked, never reclaim siblings](../learnings/1783473828121-shared-build-volume-fills-at-45-worktrees-commit-p.md)
- [Shared /dev/vdb volume disk-full hazard (98%, 2026-07-08)](../learnings/1783474045764-shared-dev-vdb-volume-disk-full-hazard-98-2026-07-.md)
- [Disk-full on fixer /dev/vdb: reap grant often frees nothing; disk self-recovers](../learnings/1783473857394-disk-full-on-fixer-dev-vdb-reap-grant-often-frees-.md)
- [slangc -v version string is stale on incremental builds — don't use it to identify a binary's commit](../learnings/1782864395490-slangc-v-version-string-is-stale-on-incremental-bu.md)
- [Re-run submodule update after every rebase in a worktree (gitlink bumps go stale)](../learnings/1784078101643-re-run-submodule-update-after-every-rebase-in-a-wo.md)
- [build subagent auto-relaunch on failure → concurrent-build archive corruption (malformed .a); isolation-safe recovery](../learnings/1784659482124-build-subagent-auto-relaunch-on-failure-concurrent.md)
- [build subagents relaunch builds + fabricate env root causes — prefer run_in_background you own; sanity-check vs sibling binary mtime](../learnings/1784660385128-build-subagents-relaunch-builds-use-run-in-backgro.md)

_Catalog: [[wiki/index.md]]_
