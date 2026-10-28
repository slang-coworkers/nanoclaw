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
- **`test-falcor / Test (Falcor)` is an external-CI bridge**, not a test runner. It fails on infra (`run-external-ci: trigger failed: HTTP Error 403: Forbidden`, or an expired Slang artifact) far more often than on a real regression. A bail in ~15s with no shader diagnostics ⇒ infra, your compiler change is cleared. It is typically **non-required**.
- **`test-falcor` is not required and is not in `check-ci`'s `needs`, and on `merge_group` it always skips** (its approval-gate grand-parent is skipped there), so the merge queue never runs the Falcor bridge test. Read required contexts from `branches/master`, not the 403ing `/protection` endpoint.
- Falcor has **≥2 distinct infra modes** (403 auth wall, expired artifact). Don't propagate "artifact-TTL is THE Falcor cause" — re-read the log each time. A `--failed` or `--job test-falcor` rerun does NOT regenerate an expired artifact (it fails in ~19s, no GitLab pipeline starts); rerunning the producing `…-gpu-falcor / build` job or a full `gh run rerun <id>` does, and a rerun that reaches the bridge submits a new Falcor pipeline. A 403 wall is not rerun-fixable — stop after ~2 attempts.
- When the Falcor log says only "external CI failed" (the internal GitLab pipeline is unreadable from the container), triage with a **public-Falcor differential compile** (baseline vs PR `slangc`, diff the diagnostics). A clean diff only *supports* infra, because the internal Falcor can differ.
- GPU jobs (`test-windows-*-gpu-vk / test-slang`) flake/timeout: a step stuck `in_progress` at completion with an empty `--log-failed` is a timeout/cancellation, not an assertion failure. React to the current head only (a new push auto-cancels prior runs).
- **Uniform** failure across *every* `test-slang` job (all OSes/arches, incl. CPU) ⇒ a deterministic `.slang` failure. Separate three causes: the PR's own new test, a PR-introduced regression of a pre-existing test, or inherited master-side breakage.
- Known flaky/benign reds: `##[error]slang-test left generated or modified files` (leftover `moduleG####.slang` from a module test) when `100% of tests passed`; and the `build-windows-debug-cl-aarch64` job's `verify-documented-compiler-version.sh` **exit 4** — a `set -e`/`pipefail` command-substitution trip in that best-effort script (fix: `|| true`), NOT a `docs/building.md` allowlist gap.
- **An ERR trap does not see everything:** without `set -E` it misses failures inside functions, and `trap '…; exit 0' ERR` turns the step green, which hides a broken check the way `|| true` does; prefer `exit "$status"` plus `continue-on-error`, and raise the trade-off with the maintainer.
- A **manual `ci.yml` dispatch on a DRAFT PR** makes `test-falcor` fail fast (~15s, `failed_steps: []`) because the draft-gated *build* jobs that produce its artifact are skipped — it is not a code failure and clears on `gh pr ready`, not on a rerun.
- **`gh run rerun` has hard age limits**: >30 days = "created over a month ago"; ~>1 week = "cannot be retried". Classification is moot for stale PRs — recover with a fresh `gh workflow run ci.yml --ref <branch>` dispatch (same SHA, no push) or a push (usually a master merge). On a non-draft PR use the push: a bot dispatch yields, and its red `check-ci` blocks merge. A bot run that *fails* at exactly 30 days is a different event: an expired `falcor-ci` approval, not code.
- `gh run view --log-failed --job <id>` is the reliable log fetch; the `/actions/jobs/<id>/logs` REST endpoint often returns empty, and needs `gh api --allow-escape-sequences` to print ANSI-laden logs. `check-ci` failing is just the aggregate — find the real failing job.

## The overriding rule: read the fresh log, classify, then act

