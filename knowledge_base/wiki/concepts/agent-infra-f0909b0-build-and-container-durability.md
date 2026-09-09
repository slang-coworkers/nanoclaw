---
title: "Slang Build Toolchain and Container-Durability in Agent Sessions"
type: concept
group: agent-infra
tags: [build, ninja, clang-format, filecheck, cost-cap, container-teardown, subagent, durability]
source_count: 10
---

## TL;DR

Building slang inside an agent container is fragile in ways that masquerade as code
errors. Distinguish the environment from the diff before blaming the diff.

- **`clang-format` is not on PATH** in slang containers; only `clang-format-17`
  (`/usr/bin/clang-format-17`) exists, and the repo requires **17.x**. Symlink it or
  `pip install clang-format==17.0.6 --break-system-packages`. `./extras/formatting.sh`
  with **no type flag** just prints usage — a silent false-green. Always pass `--cpp`,
  `--md`, etc.
- **A bare slang-test/slangc build has no FileCheck** — it needs `libslang-llvm.so`
  (from the slang-llvm lib). Without it, `//TEST:SIMPLE(filecheck=...)` tests are
  **IGNORED** (`0/0, 1 ignored`) — not passed, not failed; assertions never run.
  Fix by copying the base clone's `libslang-llvm.so` into the worktree lib dir (it's
  loaded at runtime, independent of your code, so it doesn't contaminate the test).
- **Never read a test result off `tail -1`** — a crashed run prints an empty line that
  looks like silence-means-fine. Check exit code or demand a positive `N/N` token.
- **Background builds die on container teardown / subagent turn-end.** A `run_in_background`
  or subagent-with-Monitors build is killed when the container cycles or the subagent
  returns; leftover truncated zero-byte `.so` then fails `objcopy`. Run builds
  **synchronously** — foreground chunks (~9.5 min) in one active turn, or Bash
  `run_in_background` that blocks to a completion notification. Ninja resumes from cache
  between chunks.
- **Advancing object count across wakes = teardown-killed (keep alive); frozen at the
  exact same number forever = genuine hang.** NEVER `rm -rf build` on a suspected-hung
  long build before confirming which — a clean rebuild discards recoverable cache and, if
  teardowns continue, never finishes.
- **Commit AND push eagerly** — a pushed origin commit is the only restart-durable state.
  Container restarts wipe the worktree; uncommitted (or committed-unpushed) work vanishes.
  On resume, re-verify branch state FIRST; a resume turn's first report is provisional.
- **A hand-patched file that is NOT version-controlled is a lease, not a fix** — every
  rebuild reverts it. Re-probe hand-patched files after every rebuild/`install_packages`/restart.
- **Disk can hit 100%** — an ENOSPC at the final link (`objcopy: No space left`) or
  `index.lock write error` looks like a build error. `df -h` shows the truth; report
  `blocked` with `df -h`, never delete sibling worktrees, escalate fleet disk pressure.
- **A fresh-worktree cold build recompiles SPIRV-Tools + DXC from source** (~1142 ninja
  steps, hours). Repeated `interrupted by user` (SIGTERM, not a compile error) across
  multi-hour sessions can be the **per-session cost cap** reaping the container, not host
  churn — diagnose with `ncl cost-cap get --group` and raise the cap.

## Synthesis

### Missing toolchain reads as a false pass

Two independent tools default to a green-looking non-result. `./extras/formatting.sh`
invokes bare `clang-format`, which is absent on the fleet; only `clang-format-17` at
`/usr/bin/clang-format-17` exists, and 17.x is the pinned/expected version (the
"17-18" upper bound in copilot-instructions is misleading). Fix per-session by symlink or
`pip install clang-format==17.0.6 --break-system-packages`. Independently, the bare
`./extras/formatting.sh` with no type flag prints usage and does nothing — a silent
false-green; always pass a type flag, and markdown needs its own run
([clang-format not on PATH](../learnings/1786489601678-clang-format-not-on-path-in-slang-fixer-container-.md),
[fresh slang worktree FileCheck unavailable](../learnings/1787247745831-fresh-slang-worktree-filecheck-unavailable-llvm-of.md)).
The same clang-format note (`/usr/bin/clang-format-17`) recurs across build learnings
([record-replay createSession leak](../learnings/1788252612832-record-replay-createsession-leaked-a-ref-on-regist.md)).

