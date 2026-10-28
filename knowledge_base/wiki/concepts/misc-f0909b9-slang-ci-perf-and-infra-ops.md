---
title: "Slang CI health, heartbeat monitoring, and perf/benchview infrastructure"
type: concept
group: misc
tags: [ci-health, heartbeat, test-falcor, flake-vs-real, causation, benchview, compile-perf, perf-alerting, master-branch, nightly]
source_count: 30
---

## TL;DR

Operational facts for the Slang CI-health / maintainer / heartbeat roles:

- **Read the failing log line before asserting causation.** A verified correlated fact
  (an artifact TTL exists) is not a verified cause; the job-log line preceding
  `##[error]` settles it. Read the step's *output*, not its echoed `##[group]Run …`
  source — "LLVM prebuilt not found in GCS" matches the script's own `echo` on a cache hit.
- **test-falcor has two distinct failure modes:** a 403 after a status came back is a
  *bridge auth* rejection; "artifact unavailable (expired)" is manufactured by a
  `--failed` rerun of a >1-day-old run whose 1-day build artifact is gone. Bridge health
  and artifact freshness are independent; check both, and grep `rerun-log.jsonl` for the
  run_id before any rerun.
- **A post-rebase deterministic test-slang failure on every platform (incl.
  CPU/aarch64), unrelated to the diff, is a master semantic-merge break** — file against
  master; don't push a "fix" onto the innocent PR.
- **`shader-slang/slang`'s default branch is `master`, not `main`** — a `main` query
  silently 404s; prefer `gh pr view --json mergeStateStatus` (`BEHIND` = needs rebase).
- **Heartbeat precheck's slang `workflow_failures` field is repeat-prone stale** —
  spot-check it against a live API call every wake. Re-derive a carried "since <anchor>,
  now ~Nh" duration from the anchor, never last figure + delta.
- **The Saturday CMake Options burst (479 hosted jobs, Sat 08:00Z, ~4 h) is expected
  load**, not Critical, and blinds `health_snapshots` for ~2.5 h; a bot dispatch can
  cause it any day. Attribute a queue spike to its dominant workflow's triggers first.
- **merge_group runs skip `test-falcor`** — check the job, not the run, for "MQ Falcor passed".
- **Slang's scheduled workflows have no fork guard** (16 of 17; only `sccache-populate.yml`), so a
  fork with Actions enabled fails `ci-health.yml` every 15 min (it needs the project's GCP
  identity). Tell a contributor who complains to disable Actions on the fork; PR CI runs upstream.
- **Perf/benchview:** compile-time alerting is the mature fork template; runtime perf is
  greenfield. Since PR #13625 (2026-10-19) `tools/compile-perf/benchview.py` exports
  compile-time results to BenchView; runtime GPU and MaterialX perf have nothing in tree;
  MDL results push to a PRIVATE repo. Source-verify inherited perf "facts".
- **Per-pass compile-time A/B:** phase-scoped callgrind counts plus an ABBA wall-clock
  run, not shared-box medians. A quick per-target claim: a `tools/compile-perf` generator
  through `slangc -report-detailed-perf-benchmark` (SPIR-V: `-emit-spirv-directly -O0`).
- **Nightly MDL perf: split disclosed benchmark resizes from real regressions; a green
  night after a red one is usually a sub-threshold confirmation** (1.08× < 1.10×), not
  baseline absorption. Read `Confirmation:`; size a real step by per-timer geomeans over
  size-matched workloads from `perf-confirmation-*` artifacts (download within a week).

## Causation must be read at the failure site

A `test-falcor` cluster was diagnosed 403, then "corrected" to a ~24h artifact TTL; the
orchestrator verified the TTL *exists* and escalated "it's the TTL, disregard the 403".
The failing job log, read two days later, said `run-external-ci: trigger failed: HTTP
Error 403: Forbidden` — a ~15s auth rejection *before any artifact is fetched*. The TTL
was real and causally irrelevant. Read the failing log line (`gh run view <run-id>
--log-failed --job <job-id>`) before relaying a root cause with confidence words, and
treat a coworker's root-cause label as a hypothesis, doubly so after it flip-flopped
([verify causation at the failure site](../learnings/1788459591745-verify-causation-at-the-failure-site-a-verified-co.md)).

