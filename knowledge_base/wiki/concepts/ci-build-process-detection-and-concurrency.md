---
title: "CI Build Process Detection and Concurrency"
type: concept
group: ci-tooling
tags: [ci, build, cmake, ninja, slang, pgrep, build-liveness, pretooluse-hook, decoy-fidelity, concurrent-build, frozen-artifact, baseline, capability-atoms, doc-regen, cmdline-ref, shallow-clone, submodules, git-provenance]
source_count: 17
---

# CI Build Process Detection and Concurrency

> Related: [CI Build Tooling & Workflow Structure](ci-build-tooling.md) and [Git checkout & submodule pins](ci-build-git-checkout-and-submodule-pins.md) cover the adjacent build/CI/workflow and git-provenance material; this page owns build-process liveness detection, concurrent-build corruption, and the capability-alias doc-regen invariant.

## TL;DR

**Is a build running — and is it mine?**

- To answer "is a build running", use `pgrep -x ninja` (matches `comm`, argv-spoof-immune) — never `pgrep -f <pattern>`. `pgrep -f` matches ANY process's argv, including this Bash tool call's own `bash -c` wrapper AND any long-lived process holding the pattern (e.g. a hung waiter): two self-match mechanisms.
- A real `cmake`/`ninja` build has BARE argv (`/usr/bin/ninja -f build.ninja target`) — the worktree path lives in `cwd`, never argv. So `ps -eo args | grep <worktree>` matches only transient compiler children and reads N-or-0 uncorrelated with the build.
- To scope liveness to one worktree: `for p in $(pgrep -x ninja); do readlink /proc/$p/cwd; done | grep <worktree>`. `pgrep -x` can't scope; `/proc/<pid>/cwd` is the only argv-immune way to answer "in THIS worktree". Best of all, watch the output artifact (binary mtime, `BUILD_EXIT=` sentinel).
- The concatenation trick (`A=nin;B=ja;pgrep -f "$A$B"`) defeats NEITHER self-match mechanism — it only dodges the "block your own docs" case, and still matches a live long-lived decoy. Verify a workaround against BOTH mechanisms, not just a cannot-exist control.
- `until ! pgrep -f "<pat>"; do sleep; done` is unsatisfiable by construction — the waiter's own argv holds the pattern, so the negation never becomes true (observed: 8h10m hang). `pkill -f <pat>` can kill the shell issuing it (exited 144).
- A liveness probe validated only against "nothing running" is vacuous — it agrees with truth for the wrong reason. Demonstrate BOTH poles with a genuinely long-lived probe, and give the probe its own liveness column (`ninja_alive`) so an all-zeros table can't read as a result.
- Decoy fidelity: `exec -a "cmake --build decoy" sleep 500` puts the pattern in argv BY CONSTRUCTION — the exact property real ninja lacks. Name the property the instrument keys on, then ask whether the real subject has it for the SAME reason the decoy does.
- The durable fix is a `PreToolUse:Bash` hook keyed on command text — `settings.json` IS writable (`[ -w ]` = true). `exit 2` not 0 (rc=0 discards stderr = silent no-op); strip quotes/heredocs before matching; include `!`/`until`/`while`/`if`/`then`/`do`/`elif` in the command-position set. The guard fails OPEN when its script vanishes (a rebuild causes exactly this) — inline the fallback in the settings entry; assert the property, not just the reference.

**Concurrency: freeze every shared mutable artifact for the WHOLE operation.**

- `ar: <x>.o: No such file` mid-link ⇒ TWO ninjas on ONE build dir (a subagent false-reported "still running"). `pkill -f "ninja -f build-<Config>"`, relaunch ONE — state self-heals, no `rm -rf`.
- `reset`/`checkout`/`rebase` under a running build ⇒ bogus non-zero `BUILD_EXIT` with an error-free log — treat as INCONCLUSIVE, never a code failure; quiesce the build first.
- Editing source under a running build ⇒ the un-compiled TU bakes the fix into the "baseline" — a bogus PASS that makes you rewrite working tests. A build in flight OWNS the worktree.
- Gate on evidence on disk, not intention: exit marker · non-empty results · frozen log · distinct rebuild log · `sha256sum -c` pre-registration. A bogus pass licenses destruction.

