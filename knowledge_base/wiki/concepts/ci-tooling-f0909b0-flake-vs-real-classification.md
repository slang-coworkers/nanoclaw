---
title: Classifying CI failures — flake vs regression, runner health, rerun mechanics
type: concept
group: ci-tooling
tags: [ci-babysitter, flake, infra, runner-fleet, falcor, rerun, sigterm, artifact-expiry, control]
source_count: 24
---

## TL;DR

Triaging a red CI run is a classification problem: infra/flake (rerunnable, or wait for a
rebase) vs a real code regression (author-owned, do NOT rerun). The signal usually IS in the
artifacts — you just have to read the right one and pair it with a control.

- **The exit signal often carries the verdict.** `143 = 128+15 (SIGTERM)` = graceful
  runner reclaim (infra, rerunnable); `137 = SIGKILL` (often OOM); `SIGSEGV/SIGABRT`/Windows
  `0xC0000005` = a genuine crash (author-owned). In one PR, split the jobs — don't bucket.
- **The two dominant slang infra buckets are distinct:** `test-falcor` = an *external NVIDIA
  GitLab pipeline* (Falcor-side / retry-wrapper lever); `test-slang` SIGTERM/143 = *own-fleet
  runner preemption* (pool-sizing lever). Different owners, different fixes — don't merge them.
- **Falcor red is usually a non-required, mergeable flake.** Read the failing STEP's log:
  "artifact unavailable/expired… not triggering" = expired-artifact infra (a `--failed` rerun
  is FUTILE — it re-runs the consumer, not the artifact producer); "pipeline NNN finished with
  status 'failed'" = ran-and-failed (rerun may help). Prove it with a **master control** on the
  same check-run name.
- **`gh run rerun --failed` reruns EVERY failed job** — no per-job filter. On a mixed run
  (intermittent + deterministic) use `gh run rerun <id> --job <databaseId>` (the API databaseId,
  not the URL number).
- **Alarm on age + fleet size, not queue depth** — a total outage keeps depth flat (arrivals
  stop when servers vanish). Discriminate via `runner_name` non-empty; `runner_groups` ABSENT is
  a third bucket meaning "no info," not "total 0."
- **A fix on master is inert until the PR rebases past it.** `compare <head>...master` before
  rerunning a known-fixed signature; a recurrence on a BEHIND head is expected, not a new cause.
- **Verify identity + controls.** Re-fetch the exact log from the exact repo/run the (sub)agent
  cites; a classify-only subagent can *fabricate* a finding. Reproducing a described failure is
  not confirming its framing; the within-process before/after split beats a cross-job comparison.
- **"Blocked by CI" needs `mergeable_state` + `reviewDecision`**, not just checks.

## The exit signal and the infra bucket carry the classification

[CI classify: exit-143/SIGTERM = graceful runner reclaim, NOT a crash](../learnings/1786472543511-ci-classify-exit-143-sigterm-graceful-runner-recla.md)
makes the discriminator concrete: `##[error]Process completed with exit code 143` +
"The runner has received a shutdown signal" = SIGTERM preemption of a self-hosted runner
mid-run → INFRA, rerunnable; distinct from `SIGSEGV`/`SIGABRT`/AV = an author-owned crash. The
confirming control: a reclaim shows the same config PASSING on sibling legs with the failing
leg's log passing right up to the `exit 143` line; a real regression fails the SAME test across
platforms. In one PR the two signals coexisting means split the jobs. `test-slang` exit-143 was
the #1 rerun driver (pool churn is structurally the biggest flake source, operator-actionable via
capacity policy). And
[two top CI infra buckets are distinct: external Falcor vs own-fleet runner preemption](../learnings/1786494033565-two-top-ci-infra-buckets-are-distinct-external-fal.md)
insists on keeping them separate in the sweep advice line: `test-falcor` is an external NVIDIA
GitLab pipeline via `run-external-ci` (lever: Falcor stability or a retry-on-transient wrapper),
`test-slang` SIGTERM is own-fleet preemption (lever: runner pool sizing) — collapsing them into
one "infra is flaky" bullet loses the actionable lever.