The single discipline that unifies every atom here: **fetch the actual failing-job log for the
current head and read it before concluding anything or touching code.** The check-run
output title/summary are frequently `null`, and `gh api .../actions/jobs/<id>/logs` frequently
returns empty or is refused (gh will not print a body containing ANSI escapes unless given
`gh api --allow-escape-sequences repos/<o>/<r>/actions/jobs/<id>/logs`) — so the reliable path is
`gh run view <run-id> -R shader-slang/slang --log-failed --job <job-id>` and grep for
`% of tests passed`, `FAILED test:`, and `##[error]`
([leftover-file flake — fetch log fast](../learnings/1788402606374-slang-ci-red-slang-test-left-generated-or-modified.md),
[GPU-job classification](../learnings/1788268233722-slang-ci-gpu-jobs-test-falcor-win-gpu-vk-test-slan.md)).
`check-ci` is only the aggregate; drill to which real job failed, and react to the **current
head only** — a pushed new head auto-cancels the prior run, so old-head jobs showing `cancelled`
are not real failures ([current head only](../learnings/1788268233722-slang-ci-gpu-jobs-test-falcor-win-gpu-vk-test-slan.md)).

## test-falcor: an external-CI bridge, not a test runner

`test-falcor / Test (Falcor)` does not run Slang's `tests/` suite — Falcor consumes Slang as a
*library* to compile its own shaders, dispatched to NVIDIA's external CI via
`/opt/slang-ci/run-external-ci`. A change under `tests/**` (or most front-end/test-only changes)
cannot make Falcor fail. The dominant failure is an **auth/permissions 403 at trigger time**,
in ~15s, before any shader compiles:

```
run-external-ci: external CI did not pass (status='failed')
run-external-ci: trigger failed: HTTP Error 403: Forbidden
```

This is infra, full stop ([external-bridge 403, non-required](../learnings/1788206678107-test-falcor-ci-failures-are-usually-external-bridg.md)).
On **bot-authored** PRs the 403 is common because the bot identity lacks permission to trigger
the external Falcor CI; the signature is *one* red `test-falcor` while every `test-slang` job
(Windows/Linux/macOS × DX/VK/CUDA, RHI, benchmark, MaterialX) passes green
([bot-PR 403 wall](../learnings/1788229271673-test-falcor-ci-failure-on-a-bot-pr-is-usually-a-40.md)).