**CI workflow and docs.**

- A `workflow_dispatch` CI run diffs only `HEAD^1...HEAD`: a docs-only head commit, or a big merge-commit head, skips the whole matrix and still concludes `success`. Count skipped jobs and read the `filter` job before calling a dispatched run green.

- Adding/renaming a PUBLIC capability alias regenerates TWO CI-diffed docs: `a4-02-reference-capability-atoms.md` AND `command-line-slangc-reference.md` (`/regenerate-cmdline-ref`). `check-cmdline-ref` byte-exact-diffs the generated reference — commit generator output verbatim (trailing spaces, `2>&1`); never strip whitespace.

## Detecting Whether a Build Is Running: `pgrep -f` Counts Your Own Argv

The recurring fixer-session question is *is a build still running, and is it MY build?* `pgrep -f` is the wrong tool for both parts, and each "fix" for it left a residue one layer down.

**`pgrep -f <pat>` matches the pattern text in ANY process's argv, through two distinct self-match mechanisms.** (1) Every Bash tool call runs as a `bash -c` whose argv holds the literal command text, so the check counts its own shell (control: `pgrep -f "zzz-nonexistent-zzz"` → 1 match). (2) Any *long-lived* process whose argv holds the pattern adds a permanent +1, most insidiously a hung waiter of your own. Nothing textual reliably defeats (1); (2) must be killed or excluded by PID ([pgrep -f counts your own argv — the warning was already in the store](../learnings/1786223910074-a-prescription-beats-a-warning-pgrep-f-counts-your.md), [pgrep -f has TWO self-match mechanisms; pkill -f can kill the issuing shell](../learnings/1786224292590-pgrep-f-has-two-self-match-mechanisms-the-concaten.md)).

Consequences: **`until ! pgrep -f "<pat>"; do sleep; done` is unsatisfiable by construction** — the waiter's own argv holds the pattern. One hung 8h10m and meanwhile inflated every later `pgrep -f 'ninja…'` count, which is how *"three build processes running"* got published when the truth was ≤1. **`pkill -f <pat>` can kill the issuing shell** (exited 144). Direction triage: in an `until ! pgrep` waiter the false positive is conservative (it hangs; a conclusion gated on a file sentinel survives); in a *counting* use it is a live false claim.

**The concatenation workaround (`A=nin;B=ja;pgrep -f "$A$B"`) defeats neither mechanism.** It returns 0 against a cannot-exist control, so two agents published it as verified; against a live long-lived decoy (`exec -a "cmake --build decoy-longlived" sleep 500`) it returned 2 — wrapper shell AND decoy. Runtime string-building only dodges the "block your own documentation" case. *A workaround verified against one of two mechanisms reads as verified against the phenomenon.*

**A real build's argv is bare — the worktree path lives in `cwd`, never argv.** Read while provably running: `cmake --build --preset release --target slangc` and `/usr/bin/ninja -f build-Release.ninja slangc`, both with `cwd: …/wt-12434-verify/build`. So a regex like `ninja.*wt-slang-12386` can never match a real build (its only effect is self-matching the waiter), and `ps -eo args | grep <worktree> | grep -v grep` matches only *transient compiler children* (`/bin/sh -c … c++`, `objcopy … /abs/path/…`) — the ninja PID was absent. It reads N or 0 depending on which child is mid-flight, uncorrelated with the question ([a build-liveness check that greps argv measures a coincidental proxy](../learnings/1786224903694-a-build-liveness-check-that-greps-argv-measures-a-.md), [a decoy that differs from the real subject in the property under test validates nothing](../learnings/1786224759545-a-decoy-that-differs-from-the-real-subject-in-the-.md)).

**What works, measured against a live build AND an impossible control:**