FileCheck is the higher-stakes version of the same shape. FileCheck support comes only
from `source/slang-llvm/slang-llvm-filecheck.cpp` in the slang-llvm library; a bare
`--target slang-test`/`slangc` build (or a fresh worktree where LLVM is disabled because
host GLIBC 2.36 < 2.38 and no prebuilt slang-llvm is fetched) prints "FileCheck is not
available" and **IGNORES** every filecheck test — the result line reads
`0% of tests passed (0/0), 1 tests ignored`, which is neither pass nor fail
([slang-test ignores filecheck tests](../learnings/1786633416035-slang-test-ignores-filecheck-tests-when-filecheck-.md),
[fresh slang worktree FileCheck unavailable](../learnings/1787247745831-fresh-slang-worktree-filecheck-unavailable-llvm-of.md)).
Two fixes: (a) copy the base clone's working `libslang-llvm.so` into the worktree lib dir
— it is loaded at runtime and independent of your code, so it does NOT contaminate the
test of your fix; do NOT instead point base `slang-test -bindir` at the worktree (base
slang-test links the BASE libslang, so your fix is not exercised); (b) failing that, run
the exact `slangc` command (`slang-test -v <test>` prints it) and simulate CHECK matching
by hand — matching region-by-region between `CHECK-LABEL`s, not whole-file.

### Background builds die silently; foreground/synchronous is the durable pattern

Multiple sessions independently discovered that a long slang build launched in the
background does not survive the container. A subagent that spins up Monitors and *ends its
turn* has already exited — its child `cmake --build` is reaped mid-link, leaving a
truncated **zero-byte `.so`** that fails the next `objcopy` (empty-file error) before the
target is reached ([build subagent reaped mid-build](../learnings/1787782170721-build-subagent-that-ends-its-turn-gets-reaped-mid-.md)).
Container teardown (instruction update, self-mod, crash) does the same: a "16h in-flight,
stuck at 198/957" build was really *three separate teardowns each killing a fresh
background build* ([background builds die on teardown](../learnings/1787337179999-background-builds-die-on-container-teardown-foregr.md)).
The durable pattern is foreground: run consecutive ~9.5-min chunks inside a single active
turn so the container stays alive; ninja resumes from cache and the remaining count drops
to completion. For "build then notify," use Bash `run_in_background` that blocks to a
single completion notification, NOT a subagent that returns after arming monitors.

The remedy hinges on a diagnosis that is easy to get backwards: a hung build and a
repeatedly-killed background build present identically (long elapsed, no artifact, last
signal a mid-build line) but have OPPOSITE remedies ([stall remedy: distinguish hung from repeatedly-killed](../learnings/1787337196578-stall-remedy-distinguish-hung-build-from-repeatedl.md)).
The discriminator: object counts **advancing each session** = teardown pattern (keep it
alive, never clear); **frozen at the exact same number forever** = true hang (kill +
restart). A pre-authorized "clear the build dir and rebuild clean" issued on the wrong
diagnosis throws away recoverable ninja cache and, if teardowns keep happening, never
finishes — so confirm the process is genuinely hung before any destructive remedy. If you
inherit a stale zero-byte artifact, just re-run once the real relink regenerates it and
confirm the `.so` is non-empty (`ls -la`) before blaming the diff.

### State that does not survive a rebuild/restart

The most damaging version of the durability problem is losing shipped-looking work.
Container restarts wipe the local worktree; anything not **committed AND pushed** is
invisible to GitHub afterward — a PR keeps showing the stale/rejected diff and the chain
goes silent for days ([container restarts wipe the fixer worktree](../learnings/1788355023814-container-restarts-wipe-the-fixer-worktree-commit-.md)).
Discipline: commit + push eagerly (especially right after a review rework, before any
build); on resume, re-verify branch state FIRST (`git status`; compare live PR head to
the commit you intended); treat a resume turn's first report as provisional until branch
state is confirmed (a restart mid-turn can even garble output).

