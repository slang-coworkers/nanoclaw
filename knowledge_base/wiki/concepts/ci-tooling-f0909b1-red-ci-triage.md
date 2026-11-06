---
title: Classifying red Slang CI — infra/flake vs. real regression
type: concept
group: ci-tooling
tags: [slang-ci, test-falcor, flake, infra, rerun, ci-triage, gpu-jobs, regression]
source_count: 22
---

# Classifying red Slang CI — infra/flake vs. real regression

## TL;DR

- **Read the fresh failing-job log before touching code.** Most single-job reds on `shader-slang/slang` are infra/flake, not your diff — but the log line is what tells the two apart, and the cause varies run-to-run.
- **`test-falcor / Test (Falcor)` is an external-CI bridge**, not a test runner. It fails on infra (`run-external-ci: trigger failed: HTTP Error 403: Forbidden`, or an expired Slang artifact) far more often than on a real regression. A bail in ~15s with no shader diagnostics ⇒ infra, your compiler change is cleared.
- **`test-falcor` is not required and is not in `check-ci`'s `needs`, and on `merge_group` it always skips** (its approval-gate grand-parent is skipped there), so the merge queue never runs the Falcor bridge test. Read required contexts from `branches/master`, not the 403ing `/protection` endpoint.
- Falcor has **≥2 distinct infra modes** (403 auth wall, expired artifact). Don't propagate "artifact-TTL is THE Falcor cause" — re-read the log each time. A `--failed` or `--job test-falcor` rerun does NOT regenerate an expired artifact (fails in ~19s, no GitLab pipeline starts); rerunning the producing `…-gpu-falcor / build` job or a full `gh run rerun <id>` does, and a rerun that reaches the bridge submits a new Falcor pipeline. A 403 wall is not rerun-fixable — stop after ~2 attempts.
- When the Falcor log says only "external CI failed" (the internal GitLab pipeline is unreadable from the container), triage with a **public-Falcor differential compile** (baseline vs PR `slangc`, diff the diagnostics). A clean diff only *supports* infra, because the internal Falcor can differ.
- GPU jobs (`test-windows-*-gpu-vk / test-slang`) flake/timeout: a step stuck `in_progress` at completion with an empty `--log-failed` is a timeout/cancellation, not an assertion failure. React to the current head only (a new push auto-cancels prior runs).
- **Uniform** failure across *every* `test-slang` job (all OSes/arches, incl. CPU) ⇒ a deterministic `.slang` failure. Separate three causes: the PR's own new test, a PR-introduced regression of a pre-existing test, or inherited master-side breakage.
- Known flaky/benign reds: `##[error]slang-test left generated or modified files` (leftover `moduleG####.slang`) when `100% of tests passed`; and `build-windows-debug-cl-aarch64`'s `verify-documented-compiler-version.sh` **exit 4** — a `set -e`/`pipefail` command-substitution trip in that best-effort script (fix: `|| true`), NOT a `docs/building.md` allowlist gap.
- **An ERR trap does not see everything:** without `set -E` it misses failures inside functions, and `trap '…; exit 0' ERR` turns the step green, hiding a broken check the way `|| true` does; prefer `exit "$status"` plus `continue-on-error`, and raise the trade-off with the maintainer.
- A **manual `ci.yml` dispatch on a DRAFT PR** makes `test-falcor` fail fast (~15s, `failed_steps: []`) because the draft-gated *build* jobs that produce its artifact are skipped — not a code failure; it clears on `gh pr ready`, not on a rerun.
- **`gh run rerun` has hard age limits**: >30 days = "created over a month ago"; ~>1 week = "cannot be retried". Classification is moot for stale PRs — recover with a fresh `gh workflow run ci.yml --ref <branch>` dispatch (same SHA, no push) or a push (usually a master merge). On a non-draft PR use the push: a bot dispatch yields, and its red `check-ci` blocks merge. A bot run that *fails* at exactly 30 days is a different event: an expired `falcor-ci` approval, not code.
- `gh run view --log-failed --job <id>` is the reliable log fetch; the `/actions/jobs/<id>/logs` REST endpoint often returns empty and needs `gh api --allow-escape-sequences` to print ANSI-laden logs. `check-ci` failing is just the aggregate — find the real failing job.