Reading the failure site means reading the *output*, not the step's source. GitHub
prints each step's script in its `##[group]Run …` block, so grepping job logs for "not
found in GCS" matches the setup-llvm-from-gcs step's `echo "⚠️  LLVM prebuilt not found
in GCS"` on a cache HIT as well as a miss (likewise "Downloaded LLVM prebuilt"). To
confirm a real miss, drop lines containing `echo `, look for `🔨 Building LLVM from
source`, and read `Checking for LLVM prebuilt: <url>` for the key probed. Fetch with
`--allow-escape-sequences`, strip ANSI (`sed 's/\x1b\[[0-9;]*m//g'`). This grep
nearly mis-verified a Windows LNK2019 link failure on #13526 as a cold-cache miss
([the LLVM-not-found grep matches the script echo](../learnings/1791620024633-grepping-job-logs-for-llvm-prebuilt-not-found-in-g.md)).

## test-falcor: two distinct failure modes, and the stale-rerun trap

`gh run rerun <id> --failed` reruns only the failed job, not the build jobs that made
its artifact, and the Windows-falcor build artifact has `retention-days: 1`. So a
`--failed` rerun of a run more than ~1 day old fails at artifact resolution whatever the
original error. A sweep reran 7 PRs re-classified as intermittent although their
run_ids carried a durable `legitimate` verdict; all re-failed in seconds with "artifact
unavailable (expired)." Check the run's `created_at` (>24h ⇒ do
not `--failed`-rerun), and grep `rerun-log.jsonl` for the exact run_id before any rerun,
whatever a fresh classify-only read says
([test-falcor reruns fail once the parent run is stale](../learnings/1788546124300-test-falcor-reruns-fail-deterministically-once-the.md)).

The "same underlying condition" narrative that followed over-reached: the 403 and the
artifact expiry are two failure modes on two code paths. Attempt 1 (artifact fresh) got
a status back from external CI, then a 403 on a later call — a genuine bridge auth
rejection. Attempt 2 (rerun of a stale run) died at artifact resolution *before*
triggering, so it says nothing about whether the 403 is live. Before writing a unifying
"structurally cannot" claim, read a second member of the class — here the original
failure's raw log, not only the rerun's
([CORRECTION: 403 and artifact-expiry are distinct](../learnings/1788546545702-correction-test-falcor-403-and-artifact-expiry-are.md)).
Even with the bridge confirmed healthy (a fresh unrelated run reached it, no 403), 6
`--failed` reruns of day-old runs failed with "artifact unavailable": verifying one
precondition says nothing about the other, and a test-job rerun cannot regenerate a stale
artifact ([bridge-403 confirmation must also check artifact age](../learnings/1788589902152-falcor-bridge-403-confirmation-must-also-check-bui.md)).
A `--job` rerun of `test-falcor` fails the same way, in ~19 s at `Run external CI`, with no
GitLab pipeline started. What does regenerate the artifact is a fresh push, a full rerun, or a
rerun of the producing `build-windows-release-cl-x86_64-gpu-falcor / build` job, which re-uploads
it and cascades into `test-falcor`; check `artifacts?name=slang-tests-windows-x86_64-cl-release-falcor`
(`total_count` 0 = gone) first. A rerun that reaches the bridge does submit a new Falcor pipeline
(#13886) ([test-falcor --job rerun fails in 19s once the artifact is gone](../learnings/1793081639779-test-falcor-job-rerun-fails-in-19s-once-the-run-s-.md)).

## Flake vs. real: master merge breaks and the master branch name

When `test-slang` fails **deterministically on every platform (incl. CPU-only/aarch64,
no GPU) right after a rebase** on tests unrelated to the diff, suspect a master-level
semantic merge conflict. Case: #12830 added warning E40021 while #12828 (last to touch
the affected autodiff tests) merged ~2 min earlier without it; neither PR's CI saw the
other, so master shipped tests that trigger an un-annotated warning and every rebasing
PR inherited the red. Find the failure on a CPU/aarch64 job, attribute the diagnostic with
`git log origin/master -S "<text>"` and `git log -- <testfile>`, prove master is broken
independent of the PR, fix master, and tell the innocent author to rebase. Contrast: a `test-falcor` 403/download/VCS-root failure
in ~18s, before any shader compiled, is infra
([post-rebase cross-platform failure is a master merge break](../learnings/1788457867847-post-rebase-cross-platform-test-slang-failure-on-a.md)).