Nightly reds need the same per-signature care.
[Nightly Slang Test consecutive reds can be a CI-config gap, not a master regression](../learnings/1787991326270-nightly-slang-test-consecutive-reds-can-be-a-ci-co.md):
two consecutive reds met the "re-file the regression tracker" bar, but both failed only on
`agentic-tests` with signal-4 SIGILL from a missing `SLANG_DISABLE_AVX512=1` (a runner-SKU-dependent
config gap, not a moving-master regression) — always pull the failed-jobs list + signature before
firing the alarm; a known SIGILL/AVX-512 or infra signature overrides the night-count.
[Depfile-aarch64 systemic CI regression (#12666) — fix landed, PRs just need rebase](../learnings/1787898092490-depfile-aarch64-systemic-ci-regression-12666-fix-l.md)
is the model of a systemic signature (`DepfileOutput.internal` failing ONLY on
`test-windows-*-cl-aarch64`): once the fix (#12794) landed, any BEHIND PR hitting it just needs a
rebase — do NOT rerun (re-fetches the stale-branch build) and do NOT re-file per-PR. Two more
build-config traps that are neither flake nor rerunnable:
[setup-sccache action hard-rejects Windows ARM64 runners](../learnings/1787336678361-setup-sccache-action-hard-rejects-windows-arm64-ru.md)
(a hard exit-1 on any Windows ARM64 job — needs an ARM64 sccache branch) and
[Falcor Perf CI job has a missing-dependency race](../learnings/1787639995252-falcor-perf-ci-job-has-a-missing-dependency-race-c.md)
(the perf job's `needs:` omits the eager build that produces the artifact it downloads → an
intermittent ordering flake, real workflow bug, rerunnable per-PR but should get a real `needs:` fix).

## Falcor / external lanes: read the step log, then prove it with a master control

Three atoms converge on the expired-artifact Falcor pattern.
[expired-artifact Falcor failure is infra, and `gh run rerun --failed` can't fix it](../learnings/1786945794219-slang-ci-expired-artifact-falcor-failure-is-infra-.md):
the Falcor lane consumes a build artifact from the same run; when it expires (24h retention) the
lane fails on infra, and `--failed` re-runs only the consumer, not the successful build job that
produces the artifact — so it re-fetches the same expired artifact and fails again. Distinguish
expired-artifact ("is unavailable / not triggering", rerun futile) from ran-and-failed ("pipeline
NNN finished with status 'failed'", rerun may help) by reading the step log. Only a fresh full CI
run regenerates the artifact — a human-owned decision, not a no-op commit.
[A red external-CI lane on a frozen PR head can be an expired-artifact infra flake](../learnings/1787100709269-a-red-external-ci-lane-on-a-frozen-pr-head-can-be-.md)
adds the frozen-head corollary: an approved/do-not-push head whose artifact retention is shorter
than the hold can NEVER re-green (the artifact is gone), and the discriminator that settles it is a
**master control** — query the same check-run name on current master head (`success` there ⇒ not an
upstream outage). Relay all three (red on PR + green on master + no causal path) to whoever owns the
merge, and HOLD.
[Non-required Falcor CI red is a mergeable flake, confirmed by maintainer merge-over](../learnings/1787112750038-non-required-falcor-ci-red-is-a-mergeable-flake-co.md)
seals it with an end-to-end join: Falcor shows `isRequired: null`, the PR stays MERGEABLE/APPROVED,
GitHub doesn't gate on it, and the maintainer merged with Falcor still red — do NOT rerun (buys
nothing toward merge) or head-move to "fix" it. (Bonus: a content-identical rebase + lease-pinned
force-push PRESERVES SHA-bound approvals.)

## Rerun mechanics: `--failed` is all-or-nothing; a fix needs a rebase first

Two atoms document the same `--failed` footgun:
[gh run rerun --failed reruns ALL failed jobs in a run](../learnings/1786985212126-gh-run-rerun-failed-reruns-all-failed-jobs-in-a-ru.md)
and
[gh run rerun --failed has no per-job filter for mixed failures](../learnings/1787206386186-gh-run-rerun-failed-has-no-per-job-filter-for-mixe.md).
When a run mixes an intermittent failure (Falcor, codeload 429, GPU death) with a deterministic
one (a broken test assertion), `--failed` reruns every failed job — violating "never rerun
deterministic failures." Not harmful (the deterministic one just fails again) but wasteful and
confusing to a "did my rerun fix it" read. Get job IDs first
(`gh run view <id> --json jobs --jq '.jobs[]|{name,databaseId}'`) and rerun surgically with
`--job <databaseId>` — the API databaseId, NOT the URL number, which 404s. A stuck
`status:in_progress`/`conclusion:null` step under a `conclusion:failure` job with a real
`completed_at`, plus a 404ing `jobs/<id>/logs` (BlobNotFound, never persisted), is itself sufficient
evidence of an infra death. And a fix is inert until the branch rebases:
[Rerunning a known-flake signature doesn't help until the fix is rebased in](../learnings/1787084165975-rerunning-a-known-flake-signature-doesn-t-help-unt.md)
— `compare <pr-head>...master`; if the head predates the fix commit (`diverged`/`behind`), a rerun
reproduces the identical failure by design, which is expected, not a second cause or a failed fix.

## Runner-fleet health: alarm on age and fleet size, not depth

[A 3h runner-fleet outage stayed BELOW the queue-depth alarm](../learnings/1786395185201-a-3h-runner-fleet-outage-stayed-below-the-queue-de.md):
the GPU fleet went to `0/0` for ~3h while `jobs_queued` read 20 (below the >30 threshold), because
depth = arrivals × service rate and arrivals also stop when servers vanish. What discriminated,
cheaply: fleet size (`total == 0`, checked explicitly — `busy/total=0/0` fails a saturation check
vacuously), queue AGE (186 min old), last-start from the jobs API, and starved-vs-no-demand (jobs
requesting exactly the vanished labels). Ask of any queue: "if the servers all vanished, would my
alarm fire?" — if it reads only depth, no.
[health_snapshots runner_groups: ABSENT is a third bucket, entirely pre-onset noise](../learnings/1786438193386-health-snapshots-runner-groups-absent-is-a-third-b.md)
sharpens the instrument: `runner_groups` only enumerates groups with current activity, so ABSENT
= no information, never "total 0" — treating ABSENT as zero mis-dated the outage by 17 hours. Only
`runner_name` non-empty discriminates a real execution (queued jobs carry `runner_id:0`/empty name,
and `started_at` is populated even on jobs that never ran). The pre-checkout probe has the same
requirement:
[A pre-checkout runner-death probe must require runner_name non-null](../learnings/1786357018657-a-pre-checkout-runner-death-probe-must-require-run.md)
— filtering `duration<60s AND len(steps)<=1` returned 31 false "runner deaths" that were all jobs
cancelled while still queued (`runner_name: None`, negative duration); add `if not runner_name:
continue` and the true count was 0. The error was self-flattering: a sweep looking for a trend found
a big one and nothing contradicted it. That atom's discriminator table (cancelled-while-queued vs
supersede vs real infra death vs cost regression) is worth keeping whole.

## Verify identity, verify controls, verify the premise

[A classify-only CI subagent fabricated a cross-repo finding](../learnings/1786969122532-classify-only-ci-subagent-fabricated-a-cross-repo-.md):
a report-only subagent invented a run ID that doesn't exist in the queried repo (the `SlangPy
Tests` check on a slang PR points to a slangpy-hosted run) and cited a stale superseded run ID for
another PR. "Verify actual state" must include re-fetching the exact log from the exact repo/run the
subagent cites — a plausible table with specific error text is not evidence its inputs existed, and
an unscoped `--repo` framing on a cross-repo check is a red flag. The within-subject control beats
cross-job comparison:
[An in-process before/after split refutes the "bad CI runner" confound](../learnings/1786386011669-approver-challenger-miss-an-in-process-before-afte.md)
— 144 mass Vulkan failures looked host-confounded (different runner slots head vs base), but
splitting each log at the trigger showed 130 consecutive PASSES before it on the same host in the
same process, which a host-level ICD fault could never produce → the revision owns it. Ask any
"environment flake" explanation: would it have failed the earlier tests too? A global test-state
mutation is a review-worthy blast-radius change even when the new test passes.

Two more epistemic guards.
[A true finding reached through a false premise shields the bad step from review](../learnings/1786426354718-a-true-finding-reached-through-a-false-premise-shi.md):
a stale `closingIssuesReferences.totalCount=2` (later 0) sent a hunt that found a real, worse
exposure (a squash title auto-closing the issue) — but the success camouflaged the false premise.
Separate "did I find something real?" from "was my reason for looking sound?"; re-measure a failure
(query twice, let it settle) before hunting a deeper cause; ask what the instrument prints in the
state where it can't work. And a suspected fix's first opportunity can be masked:
[LeakSanitizer regression verification blocked by unrelated infra flake](../learnings/1787071797412-leaksanitizer-regression-verification-blocked-by-u.md)
— the 4th night's head contained the fix but died on a network flake before the LeakSanitizer step
ran (per-step status array), so report "unconfirmed, not disproven" and wait for a clean run.
[First real release CI failure verified — runner infra, not source](../learnings/1786930405064-first-real-release-ci-failure-verified-runner-infr.md)
shows the verification loop unchanged on red runs (run-identity + job-census + compare +
bogus-sha-control), adding only a raw-log pull to corroborate quoted error text — worth doing since
"quoted verbatim" claims drift on relay.

## Payload and mergeability sanity

[CI babysitter wake payload prCount can mismatch both its own prs array and live gh pr list](../learnings/1786918074939-ci-babysitter-wake-payload-prcount-can-mismatch-bo.md):
`prCount:24` vs a 20-entry `prs` array vs a live `gh pr list` of 30 — an undercount (silently
excluded PRs) is the dangerous direction; flag it as an unresolved caveat rather than trust the
payload, and check whether the pre-filter is legitimately scoped.
[Release CI zero-lag now the modal case, not the exception](../learnings/1786671463195-release-ci-zero-lag-now-the-modal-case-not-the-exc.md):
`ahead_by=0` (master HEAD tested exactly) is now the modal release-dispatch outcome — don't anchor
on the old "median ~5 commit gap"; measure `ahead_by` fresh every night.
[Blocked by CI needs mergeable_state + reviewDecision checked too, not just checks](../learnings/1787012466970-blocked-by-ci-needs-mergeable-state-reviewdecision.md):
a PR can have a correctly-diagnosed infra flake AND be blocked by 2-3 unrelated things (stale
branch, zero reviews) — framing "nudge approvers, it's blocking a mergeable PR" sends a maintainer
down a dead end. Check `mergeable_state` + `reviewDecision`, and re-verify a peer's cited check
states live (a correction can be right on the main point and carry a stale side-detail).

**Source learnings (24):**

- [A pre-checkout runner-death probe must require runner_name non-null](../learnings/1786357018657-a-pre-checkout-runner-death-probe-must-require-run.md) — a dur<60s filter manufactured 31 fake "runner deaths" that were queued-cancelled jobs; add `if not runner_name: continue`; a self-flattering trend has nothing to contradict it.
- [An in-process before/after split refutes the "bad CI runner" confound](../learnings/1786386011669-approver-challenger-miss-an-in-process-before-afte.md) — 130 consecutive passes before the trigger on the same host refute a host fault; the within-process split holds host/driver/build constant where cross-job comparison confounds them.
- [A 3h runner-fleet outage stayed BELOW the queue-depth alarm](../learnings/1786395185201-a-3h-runner-fleet-outage-stayed-below-the-queue-de.md) — depth flatlines when servers vanish; alarm on oldest-item age and total==0; separate starved from no-demand via requested labels.
- [A true finding reached through a false premise shields the bad step from review](../learnings/1786426354718-a-true-finding-reached-through-a-false-premise-shi.md) — a stale API read launched a lucky hunt; audit the reasoning even when the hunt pays off; re-measure before hunting a deeper cause.
- [health_snapshots runner_groups: ABSENT is a third bucket, entirely pre-onset noise](../learnings/1786438193386-health-snapshots-runner-groups-absent-is-a-third-b.md) — ABSENT = no info, not total 0 (mis-dated the outage 17h); only runner_name non-empty discriminates execution; started_at is set even on never-run queued jobs.
- [CI classify: exit-143/SIGTERM = graceful runner reclaim, NOT a crash](../learnings/1786472543511-ci-classify-exit-143-sigterm-graceful-runner-recla.md) — 143=SIGTERM reclaim (rerunnable), SIGSEGV/AV=author crash; confirm via sibling legs passing; split jobs when both signals coexist; test-slang 143 is the #1 rerun driver.
- [Two top CI infra buckets are distinct: external Falcor vs own-fleet runner preemption](../learnings/1786494033565-two-top-ci-infra-buckets-are-distinct-external-fal.md) — Falcor = external GitLab pipeline (retry-wrapper lever); test-slang SIGTERM = pool sizing; don't collapse them into one "infra flaky" bullet.
- [Release CI zero-lag now the modal case, not the exception](../learnings/1786671463195-release-ci-zero-lag-now-the-modal-case-not-the-exc.md) — ahead_by=0 is now typical; don't anchor on the old median-5 figure; measure ahead_by fresh each night.
- [CI babysitter wake payload prCount can mismatch its prs array and live gh pr list](../learnings/1786918074939-ci-babysitter-wake-payload-prcount-can-mismatch-bo.md) — 24 vs 20 vs 30; an undercount is the dangerous direction; flag as unresolved rather than trust the payload; check the pre-filter scope.
- [First real release CI failure verified — runner infra, not source](../learnings/1786930405064-first-real-release-ci-failure-verified-runner-infr.md) — checkout action parse error before repo code; the run-identity + job-census + compare + bogus-sha loop applies unchanged on red runs; pull raw logs to corroborate quoted text.
- [Slang CI: expired-artifact Falcor failure is infra, and rerun --failed can't fix it](../learnings/1786945794219-slang-ci-expired-artifact-falcor-failure-is-infra-.md) — --failed re-runs the consumer not the artifact producer; distinguish "unavailable/not triggering" from "pipeline finished failed"; only a fresh full run regenerates the artifact.
- [Classify-only CI subagent fabricated a cross-repo finding](../learnings/1786969122532-classify-only-ci-subagent-fabricated-a-cross-repo-.md) — a report-only subagent invented a run ID and cited a stale one; re-fetch the exact log from the exact repo/run; an unscoped --repo cross-repo check is a red flag.
- [gh run rerun --failed reruns ALL failed jobs in a run](../learnings/1786985212126-gh-run-rerun-failed-reruns-all-failed-jobs-in-a-ru.md) — no way to scope --failed to just the intermittent job; use --job <databaseId> (not the URL number); mixed runs need per-job reruns.
- ["Blocked by CI" needs mergeable_state + reviewDecision checked too](../learnings/1787012466970-blocked-by-ci-needs-mergeable-state-reviewdecision.md) — a PR can be flaky-red AND blocked by stale branch/no reviews; check mergeable_state + reviewDecision; re-verify a peer's cited check states live.
- [Same-test-every-time vs different-test-each-time distinguishes a new regression from a tracked xdist flake](../learnings/1787022191042-same-test-every-time-vs-different-test-each-time-d.md) — an identical test crashing 4 nights (vs a random one) after a PR touching that test is a new regression, not the tracked ~5% flake; check the last-good/first-bad boundary.
- [LeakSanitizer regression verification blocked by unrelated infra flake](../learnings/1787071797412-leaksanitizer-regression-verification-blocked-by-u.md) — the fix's first opportunity died on a network flake before the check step ran; report "unconfirmed, not disproven" and wait for a clean run.
- [Rerunning a known-flake signature doesn't help until the fix is rebased in](../learnings/1787084165975-rerunning-a-known-flake-signature-doesn-t-help-unt.md) — compare <head>...master; a recurrence on a BEHIND head is expected, not a failed fix; only treat a recurrence as new signal on heads that contain the fix.
- [A red external-CI lane on a frozen PR head can be an expired-artifact infra flake](../learnings/1787100709269-a-red-external-ci-lane-on-a-frozen-pr-head-can-be-.md) — a frozen head + artifact retention < hold = a lane that can't re-green; prove transient with a master control on the same check-run name; HOLD for the maintainer.
- [Non-required Falcor CI red is a mergeable flake, confirmed by maintainer merge-over](../learnings/1787112750038-non-required-falcor-ci-red-is-a-mergeable-flake-co.md) — Falcor isRequired:null, PR stays MERGEABLE; don't rerun or head-move; a content-identical rebase preserves SHA-bound approvals.
- [gh run rerun --failed has no per-job filter for mixed intermittent+legitimate failures](../learnings/1787206386186-gh-run-rerun-failed-has-no-per-job-filter-for-mixe.md) — use --job <databaseId> per intermittent job; a stuck in_progress step + a 404ing job log is sufficient evidence of an infra death.
- [Falcor Perf CI job has a missing-dependency race (ci-falcor-test.yml)](../learnings/1787639995252-falcor-perf-ci-job-has-a-missing-dependency-race-c.md) — the perf job's needs: omits the eager build that produces its downloaded artifact → an intermittent ordering flake; rerun fixes the PR but the workflow bug persists.
- [Depfile-aarch64 systemic CI regression (#12666) — fix landed, PRs just need rebase](../learnings/1787898092490-depfile-aarch64-systemic-ci-regression-12666-fix-l.md) — DepfileOutput.internal fails only on windows-cl-aarch64; #12794 fixed it; BEHIND PRs need a rebase, do NOT rerun or re-file.
- [Nightly Slang Test consecutive reds can be a CI-config gap, not a master regression](../learnings/1787991326270-nightly-slang-test-consecutive-reds-can-be-a-ci-co.md) — 2 reds were SIGILL from a missing SLANG_DISABLE_AVX512 (runner-SKU config gap); pull the failed-jobs list + signature before re-filing the regression tracker.
- [setup-sccache action hard-rejects Windows ARM64 runners](../learnings/1787336678361-setup-sccache-action-hard-rejects-windows-arm64-ru.md) — the Windows branch exits 1 on any non-AMD64 arch, hard-failing every windows-11-vs2026-arm job; not a flake, not rerunnable — the action needs an ARM64 sccache download branch.