## The overriding rule: read the fresh log, classify, then act

**Fetch the failing-job log for the current head and read it before concluding anything or touching
code.** Check-run titles/summaries are often `null`, and `gh api .../actions/jobs/<id>/logs` often
returns empty or is refused (gh won't print a body with ANSI escapes without
`gh api --allow-escape-sequences`). The reliable path is
`gh run view <run-id> -R shader-slang/slang --log-failed --job <job-id>`, grepping for
`% of tests passed`, `FAILED test:` and `##[error]`
([leftover-file flake — fetch log fast](../learnings/1788402606374-slang-ci-red-slang-test-left-generated-or-modified.md),
[GPU-job classification](../learnings/1788268233722-slang-ci-gpu-jobs-test-falcor-win-gpu-vk-test-slan.md)).
`check-ci` is only the aggregate; drill to the real job, and react to the **current head only** — a
new push auto-cancels the prior run, so old-head `cancelled` jobs are not failures.

## test-falcor: an external-CI bridge, not a test runner

`test-falcor / Test (Falcor)` does not run Slang's `tests/` suite — Falcor consumes Slang as a
*library* to compile its own shaders, dispatched to NVIDIA's external CI via
`/opt/slang-ci/run-external-ci`. A `tests/**`-only (or most front-end/test-only) change cannot make
Falcor fail. The dominant failure is an **auth 403 at trigger time**, ~15s in, before any shader
compiles:

```
run-external-ci: external CI did not pass (status='failed')
run-external-ci: trigger failed: HTTP Error 403: Forbidden
```

This is infra, full stop ([external-bridge 403, non-required](../learnings/1788206678107-test-falcor-ci-failures-are-usually-external-bridg.md)).
It is common on **bot-authored** PRs, whose identity lacks permission to trigger the external CI;
the signature is *one* red `test-falcor` while every `test-slang` job (all OS × DX/VK/CUDA, RHI,
benchmark, MaterialX) is green ([bot-PR 403 wall](../learnings/1788229271673-test-falcor-ci-failure-on-a-bot-pr-is-usually-a-40.md)).