`shader-slang/slang`'s default branch is `master`: a `--branch main` / `sha=main` query
silently 404s and reads as "no base-branch CI run found," wrongly making a BEHIND PR
look like a live regression. `gh pr view --json mergeStateStatus` — `BEHIND` plus a
failing test that a recent master commit touched — separates "needs rebase" from
"regression on master" with no live master run
([default branch is master, not main](../learnings/1788675668651-shader-slang-slang-default-branch-is-master-not-ma.md)).

A recurring nightly red is not always new. The "Nightly Slang Test" `agentic-tests` job
failed two nights with the same 6 test names, fully explained by open PR #12881 (adds
them to expected-failures); it stays red until that merges, so check
`expected-failures.txt` / #12881 before re-flagging. Diffing `FAILED test:` lines across
nights' job logs (`.../jobs/{job_id}/logs`) gives a stable fingerprint
([agentic-tests 2-night failure is a tracked cluster](../learnings/1788428378771-slang-nightly-slang-test-agentic-tests-2-night-fai.md)).

## Heartbeat monitoring reliability

The heartbeat precheck's `workflow_failures.slang` field returns stale data (days-old
runs, a wrong `total_count`) while `slangpy`/`slang-rhi` in the same payload match the
live API, so it is not a systemic proxy or rate-limit outage. After a **3rd occurrence**
isolated to slang's fetch, it is a standing characteristic: spot-check slang's field
against a live API call every wake. A single anomalous read that self-corrects on an
immediate retry is different: retry once
([precheck stale for slang only](../learnings/1788404324277-heartbeat-precheck-workflow-failures-fetch-returne.md),
[staleness confirmed recurring](../learnings/1788410539745-heartbeat-precheck-s-slang-workflow-failures-stale.md)).

When a report carries "since <anchor>, now ~Nh" across many wakes, recompute N from the
anchor timestamp, not "last figure + elapsed". A base error (a ~24h off-by-one-day slip)
survives indefinitely because every delta looks locally consistent; one carried figure
read "~59h" when anchor-to-now was ~31h
([verify the base, not just the deltas](../learnings/1788393885068-heartbeat-verify-the-base-not-just-the-deltas-on-d.md)).

### Scheduled workflows run on forks, and ci-health fails there every 15 minutes

At master 9a4817c881 (2026-10-27), 16 of the 17 scheduled workflows in shader-slang/slang have
no `if: github.repository == 'shader-slang/slang'` guard; only `sccache-populate.yml` has one.
`ci-health.yml` runs on `*/15 * * * *` and needs the project's GCP Workload Identity, so on a
fork with Actions enabled it fails every 15 minutes. GitHub disables workflows on new forks by
default, but until jkwak-work's direct commit 9a4817c881 `CONTRIBUTING.md` (line 54, there since
at least #5622, 2024-11) told contributors to enable them. If a contributor complains about
failing fork workflows, the answer is Settings > Actions > General > Disable actions on the fork,
because PR CI runs upstream; those reds are not upstream CI health
([scheduled workflows lack fork guards](../learnings/1793089763873-slang-scheduled-ci-workflows-lack-fork-guards-ci-h.md)).

### The Saturday CMake Options burst is expected load, and it blinds CI Health

