---
title: "Build tooling: testing a PR's effect locally, shared-clone hazards, and detaching long builds"
type: concept
group: ci
tags: [ci, build, git, worktree, merge-base, shared-clone, subagent, setsid]
source_count: 4
---

## TL;DR

- **Test a PR's effect by extracting its merge-base delta, not by building its branch.** `git diff master..pr` on an old branch is polluted with the commits master gained since; use `git diff $(git merge-base master pr)..pr`. Then `git apply` the source-only delta onto an already-built master and bracket **apply → build → measure → revert** — one variable, one recompiled TU, instead of a whole branch (which also hits unpopulated submodules).
- **A build failure in a shared clone is not evidence about your patch.** Read the undefined symbol, find which file *generates* it, and check whether your diff touches that file. Do `git status --porcelain | grep -v '^??'` before AND after any build in a shared checkout — a sibling session mid-flight is indistinguishable from your own breakage. Preserve foreign changes; **never `git checkout --` / `reset --hard`** a shared clone.
- **A long build launched inside an `Agent` subagent dies when the subagent's turn ends** (`ninja: build stopped: interrupted by user` — SIGINT from process-group teardown, not an operator). Detach with `setsid nohup ... &` and watch via `Monitor`. Discriminator: `grep -c "^FAILED:" build.log` == 0 + "interrupted" = teardown, not a compile error.
- **A green test suite is not coverage.** A fix PR's green CI is *silent* about a slice its tests do not construct — measure the slice, don't infer it from the predicate.
- **Guards that make a local measurement worth anything:** a positive control that the PR's fix is LIVE in your binary; a must-fail pre-guard; a must-differ post-guard after revert; and `BUILD_EXIT` in the log as the only completion signal (a background wrapper reports exit 0 while still linking — compare binary mtime vs the recompiled object's).

---

## Extract the merge-base delta; don't build the branch

For "does open PR #N change this behaviour?", building the PR branch is often the expensive wrong move and the obvious diff is the wrong diff. Two traps on slang #12386 vs PR #12304: [Test a PR's effect by extracting its merge-base delta, not by building its branch](../learnings/1786000108097-test-a-pr-s-effect-by-extracting-its-merge-base-de.md)

1. **A fresh `git worktree` has UNPOPULATED submodules** — configure died on a missing `SPIRV-Headers` target and wanted to clone+build DXC (~500 MB) before Slang even started. Discriminator: `ls external/spirv-headers | wc -l` → 0 in the worktree, 16 in the main clone (must-hit control). The build log was one line because `configure && build` short-circuited, so **`BUILD_EXIT=1` was a CONFIGURE failure, not a compile failure** — read which stage failed before diagnosing.
2. **`git diff master..pr-branch` is NOT the PR's contribution** — on a 6-day-old branch it also contains the 35 commits master gained since (134 KB of unrelated churn). Use `git diff $(git merge-base master pr)..pr` — that showed PR #12304's entire source contribution was one 4-line removal.

The cheaper, strictly better method: extract the source-only delta, `git apply --check` it against current master, then bracket **apply → build → measure → revert** on the already-built clone — one variable, one recompiled TU. Non-negotiable guards, or the result is worthless: a **positive control that the PR's fix is LIVE** in your binary (master emitted `struct Empty_0` count 1, patched 0 — without it a null result is indistinguishable from measuring an unpatched binary); a **must-fail pre-guard** (master still reproduces the bug); a **must-differ post-guard** after revert (the changed cell must change back); and **`BUILD_EXIT` in the log is the only completion signal** (a background launcher reports exit 0 while still linking — twice "completed" appeared with `slangc` mtime older than the object it should have relinked). Shared-clone hazard: `ps` couldn't see another container's build processes (0 matches) but the artifact count could (objects 604 → 658 in 20s) — sample twice, snapshot binaries with a PROVENANCE file before measuring, never mutate a worktree you didn't create. Payoff: this method found the PR *widens* the bug (a shape that compiles today aborts with the PR applied — a land-order dependency a two-way-diff reading would have missed).

## A green suite is not coverage — measure the slice

On slang #12384, the fix for a sibling issue was in flight as PR #12304, CI green 27/0. Two things only measurement could settle: [A green CI on a fix PR is silent about a slice its tests do not construct — measure the slice, don't infer it from the predicate](../learnings/1786000256187-a-green-ci-on-a-fix-pr-is-silent-about-a-slice-its.md)

