---
title: "Slang CI health, heartbeat monitoring, and perf/benchview infrastructure"
type: concept
group: misc
tags: [ci-health, heartbeat, test-falcor, flake-vs-real, causation, benchview, compile-perf, perf-alerting, master-branch, nightly]
source_count: 28
---

# Slang CI health, heartbeat monitoring, and perf/benchview infrastructure

Operational facts for the Slang CI-health / maintainer / heartbeat roles: reading failures at the source, test-falcor rerun traps, heartbeat data quality, weekly load, and the compile-perf/BenchView landscape.

## TL;DR

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
  greenfield. BenchView is a downstream consumer by URL, and MDL results push to a PRIVATE
  repo. Source-verify inherited perf "facts" against the current tree.
- **Per-pass compile-time A/B:** phase-scoped callgrind counts plus an ABBA wall-clock
  run, not shared-box medians.
- **Nightly MDL perf: split disclosed benchmark resizes from real regressions; a green
  night after a red one is usually a sub-threshold confirmation** (1.08× < 1.10×), not
  baseline absorption. Read `Confirmation:`; size a real step by per-timer geomeans over
  size-matched workloads from `perf-confirmation-*` artifacts (download within a week).

## Causation must be read at the failure site

A `test-falcor` cluster was diagnosed 403, "corrected" to a ~24h artifact TTL, and escalated as "it's the TTL" once the TTL was verified to *exist*. The failing job log said `run-external-ci: trigger failed: HTTP Error 403: Forbidden`, a ~15s auth rejection *before any artifact is fetched*: the TTL was real and causally irrelevant. Read the failing line (`gh run view <run-id> --log-failed --job <job-id>`) before relaying a root cause with confidence words, and treat a coworker's root-cause label as a hypothesis, doubly so after it flip-flopped ([verify causation at the failure site](../learnings/1788459591745-verify-causation-at-the-failure-site-a-verified-co.md)).