Before flagging a `jobs_queued`/`hosted_runner_usage` Critical (e.g. `jobs_queued=93`
past a >50 threshold with the hosted cap at 60/60), attribute the backlog to its
dominant workflow and read its trigger config. "CMake Options" runs `schedule: cron "0 8
* * 6"` (Saturday 08:00 UTC) + `workflow_dispatch` only; its OS-matrix fan-out
(Windows/macOS/Linux/ARM64) taking up to half the org's hosted budget is a known,
accepted cost, which is why its `merge_group` trigger was removed. The GCP self-hosted
pools idling meanwhile is expected too. On a Saturday with CMake Options
dominating, downgrade to informational/🟢
([Saturday CMake Options saturation is expected](../learnings/1789812585102-slang-ci-saturday-cmake-options-queue-saturation-i.md)).
The dispatch need not be human or on a Saturday: on 2026-10-22 two nv-slang-bot
dispatches on #13850's branch pushed `jobs_queued` to 458 and `runs_queued` to 43, so
read `queue_by_group` / `hosted_runner_usage.queued.by_workflow` before calling a spike
a capacity outage ([bot CMake Options dispatches fill the hosted cap](../learnings/1792660471559-ci-sweep-full-ubuntu-latest-log-header-scan-exhaus.md)).

The burst (about 479 GitHub-hosted jobs) also blinds the health feed: the CI Health
`update-health` job is itself `ubuntu-latest` and cannot start, so
`health_snapshots.jsonl` has a 106–152 min gap every Saturday from about 07:50Z (5
Saturdays running through 10-17), and the first snapshot after it (jobs queued ~90–113)
is a lower bound on the peak, not a runner outage
([CMake Options burst blinds CI Health; MQ skips test-falcor](../learnings/1792312349410-slang-ci-saturday-cmake-options-burst-blinds-ci-he.md)).
On 2026-10-24 the run took 4 h 08 min (08:00→12:08Z), not the ~2 h first estimated,
holding all 60 hosted slots until ~11:15Z: a ~2.5 h snapshot gap (07:52→10:23Z),
cancelled queued CI Health and `Populate sccache` runs, a "critical" first snapshot (jq
96 / rq 31), and other `CI` runs' hosted `filter` jobs waiting ~70 min. Read its verdict
after ~12:30Z Saturday or in the Sunday report. Riders: a rate-limit sleep floor must
skip the `search` resource (30/min), and a "rerun" regex matches "not rerunning bot CI."
([CMake Options run lasts ~4 h](../learnings/1792916619171-weekly-cmake-options-run-lasts-4-h-and-blinds-the-.md)).

Three more riders from the 10-17 sweep
([same atom](../learnings/1792312349410-slang-ci-saturday-cmake-options-burst-blinds-ci-he.md)):
in `ci.yml` merge_group runs `test-falcor` is **skipped** (`falcor-build-approval-gate`
is skipped for merge_group and `test-falcor` has no `always()`; only `test-falcor-perf`
runs), so "MQ Falcor passed" needs the job's conclusion. The Actions API listing window
moves (on 10-18 `created=2026-10-12` returned 0 runs, 940 the day before), so streak
counts from `workflows/<id>/runs` can shrink day over day; carry streaks from earlier
sweeps. And through the OneCLI proxy `/rate_limit` reports unauthenticated limits (60/h,
GraphQL 0) while real calls are credentialed (6000/h); read `X-Ratelimit-*` headers on a
real call.

## Maintainer readying a bot draft PR

A maintainer may flip a bot-authored draft PR to ready-for-review (a `ready_for_review`
timeline event); do NOT revert it — "drafts only / never `gh pr ready`" constrains *our*
actions. Check the timeline actor before assuming we readied it. With "dismiss stale
reviews on push" on (slang has it), a force-push of review fixes dismisses the approval
(`reviewDecision: REVIEW_REQUIRED`) — expected; say so when the delta is
doc/comment/test-only. Once ready, `ci.yml` auto-runs on synchronize, so do NOT `gh
workflow run ci.yml` again (manual dispatch is for drafts)
([maintainer readying a bot draft PR](../learnings/1788380981281-maintainer-readying-a-bot-draft-pr-force-push-dism.md)).

## Perf and benchview infrastructure

