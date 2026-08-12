---
title: "CI Build Tooling & Workflow Structure (part 3)"
type: concept
group: ci-tooling
tags: [ci, build, wasm, falcor, workflows, test-silencing, perf, cmake, slang, capability-atoms, doc-regen, cmdline-ref, shallow-clone, submodules, git-provenance]
source_count: 7
---

# CI Build Tooling & Workflow Structure (part 3)

> **This page is part 3 of 3** of the CI Build Tooling & Workflow Structure synthesis (split 2026-08-11 to stay under the 40 KB read cap). Siblings: [part 1](ci-build-tooling.md), [part 2](ci-build-tooling-2.md). The TL;DR below is shared across all parts.

## TL;DR


## Concurrent-Ninja Build-Dir Corruption From a False-Reporting Build Subagent (2026-07-23 fold)

An `ar: <x>.cpp.o: No such file or directory` at a static-lib archive step (or other mid-link "No such file") usually means TWO `ninja` processes are running on the SAME build dir — a build subagent backgrounded its `cmake --build` and falsely reported "build still running," so you started your own, and the two ninjas race on the same `.o`/`.a`. Recovery: `pkill -f "ninja -f build-<Config>"` (kill ALL), then relaunch a SINGLE build — ninja self-heals the incremental state, no `rm -rf` needed. Prevention: `pgrep -af ninja` before starting your own build; don't trust a subagent that returns without a clear `BUILD_EXIT=<n>` line (verify via `pgrep`+mtime); launch background builds with `setsid ... ; echo BUILD_EXIT=$? ... & disown` and arm a Monitor on `until grep -q BUILD_EXIT=` (fires on both success and failure) ([build subagent false-report + concurrent-ninja collision corrupts build dir](../learnings/1784775308129-build-subagent-false-report-concurrent-ninja-colli.md)).

**The same family, one step earlier: mutating the tree under a running build produces a bogus `BUILD_EXIT` with no diagnostics.** (This is one instance of a broader invariant — *every shared mutable artifact the async consumer reads must stay frozen for the whole operation* — and the git-operation case is only its loudest direction; see the frozen-artifact section below for the silent one.) Signature — a background build reports non-zero `BUILD_EXIT=` and `build.log` contains **only that single line**: zero ninja progress, no `error:`, no `FAILED:`, even though earlier in the same run the log had normal output (`[41/1284]`). Cause is your own concurrent git operation: a `git reset --hard` / `git checkout` / rebase swaps files under the compiler mid-build, and `rm -f build.log` while the build's redirect still holds the path leaves a truncated or replaced file. Two writers race, the failure signature is lost, and the exit code reflects the yanked tree — **not** the code under test. That `BUILD_EXIT=1` looks exactly like a real compile failure, and the honest-but-empty log invites hunting a nonexistent bug in your patch, or "fixing" working code. Application: stop or stand down any running build subagent **before** any `reset --hard` / `checkout` / `rebase` / `merge`; treat a non-zero exit whose log has **no** `error:`/`FAILED:` line as *inconclusive*, never as a code failure, and re-run on a quiesced tree; write to a uniquely-named log per build (`build-$(date +%s).log`) and keep the exit marker in a **separate** file so nothing can truncate away the diagnostic; and when standing a build agent down, match the specific PID/PGID it launched rather than a blanket `pkill ninja`/`pkill cmake`, which kills sibling worktrees' builds in a shared container. Reporting corollary: an agent that says "I observed exit 1 but never saw a real error line, so I'm not claiming a build result" is behaving correctly — don't pressure a verdict out of a truncated log ([a reset/checkout under a running build yields a bogus BUILD_EXIT with no diagnostics](../learnings/1785776881296-a-reset-checkout-under-a-running-build-yields-a-bo.md)).

### The mirror image: editing source under a running build bakes the fix into the "baseline" — a bogus PASS (2026-08-04 fold)

The `reset`/`checkout`-under-a-build case above fails toward a bogus **failure**, which at least stops you. The same root cause has a mirror that fails toward a bogus **pass**, and that direction is worse. You commit tests-before-fix, kick off a build to prove the **red baseline**, and — to save wall-clock — start writing the implementation while it compiles. Ninja compiles translation units in dependency order over 10–25 minutes, so **if your edited file has not been compiled yet, the build picks up the fixed source**: a "baseline" binary that already contains the fix. The tests pass, you conclude they were inert or vacuous, and the entire red-baseline exercise is destroyed — silently, with a green build and no error anywhere. Caught live editing `source/slang/slang-lower-to-ir.cpp` at build step 400/1451: `grep -c "slang-lower-to-ir.cpp.o" build.log` returned **0**, i.e. the file had not compiled yet and the in-flight build would have consumed the fix.

It is insidious because both obvious symptoms point away from the cause — tests passing at "baseline" makes you blame the tests and start rewriting good ones, and everything being green means nothing prompts you to suspect the binary. Rules: **a build in flight owns the worktree** — no edits to any file it might compile until the exit marker appears, including "just drafting" something you intend to stash; spend the wait on **prose** (the plan, the PR body, the baseline expectations) or work in a *different* worktree; and if you have already edited, check whether your file compiled yet before deciding what to do.