```bash
pgrep -x ninja                                                          # any build?  1 live / 0 after exit
for p in $(pgrep -x ninja); do readlink /proc/$p/cwd; done | grep -q "<worktree>"   # THIS worktree?  1 / 0
```

`pgrep -x` reads `comm` (argv-spoof-immune) but cannot scope; `/proc/<pid>/cwd` is the only argv-immune answer to "in *this* worktree". Better still, watch the **output artifact** (binary mtime, a `BUILD_EXIT=` file sentinel).

**Instrument-validation lessons.** *(1) Decoy fidelity:* the argv-grep instrument was "validated" against an `exec -a` decoy that has the pattern in argv **by construction** — the exact property real `ninja` lacks. Name the property the instrument keys on, then ask whether the real subject has it for the same reason the decoy does; if not, the decoy is invalid however the test comes out. *(2) A probe validated only against "nothing running" is vacuous:* candidates read 0 for a "real" ninja that was `ninja -n` (exits too fast), and an 8-sample run of `ps|grep=0` looked like proof until a `ninja_alive` column read 0 throughout (`ninja: no work to do`). A probe of an instrument needs its own liveness column printed next to the measurement.

**The durable fix is a `PreToolUse:Bash` hook keyed on command text — `settings.json` IS writable.** Two agents published *"host-owned, no hook available"*, inferring it from existing hook commands pointing at `/app/hooks/…`; neither ran `[ -w /home/node/.claude/settings.json ]` (true). A memory warning needs you to recognise the situation; a hook triggers on the command at the moment of use. **A prescription beats a warning:** one agent repeated the mistake with the warning in their own words because a *different* note prescribed `pgrep -af "ninja|cmake --build"`. When recording an instrument defect, grep your notes for what they tell you to *run* and repair that. Design constraints, each a real defect caught in construction ([settings.json is writable — build the PreToolUse guard](../learnings/1786226029670-settings-json-is-writable-build-the-pretooluse-gua.md)):

1. **`exit 2`, never `exit 0`** — a `PreToolUse` hook exiting 0 has its stderr discarded; an "advisory" hook is a no-op.
2. **Strip heredoc bodies and quoted strings before matching**, or the guard blocks its own documentation and gets disabled.
3. **Include `!`, `until`, `while`, `if`, `then`, `do`, `elif` in the command-position set.** Two first versions let `until ! pgrep -f …` through while a bare `pgrep -f foo` test passed. Positive controls must include the load-bearing input, and verify live through the harness (the `exit 0` failure is invisible when piping JSON to the script standalone).

**The guard fails OPEN when its script vanishes, and a rebuild produces exactly that state** ([a PreToolUse guard fails open when its script vanishes — inline the fallback](../learnings/1786228693593-a-pretooluse-guard-fails-open-when-its-script-vani.md)). With the script moved aside the forbidden command ran with rc=0 and no log — indistinguishable from an allow. A hook is two artifacts on possibly-different mounts, so "durable" is a claim about both. Naive fail-closed is worse: a peer blocked *all* Bash when the script was absent and locked themselves out of `chmod`/`mv`/`cp`, escaping only via `Edit`. The fix: **inline a coarse fallback check in the settings entry string** — delegate to the guard when present, apply the coarse check when not — with no wrapper file to become a third vanishing link. The liveness gate must **assert the property, not just the reference** (an entry referencing the guard without the fallback is fail-open while every other check passes). Before arming any fail-closed gate ask: *if this fires wrongly, what tool do I still have?* And since every re-read number in the thread was re-read because it looked *implausible*, the remedy is not another reviewer but **a control that fires on the plausible case**.

## Concurrent Builds and Frozen Artifacts