The perf-CI landscape (epic #12941): **compile-TIME perf alerting is mature and the
ready fork template** — `nightly-mdl-perf-test.yml` has a separate `analyze` job running
`tools/compile-perf/trend.py` (two-tier `--rel 1.10` = 10% gate) that posts to Slack,
with results in the external repo `shader-slang/slang-compile-perf` (gh-pages
dashboard). **RUNTIME perf alerting is greenfield**: the runtime path is pass/fail only,
metrics land in benchview (NVIDIA-internal) via a GitLab Falcor2 bridge, and placement
needs a maintainer LOCUS decision. Egress gotcha: the NVIDIA perf-pool runner's proxy
DENIES CONNECT to hooks.slack.com, which is *why* `analyze` runs on a GitHub-hosted
runner ([compile-perf is the fork template](../learnings/1788881870741-slang-perf-alerting-compile-perf-is-the-fork-templ.md)).

Grounding facts (several correct circulated mislabels):

- **MDL benchmark results push to a PRIVATE repo.** `perf-push-benchmark-results.yml`
  runs `tools/benchmark/compile.py --samples 16 --target dxil` — a COMPILE-TIME MDL
  sweep, not runtime, despite a prior "runtime benchmark pipeline" label — and pushes
  `benchmarks.json` to private `shader-slang/slang-material-modules-benchmark` via a
  PAT. Whether a public benchview may expose those results is an ops/security/hosting
  decision, not compiler code
  ([results land in a PRIVATE repo](../learnings/1788881853471-slang-benchview-results-land-in-a-private-repo-the.md),
  [perf-alerting facts corrected](../learnings/1788884756637-slang-perf-alerting-facts-corrected-perf-push-benc.md)).
- **Compile-time results now reach BenchView from the repo; runtime results do not.**
  Until 2026-10-19 "benchview" appeared only in `tools/compile-perf/bench.py` comments
  (raw samples kept so a downstream BenchView format can recompute summaries), with no
  ingestion code, endpoint or creds — so "benchview appears nowhere in the repo" was
  false even then
  ([benchview is a downstream-consumer-by-URL](../learnings/1788882146534-slang-benchview-is-a-downstream-consumer-by-url-no.md),
  [benchview IS in-repo (comments)](../learnings/1788884756637-slang-perf-alerting-facts-corrected-perf-push-benc.md)).
  PR #13625 (master 68438b5e1, 2026-10-19) added `tools/compile-perf/benchview.py`, a
  stdlib-only exporter, plus an "Export nightly results for BenchView" step and payload
  artifact in `nightly-mdl-perf-test.yml`. Still absent: runtime GPU benchmarks and
  MaterialX perf (`ci-materialx-regression-test.yml` compiles shaders but records no
  timings); `ci-falcor2-perf-bridge-smoke.yml` is manual-dispatch only and just calls
  `/opt/slang-ci/run-external-ci` on a self-hosted runner. The same PR deleted
  `tools/compile-perf/COVERAGE-ANALYSIS.md` and moved the suite review into the README
  ([BenchView export now in tree](../learnings/1792423759686-slang-benchview-export-now-in-tree-tools-compile-p.md)).
  Verify an audit target branch exists before auditing (`dev/ccummings/benchview` does
  not; use four probes, since one 404 is not conclusive)
  ([downstream-consumer-by-URL](../learnings/1788882146534-slang-benchview-is-a-downstream-consumer-by-url-no.md)).
- **compile-perf emit workloads share one shader by design.** Every codegen workload
  uses `gen=workloads.gen_codegen`, differing only in `-target`, to isolate the emit
  path. The suite lacks backend-DISTINCTIVE source shapes, not backend coverage, so
  better backend targeting means generators that stress each backend's legalization,
  not more `-target` variants. It is compile-time-only and nightly-weight (no per-PR
  tier), and `check-python-core.yml` hard-codes the module import list, so renaming a
  `tools/compile-perf/*.py` module without updating it turns CI red
  ([emit_* workloads share gen_codegen](../learnings/1788881942527-compile-perf-emit-workloads-all-share-one-shader-g.md)).
- A straight fork of the compile-perf Slack template does NOT meet a rich-alert spec (a
  generic sentence, no magnitude or commit/PR link), and `trend.py`'s adaptive
  trailing median does NOT detect gradual drift
  ([perf-alerting facts corrected](../learnings/1788884756637-slang-perf-alerting-facts-corrected-perf-push-benc.md)).

Perf-epic sub-tasks are maintainer-curated, no-repro ops/infra work: don't
auto-dispatch a fixer; triage, 5-bullet, report up (closures and reply content:
[[wiki/concepts/agent-fixer-codex-skills-f0909b0-triage-routing-and-classification.md]]).

**Answering "does this pass change regress compile time?" deterministically.** A shared
64-core box is too noisy (load 5→119 moved medians ±10%), so scope callgrind to the phase: `valgrind --tool=callgrind --toggle-collect='Slang::linkIR*'
slangc ...` gives instruction counts identical across runs, and `callgrind_annotate
--inclusive=yes` shows which function absorbed the delta. Build Release base and fix
from one tree, differing in one file (copy `bin/` and `lib/` out; slangc's rpath is
`$ORIGIN/../lib`), pair with an ABBA-interleaved wall-clock run, and check the `.spv` is
byte-identical. The compile-perf SPIR-V workloads fail with "failed to load downstream
compiler 'spirv-opt'" unless you also build `--target slang-glslang` in Release and copy
`libslang-glslang-*.so` next to `libslang-compiler`. Don't claim "X% of total compile"
from phase-share × phase-delta: measure whole-process Ir and report a paired IQR that
sits entirely above zero
([callgrind scoped to the phase](../learnings/1791325135172-deterministic-compile-perf-a-b-for-a-slang-pass-ca.md)).

**Quick per-target evidence for a reply (under a minute).** To back "this pass is slow on CUDA", run the
suite's generator instead of quoting the README table: import it from `tools/compile-perf/lib/workloads.py` (e.g.
`gen_resource_load_chain(n)`), write the `.slang`, run `build/Release/bin/slangc <f>
-target cuda -entry computeMain -stage compute -report-detailed-perf-benchmark`, and grep
the per-pass lines (`[*] deferBufferLoad`, `simplifyNonSSAIR`). For the SPIR-V control
add `-emit-spirv-directly -O0`, which avoids the missing spirv-opt (E00100) without
building slang-glslang. On 2026-10-22 ToT (L40S): at N=640 CUDA spends ~80 ms in each of
those passes and SPIR-V under 2 ms; at N=160 CUDA is ~5 ms
([quick CUDA vs SPIR-V evidence](../learnings/1792649239351-quick-cuda-vs-spir-v-compile-time-evidence-from-th.md)).

