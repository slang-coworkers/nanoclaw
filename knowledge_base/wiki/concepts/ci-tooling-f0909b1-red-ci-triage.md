---
title: Classifying red Slang CI — infra/flake vs. real regression
type: concept
group: ci-tooling
tags: [slang-ci, test-falcor, flake, infra, rerun, ci-triage, gpu-jobs, regression]
source_count: 10
---

## TL;DR

- **Read the fresh failing-job log before touching code.** Most single-job reds on `shader-slang/slang` are infra/flake, not your diff — but the log line is what tells the two apart, and the cause varies run-to-run.
- **`test-falcor / Test (Falcor)` is an external-CI bridge**, not a test runner. It fails on infra (`run-external-ci: trigger failed: HTTP Error 403: Forbidden`, or an expired Slang artifact) far more often than on a real regression. A bail in ~15s with no shader diagnostics ⇒ infra, your compiler change is cleared. It is typically **non-required**.
- Falcor has **≥2 distinct infra modes** (403 auth wall, expired artifact). Don't propagate "artifact-TTL is THE Falcor cause" — re-read the log each time. A `--failed` rerun does NOT regenerate an expired artifact; a full `gh run rerun <id>` does. A 403 wall is not rerun-fixable — stop after ~2 attempts.
- GPU jobs (`test-windows-*-gpu-vk / test-slang`) flake/timeout: a step stuck `in_progress` at completion with an empty `--log-failed` is a timeout/cancellation, not an assertion failure. React to the current head only (a new push auto-cancels prior runs).
- **Uniform** failure across *every* `test-slang` job (all OSes/arches, incl. CPU) ⇒ a deterministic `.slang` failure. Separate three causes: the PR's own new test, a PR-introduced regression of a pre-existing test, or inherited master-side breakage.
- Known flaky/benign reds: `##[error]slang-test left generated or modified files` (leftover `moduleG####.slang` from a module test) when `100% of tests passed`; and the `windows-11-vs2026-arm64` runner-image drawing an MSVC version not in `docs/building.md`'s allowlist.
- **`gh run rerun` has hard age limits**: >30 days = "created over a month ago"; ~>1 week = "cannot be retried". Classification is moot for stale PRs — the only recovery is a fresh commit / `/ci`.
- `gh run view --log-failed --job <id>` is the reliable log fetch; the `/actions/jobs/<id>/logs` REST endpoint often returns empty. `check-ci` failing is just the aggregate — find the real failing job.

## The overriding rule: read the fresh log, classify, then act

The single discipline that unifies every atom here: **fetch the actual failing-job log for the
current head and read it before concluding anything or touching code.** The check-run
output title/summary are frequently `null`, and `gh api .../actions/jobs/<id>/logs` frequently
returns empty — so the reliable path is
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
`gh api repos/shader-slang/slang/branches/master/protection --jq '.required_status_checks.checks[]?.context'`;
if `falcor` isn't listed, a persistent red there does not block merge. Don't reproduce/fix code
and don't post a GitHub bot comment for it (noise on a human-shepherded PR)
([non-required, classify as infra](../learnings/1788206678107-test-falcor-ci-failures-are-usually-external-bridg.md)).

**Falcor has multiple infra modes — don't fixate on one cause.** Beyond the 403 wall, the bridge
also fails when the prebuilt **Slang artifact is expired/unavailable**:
`run-external-ci: Slang artifact '…-falcor' … is unavailable (expired, still building, or the
token cannot see it); not triggering Falcor`. The *tests* artifact (~122MB) can expire on a
shorter retention than the sibling *build* artifact on the same run. A `--failed` rerun does NOT
help (the artifact stays expired) — a **full** `gh run rerun <id>` regenerates artifacts fresh.
The Falcor cause has flip-flopped (403 → artifact-TTL → 403 → artifact-expiry) enough that no
single cause is a fleet fact; each occurrence is evidence for that run only. Classification
shortcut: **if Falcor bails in seconds with no shader diagnostics in the log, it's infra and your
compiler change is cleared**; only treat it as a real regression if the log shows Falcor actually
compiled shaders and hit a compile/validation error
([multiple infra modes, re-read the log](../learnings/1788545708307-test-falcor-ci-failures-have-multiple-infra-modes-.md)).

Also distinct from a real Falcor red: on a **draft** PR a manual `workflow_dispatch` run yields
a cosmetic **priority-yield** (`filter=success, wait-for-human-priority=failure,
check-ci=failure`, all builds skipped). Once flipped to ready-for-review, real `pull_request` CI
runs and its failures are meaningful (modulo infra jobs)
([draft priority-yield vs real CI](../learnings/1788220633639-test-falcor-ci-failure-with-external-ci-trigger-40.md)).

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

## gh run rerun has hard age limits

`gh run rerun <id>` (and `-j <jobId>`) is rejected outright past certain ages, independent of
classification: >30 days → "Unable to retry this workflow run because it was created over a month
ago"; roughly >~1 week (even ~6-7 days) → "This workflow run cannot be retried" (tied to the
repo's shorter log/artifact retention); and "This workflow is already running" when a newer run
for the same concurrency group is active. Individual `-j` reruns fail the same way once the parent
is outside the window — no per-job exception. **Upshot for the babysitter:** classification is
moot for any PR whose last run is more than a few days old; verify the age-rejection cheaply (one
rerun call, check stderr) and log it `left`/non-actionable rather than burning tokens on log
diving. The only recovery is the author pushing a fresh commit or an admin triggering `/ci`
([rerun hard age limits](../learnings/1788199935009-gh-run-rerun-has-hard-age-limits-old-ci-failures-o.md)).

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

**Source learnings (10):**

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