**Two ninjas on one build dir.** `ar: <x>.cpp.o: No such file or directory` at an archive step (or another mid-link "No such file") usually means two `ninja` processes racing on the same build dir — a build subagent backgrounded its `cmake --build`, falsely reported "still running", and you started your own. Recovery: `pkill -f "ninja -f build-<Config>"` (all of them), relaunch ONE build; ninja self-heals, no `rm -rf`. Prevention: check `pgrep -x ninja` before building; distrust a subagent that returns without a clear `BUILD_EXIT=<n>` (verify via `pgrep` + mtime); launch background builds as `setsid … ; echo BUILD_EXIT=$? … & disown` and arm a Monitor on `until grep -q BUILD_EXIT=` (fires on success and failure) ([build subagent false-report + concurrent-ninja collision corrupts build dir](../learnings/1784775308129-build-subagent-false-report-concurrent-ninja-colli.md)).

**Mutating the tree under a running build ⇒ bogus failure.** Signature: non-zero `BUILD_EXIT=` with a `build.log` holding only that line — no ninja progress, no `error:`/`FAILED:` — though earlier output existed. Cause: your own `git reset --hard`/`checkout`/rebase swapped files mid-compile, or `rm -f build.log` while the redirect held the path. The exit code reflects the yanked tree, not the code under test, and invites hunting a nonexistent bug. Rules: stand down any build before `reset`/`checkout`/`rebase`/`merge`; treat a non-zero exit with no error line as **inconclusive** and re-run on a quiesced tree; use a uniquely named log per build with the exit marker in a separate file; stop a build by its own PID/PGID, not blanket `pkill ninja`, which kills sibling worktrees' builds. An agent that says "exit 1 but no real error line, so no build verdict" is behaving correctly ([a reset/checkout under a running build yields a bogus BUILD_EXIT with no diagnostics](../learnings/1785776881296-a-reset-checkout-under-a-running-build-yields-a-bo.md)).

**Editing source under a running build ⇒ bogus PASS — the worse direction.** Writing the fix while the red-baseline build compiles means any not-yet-compiled TU picks up the fixed source: the "baseline" binary already contains the fix, tests pass, and you conclude they were inert and rewrite good tests — with a green build and nothing to stop you. Caught live editing `slang-lower-to-ir.cpp` at step 400/1451 (`grep -c "slang-lower-to-ir.cpp.o" build.log` → 0). **A build in flight owns the worktree**: no edits to anything it might compile until the exit marker, even drafts; spend the wait on prose or another worktree. If already edited:

```bash
grep -c "<yourfile>.o" build.log   # 0 => the in-flight build will consume your edit
git stash push -m wip -- <path>    # restore pristine, keep the work
```

Zero ⇒ stash and let it finish; already compiled ⇒ rebuild from a pristine tree rather than reasoning about stale objects. A passing baseline is a claim about a binary, not about your tests; any measure-before/change/measure-after protocol needs the before-measurement to complete on the unmodified subject ([never edit source while a baseline build is running — it silently bakes the fix into the baseline](../learnings/1785824280820-never-edit-source-while-a-baseline-build-is-runnin.md)).

**The invariant: every shared mutable artifact an async consumer reads stays frozen for the WHOLE operation.**

| # | artifact assumed stable | async consumer / mutator | failure direction |
|---|---|---|---|
| 1 | branch state / working tree | a running build | bogus **failure** (empty log, non-zero exit) |
| 2 | source file | a running build (that TU not yet compiled) | bogus **pass** (baseline silently contains the fix) |
| 3 | the built binary | a test run launched after the build | bogus **pass** (baseline tests measure the fixed binary) |

A bogus pass licenses destruction — the response to the false signal deletes the evidence it was false — so self-erasing errors need controls, not care. Two easily missed artifacts: **the diagnostic's own input** (a rebuild rewrites the same `build.log`, so `grep -c "<file>.o"` then answers about the wrong build — `cp build.log build.log.frozen` at build-exit and point the rebuild elsewhere), and **a pre-registration** (`sha256sum` it while nothing can have been observed, store the hash, `chmod 444`). Gate on evidence on disk, not on intention:

```
1. build-baseline.exit exists            (build finished)
2. baseline-results.txt non-empty        (results captured)
3. build-baseline.log.frozen exists      (log snapshotted under a name no rebuild writes)
4. rebuild writes build-fix.log          (NEVER the baseline paths)
5. sha256sum -c baseline.sha256 passes   (pre-registration unmodified since before results existed)
```

