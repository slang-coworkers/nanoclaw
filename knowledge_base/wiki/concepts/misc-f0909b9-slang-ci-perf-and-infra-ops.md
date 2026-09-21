---
title: "Slang CI health, heartbeat monitoring, and perf/benchview infrastructure"
type: concept
group: misc
tags: [ci-health, heartbeat, test-falcor, flake-vs-real, causation, benchview, compile-perf, perf-alerting, master-branch, nightly]
source_count: 18
---

## TL;DR

Operational facts for the Slang CI-health / maintainer / heartbeat roles:

- **Read the failing log line before asserting causation.** A confirmed correlated
  fact (artifact-TTL exists) is NOT a confirmed cause; the only thing that settles a
  failure is the job-log line preceding `##[error]`.
- **test-falcor 403 vs artifact-expiry are two distinct failure modes** (don't
  conflate): a fresh 403 after a status came back is a *bridge auth* rejection; an
  "artifact unavailable (expired)" on a `--failed` rerun of a >1-day-old run is
  manufactured by rerunning a stale run whose 1-day build artifact is gone. Bridge
  health and artifact freshness are independent preconditions — check both, and grep
  `rerun-log.jsonl` for the run_id before any rerun.
- **Post-rebase deterministic test-slang failure on every platform (incl.
  CPU/aarch64), unrelated to the diff ⇒ a master semantic-merge break**, not the PR;
  don't push a "fix" onto the innocent PR.
- **`shader-slang/slang`'s default branch is `master`, not `main`** — a `main` query
  silently 404s; prefer `gh pr view --json mergeStateStatus` (`BEHIND` = needs
  rebase).
- **Heartbeat precheck's slang `workflow_failures` field is repeat-prone stale**
  (3+ occurrences, isolated to slang); spot-check against a live API call. Re-derive
  a carried "since <anchor>, now ~Nh" duration from the anchor, not last-figure +
  delta.
- **Perf/benchview:** compile-perf is the mature fork template; runtime perf is
  greenfield; benchview is a downstream-consumer-by-URL (bench.py comments only), and
  MDL benchmark results push to a PRIVATE repo. Source-verify inherited perf
  "facts" — several circulated mislabeled.

## Causation must be read at the failure site

Verifying a plausible correlated fact is NOT verifying causation. A `test-falcor`
cluster was diagnosed 403 → "corrected" to a ~24h artifact-TTL, and the orchestrator
independently verified the TTL *exists* and escalated with confidence "it's the TTL,
disregard the 403" — but reading the actual failing job log two days later showed
`run-external-ci: trigger failed: HTTP Error 403: Forbidden`, a ~15s auth rejection
*before any artifact is fetched*. The TTL was real but causally irrelevant. Rules:
read the actual failing log line before relaying a root-cause with confidence words;
a coworker's root-cause label is a hypothesis (doubly so after it flip-flopped once);
the cheap disambiguator is `gh run view <run-id> --log-failed --job <job-id>`
([verify causation at the failure site — a verified correlated fact is not a verified cause](../learnings/1788459591745-verify-causation-at-the-failure-site-a-verified-co.md)).

## test-falcor: two distinct failure modes, and the stale-rerun trap

`gh run rerun <id> --failed` reruns only the failed job, not the artifact-producing
build jobs earlier in the same run. The Falcor bridge needs a build artifact from
that same run, and the Windows-falcor build artifact has `retention-days: 1`. So any
`--failed` rerun of a run more than ~1 day old is doomed at artifact resolution —
regardless of the original error. A sweep re-classified 7 PRs as intermittent and
fired reruns even though those run_ids already carried a durable `legitimate`
verdict; all re-failed within seconds with "artifact unavailable (expired)." Rule:
check the original run's `created_at`; if >24h old, do not `--failed`-rerun — it
structurally cannot succeed. And the parent must grep `rerun-log.jsonl` for the exact
run_id before executing any rerun, regardless of a fresh classify-only read
([test-falcor reruns fail deterministically once the parent workflow run is stale](../learnings/1788546124300-test-falcor-reruns-fail-deterministically-once-the.md)).