1. **"Does the in-flight fix close my issue?" is a build, not a code read.** Building PR #12304's head against a pristine baseline showed it fixes the reported repro but leaves a residual **byte-identical** — `public __extern_cpp struct Empty {}` still mismatches, because `kIROp_ExternCppDecoration` is a *separate case label* from `kIROp_PublicDecoration` in the same switch and the PR removes only the `PublicDecoration` producer. Predicting this from reading the predicate is not measuring it — and the verdict needed the measurement because a maintainer decides close-vs-keep-open on it.
2. **A green test suite is not coverage.** All five of the PR's regression shapes were `ParameterBlock`/function-boundary — none takes an entry-point uniform parameter, the path the new issue reports. Its green CI is *silent* about that slice. Say so explicitly, or someone later mistakes green CI for coverage. Checkable form: enumerate the test's shapes and state which axis none exercises.

The control that makes the rest trustworthy: a matrix cell whose expected result is AGREEMENT (a non-empty inner struct, reflection 8 / PTX 8) — without it every MISMATCH cell is indistinguishable from a stuck instrument. Two cells were not constructible (`E30604`) and were reported as void, not as findings — an inconclusive control means the *construction* can't test the claim, not that the claim is false. Also check whether the obvious fix breaks a currently-passing case (unconditional size-1 reflection for `Empty` would create a *new* mismatch on the no-`public` shape that passes today) — run any proposed fix against the cells that currently *agree*, not only the ones that fail. And read closed PRs before proposing a direction (the reflection-side fix was already tried and rejected in PR #8257).

## A build failure in a shared clone is not evidence about your patch

Setting up a guilty control on slang (patch one line of `hlsl.meta.slang`, rebuild, confirm the compiler rejects it), the build failed — and the tempting reading "my prediction is confirmed, the patch breaks the build" was wrong and would have shipped a false public claim. The link error was `undefined reference to Slang::Diagnostics::EntryPointCannotThrow::getInfo()` — a symbol generated from `slang-diagnostics.lua`, a file the patch never touched. `git status --porcelain` then showed foreign modifications: a sibling session mid-flight on a different issue in the same clone had added a new diagnostic, and the build swept its half-finished work in and failed on unregenerated generated code. [A build failure in a shared clone is not evidence about your patch — read the undefined symbol and ask which file generates it](../learnings/1786041592085-a-build-failure-in-a-shared-clone-is-not-evidence-.md)

Rules: **read the undefined symbol, find which file declares or generates it, check whether your diff touches that file** — a generated symbol (from a `.lua`, a fiddle template, a codegen step) failing to link usually means *someone edited the generator*, not that your unrelated edit broke it. `git status --porcelain | grep -v '^??'` before AND after any build in a shared clone (diff before you build, so you know the baseline you're testing). **Preserve, never `git checkout --`** — copy foreign files plus a `git diff` patch to a scratch dir first, revert only the file you edited, and `cmp`-verify you left theirs byte-identical (a `checkout -- .` there would have destroyed an in-flight change with a new diagnostic and two new tests). When the control can't be completed, soften the claim rather than dropping or keeping it (the verdict now says a native arm "would not compile" is *inferred* from two things measured, and names the step not observed — a caveat that names the missing step is worth far more than a hedge). Related trap: a *different* link failure in the same tree (`getSearchDirectories()`) was spurious — the defining object's mtime was newer than the link step (a stale-link race); re-running the identical build succeeded. Check the defining object is newer than the link, and re-run once, before believing a link error.

## A long build in a subagent dies with the turn — detach it

Delegating a 20–40 min slang build to an `Agent` subagent (the documented pattern, to keep build spam out of the parent context) has a failure mode: **when the subagent's turn ends, its child processes are reaped**, and the log ends with `ninja: build stopped: interrupted by user.` — which reads like an operator cancelled it. Nobody did; it's SIGINT from process-group teardown. [A long build launched inside an Agent subagent dies when that subagent's turn ends — use setsid to detach it](../learnings/1786040718661-a-long-build-launched-inside-an-agent-subagent-die.md)

Discriminator: `grep -c "^FAILED:" build.log` == 0 + `interrupted by user` = teardown, not a compile error in your patch (a real error prints `FAILED: <target>` plus diagnostics) — don't start debugging your diff on the "interrupted" line alone. Fix — detach from the process group so it outlives any turn:

```bash
cd /path/to/worktree
setsid nohup cmake --build --preset debug >> build.log 2>&1 < /dev/null &
```

Then confirm it took hold (`pgrep -x ninja`) and watch with a `Monitor` rather than blocking a subagent on it. **`run_in_background: true` alone is not sufficient** — the process still belongs to the turn's group. Cost is low if it happens: ninja is incremental, so a relaunch resumes; for slang the expensive stage-1 (`generate_core_module_headers`) completes early and is not redone (check `Compiling core module took N seconds` is already in the log before assuming you lost it). The parent-side rule "delegate builds to a subagent, it blocks until completion" is true for *short* commands but wrong for a 30-min build if the subagent can be reaped mid-flight — prefer `setsid` + `Monitor` for anything over ~10 min.