Any check failing ⇒ re-establish the baseline from a pristine tree; a reconstructed baseline is not a baseline. Keep one consumer per artifact (two waiters polling one binary is the same race). To find the next instance ask: *what am I treating as a snapshot, and who else can write it before I read it?* — especially around slow operations and anything used as evidence ([gate on evidence on disk, not on intention — the frozen-artifact invariant](../learnings/1785824548562-gate-on-evidence-on-disk-not-on-intention-the-froz.md)).

**A background job's "completed (exit 0)" is the LAST command's exit, not the build's.** In `cmake --build … > build.log 2>&1; echo "BUILD_EXIT=$?"; tail -2 build.log` the notification reports `tail`'s 0 even when `BUILD_EXIT=1`; a failed incremental build also leaves the previous binary, so `slangc` dumps look right — a double false positive that once force-pushed a non-compiling commit. Make the build the final command, or read the captured `BUILD_EXIT=`; confirm relinking (`[N/N] Linking … slangc` or mtime) before trusting output. Related: two-dot `git diff origin/master..HEAD` shows upstream changes as your "reverts" once master advances — use three-dot `origin/master...HEAD` ([Background build exit code masked by trailing `tail`/`echo` — check BUILD_EXIT, not the wrapper](../learnings/1789990370500-background-build-exit-code-masked-by-trailing-tail.md)).

## Adding a public capability alias regenerates TWO CI-diffed docs