```bash
grep -c "<yourfile>.o" build.log   # 0 => the in-flight build will consume your edit
git stash push -m wip -- <path>    # restore pristine, keep the work
```

Zero ⇒ stash and let the build finish clean; already compiled ⇒ the baseline is compromised, **rebuild from a pristine tree** rather than reasoning about which object files are stale. And **verify what the baseline binary actually contains** before trusting a surprising result: a baseline that passes is a claim about a binary, not about your tests. Generalized: any "measure before / change / measure after" protocol requires the before-measurement to complete on the **unmodified** subject — builds make this easy to violate because they are slow and the edit feels harmless, but for a compiler the file *is* the input to the process ([never edit source while a baseline build is running — it silently bakes the fix into the baseline](../learnings/1785824280820-never-edit-source-while-a-baseline-build-is-runnin.md)).

**The invariant behind both cases: every shared mutable artifact the async consumer reads must stay frozen for the WHOLE operation, not just at kickoff.** Three errors in one session were one mistake — holding a fixed picture of an artifact while something else was concurrently free to change it:

| # | artifact assumed stable | async consumer / mutator | failure direction |
|---|---|---|---|
| 1 | branch state / working tree | a running build | bogus **failure** (empty log, non-zero exit) |
| 2 | source file | a running build (that TU not yet compiled) | bogus **pass** (baseline silently contains the fix) |
| 3 | the built binary | a test run launched after the build | bogus **pass** (baseline tests measure the fixed binary) |

Direction matters because **a bogus pass licenses destruction**: you conclude your test was inert and start rewriting tests that were working, and the green build gives you nothing to stop you — the response to the false signal deletes the evidence that it was false. Self-erasing errors deserve controls, not care. Two artifacts are easy to miss beyond source and binary. **The diagnostic's own input:** `grep -c "<file>.o" build.log` is only meaningful if that log can't be rewritten, but a rebuild writes the *same* `build.log` path, so after a rebuild the check silently answers about the wrong build — **freeze the log** (`cp build.log build.log.frozen`) as the first action at build-exit and make the rebuild write a *different* path. **A pre-registration:** writing expected results before running is only meaningful if the file cannot be edited afterward; left writable it degrades into a post-hoc rationalization with an early timestamp — `sha256sum` it *while you can still prove nothing was observed* (no results file, build unfinished), store the hash, and `chmod 444` so a later edit must be deliberate.

**Gate on evidence on disk, not on intention.** An intention isn't testable by anything, degrades under time pressure, and leaves no trace when it fails — so convert the rule into a checkable precondition:

```
1. build-baseline.exit exists            (build finished)
2. baseline-results.txt non-empty        (results captured)
3. build-baseline.log.frozen exists      (log snapshotted under a name no rebuild writes)
4. rebuild writes build-fix.log          (NEVER the baseline paths)
5. sha256sum -c baseline.sha256 passes   (pre-registration unmodified since before results existed)
```

Any check failing ⇒ the baseline is untrustworthy; re-establish from a pristine tree rather than reasoning about which parts are stale. **Durability is load-bearing, not tidiness** — if the rebuild destroys the only record of the baseline you end up *reconstructing* the baseline claim, which is precisely the claim the exercise exists to establish independently, and a reconstructed baseline is not a baseline. Also **one consumer per artifact**: two waiters polling the same binary is the same race in miniature, so stop the redundant one. To spot the next instance, ask of every step: *what am I treating as a snapshot, and who else can write it before I read it?* — candidates cluster around slow operations (builds, test runs, packaging, in-flight `git`) and around anything used as **evidence**: logs, result files, pre-registrations, hashes ([gate on evidence on disk, not on intention — the frozen-artifact invariant](../learnings/1785824548562-gate-on-evidence-on-disk-not-on-intention-the-froz.md)).


## Adding a public capability alias regenerates TWO CI-diffed docs (2026-07-27 fold)

When you add or rename a **public** capability atom/alias in `slang-capabilities.capdef`, TWO tracked, CI-diffed docs must be regenerated or the build goes red: (1) `docs/user-guide/a4-02-reference-capability-atoms.md` via `slang-capability-generator` (the one CLAUDE.md documents), and (2) the easy-to-forget `docs/command-line-slangc-reference.md` via `slangc -help-style markdown -h > docs/command-line-slangc-reference.md` — CI diffs it at `.github/workflows/ci.yml` (~line 555) and fails on any difference (hint: `/regenerate-cmdline-ref`), because that file enumerates every non-abstract capability alias in its `-capability` section. Both diffs are additive-only for a pure alias-add; regenerate with a freshly-built local `slangc` and commit both alongside the capdef change. Discovered on #12244 (added `texture_shadow`+`texture_shadowbias`) — a codex PLAN_REVIEW caught that the a4-02 regen alone would ship a PR that goes red in the cmdline-ref check [Adding a public capability alias requires regenerating TWO CI-checked docs, not just a4-02](../learnings/1785207263835-adding-a-public-capability-alias-requires-regenera.md).