A subtler durability class is the **hand-patched but unversioned file**. When
nanoclaw#1145 merged and the container rebuilt, the version-controlled copy of
`devin-fetch.sh` came back *fixed* while the unversioned sibling copy **reverted** — the
very rebuild that delivered the durable fix discarded the hand-patch on the other copy
([nanoclaw#1145 merged — re-probe after every rebuild](../learnings/1786388979361-approver-infra-abstain-nanoclaw-1145-merged-and-my.md)).
"Is it version-controlled?" is the first question about any patch you apply; a
per-container patch is a lease that every rebuild revokes. Re-probe hand-patched files
after any rebuild, `install_packages`/`add_mcp_server` approval, restart, and specifically
after an upstream fix you were waiting on merges. The same learning carries a verification
warning that belongs to the whole page: a test that **prints nothing** is not a test that
passed — a crashed run's `tail -1` is an empty line indistinguishable from
silence-means-fine; check the exit code or demand a positive `N/N` token.

### Disk exhaustion and the per-session cost cap look like build failures

A worktree volume at 100% (956G/1007G) fails a debug build at the FINAL link with
`objcopy: ... No space left on device` and breaks `git commit` with `index.lock write
error` — both look like build errors but are disk exhaustion ([worktree volume 100% full](../learnings/1787280962308-worktree-volume-can-be-100-full-build-fails-enospc.md)).
`df -h` shows the truth; report `blocked` with `df -h`, never delete sibling `wt-*`
worktrees (isolation), and for a change that only needs a rebuilt binary to regenerate an
auto-generated doc, push source-only and let CI regenerate (`/regenerate-cmdline-ref`).
Fleet-wide disk pressure is an operator problem — escalate it.

Finally, a fresh-worktree cold build recompiles SPIRV-Tools + DXC entirely from source
(GLIBC 2.36 forces DXC-from-source), ~1142 ninja steps over hours. Repeated
`ninja: build stopped: interrupted by user` (a SIGTERM, not a compile error) across a
multi-hour multi-wake session can be the **per-session cost cap** reaping the container —
not host churn, a cron reaper, or fixer silence ([fresh-worktree builds hit the per-session cost cap](../learnings/1787277018261-fresh-worktree-slang-builds-can-hit-the-per-sessio.md)).
From Main/global scope, diagnose with `ncl tasks list` (rule out a scheduled teardown),
`ncl cost-cap get --group <folder>` (check the cap — slang-fixer's was $24.96), and
`ncl sessions list | grep <issue>` (exactly one running session + repeated empty turns =
a live session losing its backgrounded build). Mitigation: raise the cap
(`ncl cost-cap set --cap 60`), and do NOT force-restart a session whose build is
near-complete since ninja progress caches across wakes and converges. Host logs naming the
actual teardown reason are not reachable from an agent container, so the SIGTERM cause
stays a hypothesis from the agent side — corroborated, not proven.

**Source learnings (10):**
- [clang-format not on PATH in slang-fixer container; pip-install 17.x per-session](../learnings/1786489601678-clang-format-not-on-path-in-slang-fixer-container-.md) — install 17.0.6 or symlink `clang-format-17`; bare `formatting.sh` prints usage (false-green); critique gate blocks all `gh`.
- [slang-test ignores filecheck tests when FileCheck unavailable in worktree builds](../learnings/1786633416035-slang-test-ignores-filecheck-tests-when-filecheck-.md) — `0/0 ignored` is neither pass nor fail; simulate CHECK by hand region-by-region.
- [Fresh slang worktree: FileCheck unavailable → borrow base build's libslang-llvm.so](../learnings/1787247745831-fresh-slang-worktree-filecheck-unavailable-llvm-of.md) — copy the base `libslang-llvm.so` (runtime-loaded, non-contaminating); don't `-bindir` base slang-test at the worktree.
- [Fresh-worktree Slang builds can hit the per-session cost cap and look like container churn](../learnings/1787277018261-fresh-worktree-slang-builds-can-hit-the-per-sessio.md) — cold build = ~1142 steps; repeated SIGTERM = cost-cap reap; raise `ncl cost-cap set --cap`.
- [Worktree volume can be 100% full — build fails ENOSPC at final link, not a code error](../learnings/1787280962308-worktree-volume-can-be-100-full-build-fails-enospc.md) — `objcopy: No space left` / `index.lock` = disk full; `df -h`, report blocked, never delete sibling worktrees.
- [Background builds die on container teardown — foreground chunking is the workaround](../learnings/1787337179999-background-builds-die-on-container-teardown-foregr.md) — "16h stuck" was 3 teardowns; advancing object count = teardown, run foreground chunks in one turn.
- [Stall remedy: distinguish hung build from repeatedly-killed background build](../learnings/1787337196578-stall-remedy-distinguish-hung-build-from-repeatedl.md) — hung vs killed present identically, opposite remedies; never clear cache before confirming a true hang.
- [Build subagent that ends its turn gets reaped mid-build → zero-byte .so → objcopy FAILED](../learnings/1787782170721-build-subagent-that-ends-its-turn-gets-reaped-mid-.md) — a subagent that arms Monitors and returns has exited; use Bash `run_in_background`, confirm `.so` non-empty.
- [Container restarts wipe the fixer worktree — commit+push before any restart-risk](../learnings/1788355023814-container-restarts-wipe-the-fixer-worktree-commit-.md) — only pushed commits survive restart; re-verify branch state on resume before reporting "done."
- [nanoclaw#1145 merged and my container rebuilt — re-probe after every rebuild](../learnings/1786388979361-approver-infra-abstain-nanoclaw-1145-merged-and-my.md) — an unversioned hand-patch is a lease; every rebuild reverts it; a test that prints nothing is not a pass.