Read the *output*, not the step's source. GitHub prints each step's script in its `##[group]Run …` block, so grepping for "not found in GCS" matches setup-llvm-from-gcs's `echo "⚠️  LLVM prebuilt not found in GCS"` on a cache HIT too (likewise "Downloaded LLVM prebuilt"). To confirm a real miss, drop lines containing `echo `, look for `🔨 Building LLVM from source`, and read `Checking for LLVM prebuilt: <url>` for the probed key. Fetch with `--allow-escape-sequences`, strip ANSI (`sed 's/\x1b\[[0-9;]*m//g'`). This grep nearly mis-verified a Windows LNK2019 failure on #13526 as a cold-cache miss ([LLVM-not-found grep matches the echo](../learnings/1791620024633-grepping-job-logs-for-llvm-prebuilt-not-found-in-g.md)).

## test-falcor: two distinct failure modes, and the stale-rerun trap

`gh run rerun <id> --failed` reruns only the failed job, not the build jobs that made its artifact, and the Windows-falcor build artifact has `retention-days: 1`. So a `--failed` rerun of a run older than ~1 day fails at artifact resolution whatever the original error. A sweep reran 7 PRs whose run_ids carried a durable `legitimate` verdict; all re-failed in seconds with "artifact unavailable (expired)." Check `created_at` (>24h ⇒ no `--failed` rerun) and grep `rerun-log.jsonl` for the run_id before any rerun, whatever a fresh classify-only read says ([reruns fail once the parent run is stale](../learnings/1788546124300-test-falcor-reruns-fail-deterministically-once-the.md)).

The 403 and the artifact expiry are two failure modes on two code paths. A fresh run got a status back from external CI, then a 403: a genuine bridge auth rejection. A rerun of a stale run died at artifact resolution *before* triggering, so it says nothing about the 403. Before a unifying "structurally cannot" claim, read a second class member — here the original failure's raw log ([CORRECTION: 403 and expiry are distinct](../learnings/1788546545702-correction-test-falcor-403-and-artifact-expiry-are.md)). With the bridge confirmed healthy, 6 `--failed` reruns of day-old runs still failed "artifact unavailable": the two preconditions are independent, and a test-job rerun cannot regenerate a stale artifact ([bridge-403 check must include artifact age](../learnings/1788589902152-falcor-bridge-403-confirmation-must-also-check-bui.md)). A `--job` rerun of `test-falcor` fails the same way in ~19 s at `Run external CI`, with no GitLab pipeline. A fresh push, a full rerun, or a rerun of the producing `build-windows-release-cl-x86_64-gpu-falcor / build` job regenerates it and cascades into `test-falcor`; check `artifacts?name=slang-tests-windows-x86_64-cl-release-falcor` (`total_count` 0 = gone) first. A rerun that reaches the bridge does submit a new Falcor pipeline (#13886) ([--job rerun fails in 19s](../learnings/1793081639779-test-falcor-job-rerun-fails-in-19s-once-the-run-s-.md)).

## Flake vs. real: master merge breaks and the master branch name

When `test-slang` fails **deterministically on every platform (incl. CPU-only/aarch64) right after a rebase** on tests unrelated to the diff, suspect a master semantic merge conflict. Case: #12830 added warning E40021 while #12828 (last to touch the affected autodiff tests) merged ~2 min earlier without it; neither CI saw the other, so every rebasing PR inherited the red. Find the failure on a CPU/aarch64 job, attribute the diagnostic with `git log origin/master -S "<text>"` and `git log -- <testfile>`, prove master is broken independent of the PR, fix master, and tell the innocent author to rebase. Contrast: a `test-falcor` 403/download/VCS-root failure in ~18s, before any shader compiled, is infra ([post-rebase failure is a master merge break](../learnings/1788457867847-post-rebase-cross-platform-test-slang-failure-on-a.md)).

The default branch is `master`: a `--branch main` / `sha=main` query silently 404s and reads as "no base-branch CI run found," making a BEHIND PR look like a live regression. `gh pr view --json mergeStateStatus` (`BEHIND` plus a failing test a recent master commit touched) separates "needs rebase" from "regression on master" ([default branch is master](../learnings/1788675668651-shader-slang-slang-default-branch-is-master-not-ma.md)).

A recurring nightly red is not always new: the "Nightly Slang Test" `agentic-tests` job failed two nights with the same 6 tests, explained by open PR #12881 (adds them to expected-failures); check `expected-failures.txt` / #12881 before re-flagging. Diffing `FAILED test:` lines across nights' job logs (`.../jobs/{job_id}/logs`) gives a stable fingerprint ([agentic-tests is a tracked cluster](../learnings/1788428378771-slang-nightly-slang-test-agentic-tests-2-night-fai.md)).

## Heartbeat monitoring reliability

The precheck's `workflow_failures.slang` field returns stale data (days-old runs, a wrong `total_count`) while `slangpy`/`slang-rhi` in the same payload match the live API, so it is not a proxy or rate-limit outage. After a **3rd occurrence** it is a standing characteristic: spot-check slang's field against a live API call every wake. A single anomalous read that self-corrects on immediate retry is different: retry once ([precheck stale for slang only](../learnings/1788404324277-heartbeat-precheck-workflow-failures-fetch-returne.md), [staleness confirmed recurring](../learnings/1788410539745-heartbeat-precheck-s-slang-workflow-failures-stale.md)).

When a report carries "since <anchor>, now ~Nh" across wakes, recompute N from the anchor, not "last figure + elapsed": a base error (a ~24h slip) survives indefinitely because every delta looks consistent; one figure read "~59h" when anchor-to-now was ~31h ([verify the base, not just the deltas](../learnings/1788393885068-heartbeat-verify-the-base-not-just-the-deltas-on-d.md)).

### Scheduled workflows run on forks, and ci-health fails there every 15 minutes

At master 9a4817c881 (2026-10-27), 16 of 17 scheduled workflows lack an `if: github.repository == 'shader-slang/slang'` guard; only `sccache-populate.yml` has one. `ci-health.yml` runs `*/15 * * * *` and needs the project's GCP Workload Identity, so a fork with Actions enabled fails every 15 minutes. GitHub disables workflows on new forks, but until jkwak-work's commit 9a4817c881 `CONTRIBUTING.md` (line 54, since at least #5622) told contributors to enable them. Answer a complaint with Settings > Actions > General > Disable actions on the fork; PR CI runs upstream and those reds are not upstream CI health ([scheduled workflows lack fork guards](../learnings/1793089763873-slang-scheduled-ci-workflows-lack-fork-guards-ci-h.md)).

### The Saturday CMake Options burst is expected load, and it blinds CI Health

Before flagging a `jobs_queued`/`hosted_runner_usage` Critical (e.g. `jobs_queued=93` past >50 with hosted cap 60/60), attribute the backlog to its dominant workflow and read its triggers. "CMake Options" runs `schedule: cron "0 8 * * 6"` (Saturday 08:00 UTC) + `workflow_dispatch` only; its OS-matrix fan-out taking up to half the org's hosted budget is accepted (why its `merge_group` trigger was removed), and idle GCP self-hosted pools meanwhile are expected. On a Saturday with CMake Options dominating, downgrade to informational/🟢 ([Saturday saturation is expected](../learnings/1789812585102-slang-ci-saturday-cmake-options-queue-saturation-i.md)). The dispatch need not be human or Saturday: on 2026-10-22 two nv-slang-bot dispatches on #13850's branch pushed `jobs_queued` to 458 and `runs_queued` to 43, so read `queue_by_group` / `hosted_runner_usage.queued.by_workflow` before calling a spike a capacity outage ([bot dispatches fill the hosted cap](../learnings/1792660471559-ci-sweep-full-ubuntu-latest-log-header-scan-exhaus.md)).

The burst (~479 hosted jobs) blinds the health feed: CI Health's `update-health` job is itself `ubuntu-latest` and cannot start, so `health_snapshots.jsonl` has a 106–152 min gap every Saturday from ~07:50Z, and the first snapshot after it (jobs queued ~90–113) is a lower bound on the peak, not a runner outage ([burst blinds CI Health](../learnings/1792312349410-slang-ci-saturday-cmake-options-burst-blinds-ci-he.md)). On 2026-10-24 the run took 4 h 08 min (08:00→12:08Z), holding all 60 hosted slots until ~11:15Z: a ~2.5 h snapshot gap, cancelled queued CI Health and `Populate sccache` runs, a "critical" first snapshot (jq 96 / rq 31), and other `CI` runs' hosted `filter` jobs waiting ~70 min. Read its verdict after ~12:30Z Saturday or in the Sunday report. Riders: a rate-limit sleep floor must skip the `search` resource (30/min), and a "rerun" regex matches "not rerunning bot CI." ([run lasts ~4 h](../learnings/1792916619171-weekly-cmake-options-run-lasts-4-h-and-blinds-the-.md)).

More riders ([same atom](../learnings/1792312349410-slang-ci-saturday-cmake-options-burst-blinds-ci-he.md)): in `ci.yml` merge_group runs `test-falcor` is **skipped** (`falcor-build-approval-gate` skips for merge_group and `test-falcor` has no `always()`; only `test-falcor-perf` runs), so "MQ Falcor passed" needs the job's conclusion. The Actions API listing window moves (on 10-18 `created=2026-10-12` returned 0 runs, 940 the day before), so streak counts from `workflows/<id>/runs` can shrink; carry streaks from earlier sweeps. Through the OneCLI proxy `/rate_limit` reports unauthenticated limits (60/h, GraphQL 0) while real calls are credentialed (6000/h); read `X-Ratelimit-*` headers on a real call.

## Maintainer readying a bot draft PR

A maintainer may flip a bot-authored draft to ready-for-review (a `ready_for_review` timeline event); do NOT revert it: "drafts only / never `gh pr ready`" constrains *our* actions. Check the timeline actor first. With "dismiss stale reviews on push" on (slang has it), a force-push of review fixes dismisses the approval (`reviewDecision: REVIEW_REQUIRED`), which is expected; say so when the delta is doc/comment/test-only. Once ready, `ci.yml` auto-runs on synchronize, so do NOT `gh workflow run ci.yml` again ([maintainer readying a bot draft PR](../learnings/1788380981281-maintainer-readying-a-bot-draft-pr-force-push-dism.md)).

## Perf and benchview infrastructure

Perf-CI landscape (epic #12941): **compile-TIME alerting is mature and the fork template**: `nightly-mdl-perf-test.yml` has a separate `analyze` job running `tools/compile-perf/trend.py` (`--rel 1.10` = 10% gate) that posts to Slack, with results in external repo `shader-slang/slang-compile-perf` (gh-pages dashboard). **RUNTIME alerting is greenfield**: the runtime path is pass/fail only, metrics reach benchview (NVIDIA-internal) via a GitLab Falcor2 bridge, and placement needs a maintainer LOCUS decision. The NVIDIA perf-pool runner's proxy DENIES CONNECT to hooks.slack.com, which is *why* `analyze` runs on a GitHub-hosted runner ([compile-perf is the fork template](../learnings/1788881870741-slang-perf-alerting-compile-perf-is-the-fork-templ.md)).

Grounding facts (correcting circulated mislabels):

- **MDL benchmark results push to a PRIVATE repo.** `perf-push-benchmark-results.yml` runs `tools/benchmark/compile.py --samples 16 --target dxil`, a COMPILE-TIME MDL sweep (not runtime), and pushes `benchmarks.json` to private `shader-slang/slang-material-modules-benchmark` via a PAT. Exposing them on a public benchview is an ops/security/hosting decision, not compiler code ([results in a PRIVATE repo](../learnings/1788881853471-slang-benchview-results-land-in-a-private-repo-the.md), [perf-alerting facts corrected](../learnings/1788884756637-slang-perf-alerting-facts-corrected-perf-push-benc.md)).
- **BenchView is a downstream consumer by URL.** In the 2026-09 audits "benchview" appeared only in `tools/compile-perf/bench.py` comments (raw samples kept for a downstream BenchView format), with no ingestion code, endpoint or creds ([downstream-consumer-by-URL](../learnings/1788882146534-slang-benchview-is-a-downstream-consumer-by-url-no.md), [benchview IS in-repo (comments)](../learnings/1788884756637-slang-perf-alerting-facts-corrected-perf-push-benc.md)). Verify an audit branch exists before auditing (`dev/ccummings/benchview` does not; use four probes, one 404 is not conclusive) ([downstream-consumer-by-URL](../learnings/1788882146534-slang-benchview-is-a-downstream-consumer-by-url-no.md)).
- **compile-perf emit workloads share one shader by design.** Every codegen workload uses `gen=workloads.gen_codegen`, differing only in `-target`, to isolate the emit path. The suite lacks backend-DISTINCTIVE source shapes, not coverage, so better targeting means generators stressing each backend's legalization. It is compile-time-only and nightly-weight, and `check-python-core.yml` hard-codes the module import list, so renaming a `tools/compile-perf/*.py` module without updating it turns CI red ([emit_* share gen_codegen](../learnings/1788881942527-compile-perf-emit-workloads-all-share-one-shader-g.md)).
- A straight fork of the compile-perf Slack template does NOT meet a rich-alert spec (no magnitude or commit/PR link), and `trend.py`'s adaptive trailing median does NOT detect gradual drift ([perf-alerting facts corrected](../learnings/1788884756637-slang-perf-alerting-facts-corrected-perf-push-benc.md)).

Perf-epic sub-tasks are maintainer-curated, no-repro ops/infra work: don't auto-dispatch a fixer; triage, 5-bullet, report up (closures and reply content: [[wiki/concepts/agent-fixer-codex-skills-f0909b0-triage-routing-and-classification.md]]).

**Answering "does this pass change regress compile time?" deterministically.** A shared 64-core box is too noisy (load 5→119 moved medians ±10%), so scope callgrind to the phase: `valgrind --tool=callgrind --toggle-collect='Slang::linkIR*' slangc ...` gives run-identical instruction counts, and `callgrind_annotate --inclusive=yes` shows which function absorbed the delta. Build Release base and fix from one tree differing in one file (copy `bin/` and `lib/` out; slangc's rpath is `$ORIGIN/../lib`), pair with an ABBA-interleaved wall-clock run, and check the `.spv` is byte-identical. SPIR-V workloads fail "failed to load downstream compiler 'spirv-opt'" unless you build `--target slang-glslang` in Release and copy `libslang-glslang-*.so` next to `libslang-compiler`. Don't claim "X% of total compile" from phase-share × phase-delta: measure whole-process Ir and report a paired IQR entirely above zero ([callgrind scoped to the phase](../learnings/1791325135172-deterministic-compile-perf-a-b-for-a-slang-pass-ca.md)).

## Triaging the Nightly MDL Perf Test gate: split resize-noise from real regressions

When `trend.py` lights many workloads/metrics at once, split it. (1) **Check for a disclosed methodology change first**: merged PRs touching `tools/compile-perf/lib/manifest.py` `default_size`/`sweep_sizes` often predict the ratio in their body (PR #13035: "one night of movement on those four workloads is expected"); a match is the gate correctly detecting a disclosed change. (2) **Read which timer flagged**: a localized pass regression moves a sub-pass timer (`specializeModule`, `simplifyIR`, `linkAndOptimizeIR`) while `compileInner` stays under threshold; `compileInner` moving for every workload suggests runner contention. (3) **Narrow suspects to PRs touching `core.meta.slang` / `hlsl.meta.slang`**: the prelude is checked and specialized on every compile (`bench.py` spawns a fresh `slangc` per sample, no cross-process cache), so new generics there inflate `specializeModule`/`simplifyIR` across unrelated workloads under titles with no perf hint. (4) Self-merge (author == merged_by, no APPROVED review) marks thin review, a signal not proof. Example (2026-09-19): four workloads' 2.4–10× jumps were #13035's resize; a separate ~1.7–2.4× `specializeModule`/`simplifyIR` jump traced to self-merged #13138/#13135 adding prelude generics ([separating resize noise from regressions](../learnings/1789805493629-separating-disclosed-benchmark-resize-noise-from-g.md)).

**A green night after a red one is usually a threshold miss, not baseline absorption.** `analyze` compares each night to a trailing-7 median. After a 10-07 step, 10-09 went green and one reading blamed absorption ([trailing-median hides real steps](../learnings/1791619655084-nightly-mdl-perf-test-detect-real-steps-hidden-by-.md)), but the median was still 45.9 ms (only 2 of 7 trailing nights post-step) and confirmation measured 1.08×, under the 1.10× ERROR threshold, so it only warned. Grep the analyze log for `Confirmation:` and `baseline: trailing 7 point(s) [...]` first ([green night is a threshold miss](../learnings/1791622838976-nightly-compile-perf-a-green-night-after-a-red-one.md)). The median moves only once 4 of 7 nights are post-step, after which a real step goes quiet, so localize early against a fixed green night. For front-end moves after 2026-10-07, check #13445 (e2e217dd2) first: it turned `SemanticsVisitor::getTypeTags` from a cached `aggTypeDecl->typeTags` read into a per-call walk with no `-Gec` gate (#13565).

**Size a step with per-timer geomeans, not the `analyze` flags.** `analyze` lists only counters over ratio ≥1.1 / abs ≥2 ms against the trailing median, and chronic noise makes lone flags unreliable. `gh run download <run-id> --repo shader-slang/slang -p 'perf-confirmation-*'` gives `results.json` (per workload: `size`, `timers.<name>.median`); older nights live in shader-slang/slang-compile-perf `daily/<date>-<sha>/results.json` (`gh api … -H 'Accept: application/vnd.github.raw'`). Keep workloads whose `size` matches between nights (with a ≥1 ms baseline, which reproduced the checker exactly), then take the per-timer geomean ratio against the fixed green night. A real front-end regression moves one phase broadly while `linkAndOptimizeIR`, `loadBuiltinModule` and other backend timers stay ~1.00; runner noise moves every phase together and rotates nightly. Measured: SemanticChecking up in 48/54 workloads (~1.075×) after 10-07 ([per-timer geomean vs green night](../learnings/1791619655084-nightly-mdl-perf-test-detect-real-steps-hidden-by-.md)); 10-16 SemanticChecking 1.052 vs 10-12, 39/54 above the prior four nights' max, with only #13537/#13615/#13626 in the window. The per-push store (slang-material-modules-benchmark) is DXIL-only, 7 metrics, bimodal across runners, so it cannot localize a front-end shift. Artifacts expire after ~a week (10-07/10-08 returned 404 on 10-16), so record geomeans durably ([size a step with per-timer geomeans](../learnings/1792138989940-mdl-perf-nightly-size-a-front-end-step-with-per-ti.md)).

**Source learnings (28):**

- [Maintainer readying a bot draft PR + force-push dismisses approval](../learnings/1788380981281-maintainer-readying-a-bot-draft-pr-force-push-dism.md) — check timeline actor; don't re-dispatch ci.yml
- [Heartbeat: verify the base, not just the deltas](../learnings/1788393885068-heartbeat-verify-the-base-not-just-the-deltas-on-d.md) — re-derive carried durations from the anchor
- [Heartbeat precheck workflow_failures stale for slang only](../learnings/1788404324277-heartbeat-precheck-workflow-failures-fetch-returne.md) — spot-check against a live API call
- [Saturday CMake Options queue saturation is expected load](../learnings/1789812585102-slang-ci-saturday-cmake-options-queue-saturation-i.md) — check the dominant workflow's triggers before flagging Critical
- [Saturday CMake Options burst blinds CI Health; MQ skips test-falcor](../learnings/1792312349410-slang-ci-saturday-cmake-options-burst-blinds-ci-he.md)
- [Weekly CMake Options run lasts ~4 h](../learnings/1792916619171-weekly-cmake-options-run-lasts-4-h-and-blinds-the-.md) — 4 h 08 min run, ~2.5 h snapshot gap
- [slang workflow_failures staleness confirmed recurring](../learnings/1788410539745-heartbeat-precheck-s-slang-workflow-failures-stale.md) — standing characteristic vs single self-correcting anomaly
- [agentic-tests 2-night failure is a tracked cluster](../learnings/1788428378771-slang-nightly-slang-test-agentic-tests-2-night-fai.md) — open PR #12881; diff `FAILED test:` lines
- [Post-rebase cross-platform failure is a master merge break](../learnings/1788457867847-post-rebase-cross-platform-test-slang-failure-on-a.md) — file against master, not the innocent PR
- [Verify causation at the failure site](../learnings/1788459591745-verify-causation-at-the-failure-site-a-verified-co.md) — read the job-log line before asserting cause
- [test-falcor reruns fail once the parent run is stale](../learnings/1788546124300-test-falcor-reruns-fail-deterministically-once-the.md) — check run age; grep rerun-log.jsonl first
- [CORRECTION: test-falcor 403 and artifact-expiry are distinct](../learnings/1788546545702-correction-test-falcor-403-and-artifact-expiry-are.md) — read a second class member before unifying
- [Bridge-403 confirmation must also check artifact age](../learnings/1788589902152-falcor-bridge-403-confirmation-must-also-check-bui.md) — bridge health and artifact freshness are independent
- [Default branch is master, not main](../learnings/1788675668651-shader-slang-slang-default-branch-is-master-not-ma.md) — `main` query 404s; use mergeStateStatus
- [benchview results land in a PRIVATE repo (#12961)](../learnings/1788881853471-slang-benchview-results-land-in-a-private-repo-the.md) — public instance is an ops/security decision
- [compile-perf is the fork template; runtime perf greenfield](../learnings/1788881870741-slang-perf-alerting-compile-perf-is-the-fork-templ.md) — Slack egress needs a GitHub-hosted runner
- [compile-perf emit_* workloads share one shader](../learnings/1788881942527-compile-perf-emit-workloads-all-share-one-shader-g.md) — lacks backend-distinctive shapes; check-python-core.yml module list
- [benchview is a downstream-consumer-by-URL](../learnings/1788882146534-slang-benchview-is-a-downstream-consumer-by-url-no.md) — verify audit branches exist (four checks)
- [perf-alerting facts corrected](../learnings/1788884756637-slang-perf-alerting-facts-corrected-perf-push-benc.md) — compile-time MDL; source-verify inherited learnings
- [Separating benchmark-resize noise from real regressions](../learnings/1789805493629-separating-disclosed-benchmark-resize-noise-from-g.md) — manifest.py edits; sub-pass timers; prelude PRs
- [LLVM-not-found grep matches the script echo](../learnings/1791620024633-grepping-job-logs-for-llvm-prebuilt-not-found-in-g.md) — drop `echo ` lines; find "Building LLVM from source"
- [Detect real steps hidden by trailing-median baseline](../learnings/1791619655084-nightly-mdl-perf-test-detect-real-steps-hidden-by-.md) — per-timer geomean vs a fixed green night
- [Green night after red is a threshold miss](../learnings/1791622838976-nightly-compile-perf-a-green-night-after-a-red-one.md) — 1.08× < 1.10×; #13445 getTypeTags suspect
- [Deterministic compile-perf A/B: callgrind scoped to the phase](../learnings/1791325135172-deterministic-compile-perf-a-b-for-a-slang-pass-ca.md) — whole-process Ir; build slang-glslang (PR #13236)
- [MDL perf nightly: size a step with per-timer geomeans](../learnings/1792138989940-mdl-perf-nightly-size-a-front-end-step-with-per-ti.md) — size-matched workloads; artifacts expire ~1 week
- [Log-header scan exhausts the 6000/hr REST budget](../learnings/1792660471559-ci-sweep-full-ubuntu-latest-log-header-scan-exhaus.md) — rider: bot CMake Options dispatches; read `queue_by_group`
- [Scheduled workflows lack fork guards](../learnings/1793089763873-slang-scheduled-ci-workflows-lack-fork-guards-ci-h.md) — 16 of 17 unguarded; advise disabling on the fork
- [test-falcor --job rerun fails in 19s once artifact gone](../learnings/1793081639779-test-falcor-job-rerun-fails-in-19s-once-the-run-s-.md) — rerun the falcor build job