## Triaging the Nightly MDL Perf Test gate: split resize-noise from real regressions

When `trend.py` flags a nightly with many workloads/metrics lit at once, split it.
(1) **Check for a disclosed methodology change first**: recently merged PRs touching
`tools/compile-perf/lib/manifest.py` `default_size`/`sweep_sizes` often *predict* the
before/after ratio in their body (PR #13035: "one night of movement on those four
workloads is expected"); a flagged workload matching that list and ratio is the gate
correctly detecting a disclosed change. (2) **What remains is the signal — read which
timer flagged**: a localized pass regression moves a sub-pass timer (`specializeModule`,
`simplifyIR`, `linkAndOptimizeIR`) while the workload's `compileInner` stays under the
workload-level threshold; if `compileInner` moves for every workload, suspect runner
contention. (3) **Narrow suspects to PRs touching `core.meta.slang` /
`hlsl.meta.slang`**: the shared prelude is checked and specialized on every compile
(`bench.py` spawns a fresh `slangc` per sample, no cross-process module cache), so new
generics there inflate `specializeModule`/`simplifyIR` across unrelated workloads, under
titles with no perf hint ("Support generic builtin vector dot products"). (4)
Self-merge (author == merged_by, no APPROVED review) marks where review was thinnest —
a signal, not proof. Worked example (2026-09-19): four workloads' 2.4–10×
jumps were PR #13035's resize; a separate ~1.7–2.4× `specializeModule`/`simplifyIR` jump
traced to self-merged #13138/#13135 adding generics to the prelude
([separating resize noise from real regressions](../learnings/1789805493629-separating-disclosed-benchmark-resize-noise-from-g.md)).

**A green night after a red one is usually a threshold miss, not baseline absorption.**
`analyze` compares each night to a trailing-7 median. After a 10-07 step, 10-09 went
green and one reading blamed absorption
([trailing-median baseline hides real steps](../learnings/1791619655084-nightly-mdl-perf-test-detect-real-steps-hidden-by-.md)),
but the median was still 45.9 ms on 10-09 and 10-10 (only 2 of 7 trailing nights were
post-step) and confirmation found 0 regressions: conformance measured 1.08×, under the
1.10× ERROR threshold, so it only warned. Grep the analyze log for `Confirmation:` and
`baseline: trailing 7 point(s) [...]` first
([a green night is a threshold miss](../learnings/1791622838976-nightly-compile-perf-a-green-night-after-a-red-one.md)).
The median moves only once 4 of 7 nights are post-step, after which a real step does go
quiet, so localize early against a fixed known-green night. For front-end moves after
2026-10-07, check #13445 (e2e217dd2) first: it turned `SemanticsVisitor::getTypeTags`
from a cached `aggTypeDecl->typeTags` read into a per-call field/base walk with no `-Gec`
gate (filed as #13565).

**Size a step with per-timer geomeans, not the `analyze` flags.** The `analyze` table
lists only counters over ratio ≥1.1 / abs ≥2 ms against the trailing median, and chronic
noise makes lone flags unreliable. `gh run download <run-id> --repo shader-slang/slang -p
'perf-confirmation-*'` gives `results.json` (per workload: `size`, `timers.<name>.median`);
older nights live in shader-slang/slang-compile-perf `daily/<date>-<sha>/results.json`
(`gh api … -H 'Accept: application/vnd.github.raw'`). Keep workloads whose `size` matches
between nights (and a ≥1 ms baseline, which reproduced the checker's numbers exactly),
then take the geomean ratio per timer against the fixed green night. A real front-end
regression moves one phase broadly while `linkAndOptimizeIR`, `loadBuiltinModule` and
other backend/IR timers stay ~1.00; runner noise moves every phase together and rotates
nightly. Measured: SemanticChecking up in 48/54 workloads (~1.075×) after 10-07
([per-timer geomean vs a fixed green night](../learnings/1791619655084-nightly-mdl-perf-test-detect-real-steps-hidden-by-.md));
on the 10-16 nightly SemanticChecking 1.052 vs 10-12 (1.042 vs 10-15 alone), 39/54
workloads above the prior four nights' max, with only #13537/#13615/#13626 in the window.
The per-push store (slang-material-modules-benchmark) is DXIL-only, 7 metrics,
bimodal across runners: it cannot localize a front-end shift. Artifacts expire after
about a week (10-07/10-08 runs returned 404 on 10-16), so record geomeans durably when
sizing a step
([MDL perf nightly per-timer geomeans](../learnings/1792138989940-mdl-perf-nightly-size-a-front-end-step-with-per-ti.md)).

**Source learnings (30):**

- [Maintainer readying a bot draft PR + force-push dismisses the approval](../learnings/1788380981281-maintainer-readying-a-bot-draft-pr-force-push-dism.md) — check the timeline actor before assuming we readied a PR; a force-push dismissal is expected; don't re-dispatch ci.yml on a ready PR.
- [Heartbeat: verify the base, not just the deltas, on durations carried across many wakes](../learnings/1788393885068-heartbeat-verify-the-base-not-just-the-deltas-on-d.md) — re-derive "since <anchor>, now ~Nh" from the anchor; a base error survives indefinitely under delta-only checks.
- [Heartbeat precheck workflow_failures fetch returned stale data for slang only](../learnings/1788404324277-heartbeat-precheck-workflow-failures-fetch-returne.md) — slang's field alone returned days-old runs while slangpy/slang-rhi were correct; spot-check against a live API call.
- [slang CI: Saturday "CMake Options" queue saturation is expected weekly load, not Critical](../learnings/1789812585102-slang-ci-saturday-cmake-options-queue-saturation-i.md) — a single-workflow spike on a `schedule`+`workflow_dispatch` cron (Saturday 08:00 UTC OS matrix, ~half the hosted-runner cap by design) is accepted weekly cost; check the dominant workflow's triggers before flagging jobs_queued/hosted_runner_usage 🔴.
- [Slang CI: Saturday CMake Options burst blinds CI Health; MQ skips test-falcor](../learnings/1792312349410-slang-ci-saturday-cmake-options-burst-blinds-ci-he.md)
- [Weekly CMake Options run lasts ~4 h and blinds the CI Health snapshots](../learnings/1792916619171-weekly-cmake-options-run-lasts-4-h-and-blinds-the-.md) — measured 4 h 08 min run, ~2.5 h snapshot gap
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
- [Slang BenchView export now in tree (tools/compile-perf/benchview.py, PR #13625)](../learnings/1792423759686-slang-benchview-export-now-in-tree-tools-compile-p.md) — corrects "comments only": exporter + nightly export step; runtime GPU/MaterialX perf still absent; Falcor2 perf workflow manual-only.
- [separating disclosed benchmark-resize noise from genuine compiler perf regressions (Nightly MDL Perf Test)](../learnings/1789805493629-separating-disclosed-benchmark-resize-noise-from-g.md) — check manifest.py default_size/sweep_sizes edits (PR body predicts the ratio); the real signal is a sub-pass timer moving while compileInner stays clean; narrow to core/hlsl.meta.slang prelude PRs; cross-ref self-merge.
- [Grepping job logs for "LLVM prebuilt not found in GCS" matches the script echo, not the output](../learnings/1791620024633-grepping-job-logs-for-llvm-prebuilt-not-found-in-g.md) — `##[group]Run` prints the step source; drop `echo ` lines, look for "Building LLVM from source".
- [Nightly MDL Perf Test: detect real steps hidden by trailing-median baseline](../learnings/1791619655084-nightly-mdl-perf-test-detect-real-steps-hidden-by-.md) — per-timer geomean vs a fixed green night; one phase shifting broadly = real, all phases together = runner noise.
- [Nightly compile-perf: a green night after a red one is a threshold miss, not baseline absorption](../learnings/1791622838976-nightly-compile-perf-a-green-night-after-a-red-one.md) — median unchanged, 1.08× < 1.10× ERROR; grep `Confirmation:`; #13445 getTypeTags walk suspect (#13565).
- [Deterministic compile-perf A/B for a Slang pass: callgrind scoped to the phase](../learnings/1791325135172-deterministic-compile-perf-a-b-for-a-slang-pass-ca.md) — --toggle-collect on the phase gives run-identical Ir; build slang-glslang for SPIR-V workloads; report whole-process Ir, not phase-share x delta (PR #13236).
- [Quick CUDA vs SPIR-V compile-time evidence from the compile-perf generators](../learnings/1792649239351-quick-cuda-vs-spir-v-compile-time-evidence-from-th.md) — import a `workloads.py` generator, `-report-detailed-perf-benchmark`; SPIR-V control needs `-emit-spirv-directly -O0`; N=640: CUDA ~80 ms/pass vs SPIR-V <2 ms
- [MDL perf nightly: size a front-end step with per-timer geomeans from perf-confirmation artifacts](../learnings/1792138989940-mdl-perf-nightly-size-a-front-end-step-with-per-ti.md) — size-matched workloads vs a fixed green night; artifacts expire ~1 week
- [CI sweep: full ubuntu-latest log-header scan exhausts the shared 6000/hr REST budget](../learnings/1792660471559-ci-sweep-full-ubuntu-latest-log-header-scan-exhaus.md) — rider: two nv-slang-bot CMake Options dispatches pushed jobs_queued to 458; read `queue_by_group` first (quota half on the agent-ops page)
- [Slang scheduled CI workflows lack fork guards; ci-health fails every 15 min on forks with Actions on](../learnings/1793089763873-slang-scheduled-ci-workflows-lack-fork-guards-ci-h.md) — 16 of 17 unguarded; CONTRIBUTING.md told contributors to enable Actions until 9a4817c881; advise disabling on the fork
- [test-falcor --job rerun fails in 19s once the run's slang-tests-* artifact is gone](../learnings/1793081639779-test-falcor-job-rerun-fails-in-19s-once-the-run-s-.md) — rerun the falcor build job; reruns do submit a new pipeline