**A 403 wall is not rerun-fixable.** `gh run rerun --failed` re-hits the same 403 and wastes
external-CI capacity. Rerun **once**; if the identical message recurs (check the `-2-` attempt
counter in the request ID) it is persistent infra — stop, and escalate to the CI team since it likely
hits every PR ([don't rerun past 2×](../learnings/1788220633639-test-falcor-ci-failure-with-external-ci-trigger-40.md)).
Verify required contexts with
`gh api repos/shader-slang/slang/branches/master --jq '.protection.required_status_checks.contexts'`
(`/branches/master/protection` returns 403 for the app token): they are `check-formatting`,
`check-ci` and `SlangPy Tests`. `test-falcor` is neither required nor in `check-ci`'s `needs`, so a
persistent Falcor red does not block merge. Don't reproduce/fix code or post a bot comment for it
([non-required, classify as infra](../learnings/1788206678107-test-falcor-ci-failures-are-usually-external-bridg.md),
[test-falcor is not in check-ci's needs](../learnings/1791509362714-slang-sanitizer-job-s-pr-related-label-is-file-att.md)).

**On `merge_group` runs `test-falcor` always skips, although the Falcor-only build runs.**
`falcor-build-approval-gate` is skipped on merge_group (#12770);
`build-windows-release-cl-x86_64-gpu-falcor` still runs because its `if` uses `always()`, but
`test-falcor` uses the default status check, so the skipped grand-parent skips it. In the 15 latest
successful merge_group runs (2026-10-08) `test-falcor` skipped 15/15 while the build ran in 14 — the
merge queue never runs the bridge test and that build is wasted. #12770's rationale ("check-ci
includes test-falcor") is stale: #13183 and #12844 merged with their final-head gate still
`waiting`. `gh api repos/<r>/actions/runs/<id>/pending_deployments` shows which environment a stuck
run waits on ([on merge_group test-falcor always skips](../learnings/1791462328513-slang-ci-yml-on-merge-group-test-falcor-always-ski.md)).

**Falcor has multiple infra modes — don't fixate on one cause.** The bridge also fails when the
prebuilt **Slang artifact is expired/unavailable**: `run-external-ci: Slang artifact '…-falcor' … is
unavailable (expired, still building, or the token cannot see it); not triggering Falcor`. The
*tests* artifact (~122MB) can expire sooner than the sibling *build* artifact: on a run older than
~a day, `gh run rerun --job <test-falcor job>` fails in ~19s at `Run external CI` with this message
and no GitLab pipeline starts. Before spending a rerun, check
`gh api repos/shader-slang/slang/actions/runs/<run>/artifacts?name=slang-tests-windows-x86_64-cl-release-falcor`
(`total_count` 0 = gone). A `--failed` or test-job rerun does NOT help; rerunning the producing
`build-windows-release-cl-x86_64-gpu-falcor / build` job re-uploads the artifact and cascades into
`test-falcor`, and a **full** `gh run rerun <id>` regenerates artifacts too. A rerun that reaches the
bridge submits a NEW Falcor pipeline (#13886 passed on a rerun), so "a rerun cannot change an
external pipeline's outcome" is false. Some old runs refuse job reruns outright (HTTP 403 "Jobs in
this workflow run cannot be re-run")
([test-falcor --job rerun fails in 19s once the slang-tests-* artifact is gone](../learnings/1793081639779-test-falcor-job-rerun-fails-in-19s-once-the-run-s-.md)).
The cause has flip-flopped (403 → artifact-TTL → 403 → artifact-expiry), so no single cause is a
fleet fact. Shortcut: **if Falcor bails in seconds with no shader diagnostics, it's infra and your
change is cleared**; treat it as a regression only if the log shows Falcor compiled shaders and hit
a compile/validation error ([multiple infra modes, re-read the log](../learnings/1788545708307-test-falcor-ci-failures-have-multiple-infra-modes-.md)).

**When the log says only "external CI failed", do a public-Falcor differential compile.** The
internal GitLab pipeline (gitlab-master.nvidia.com) gives no diagnostics in the GitHub log, and its
API returns 502 from coworker containers. Shallow-clone public NVIDIAGameWorks/Falcor; compile every
`Source/**/*.slang` with both baseline and PR `slangc` (`-I Source/Falcor -I Source
-I Source/RenderPasses -I Source/Falcor/Shaders -target spirv -no-codegen`) under `xargs -P 32`,
with a per-file wrapper ending `exit 0` so xargs doesn't abort on a 255; diff the sorted
`error[`/`warning[` lines per file (~2 min on 64 cores; #13880: 441 files, zero diffs). The internal
Falcor can differ, so a clean diff only *supports* infra. Also check whether `test-falcor` failed on
other PRs that day, then `gh run rerun <id> --failed`
([public-Falcor differential compile](../learnings/1792769226659-slang-ci-test-falcor-failures-can-t-be-read-from-t.md)).
Nobody watches that rerun for you — on #13880 attempt 2 failed with no second webhook (see
[rerun decision rules](ci-flake-rerun-decision-rules.md)).

**Draft-PR artifacts are not Falcor reds.** On a **draft** PR a manual `workflow_dispatch` yields a
cosmetic **priority-yield** (`filter=success, wait-for-human-priority=failure, check-ci=failure`,
all builds skipped); once ready-for-review, real `pull_request` CI runs and its failures count
(modulo infra jobs) ([draft priority-yield vs real CI](../learnings/1788220633639-test-falcor-ci-failure-with-external-ci-trigger-40.md)).
Separately, `/slang-fix-issue` Step 7's `gh workflow run ci.yml --ref fix/issue-N` after opening a
**draft** runs `test-falcor` while the **draft-gated build jobs** producing its artifact
(`slang-tests-windows-x86_64-cl-release-falcor`) are skipped, so Falcor bails in ~15s with the
artifact-unavailable message. Tell: a failed check-run with `failed_steps: []`. `gh run rerun
--failed` will NOT clear it; it self-resolves on `gh pr ready`. Don't rerun or touch code; report
it as a draft-artifact sequencing red, and consider skipping the manual dispatch on drafts entirely
([draft ci.yml dispatch → spurious test-falcor missing-artifact red](../learnings/1789147576274-manually-dispatching-ci-yml-on-a-draft-slang-pr-pr.md)).

## GPU-job flake/timeout and the leftover-file check

`test-windows-*-gpu-vk / test-slang` and other GPU jobs flake or time out. Tell a timeout from a
real failure with
`gh api repos/shader-slang/slang/actions/jobs/<jobid> --jq '.steps[] | "\(.name)\t\(.status)\t\(.conclusion)"'`:
a "Test Slang" step stuck `in_progress` at job completion with a long (~35 min) gap and an **empty**
`--log-failed` is a timeout/cancellation. Rerun a flake (`gh run rerun <run-id> --failed`, ≤3×);
reproduce/fix only when a real job (build, or CPU `static-unit-test`) fails with an assertion. In
slang#12853 all builds + CPU static-unit-tests passed (580/580), only the two GPU jobs flaked, and
the maintainer merged anyway ([GPU flake/timeout classification](../learnings/1788268233722-slang-ci-gpu-jobs-test-falcor-win-gpu-vk-test-slan.md)).

A specific benign red is the **post-test worktree-cleanliness check**: one `test-*/test-slang`
config exits 1 on `##[error]slang-test left generated or modified files in the worktree` plus an
untracked `?? moduleG6360.slang` (a generated module name from a separate-compilation test that
intermittently fails to clean up), while its summary reads `100% of tests passed (N/N)` and sibling
configs are green. Rerun ≤3×; confirm unrelated with `git show --name-only HEAD`; don't "fix" it in
an unrelated PR ([leftover-file flake](../learnings/1788402606374-slang-ci-red-slang-test-left-generated-or-modified.md)).

## verify-documented-compiler-version.sh exit 4 and ERR traps

**Original read (superseded): runner-image rollout.** A `windows-11-vs2026-arm64` image (Image
Release 20260823.138.1, MSVC toolset 14.51.36231 / VS18.0) failed
`extras/verify-documented-compiler-version.sh` with exit 4, and it was read as that MSVC version
missing from `docs/building.md`'s allowlist. The tell offered for a **rollout-in-progress** rather
than a regression still holds as a pattern: the identical job passed on an earlier run that landed
on the old image, so it is fleet-side variance, not safely requeueable (a rerun may bounce
identically); log it `action:"left"` and watch for it spreading across windows-aarch64 jobs — >1 PR
graduates it to a systemic advice item like the falcor 403
([vs2026-arm64 image not in allowlist](../learnings/1788242807926-slang-ci-windows-11-vs2026-arm64-runner-image-not-.md)).

**Correction — exit 4 is a shell bug, not a docs-allowlist failure.** Reading the script and
reproducing GPU-free (#13041/#13042) shows it has **no exit-non-zero path of its own**: every branch
ends `exit 0`, and a version mismatch only emits `::warning::`. So exit 4 must be `set -euo pipefail`
aborting: `COMPILER_VERSION=$("$COMPILER_PATH" 2>&1 | grep … | head -1)` invokes `cl.exe` with no
sources, which prints its banner but **exits 4**; under `pipefail` that is the pipeline status and
the plain `VAR=$(…)` under `set -e` kills the script *before* its empty-version guard. `14.51` is
`VCToolsVersion`; the script compares only the banner's *compiler* major (`19`), which the docs
already match, so a docs edit would not touch the crash. The fix is `|| true` on the best-effort
substitutions (not `|| VAR=""`, since `cl.exe` prints a parseable banner while exiting non-zero).
General rules: (1) under `set -euo pipefail`, a `VAR=$(cmd | …)` whose `cmd` can fail aborts before
its own empty-value guard, which is dead code until `|| true` is appended — and a never-fail script
that exits non-zero is the tell of a command-substitution trip. (2) Reviewing such a fix, enumerate
**every** structurally-identical `VAR=$(pipeline)` at the same errexit scope and confirm symmetric
application (three unguarded `DOC_LINE=$(grep … | head -1)` siblings would abort on a routine docs
reword) — but `errexit` is **off inside `$(...)` subshells** unless `shopt -s inherit_errexit`, so
greps nested in another `$(...)` ending in `echo` are already safe and flagging them is a false
positive
([exit-4 is a set-e/pipefail trip, not a docs allowlist](../learnings/1789252710427-verify-documented-compiler-version-sh-exit-4-on-wi.md),
[same, reproduced + fixed in #13042](../learnings/1789254176751-slang-ci-verify-documented-compiler-version-sh-exi.md),
[reviewing `|| true` CI-tolerance shell PRs](../learnings/1789255179378-reviewing-true-ci-tolerance-shell-prs-check-every-.md)).

Follow-up #13352 adds `trap '…; exit 0' ERR` to the same script; its review mapped an ERR trap's
reach (bash 5.2). Without `set -E` the trap fires only for **top-level** failures: a `set -e` abort
inside a function (`f(){ false; }; f`) exits silently rc=1. Errexit is cleared inside `$(...)`, so a
failure there reaches the trap only if it fails the assignment; `A=($(exit 4))` propagates status 4
like scalar `A=$(exit 4)`. `set -u` errors bypass ERR but print to stderr, so a truly silent exit
rules them out. A multi-line `$BASH_COMMAND` splits the `::warning::` annotation (only line one
survives). The review lens is the `exit 0`: it turns the step GREEN, like `|| true`, and maintainer
jvepsalainen-nv ranked that below `continue-on-error` because a broken check should stay visible
without gating (see the advisory-script section of [CI Build Tooling](../concepts/ci-build-tooling.md)).
Raise the trade-off rather than treat it as settled; `exit "$status"` plus `continue-on-error`
keeps both the diagnostic and the red step
([Bash ERR trap as a CI diagnostic: reach limits and the exit-0 vs visible-failure trade-off](../learnings/1790798241576-bash-err-trap-as-a-ci-diagnostic-reach-limits-and-.md)).

## gh run rerun has hard age limits

`gh run rerun <id>` (and `-j <jobId>`) is rejected by age regardless of classification: >30 days →
"created over a month ago"; roughly >~1 week (even ~6-7 days) → "This workflow run cannot be
retried" (tied to shorter log/artifact retention); "This workflow is already running" when a newer
run in the concurrency group is active. Per-job reruns fail the same way. **Upshot:** for a PR whose
last run is more than a few days old, verify the rejection with one rerun call, log it
`left`/non-actionable, and don't burn tokens on log diving; recovery needs a fresh run (a push, an
admin `/ci`, or a new dispatch on the same head)
([rerun hard age limits](../learnings/1788199935009-gh-run-rerun-has-hard-age-limits-old-ci-failures-o.md)).
The 30-day refusal bites slow PRs because `falcor-build-approval-gate` waits up to 720h for manual
approval: when it times out and fires `ci_failed`, the run is already too old to rerun. Two moves
give a fresh run. (1) `gh workflow run ci.yml -R shader-slang/slang --ref <branch>` — no commit, so
the reviewer's target SHA is unchanged (on a bot draft that run yields again; on a non-draft PR the
yielded dispatch's red `check-ci` blocks merge, so push instead — see
[draft-PR CI](ci-b-draft-pr-ci-and-conditional-claims.md)). (2) Push, which on a long-idle branch
usually means merging master since it is also BEHIND: first check `git diff <merge-base>
origin/master -- <your files>`, rebuild, re-run affected suites, and confirm `build/` still exists
(reaped on slang#12443, needing `cmake --preset default`). Attribution trap: `check-ci`'s `needs`
excludes `falcor-build-approval-gate`, so when both are red compare `completed_at` before saying
"check-ci rolled up X"
([dispatch a fresh workflow_dispatch instead of rerunning a month-old run](../learnings/1792219533913-gh-run-rerun-fails-on-runs-older-than-one-month-di.md),
[runs older than 30 days cannot be rerun; push to get fresh CI](../learnings/1792224538847-github-actions-runs-older-than-30-days-cannot-be-r.md)).
Distinct event: a bot run that *fails* after exactly 30 days is GitHub auto-failing an ungranted
`falcor-ci` deployment approval (`falcor-build-approval-gate`, 0 steps, every job skipped). No code
ran; on a draft a fresh run only yields and queues another approval, so the matrix runs when the PR
is marked ready (see [rerun decision rules](ci-flake-rerun-decision-rules.md);
[expired falcor-ci approval at 30 days](../learnings/1792173072753-bot-ci-run-failure-after-exactly-30-days-expired-f.md)).

## Uniform test failures: new-test vs. regression vs. inherited master breakage

When *every* `test-slang` job fails uniformly (all platforms, debug+release, incl. CPU), it is a
**deterministic `.slang` failure**, not flake or infra. Separate three causes without assuming:

1. **The PR's own new test** — read `gh run view --job <id> --log-failed | grep "FAILED test:"`; if
   the new test passes and something else fails, the new test is fine.
2. **A PR-introduced regression** of a pre-existing, unrelated test.
3. **Inherited master breakage** — PR CI merges into current master, so a red master (e.g. a
   just-landed semantic-merge conflict) reddens every rebasing PR.

Decisive checks (#12892): grep the PR's CI log for the suspect master change's fingerprint (zero hits
⇒ the CI base predates it); confirm the failing test passed on master's own CI for that commit (then
it's a PR regression, the test file being unchanged); reproduce on the exact PR head
(`git fetch origin pull/<n>/head`, `git worktree add <wt> FETCH_HEAD`; `cmake --preset default` may
need `git submodule update --init --recursive` first). The bug there was a parser change feeding a
pre-`CheckTerm`'d base into `parseGenericApp` for the whole `Generic` branch, mis-pinning overloads
for free-function generic calls; the fix reused `checkedBase` only for member-access exprs.
`tests/bugs/overload-ambiguous-2.slang` (#4476) is a sensitive canary for overload-resolution /
generic-app parser changes ([uniform-failure triage](../learnings/1788474162476-triaging-uniform-ci-test-failures-new-test-vs-pr-r.md)).

## Reviewing a "descope the failing test case" CI fix

When a PR's own new test fails and the fix descopes the failing case instead of fixing compiler
code: (1) **confirm the affected code path is byte-identical** from the diff's *context* lines —
unchanged `operator-`/`neg()` context means descoping `-` masks no PR regression, only narrows a new
test away from a pre-existing bug. (2) An **arch-specific wrong *primal*** (not just tangent) in a
CPU/interpreter autodiff test (aarch64 `0 0` vs x86_64 `-9 -6`) is latent nondeterminism/UB, not FP
rounding — say "wrong primal, not just derivative". (3) Validate **without a PR rebuild** by running
the master-supported parts of the patched test and using the CI `actual:` FileCheck line for
unchanged cases. (4) Descope is non-masking **only if a tracking issue is filed** and linked from the
test + PR. (5) State the residual: FileCheck aborts at the first failed line, so later CHECKs never
ran on the failing arch — the pass there is predicted until a CI re-run
([reviewing a descope CI fix](../learnings/1788286964829-reviewing-a-descope-the-failing-test-case-ci-fix-b.md)).

**Source learnings (22):**
- [Bash ERR trap as a CI diagnostic: reach limits and the exit-0 vs visible-failure trade-off](../learnings/1790798241576-bash-err-trap-as-a-ci-diagnostic-reach-limits-and-.md) — no `set -E` = top-level only; `exit 0` ≈ `|| true`, below `continue-on-error`
- [gh run rerun has hard age limits — old CI failures on stale PRs cannot be rerun](../learnings/1788199935009-gh-run-rerun-has-hard-age-limits-old-ci-failures-o.md) — >30d / >~1wk / "already running"; classification moot for stale PRs
- [test-falcor CI failures are usually external-bridge infra (403), not your code — and it's non-required](../learnings/1788206678107-test-falcor-ci-failures-are-usually-external-bridg.md) — Falcor consumes Slang as a library; trigger 403 = infra
- [test-falcor CI failure with 'external CI trigger 403 Forbidden' is infra — don't rerun past 2×](../learnings/1788220633639-test-falcor-ci-failure-with-external-ci-trigger-40.md) — persistent 403; escalate; draft priority-yield is distinct
- [test-falcor CI failure on a bot PR is usually a 403 external-CI-trigger wall, not your code](../learnings/1788229271673-test-falcor-ci-failure-on-a-bot-pr-is-usually-a-40.md) — bot identity lacks trigger permission; read the log first
- [Slang CI: windows-11-vs2026-arm64 runner image not yet in docs/building.md compiler-version allowlist](../learnings/1788242807926-slang-ci-windows-11-vs2026-arm64-runner-image-not-.md) — image-variance read of exit 4; superseded by the set -e diagnosis
- [Slang CI: GPU jobs (test-falcor, win-gpu-vk test-slang) flake/timeout; classify before reacting](../learnings/1788268233722-slang-ci-gpu-jobs-test-falcor-win-gpu-vk-test-slan.md) — step in_progress + empty --log-failed = timeout; current head only
- [Reviewing a "descope the failing test case" CI fix: byte-identical check + arch-wrong-primal signal](../learnings/1788286964829-reviewing-a-descope-the-failing-test-case-ci-fix-b.md) — context-line identity, wrong-primal severity, tracking issue
- [Slang CI red "slang-test left generated or modified files" is a flaky leftover-file check](../learnings/1788402606374-slang-ci-red-slang-test-left-generated-or-modified.md) — 100% pass but untracked moduleG####.slang; rerun ≤3×
- [Triaging uniform CI test failures: new-test vs PR-regression vs inherited master breakage](../learnings/1788474162476-triaging-uniform-ci-test-failures-new-test-vs-pr-r.md) — uniform red = deterministic; three causes; overload-ambiguous-2 canary
- [test-falcor CI failures have multiple infra modes — re-read the fresh log each time](../learnings/1788545708307-test-falcor-ci-failures-have-multiple-infra-modes-.md) — expired artifact vs 403; no shader diag = infra
- [Manually dispatching ci.yml on a DRAFT slang PR yields a spurious test-falcor missing-artifact red](../learnings/1789147576274-manually-dispatching-ci-yml-on-a-draft-slang-pr-pr.md) — draft-gated builds skipped; failed_steps:[]; clears on gh pr ready
- [Slang ci.yml: on merge_group test-falcor always skips even though the Falcor-only build runs](../learnings/1791462328513-slang-ci-yml-on-merge-group-test-falcor-always-ski.md) — skipped gate skips test-falcor 15/15; #12770's rationale stale
- [Slang sanitizer job's "PR-related" label is file-attribution, not causation](../learnings/1791509362714-slang-sanitizer-job-s-pr-related-label-is-file-att.md) — also notes `test-falcor` is not in `check-ci`'s `needs`
- [verify-documented-compiler-version.sh exit-4 on windows-aarch64 is a set-e/pipefail trip, NOT a stale docs allowlist](../learnings/1789252710427-verify-documented-compiler-version-sh-exit-4-on-wi.md) — cl.exe exits 4 with no sources; fix with || true
- [Slang CI verify-documented-compiler-version.sh exit 4 is a set -e/pipefail shell bug (reproduced, fixed #13042)](../learnings/1789254176751-slang-ci-verify-documented-compiler-version-sh-exi.md) — all branches exit 0; non-zero = substitution trip
- [Reviewing `|| true` CI-tolerance shell PRs: check every same-scope VAR=$(pipeline); errexit is OFF in command-substitution subshells](../learnings/1789255179378-reviewing-true-ci-tolerance-shell-prs-check-every-.md) — enumerate identical substitutions; $(...) safe sans inherit_errexit
- [Bot CI run 'failure' after exactly 30 days = expired falcor-ci environment approval, not code](../learnings/1792173072753-bot-ci-run-failure-after-exactly-30-days-expired-f.md) — distinct from the 30-day rerun refusal; no code ran
- [gh run rerun fails on runs older than one month — dispatch a fresh workflow_dispatch instead](../learnings/1792219533913-gh-run-rerun-fails-on-runs-older-than-one-month-di.md) — 720h gate timeout past rerun window; `--ref` dispatch keeps the SHA
- [GitHub Actions runs older than 30 days cannot be rerun — push to get fresh CI](../learnings/1792224538847-github-actions-runs-older-than-30-days-cannot-be-r.md) — merge master, check its diff to your files, rebuild; reaped `build/`
- [test-falcor --job rerun fails in 19s once the run's slang-tests-* artifact is gone](../learnings/1793081639779-test-falcor-job-rerun-fails-in-19s-once-the-run-s-.md) — check artifact total_count; rerun the falcor build job to re-upload
- [Slang CI: test-falcor failures can't be read from the container, so do a public-Falcor differential compile to triage](../learnings/1792769226659-slang-ci-test-falcor-failures-can-t-be-read-from-t.md) — baseline vs PR `slangc` over public Falcor; clean diff only supports infra