That "structurally cannot / same underlying condition" narrative then over-reached:
the 403 and the artifact-expiry message are TWO different failure modes at two code
paths. Attempt 1 (artifact fresh): got a status back from external CI, then a 403 on
a subsequent call = a genuine bridge auth rejection. Attempt 2 (rerun of a stale run):
died at artifact resolution *before* triggering. The artifact-expiry failure is
manufactured by rerunning a stale run and says nothing about whether the original
bridge-403 is live. Meta-lesson: before writing a unifying "structurally cannot"
claim, actually read a second member of the class (here the *original* failure's raw
log, not just the rerun's)
([CORRECTION: test-falcor 403 and artifact-expiry are two distinct failure modes](../learnings/1788546545702-correction-test-falcor-403-and-artifact-expiry-are.md)).
Even after confirming the bridge is healthy again (a fresh unrelated run reaches it,
no 403), 6 `--failed` reruns of day-old runs failed with "artifact unavailable":
bridge health and artifact freshness are two independent preconditions — verifying
one says nothing about the other; only a fresh push regenerates a stale artifact
([Falcor bridge-403 confirmation must also check build-artifact age, not just bridge health](../learnings/1788589902152-falcor-bridge-403-confirmation-must-also-check-bui.md)).

## Flake vs. real: master merge breaks and the master branch name

When a PR's `test-slang` fails **deterministically on every platform (incl.
CPU-only/aarch64, no GPU) right after a rebase** and the failing tests are unrelated
to the diff, suspect a master-level semantic merge conflict, not the PR. Concrete
case: #12830 added warning E40021 while #12828 (last to touch the affected autodiff
tests) merged ~2 min earlier without it — neither PR's CI saw the other, so master
ships tests that trigger an un-annotated warning, and every rebasing PR inherits the
red. Recipe: find the deterministic failure on a CPU/aarch64 job; attribute the
diagnostic with `git log origin/master -S "<text>"` and `git log -- <testfile>`;
prove master is broken independent of the PR. Action: file the fix against master,
tell the innocent author to rebase after — do NOT push a fix onto their PR. Contrast:
a `test-falcor` 403/download/VCS-root failure in ~18s (never compiled a shader) is
infra
([post-rebase cross-platform test-slang failure is often a master semantic-merge break, not the PR](../learnings/1788457867847-post-rebase-cross-platform-test-slang-failure-on-a.md)).
Note `shader-slang/slang`'s default branch is `master` — a `--branch main` /
`sha=main` query silently 404s and can look like "no base-branch CI run found,"
wrongly reading a BEHIND-master PR as a live regression. Prefer `gh pr view --json
mergeStateStatus`: `BEHIND` + a failing test that a recent master commit touched
distinguishes "needs rebase" from "regression on master" with no live master run
([shader-slang/slang default branch is master, not main](../learnings/1788675668651-shader-slang-slang-default-branch-is-master-not-ma.md)).
A recurring nightly red is not always a new regression: the "Nightly Slang Test"
`agentic-tests` job failed two nights with the exact same 6 test names — fully
explained by open PR #12881 (adds them to expected-failures) and will stay red until
it merges; check `expected-failures.txt` / #12881 before re-flagging. Diffing
`FAILED test:` lines across nights' job logs (via `.../jobs/{job_id}/logs`) gives a
stable fingerprint
([Nightly Slang Test agentic-tests: 2-night failure is a known, already-tracked cluster](../learnings/1788428378771-slang-nightly-slang-test-agentic-tests-2-night-fai.md)).

## Heartbeat monitoring reliability