**A 403 wall is not rerun-fixable.** `gh run rerun --failed` re-invokes the same trigger and
re-hits the same 403, wasting external-CI capacity. Rerun **once**; if it 403s again with the
identical message (check the `-2-` attempt counter in the request ID), it's *persistent* infra —
STOP, don't burn a 3rd rerun. Escalate to the CI team, since it's likely systemic (affects every
PR running test-falcor); if test-falcor is required it shows `mergeStateStatus=BLOCKED`
([don't rerun past 2×](../learnings/1788220633639-test-falcor-ci-failure-with-external-ci-trigger-40.md)).
Verify required-status membership with
`gh api repos/shader-slang/slang/branches/master --jq '.protection.required_status_checks.contexts'`
(the `/branches/master/protection` endpoint returns 403 for the app token); the required contexts
are `check-formatting`, `check-ci` and `SlangPy Tests`. `test-falcor` is neither a required context
nor in `check-ci`'s `needs`, so a persistent Falcor red does not block merge. Don't reproduce/fix code
and don't post a GitHub bot comment for it (noise on a human-shepherded PR)
([non-required, classify as infra](../learnings/1788206678107-test-falcor-ci-failures-are-usually-external-bridg.md),
[test-falcor is not in check-ci's needs](../learnings/1791509362714-slang-sanitizer-job-s-pr-related-label-is-file-att.md)).

**On `merge_group` runs `test-falcor` always skips, although the Falcor-only build runs.**
`falcor-build-approval-gate` is skipped on merge_group (#12770).
`build-windows-release-cl-x86_64-gpu-falcor` still runs because its `if` uses `always()`, but
`test-falcor` uses the default status check, so the skipped grand-parent skips it as well. Across the
15 latest successful merge_group runs (2026-10-08), `test-falcor` was skipped in all 15, while the
build and `test-falcor-perf` ran in 14 (the 15th was docs-only). So the merge queue never runs the
Falcor bridge test and the build there is wasted. #12770's justification ("check-ci includes
test-falcor") is stale: PRs #13183 and #12844 merged while their final-head gate was still
`waiting`. To see which environment a stuck run is waiting on, use
`gh api repos/<r>/actions/runs/<id>/pending_deployments`
([on merge_group test-falcor always skips](../learnings/1791462328513-slang-ci-yml-on-merge-group-test-falcor-always-ski.md)).

**Falcor has multiple infra modes — don't fixate on one cause.** Beyond the 403 wall, the bridge
also fails when the prebuilt **Slang artifact is expired/unavailable**:
`run-external-ci: Slang artifact '…-falcor' … is unavailable (expired, still building, or the
token cannot see it); not triggering Falcor`. The *tests* artifact (~122MB) can expire on a
shorter retention than the sibling *build* artifact on the same run: on a run older than ~a day,
`gh run rerun --job <test-falcor job>` fails in ~19s at `Run external CI` with exactly this
message, no GitLab pipeline starts, and so the red says nothing about Falcor. Before spending a
rerun, check `gh api repos/shader-slang/slang/actions/runs/<run>/artifacts?name=slang-tests-windows-x86_64-cl-release-falcor`
(`total_count` 0 = gone; only the `slang-build-*` artifacts remain). A `--failed` or test-job
rerun does NOT help (the artifact stays expired). Rerunning the producing
`build-windows-release-cl-x86_64-gpu-falcor / build` job re-uploads the artifact and cascades into
`test-falcor`; a **full** `gh run rerun <id>` also regenerates artifacts fresh. A rerun that does
reach the bridge submits a NEW Falcor pipeline (#13886 job 120443897612 passed on a rerun), so "a
rerun cannot change an external pipeline's outcome" is false. Some old runs refuse job reruns
outright (HTTP 403 "Jobs in this workflow run cannot be re-run")
([test-falcor --job rerun fails in 19s once the slang-tests-* artifact is gone](../learnings/1793081639779-test-falcor-job-rerun-fails-in-19s-once-the-run-s-.md)).
The Falcor cause has flip-flopped (403 → artifact-TTL → 403 → artifact-expiry) enough that no
single cause is a fleet fact; each occurrence is evidence for that run only. Classification
shortcut: **if Falcor bails in seconds with no shader diagnostics in the log, it's infra and your
compiler change is cleared**; only treat it as a real regression if the log shows Falcor actually
compiled shaders and hit a compile/validation error
([multiple infra modes, re-read the log](../learnings/1788545708307-test-falcor-ci-failures-have-multiple-infra-modes-.md)).

**When the log says only "external CI failed", do a public-Falcor differential compile.** The job
delegates to an internal GitLab pipeline (`run-external-ci`, gitlab-master.nvidia.com); the GitHub
log gives no shader diagnostics, and the GitLab API returns 502 from coworker containers. To decide
whether a frontend PR breaks Falcor: shallow-clone the public NVIDIAGameWorks/Falcor; compile every
`Source/**/*.slang` with both the baseline and the PR `slangc` (`-I Source/Falcor -I Source
-I Source/RenderPasses -I Source/Falcor/Shaders -target spirv -no-codegen`) under `xargs -P 32`,
with a per-file wrapper that ends `exit 0` so xargs does not abort on a compile that fails with 255;
then diff the sorted `error[`/`warning[` lines per file. It takes about 2 minutes on 64 cores. On
#13880, 441 files gave zero differences (252 compile cleanly). The internal Falcor can differ from
the public one, so a clean diff only *supports* treating the red as infra. Also check whether
`test-falcor` failed on other PRs the same day, then rerun with `gh run rerun <id> --failed`
([public-Falcor differential compile](../learnings/1792769226659-slang-ci-test-falcor-failures-can-t-be-read-from-t.md)).
That rerun is not watched for you: on #13880 attempt 2 failed while another frontend PR (#13889)
passed its attempt 2 in the same window, and no second webhook arrived (see
[rerun decision rules](ci-flake-rerun-decision-rules.md)).

Also distinct from a real Falcor red: on a **draft** PR a manual `workflow_dispatch` run yields
a cosmetic **priority-yield** (`filter=success, wait-for-human-priority=failure,
check-ci=failure`, all builds skipped). Once flipped to ready-for-review, real `pull_request` CI
runs and its failures are meaningful (modulo infra jobs)
([draft priority-yield vs real CI](../learnings/1788220633639-test-falcor-ci-failure-with-external-ci-trigger-40.md)).

A second draft-dispatch artifact hits Falcor specifically: `/slang-fix-issue` Step 7 tells you to
`gh workflow run ci.yml --ref fix/issue-N` after opening a **draft** PR, but that manual dispatch
runs the downstream `test-falcor / Test (Falcor)` job while the **draft-gated build jobs** that
produce the artifact it consumes (`slang-tests-windows-x86_64-cl-release-falcor`) are skipped — so
Falcor bails in ~15s with `run-external-ci: Slang artifact '…-falcor' … is unavailable (expired,
still building, or the token cannot see it); not triggering Falcor`. The tell of this false
positive is a failed check-run with `failed_steps: []` (no test-step assertion). It is NOT a code
failure and `gh run rerun --failed` will NOT clear it — the artifact stays absent until `gh pr
ready` runs the real build jobs, so it self-resolves on ready. Don't rerun or touch code; report
the Falcor red up as a draft-artifact sequencing artifact, and consider skipping the manual
`ci.yml` dispatch on drafts entirely (it mostly yields this confusing red X while the build/test
jobs are skipped anyway)
([draft ci.yml dispatch → spurious test-falcor missing-artifact red](../learnings/1789147576274-manually-dispatching-ci-yml-on-a-draft-slang-pr-pr.md)).

## GPU-job flake/timeout and the leftover-file check

`test-windows-*-gpu-vk / test-slang` and other GPU jobs flake or time out. Tell a timeout from a
real failure with
`gh api repos/shader-slang/slang/actions/jobs/<jobid> --jq '.steps[] | "\(.name)\t\(.status)\t\(.conclusion)"'`:
a "Test Slang" step stuck `in_progress` at job completion with a long started→completed gap
(~35 min) and an **empty** `--log-failed` is a timeout/cancellation, not an assertion failure.
Rerun a flake (`gh run rerun <run-id> --failed`, ≤3×); only reproduce/fix if a real job (build,
or CPU `static-unit-test`) fails with an actual assertion. In slang#12853 all builds + CPU
static-unit-tests passed (580/580); only the two GPU jobs flaked and the maintainer merged anyway
([GPU flake/timeout classification](../learnings/1788268233722-slang-ci-gpu-jobs-test-falcor-win-gpu-vk-test-slan.md)).

A specific benign red is the **post-test worktree-cleanliness check**: a single `test-*/test-slang`
config exits 1 on `##[error]slang-test left generated or modified files in the worktree` followed
by an untracked randomly-named file (e.g. `?? moduleG6360.slang` — the `G####` suffix is a
generated module name from a separate-compilation/module test that intermittently fails to clean
up), while its own test summary reads `100% of tests passed (N/N)` and all sibling configs are
green. Treat as flaky → rerun ≤3×; confirm unrelated with `git show --name-only HEAD` not
including the leftover file. Do not try to "fix" it in an unrelated PR
([leftover-file flake](../learnings/1788402606374-slang-ci-red-slang-test-left-generated-or-modified.md)).

## Runner-image rollout mismatch (not rerunnable)

A `windows-11-vs2026-arm64` runner image (e.g. Image Release 20260823.138.1, MSVC toolset
14.51.36231 / VS18.0) can fail `extras/verify-documented-compiler-version.sh` (exit 4) because
that MSVC version isn't yet in `docs/building.md`'s compiler-version allowlist. Key tell it's a
**rollout-in-progress**, not a regression: the identical job PASSED on an earlier run of the same
PR that happened to land on the old image — different runs land on different underlying images,
so it's fleet-side variance. It is NOT safely requeueable (a rerun might land on the new image
and bounce identically); log it `action:"left"` and advise a human to update `docs/building.md`
(or pin CI off the vs2026-arm64 image). Watch for the signature spreading across windows-aarch64
jobs — if it hits >1 PR it graduates to a systemic advice-line item like the falcor 403
([vs2026-arm64 image not in allowlist](../learnings/1788242807926-slang-ci-windows-11-vs2026-arm64-runner-image-not-.md)).

**Correction — the `verify-documented-compiler-version.sh` *exit 4* is a shell bug, not a
docs-allowlist failure.** Reading the script and reproducing GPU-free (shader-slang/slang
#13041/#13042) shows it has **no exit-non-zero path of its own** — every branch ends `exit 0`, and
a version *mismatch* only emits a `::warning::` and exits 0. So exit 4 can only be `set -euo
pipefail` aborting on a failed command: `COMPILER_VERSION=$("$COMPILER_PATH" 2>&1 | grep … | head
-1)` invokes `cl.exe` with no source files, which prints its banner but **exits 4**; under
`pipefail` that becomes the pipeline status, and the plain `VAR=$(…)` assignment under `set -e`
kills the script *before* it reaches its graceful empty-version guard. `14.51` is `VCToolsVersion`;
the script only compares the `cl.exe` banner's *compiler* major (`19`), which `docs/building.md`
already matches — so a docs edit would not touch the crash. The fix is `|| true` on the
best-effort command substitutions (use `|| true`, NOT `|| VAR=""`, since `cl.exe` prints a
parseable banner while exiting non-zero). Two general rules follow. (1) For any best-effort script
under `set -euo pipefail`, a `VAR=$(cmd | …)` where `cmd` can exit non-zero aborts before its own
empty-value guard — the guard is dead code until you append `|| true`; a never-fail
(all-branches-`exit 0`) script that nonetheless exits non-zero is the diagnostic tell of a
command-substitution trip, not business logic. (2) When reviewing such a `|| true` fix, enumerate
**every** structurally-identical `VAR=$(pipeline)` at the same errexit scope and confirm the fix is
applied symmetrically (three unguarded `DOC_LINE=$(grep … | head -1)` siblings would abort on a
routine `docs/building.md` reword) — but note `errexit` is **off inside `$(...)`
command-substitution subshells** unless `shopt -s inherit_errexit` is set, so greps nested in
another `$(...)` whose last statement is `echo` are already safe and flagging them is a false
positive
([exit-4 is a set-e/pipefail trip, not a docs allowlist](../learnings/1789252710427-verify-documented-compiler-version-sh-exit-4-on-wi.md),
[same, reproduced + fixed in #13042](../learnings/1789254176751-slang-ci-verify-documented-compiler-version-sh-exi.md),
[reviewing `|| true` CI-tolerance shell PRs](../learnings/1789255179378-reviewing-true-ci-tolerance-shell-prs-check-every-.md)).

The follow-up PR (shader-slang/slang#13352) adds `trap '…; exit 0' ERR` to the same script as a
diagnostic, and reviewing it surfaced how far an ERR trap actually reaches (verified on bash 5.2).
Without `set -E`, the trap fires only for **top-level** failures: a `set -e` abort inside a
function body called at top level (`f(){ false; }; f`) exits silently with rc=1 and never runs the
trap. Errexit is already cleared inside `$(...)`, so a failure there reaches the trap only if the
substitution's status fails the assignment; an array assignment `A=($(exit 4))` propagates status
4 exactly like a scalar `A=$(exit 4)`. `set -u` unbound-variable errors bypass ERR but print a bash
message to stderr, so a truly silent exit rules them out. A multi-line `$BASH_COMMAND` splits the
`::warning::` annotation, and only its first line becomes the annotation. The review lens is the
`exit 0`: it turns the step GREEN plus an annotation, which behaves like `|| true` on the `run:`
line, and maintainer jvepsalainen-nv explicitly ranked that below `continue-on-error` because a
broken check should stay visible (red) without gating (see the advisory-script section of
[CI Build Tooling](../concepts/ci-build-tooling.md)). Raise that trade-off with the maintainer
rather than treating it as settled; `exit "$status"` plus `continue-on-error` keeps both the
diagnostic and the red step
([Bash ERR trap as a CI diagnostic: reach limits and the exit-0 vs visible-failure trade-off](../learnings/1790798241576-bash-err-trap-as-a-ci-diagnostic-reach-limits-and-.md)).

## gh run rerun has hard age limits

`gh run rerun <id>` (and `-j <jobId>`) is rejected outright past certain ages, independent of
classification: >30 days → "Unable to retry this workflow run because it was created over a month
ago"; roughly >~1 week (even ~6-7 days) → "This workflow run cannot be retried" (tied to the
repo's shorter log/artifact retention); and "This workflow is already running" when a newer run
for the same concurrency group is active. Individual `-j` reruns fail the same way once the parent
is outside the window — no per-job exception. **Upshot for the babysitter:** classification is
moot for any PR whose last run is more than a few days old; verify the age-rejection cheaply (one
rerun call, check stderr) and log it `left`/non-actionable rather than burning tokens on log
diving. Recovery needs a fresh run: the author pushing a fresh commit, an admin triggering `/ci`,
or a new dispatch on the same head
([rerun hard age limits](../learnings/1788199935009-gh-run-rerun-has-hard-age-limits-old-ci-failures-o.md)).
The 30-day refusal bites slow PRs in particular, because `falcor-build-approval-gate` waits up to
720h (30 days) for a manual approval: when it times out and fires a `ci_failed` webhook, the run is
already too old to rerun. A fresh run comes from one of two moves. (1) Dispatch on the same branch
head, `gh workflow run ci.yml -R shader-slang/slang --ref <branch>`; no commit is needed, so the
reviewer's target SHA does not change (on a bot draft that run yields again, see below; on a
non-draft PR the yielded dispatch's red `check-ci` blocks merge, so push instead — see
[draft-PR CI](ci-b-draft-pr-ci-and-conditional-claims.md)). (2) Push,
which on a long-idle branch usually means merging current master, since the branch is also BEHIND.
Before pushing, check whether master touched your files (`git diff <merge-base> origin/master --
<your files>`), rebuild, and re-run the affected suites; also check that the worktree still has a
`build/` dir, because on slang#12443 it had been reaped and needed `cmake --preset default` again.
One attribution trap rides along: `check-ci` is an aggregator whose `needs` list does NOT include
`falcor-build-approval-gate`, so when both are red, compare the jobs' `completed_at` before saying
"check-ci rolled up X"; a check-ci failure from weeks earlier belongs to whichever `needs` job
failed then ([dispatch a fresh workflow_dispatch instead of rerunning a month-old run](../learnings/1792219533913-gh-run-rerun-fails-on-runs-older-than-one-month-di.md),
[runs older than 30 days cannot be rerun; push to get fresh CI](../learnings/1792224538847-github-actions-runs-older-than-30-days-cannot-be-r.md)).
Do not confuse the 30-day rerun limit with a bot run that *fails* after exactly 30 days. That
is GitHub auto-failing a `falcor-ci` deployment approval nobody granted (`falcor-build-approval-gate`,
0 steps, every build/test job skipped): no code ran, and on a draft a fresh run only yields and
queues another approval, so the matrix runs when the PR is marked ready (details on
[rerun decision rules](ci-flake-rerun-decision-rules.md);
[expired falcor-ci approval at 30 days](../learnings/1792173072753-bot-ci-run-failure-after-exactly-30-days-expired-f.md)).

## Uniform test failures: new-test vs. regression vs. inherited master breakage

When *every* `test-slang` job fails uniformly (all platforms/arches, debug+release, incl. CPU),
that pattern means a **deterministic `.slang` failure**, not a GPU flake or infra issue. Separate
three causes without assuming:

1. **The PR's own new test** — read the failing-test verdict lines
   (`gh run view --job <id> --log-failed | grep "FAILED test:"`). If the new test passes and
   something else fails, the new test is fine.
2. **A PR-introduced regression** of a pre-existing, unrelated test.
3. **Inherited master breakage** — PR CI merges the PR into current master, so a red master
   (e.g. a just-landed semantic-merge conflict) makes every rebasing PR red.

Decisive checks used on #12892: grep the PR's CI log for the suspect master change's fingerprint
(zero hits ⇒ the CI base predates it ⇒ not the inherited breakage); confirm the failing test's
verdict on plain master's own CI run for the suspect commit (passed on master but failed on the
PR ⇒ regression, since the test file is unchanged); reproduce locally on the exact PR head
(`git fetch origin pull/<n>/head`, `git worktree add <wt> FETCH_HEAD`, build — `cmake --preset
default` may need `git submodule update --init --recursive` for SPIRV-Headers first). The actual
bug there was a parser change feeding a pre-`CheckTerm`'d base into `parseGenericApp` for the
whole `Generic` branch, mis-pinning an overload for free-function generic calls; the principled
fix reused `checkedBase` only for member-access exprs. `tests/bugs/overload-ambiguous-2.slang`
(issue #4476) is a sensitive canary for overload-resolution / generic-app parser changes
([uniform-failure triage](../learnings/1788474162476-triaging-uniform-ci-test-failures-new-test-vs-pr-r.md)).

## Reviewing a "descope the failing test case" CI fix

When a PR's own new test fails and the proposed fix is to descope/rescope the failing case rather
than fix compiler code, review it thus: (1) **confirm the affected code path is byte-identical** —
read the diff's *context* lines, not just the file list; unchanged `operator-`/`neg()` context
means descoping the `-` case masks no PR regression (this distinguishes "masking a PR-introduced
regression" from "narrowing a brand-new test away from a pre-existing unrelated bug"). (2) An
**arch-specific wrong *primal* (not just tangent)** in a CPU/interpreter autodiff test is latent
nondeterminism/UB — a genuine correctness bug, not FP rounding (aarch64 `0 0` vs x86_64 `-9 -6`);
say "wrong primal, not just derivative" to upgrade the severity framing. (3) You can validate a
descope **without a costly PR rebuild** by running the master-supported components of the patched
test and leaning on the CI `actual:` FileCheck line for unchanged cases. (4) Descope is
non-masking **only if a tracking issue is actually filed** and linked from the test + PR — "worth
its own issue" in a comment is not enough. (5) Note the residual honestly: FileCheck aborts at the
first failed line, so later CHECK directives were never exercised on the failing arch — the fix's
pass there is predicted, not proven; confirm via a CI re-run
([reviewing a descope CI fix](../learnings/1788286964829-reviewing-a-descope-the-failing-test-case-ci-fix-b.md)).

**Source learnings (22):**
- [Bash ERR trap as a CI diagnostic: reach limits and the exit-0 vs visible-failure trade-off](../learnings/1790798241576-bash-err-trap-as-a-ci-diagnostic-reach-limits-and-.md) — slang#13352: no `set -E` = top-level only; `$BASH_COMMAND` splits annotations; `exit 0` ≈ `|| true`, below `continue-on-error`; `gh api --allow-escape-sequences` for job logs.

- [gh run rerun has hard age limits — old CI failures on stale PRs cannot be rerun](../learnings/1788199935009-gh-run-rerun-has-hard-age-limits-old-ci-failures-o.md) — >30d "over a month ago", >~1wk "cannot be retried", "already running"; classification moot for stale PRs.
- [test-falcor CI failures are usually external-bridge infra (403), not your code — and it's non-required](../learnings/1788206678107-test-falcor-ci-failures-are-usually-external-bridg.md) — Falcor consumes Slang as a library; 403 at trigger step = infra; verify required-status membership.
- [test-falcor CI failure with 'external CI trigger 403 Forbidden' is infra — don't rerun past 2×](../learnings/1788220633639-test-falcor-ci-failure-with-external-ci-trigger-40.md) — persistent 403 not transient; escalate systemic; draft priority-yield is distinct.
- [test-falcor CI failure on a bot PR is usually a 403 external-CI-trigger wall, not your code](../learnings/1788229271673-test-falcor-ci-failure-on-a-bot-pr-is-usually-a-40.md) — bot identity lacks external-trigger permission; don't reflex-rerun; read the log before concluding.
- [Slang CI: windows-11-vs2026-arm64 runner image not yet in docs/building.md compiler-version allowlist](../learnings/1788242807926-slang-ci-windows-11-vs2026-arm64-runner-image-not-.md) — MSVC 14.51 fails verify-documented-compiler-version.sh; fleet-side image variance, not rerunnable.
- [Slang CI: GPU jobs (test-falcor, win-gpu-vk test-slang) flake/timeout; classify before reacting](../learnings/1788268233722-slang-ci-gpu-jobs-test-falcor-win-gpu-vk-test-slan.md) — step in_progress + empty --log-failed = timeout; react to current head; BEHIND-branch merge recipe.
- [Reviewing a "descope the failing test case" CI fix: byte-identical check + arch-wrong-primal signal](../learnings/1788286964829-reviewing-a-descope-the-failing-test-case-ci-fix-b.md) — context-line byte-identity, wrong-primal severity, no-rebuild validation, tracking-issue requirement.
- [Slang CI red "slang-test left generated or modified files" is a flaky leftover-file check](../learnings/1788402606374-slang-ci-red-slang-test-left-generated-or-modified.md) — 100% tests pass but worktree-clean check trips on untracked moduleG####.slang; rerun ≤3×.
- [Triaging uniform CI test failures: new-test vs PR-regression vs inherited master breakage](../learnings/1788474162476-triaging-uniform-ci-test-failures-new-test-vs-pr-r.md) — uniform red = deterministic .slang failure; separate three causes; overload-ambiguous-2.slang canary.
- [test-falcor CI failures have multiple infra modes — re-read the fresh log each time](../learnings/1788545708307-test-falcor-ci-failures-have-multiple-infra-modes-.md) — expired artifact vs 403; --failed rerun won't regenerate; full rerun does; no shader diag = infra.
- [Manually dispatching ci.yml on a DRAFT slang PR yields a spurious test-falcor missing-artifact red](../learnings/1789147576274-manually-dispatching-ci-yml-on-a-draft-slang-pr-pr.md) — draft-gated build jobs skipped, Falcor bails ~15s with artifact-unavailable; failed_steps:[]; clears on gh pr ready, not on rerun.
- [Slang ci.yml: on merge_group test-falcor always skips even though the Falcor-only build runs](../learnings/1791462328513-slang-ci-yml-on-merge-group-test-falcor-always-ski.md) — skipped approval gate skips `test-falcor` (default status check) in 15/15 merge_group runs; #12770's rationale is stale.
- [Slang sanitizer job's "PR-related" label is file-attribution, not causation](../learnings/1791509362714-slang-sanitizer-job-s-pr-related-label-is-file-att.md) — also notes `test-falcor` is not in `check-ci`'s `needs`.
- [verify-documented-compiler-version.sh exit-4 on windows-aarch64 is a set-e/pipefail trip, NOT a stale docs allowlist](../learnings/1789252710427-verify-documented-compiler-version-sh-exit-4-on-wi.md) — cl.exe exits 4 with no sources; VAR=$(pipeline) under set -e aborts before the empty-version guard; fix with || true.
- [Slang CI verify-documented-compiler-version.sh exit 4 is a set -e/pipefail shell bug (reproduced, fixed #13042)](../learnings/1789254176751-slang-ci-verify-documented-compiler-version-sh-exi.md) — all branches exit 0; a never-fail script exiting non-zero = command-substitution trip, not business logic.
- [Reviewing `|| true` CI-tolerance shell PRs: check every same-scope VAR=$(pipeline); errexit is OFF in command-substitution subshells](../learnings/1789255179378-reviewing-true-ci-tolerance-shell-prs-check-every-.md) — enumerate structurally-identical substitutions; $(...) subshells safe unless inherit_errexit.
- [Bot CI run 'failure' after exactly 30 days = expired falcor-ci environment approval, not code](../learnings/1792173072753-bot-ci-run-failure-after-exactly-30-days-expired-f.md) — distinct from the 30-day rerun refusal; no code ran
- [gh run rerun fails on runs older than one month — dispatch a fresh workflow_dispatch instead](../learnings/1792219533913-gh-run-rerun-fails-on-runs-older-than-one-month-di.md) — 720h falcor gate timeout lands past the rerun window; `gh workflow run --ref` keeps the SHA; `check-ci` `needs` excludes the gate.
- [GitHub Actions runs older than 30 days cannot be rerun — push to get fresh CI](../learnings/1792224538847-github-actions-runs-older-than-30-days-cannot-be-r.md) — merge master (branch is BEHIND), check master's diff to your files, rebuild; reaped `build/` on #12443.
- [test-falcor --job rerun fails in 19s once the run's slang-tests-* artifact is gone](../learnings/1793081639779-test-falcor-job-rerun-fails-in-19s-once-the-run-s-.md) — check `artifacts?name=…-falcor` total_count; rerun the falcor build job to re-upload; reruns do submit a new pipeline (#13886)
- [Slang CI: test-falcor failures can't be read from the container, so do a public-Falcor differential compile to triage](../learnings/1792769226659-slang-ci-test-falcor-failures-can-t-be-read-from-t.md) — GitLab 502; baseline vs PR `slangc` over public Falcor `Source/**/*.slang`; #13880 441 files, 0 diffs; clean diff only supports infra