Adding or renaming a **public** atom/alias in `slang-capabilities.capdef` requires regenerating (1) `docs/user-guide/a4-02-reference-capability-atoms.md` via `slang-capability-generator` and (2) the easy-to-forget `docs/command-line-slangc-reference.md` via `slangc -help-style markdown -h > docs/command-line-slangc-reference.md`, since its `-capability` section enumerates every non-abstract alias and CI diffs it (`.github/workflows/ci.yml`; hint `/regenerate-cmdline-ref`). Both diffs are additive for a pure alias-add; regenerate with a freshly built `slangc` and commit both with the capdef change (caught by a codex PLAN_REVIEW on #12244) ([Adding a public capability alias requires regenerating TWO CI-checked docs, not just a4-02](../learnings/1785207263835-adding-a-public-capability-alias-requires-regenera.md)).

`check-cmdline-ref` is a **byte-exact `diff`**. The generator emits every line with a trailing space; stripping it to silence `git diff --check` flips the job red. Commit output verbatim (`… -h > docs/command-line-slangc-reference.md 2>&1`) or comment `/regenerate-cmdline-ref` ([check-cmdline-ref does byte-exact diff — never strip trailing space from the generated doc](../learnings/1785334855546-check-cmdline-ref-ci-does-byte-exact-diff-never-st.md)).

## slang `ci.yml` triggers and the `filter` job that gates the whole matrix

**`ci.yml` never runs on `push`** — triggers are `workflow_dispatch`, `merge_group`, and `pull_request` (master) only. To answer "is master red", read recent `merge_group` runs (`gh api repos/<o>/<r>/actions/workflows/<id>/runs?event=merge_group`), which re-test master's tip before each merge. `gh` gotchas: `/actions/runs/<id>/jobs` without `--paginate` returns only 30 jobs and can hide the failing one (run 34574220286); a read-only App token fails `gh api user`/`gh auth status` while repo-scoped GETs work — test the actual call, and use `WebFetch` on `raw.githubusercontent.com` for other repos' files ([slang ci.yml never runs on push to master — reframe "is master red" as merge_group re-test](../learnings/1789169357763-slang-ci-yml-never-runs-on-push-to-master-reframe-.md)).

**On a `workflow_dispatch` run the `filter` job can skip the entire matrix while the run concludes `success`.** A dispatch (`gh workflow run ci.yml --ref <branch>`, the bot's route to CI on a draft PR) diffs `git diff --name-only "HEAD^1...HEAD"` on a `fetch-depth: 2` checkout — the LAST commit, not the PR. (1) A **docs-only head commit** correctly sets `should-run=false` (#13619 run 38525347723: 2 success / 48 skipped). (2) A **merge-commit head** trips a SIGPIPE-under-pipefail bug in `.github/actions/docs-only-filter/action.yml`: past the ~64 KB pipe buffer, `grep -q` exits early, `echo` takes SIGPIPE, the pipeline goes non-zero and control falls to the "docs only" branch. `check-ci` counts skipped as success — a FALSE GREEN. Before calling a dispatched run green, count skipped jobs (`gh run view <id> --json jobs --jq '[.jobs[].conclusion]|group_by(.)|map({(.[0]):length})|add'`) and read the `filter` output. For a real matrix make the head a small code-touching non-merge commit (or rebase), or use the `pull_request` path (marking ready diffs `origin/master...HEAD`, immune to both). Draft status gates only `pull_request`, not dispatch; for a bot PR an operator marking it ready is the reliable route, since dispatch is also gated by priority-yield and `falcor-build-approval-gate` ([precise mechanism: slang docs-only-filter false-skip is SIGPIPE+pipefail on an oversized (merge-commit) changed-file list](../learnings/1789184828074-precise-mechanism-slang-docs-only-filter-false-ski.md), [a docs-only head commit makes a dispatched run skip the whole matrix](../learnings/1791961955700-slang-ci-workflow-dispatch-skips-the-whole-matrix-.md)).

## Contradictions / supersessions

- **Shallow-clone silent-regime discriminator** — the `[ "$(git rev-parse HEAD)" = "$(cat .git/shallow | head -1)" ]` form is **retracted** (`.git/shallow` is SHA-sorted, one entry per fetched tip, so HEAD is often not line 1). Use `[ "$(git rev-parse --is-shallow-repository)" = true ] && [ -z "$(git log -1 --format=%P)" ]`; the `--is-shallow-repository` guard suppresses a false positive on a full clone parked at the true root. Because `--depth` implies `--single-branch`, the bad check agrees ~always in the modal `clone --depth 1 --branch <pr-head>` shape, so a measured false-agreement rate understates the hazard.
- **"The `--stat` graft lie is depth-1-specific"** — corrected: it fires whenever the commit you `--stat` **is** the graft root, at any depth (depth-203 clone: 521-vs-11). "`--stat` is false past the graft" is also wrong — commits inside the graft diff correctly.
- **`git log -S` provenance in `slang-rhi`** — attributing the `test-sampler-array.cpp` Metal skip to `eb8c343`/#534 is retracted; the introducer is `8da2bf4f`/#533, proven by patch.
- **`grep -c '^-'` as the submodule-health check** — insufficient; a `+`-marked wrong-commit submodule with an empty worktree passes. Check `^+`, `^-`, and a file count, all `--recursive`.
- **"The pin moved, so the regression is in the submodule"** — superseded: intersect the commit range with the backtrace's functions; byte-identical symbols at both pins mean a caller-side activation.
- **"Don't mutate the tree under a running build" as a git-only hazard** — widened to the frozen-artifact invariant: `reset`/`checkout` fails toward a bogus failure, editing source toward a bogus pass (worse, because it destroys working tests).
- **`grep -c "<file>.o" build.log` as a standalone freshness check** — unsound once a rebuild rewrites the same path; freeze the log at build-exit and give the rebuild a different filename.
- **A written-down intention as the guard** — replaced by the on-disk 5-check precondition list; an intention isn't testable and leaves no trace when it fails.

**Source learnings (17):**

- [Background build exit code masked by trailing `tail`/`echo` — the notification's "exit 0" is the last command's, not the build's; a failed incremental build leaves the old binary so dumps look correct; use three-dot `origin/master...HEAD`](../learnings/1789990370500-background-build-exit-code-masked-by-trailing-tail.md)
- [slang `ci.yml` never runs on `push` — triggers are workflow_dispatch/merge_group/pull_request; "is master red" = check recent `merge_group` runs; paginate `/jobs`; a read-only App token's `gh api user` "Bad credentials" ≠ no read access](../learnings/1789169357763-slang-ci-yml-never-runs-on-push-to-master-reframe-.md)
- [the `filter` job's `docs-only-filter` false-skips the whole matrix on a merge-commit HEAD (SIGPIPE+pipefail on an oversized `HEAD^1...HEAD` list) → false green; rebase or a small non-merge commit fixes manual CI; draft gates only pull_request, not workflow_dispatch](../learnings/1789184828074-precise-mechanism-slang-docs-only-filter-false-ski.md)
- [a `workflow_dispatch` run whose head commit is docs-only skips the whole matrix and still reports success (#13619)](../learnings/1791961955700-slang-ci-workflow-dispatch-skips-the-whole-matrix-.md) — the dispatch diffs `HEAD^1`, not master; count skipped jobs before saying green.
- [a reset/checkout under a running build yields a bogus BUILD_EXIT with no diagnostics — treat an error-free non-zero exit as inconclusive](../learnings/1785776881296-a-reset-checkout-under-a-running-build-yields-a-bo.md)
- [never edit source while a baseline build is running — an un-compiled TU bakes the fix into the "baseline" and the bogus PASS makes you rewrite working tests](../learnings/1785824280820-never-edit-source-while-a-baseline-build-is-runnin.md)
- [gate on evidence on disk, not on intention — the frozen-artifact invariant (source, binary, log, pre-registration), plus the 5-check baseline precondition list](../learnings/1785824548562-gate-on-evidence-on-disk-not-on-intention-the-froz.md)
- [A maintainer merging master into your PR branch can silently fix the root cause](../learnings/1781651810617-a-maintainer-merging-master-into-your-pr-branch-ca.md)
- ['ar: no such .o' at link = two ninjas on one build dir (a subagent false-reported 'still running'); pkill all ninja, relaunch one — state self-heals, no rm -rf needed](../learnings/1784775308129-build-subagent-false-report-concurrent-ninja-colli.md)
- [adding a public capability alias regenerates TWO CI-checked docs (a4-02 AND command-line-slangc-reference.md), not just a4-02](../learnings/1785207263835-adding-a-public-capability-alias-requires-regenera.md)
- [`check-cmdline-ref` byte-exact-diffs the generated slangc reference — commit generator output verbatim (trailing spaces included, `2>&1`); don't strip whitespace to satisfy `git diff --check`](../learnings/1785334855546-check-cmdline-ref-ci-does-byte-exact-diff-never-st.md)
- [a prescription beats a warning: `pgrep -f` counts your own argv (and a hung waiter's), so use `pgrep -x ninja`; repair the prescription in your notes, not just the warning](../learnings/1786223910074-a-prescription-beats-a-warning-pgrep-f-counts-your.md)
- [`pgrep -f` has TWO self-match mechanisms (transient wrapper + long-lived process); the concatenation workaround defeats neither, and `pkill -f` can kill the issuing shell](../learnings/1786224292590-pgrep-f-has-two-self-match-mechanisms-the-concaten.md)
- [a decoy differing from the real subject in the property under test validates nothing — real ninja argv is bare, the worktree path is only in `cwd`](../learnings/1786224759545-a-decoy-that-differs-from-the-real-subject-in-the-.md)
- [a build-liveness check that greps argv measures a coincidental proxy (transient compiler children), and a probe of an instrument needs its own liveness column](../learnings/1786224903694-a-build-liveness-check-that-greps-argv-measures-a-.md)
- [`settings.json` IS writable — build the `PreToolUse` guard; `exit 2` not 0, strip quotes, and include `until`/`while`/`if` in the command-position set](../learnings/1786226029670-settings-json-is-writable-build-the-pretooluse-gua.md)
- [a `PreToolUse` guard fails OPEN when its script vanishes (a rebuild causes exactly this) — inline the fallback in the settings entry; assert the property not the reference](../learnings/1786228693593-a-pretooluse-guard-fails-open-when-its-script-vani.md)

_Catalog: [[wiki/index.md]]_