The heartbeat precheck's `workflow_failures.slang` field returns stale/wrong data
(days-old runs, wrong `total_count`) while `slangpy`/`slang-rhi` in the same payload
are correct — first seen as a possible cache/CDN one-off, then confirmed a **3rd
occurrence** of the same failure mode isolated to slang's fetch iteration. Treat it
as a standing characteristic: always spot-check slang's raw field against a live API
call every wake before trusting it. Distinguish "recurring, same repo, same shape,
3+ times" (actionable — spot-check every wake) from "single anomalous read that
self-corrects on immediate retry" (not actionable — retry once)
([heartbeat precheck workflow_failures returned stale data for slang only](../learnings/1788404324277-heartbeat-precheck-workflow-failures-fetch-returne.md),
[heartbeat precheck's slang workflow_failures staleness confirmed recurring (3rd occurrence)](../learnings/1788410539745-heartbeat-precheck-s-slang-workflow-failures-stale.md)).
Separately, when a report carries a "since <anchor>, now ~Nh" duration across many
wakes, periodically recompute N directly from the anchor timestamp — not "last figure
+ elapsed since last wake." A base error (a ~24h off-by-one-day slip) survives
indefinitely because every delta looks locally consistent; smooth incrementation is
exactly what a base error looks like from the inside. One carried figure read "~59h"
when the anchor-to-now was actually ~31h
([heartbeat: verify the base, not just the deltas, on durations carried across many wakes](../learnings/1788393885068-heartbeat-verify-the-base-not-just-the-deltas-on-d.md)).

A single-workflow-attributable queue spike on a schedule-cron workflow is expected weekly load, not an infra incident — before flagging a `jobs_queued`/`hosted_runner_usage` Critical (e.g. `jobs_queued=93` past a >50 threshold with the hosted-runner cap maxed at 60/60), attribute the backlog to its dominant workflow and read *that workflow's trigger config*. The "CMake Options" workflow runs `schedule: cron "0 8 * * 6"` (Saturday 08:00 UTC) + `workflow_dispatch` only, and its OS-matrix fan-out (Windows/macOS/Linux/ARM64) consuming up to half the org's hosted-runner budget is a **known, accepted cost** — its `merge_group` trigger was deliberately removed for exactly that reason, keeping only the weekly run + ad-hoc dispatch; the GCP self-hosted pools sitting idle meanwhile is also expected (it targets GH-hosted runners only). So on a Saturday with "CMake Options" dominating the queue, downgrade to informational/🟢, not 🔴. More generally, a `workflow_dispatch`+`schedule` fan-out is a different failure mode than unbounded/regression-driven queue growth — check the trigger config before escalating a queue reading as an infra problem ([Saturday "CMake Options" queue saturation is expected weekly load, not Critical](../learnings/1789812585102-slang-ci-saturday-cmake-options-queue-saturation-i.md)).

## Maintainer readying a bot draft PR

A bot-authored *draft* PR can be legitimately flipped to ready-for-review by a
maintainer themselves (a `ready_for_review` timeline event) — this must NOT be
reverted; the "drafts only / never `gh pr ready`" rule constrains *our* actions, not
the maintainer's. Check the timeline actor before assuming a ready PR means we
readied it. Consequence: with "dismiss stale reviews on push" enabled (slang has it),
a subsequent force-push of review fixes dismisses the approval (`reviewDecision:
REVIEW_REQUIRED`) — expected, not an error; say so in the report when the delta is
doc/comment/test-only. Once a PR is ready, `ci.yml` auto-runs on synchronize — do NOT
`gh workflow run ci.yml` again (duplicate run; manual dispatch is only for drafts)
([maintainer readying a bot draft PR + force-push dismisses the approval](../learnings/1788380981281-maintainer-readying-a-bot-draft-pr-force-push-dism.md)).

## Perf and benchview infrastructure

The perf-CI landscape (epic #12941): **compile-TIME perf alerting is mature and is
the ready fork template** — `nightly-mdl-perf-test.yml` has a separate `analyze` job
running `tools/compile-perf/trend.py` (two-tier `--rel 1.10` = 10% gate) posting to a
Slack channel; results store is the external repo `shader-slang/slang-compile-perf`
(gh-pages dashboard). **RUNTIME perf alerting is greenfield** — the runtime path is
pass/fail only, metrics land in benchview (NVIDIA-internal) via a GitLab Falcor2
bridge, needing a maintainer LOCUS decision. Egress gotcha to reuse: the NVIDIA
perf-pool runner's proxy DENIES CONNECT to hooks.slack.com, which is *why* the analyze
job is split onto a GitHub-hosted runner
([compile-perf is the fork template, runtime perf is greenfield](../learnings/1788881870741-slang-perf-alerting-compile-perf-is-the-fork-templ.md)).

Grounding facts, several of which correct circulating mislabels — source-verify
inherited perf claims before repeating them:

- **MDL benchmark results push to a PRIVATE repo.**
  `perf-push-benchmark-results.yml` runs `tools/benchmark/compile.py --samples 16
  --target dxil` (a COMPILE-TIME MDL sweep, NOT runtime) and pushes `benchmarks.json`
  to the private `shader-slang/slang-material-modules-benchmark` via a PAT. A public
  benchview instance's core decision is whether those results can be exposed publicly
  — an ops/security/hosting decision, not a compiler-code task
  ([benchview results land in a PRIVATE repo — the crux of the public/internal split](../learnings/1788881853471-slang-benchview-results-land-in-a-private-repo-the.md)).
  A prior learning mislabeled this workflow "runtime benchmark pipeline"; it is
  compile-time MDL, not runtime
  ([perf-alerting facts corrected: perf-push-benchmark-results.yml is COMPILE-TIME MDL](../learnings/1788884756637-slang-perf-alerting-facts-corrected-perf-push-benc.md)).
- **"benchview" is a downstream-consumer-by-URL, not in-tree infra.** It appears only
  in `tools/compile-perf/bench.py` COMMENTS (raw samples retained so a downstream
  BenchView format can recompute summaries); there is no ingestion code, endpoint, or
  creds. "benchview appears nowhere in the repo" is FALSE, but so is "benchview
  integration exists" — the accurate claim is "no public-repo Falcor
  runtime→BenchView publishing integration exists." Verify an audit target branch
  actually exists before auditing (`dev/ccummings/benchview` does not)
  ([benchview is a downstream-consumer-by-URL, not in-tree infra](../learnings/1788882146534-slang-benchview-is-a-downstream-consumer-by-url-no.md),
  [perf-alerting facts corrected: benchview IS in-repo (bench.py comments only)](../learnings/1788884756637-slang-perf-alerting-facts-corrected-perf-push-benc.md)).
- **compile-perf emit workloads all share one shader by design.** Every codegen
  workload uses `gen=workloads.gen_codegen`, differing only in `-target`, to isolate
  the emit path per target. So the suite lacks backend-DISTINCTIVE *source shapes*,
  not backend coverage — improving backend targeting means adding generators that
  stress each backend's characteristic legalization, not more `-target` variants. The
  suite is compile-time-only and nightly-weight (no fast/per-PR tier);
  `check-python-core.yml` hard-codes the module import list, so renaming a
  `tools/compile-perf/*.py` module without updating it turns CI red
  ([compile-perf emit_* workloads all share one shader (gen_codegen) by design](../learnings/1788881942527-compile-perf-emit-workloads-all-share-one-shader-g.md)).
- A straight fork of the compile-perf Slack template does NOT satisfy a rich-alert
  spec (it emits only a generic sentence with no magnitude or commit/PR link), and
  `trend.py`'s adaptive trailing-median does NOT detect gradual drift
  ([perf-alerting facts corrected](../learnings/1788884756637-slang-perf-alerting-facts-corrected-perf-push-benc.md)).

Routing note across these facts: perf-epic sub-tasks are maintainer-curated,
sprint-planned, no-repro, ops/infra-not-compiler — don't auto-dispatch a fixer;
triage + 5-bullet + report up.

## Triaging the Nightly MDL Perf Test gate: split resize-noise from real regressions

When `trend.py`'s compile-perf gate flags a nightly MDL Perf Test failure with many workloads/metrics lit at once, don't treat it as one blob — split it. (1) **Check for a disclosed benchmark-methodology change first:** search recently-merged PRs touching `tools/compile-perf/lib/manifest.py` for `default_size`/`sweep_sizes` edits — a human-reviewed PR that changed a workload's `default_size` often *predicts* the expected before/after ratio in its body (e.g. Slang PR #13035 said "one night of movement on those four workloads is expected"), so a flagged workload matching that predicted list+ratio is NOT a regression, just the gate correctly detecting an intentional disclosed change. (2) **What's left after removing resize-explained workloads is the real signal** — look at which *timer* flagged, not just which workload: a genuine localized pass regression shows up in a sub-pass timer (`specializeModule`, `simplifyIR`, `linkAndOptimizeIR`) while the workload's own `compileInner` (full wall-clock) stays clean (the regression is a fraction of total time, below the workload-level ratio threshold); if `compileInner` also moves for every workload, suspect host/runner contention instead. (3) **Narrow suspects to PRs touching `source/slang/core.meta.slang` / `hlsl.meta.slang`** — the shared core/HLSL prelude is checked+specialized on every single compile (`bench.py` spawns a fresh `slangc` per sample, no cross-process module cache), so adding generic functions/overloads there inflates `specializeModule`/`simplifyIR` broadly across unrelated workloads (easy to miss because a title like "Support generic builtin vector dot products" gives no perf hint). (4) Cross-reference self-merge status (author == merged_by, no APPROVED review) on candidate PRs in the window — a fast signal for where review rigor was lowest, not proof of causation. Worked example (2026-09-19): 4 workloads' 2.4-10x jumps → PR #13035 resize (not a regression); a separate ~1.7-2.4x `specializeModule`/`simplifyIR` jump on other workloads → traced to self-merged #13138/#13135 adding new generics to the core/HLSL prelude ([separating disclosed benchmark-resize noise from genuine compiler perf regressions](../learnings/1789805493629-separating-disclosed-benchmark-resize-noise-from-g.md)).

**Source learnings (18):**

- [Maintainer readying a bot draft PR + force-push dismisses the approval](../learnings/1788380981281-maintainer-readying-a-bot-draft-pr-force-push-dism.md) — check the timeline actor before assuming we readied a PR; a force-push dismissal is expected; don't re-dispatch ci.yml on a ready PR.
- [Heartbeat: verify the base, not just the deltas, on durations carried across many wakes](../learnings/1788393885068-heartbeat-verify-the-base-not-just-the-deltas-on-d.md) — re-derive "since <anchor>, now ~Nh" from the anchor; a base error survives indefinitely under delta-only checks.
- [Heartbeat precheck workflow_failures fetch returned stale data for slang only](../learnings/1788404324277-heartbeat-precheck-workflow-failures-fetch-returne.md) — slang's field alone returned days-old runs while slangpy/slang-rhi were correct; spot-check against a live API call.
- [slang CI: Saturday "CMake Options" queue saturation is expected weekly load, not Critical](../learnings/1789812585102-slang-ci-saturday-cmake-options-queue-saturation-i.md) — a single-workflow spike on a `schedule`+`workflow_dispatch` cron (Saturday 08:00 UTC OS matrix, ~half the hosted-runner cap by design) is accepted weekly cost; check the dominant workflow's triggers before flagging jobs_queued/hosted_runner_usage 🔴.
- [Heartbeat precheck's slang workflow_failures staleness confirmed recurring (3rd occurrence)](../learnings/1788410539745-heartbeat-precheck-s-slang-workflow-failures-stale.md) — treat as a standing characteristic; distinguish recurring-same-shape from a single self-correcting anomaly.
- [slang Nightly Slang Test agentic-tests: 2-night failure is a known, already-tracked cluster](../learnings/1788428378771-slang-nightly-slang-test-agentic-tests-2-night-fai.md) — same 6 tests explained by open PR #12881 (expected-failures); diff `FAILED test:` lines across nights for a fingerprint.
- [Post-rebase cross-platform test-slang failure on a PR is often a master semantic-merge break](../learnings/1788457867847-post-rebase-cross-platform-test-slang-failure-on-a.md) — deterministic failure on CPU/aarch64 unrelated to the diff ⇒ file against master; don't fix the innocent PR.
- [Verify causation at the failure site — a verified correlated fact is not a verified cause](../learnings/1788459591745-verify-causation-at-the-failure-site-a-verified-co.md) — read the job-log line before asserting causation; a coworker's flip-flopping root-cause label is a hypothesis.
- [test-falcor reruns fail deterministically once the parent workflow run is stale — check run age](../learnings/1788546124300-test-falcor-reruns-fail-deterministically-once-the.md) — `--failed` doesn't rebuild the artifact; a >24h-old run can't succeed; grep rerun-log.jsonl for the run_id first.
- [CORRECTION: test-falcor 403 and artifact-expiry are two distinct failure modes, not one](../learnings/1788546545702-correction-test-falcor-403-and-artifact-expiry-are.md) — a fresh 403-after-status is bridge auth; artifact-expiry is manufactured by rerunning a stale run; draw a second class member before a unifying claim.
- [Falcor bridge-403 confirmation must also check build-artifact age, not just bridge health](../learnings/1788589902152-falcor-bridge-403-confirmation-must-also-check-bui.md) — bridge health and artifact freshness are independent preconditions; only a fresh push regenerates a stale artifact.
- [shader-slang/slang default branch is master, not main](../learnings/1788675668651-shader-slang-slang-default-branch-is-master-not-ma.md) — a `main` query silently 404s; prefer `gh pr view --json mergeStateStatus` (BEHIND = needs rebase).
- [Slang benchview results land in a PRIVATE repo — the crux of the public/internal split (#12961)](../learnings/1788881853471-slang-benchview-results-land-in-a-private-repo-the.md) — MDL benchmarks push to a private repo via PAT; a public instance is an ops/security decision, not compiler code.
- [Slang perf-alerting: compile-perf is the fork template, runtime perf is greenfield (benchview)](../learnings/1788881870741-slang-perf-alerting-compile-perf-is-the-fork-templ.md) — compile-time alerting is mature (10% trend.py gate, external results repo); runtime is greenfield; Slack egress needs a GitHub-hosted runner.
- [compile-perf emit_* workloads all share one shader (gen_codegen) by design](../learnings/1788881942527-compile-perf-emit-workloads-all-share-one-shader-g.md) — the suite lacks backend-distinctive source shapes, not coverage; check-python-core.yml hard-codes the module list.
- [Slang "benchview" is a downstream-consumer-by-URL, not in-tree infra; verify audit branches exist](../learnings/1788882146534-slang-benchview-is-a-downstream-consumer-by-url-no.md) — benchview lives only in bench.py comments; confirm a named audit branch exists (four checks) before auditing.
- [Slang perf-alerting facts corrected: perf-push-benchmark-results.yml is COMPILE-TIME MDL; benchview IS in-repo (comments only)](../learnings/1788884756637-slang-perf-alerting-facts-corrected-perf-push-benc.md) — source-verify inherited learnings; a forked Slack template lacks magnitude/PR links and adaptive median misses gradual drift.
- [separating disclosed benchmark-resize noise from genuine compiler perf regressions (Nightly MDL Perf Test)](../learnings/1789805493629-separating-disclosed-benchmark-resize-noise-from-g.md) — check manifest.py default_size/sweep_sizes edits (PR body predicts the ratio); the real signal is a sub-pass timer moving while compileInner stays clean; narrow to core/hlsl.meta.slang prelude PRs; cross-ref self-merge.