Related to the doc-regeneration lesson above, the `check-cmdline-ref` CI job enforces `docs/command-line-slangc-reference.md` with a **byte-exact `diff`** of `slangc -help-style markdown -h`. The generator emits every line with a **trailing space**; hand-stripping that whitespace (e.g. to silence a `git diff --check` warning) makes the committed doc no longer match generator output and flips the job red. Commit generator output verbatim (`... -h > docs/command-line-slangc-reference.md 2>&1`, note the `2>&1`); the trailing-whitespace warning on this generated file is expected and is NOT what CI checks — or comment `/regenerate-cmdline-ref` to auto-fix ([check-cmdline-ref does byte-exact diff — never strip trailing space from the generated doc](../learnings/1785334855546-check-cmdline-ref-ci-does-byte-exact-diff-never-st.md)).


## Contradictions / supersessions

- **Shallow-clone silent-regime discriminator** — the `[ "$(git rev-parse HEAD)" = "$(cat .git/shallow | head -1)" ]` form is **retracted** for a false negative (`.git/shallow` is SHA-sorted with one entry per fetched tip, so HEAD is often not line 1). Use `[ "$(git rev-parse --is-shallow-repository)" = true ] && [ -z "$(git log -1 --format=%P)" ]`; the `--is-shallow-repository` guard is required to suppress a false positive on a full clone parked at the true root commit. Because `--depth` implies `--single-branch`, the bad check agrees ~always in the modal `clone --depth 1 --branch <pr-head>` shape — so a measured "false-agreement rate" *understates* the hazard.
- **"The `--stat` graft lie is depth-1-specific"** — corrected in place: mode 2 fires whenever the commit you `--stat` **is** the graft root, at any depth (measured on a depth-203 clone whose HEAD diffed correctly while the graft still inflated 521-vs-11). The opposite phrasing, "`--stat` is false past the graft," is also wrong — commits inside the graft diff correctly.
- **`git log -S` provenance in `slang-rhi`** — a stored attribution of the `test-sampler-array.cpp` Metal skip to `eb8c343`/#534 is retracted; the real introducer is `8da2bf4f`/#533, proven by patch. The impeachment also forced re-derivation of an older `git log -S`-based claim in that repo (which survived, but by a different method).
- **`grep -c '^-'` as the submodule-health check** — insufficient; a `+`-marked wrong-commit submodule with an empty worktree passes it. Check `^+`, `^-`, and a file count, all `--recursive`.
- **"The pin moved, so the regression is in the submodule"** — superseded: intersect the commit range with the backtrace's specific functions; byte-identical symbols at both pins mean a caller-side activation.
- **"Don't mutate the tree under a running build" as a git-only hazard** — widened in place: the rule is *every shared mutable artifact the async consumer reads stays frozen for the whole operation*. `git reset`/`checkout` fails toward a bogus **failure**; **editing source** under the same build fails toward a bogus **pass** (the un-compiled TU picks up the fix), and the pass direction is worse because the response to it — "my tests must be inert" — destroys working tests.
- **`grep -c "<file>.o" build.log` as a standalone freshness check** — unsound once a rebuild runs, because the rebuild writes the *same* path and the check then answers about the wrong build. Freeze the log at build-exit (`build-baseline.log.frozen`) and point the rebuild at a different filename.
- **A written-down intention ("I won't touch source during the build") as the guard** — replaced by the on-disk precondition list (exit marker · non-empty results · frozen log · distinct rebuild log · `sha256sum -c` on the pre-registration). An intention isn't testable and leaves no trace when it fails.

**Source learnings (7):**

- [a reset/checkout under a running build yields a bogus BUILD_EXIT with no diagnostics — treat an error-free non-zero exit as inconclusive](../learnings/1785776881296-a-reset-checkout-under-a-running-build-yields-a-bo.md)
- [never edit source while a baseline build is running — an un-compiled TU bakes the fix into the "baseline" and the bogus PASS makes you rewrite working tests](../learnings/1785824280820-never-edit-source-while-a-baseline-build-is-runnin.md)
- [gate on evidence on disk, not on intention — the frozen-artifact invariant (source, binary, log, pre-registration), plus the 5-check baseline precondition list](../learnings/1785824548562-gate-on-evidence-on-disk-not-on-intention-the-froz.md)
- [A maintainer merging master into your PR branch can silently fix the root cause](../learnings/1781651810617-a-maintainer-merging-master-into-your-pr-branch-ca.md)
- ['ar: no such .o' at link = two ninjas on one build dir (a subagent false-reported 'still running'); pkill all ninja, relaunch one — state self-heals, no rm -rf needed](../learnings/1784775308129-build-subagent-false-report-concurrent-ninja-colli.md)
- [adding a public capability alias regenerates TWO CI-checked docs (a4-02 AND command-line-slangc-reference.md), not just a4-02](../learnings/1785207263835-adding-a-public-capability-alias-requires-regenera.md)
- [`check-cmdline-ref` byte-exact-diffs the generated slangc reference — commit generator output verbatim (trailing spaces included, `2>&1`); don't strip whitespace to satisfy `git diff --check`](../learnings/1785334855546-check-cmdline-ref-ci-does-byte-exact-diff-never-st.md)
