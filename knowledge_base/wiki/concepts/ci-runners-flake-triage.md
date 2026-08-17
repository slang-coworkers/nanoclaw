---
title: "CI Runners & Flake Triage (part 1 — currency: which run is the verdict)"
type: concept
group: ci-tooling
tags: [ci, currency, filter-latest, workflow-dispatch, phantom-suite, timestamps, created-at, draft-pr, priority-yield, cancelled-job, triggering-actor, merge-queue, slang]
source_count: 85
---

# CI Runners & Flake Triage

> **Part 1 of 4** of the CI Runners & Flake Triage synthesis (split 2026-08-08 to stay under the 40 KB read cap). Siblings: [part 2](ci-runners-flake-triage-2.md) · [part 3](ci-runners-flake-triage-3.md) · [part 4](ci-runners-flake-triage-4.md).

How to decide whether a Slang CI run is still the answer. Two orthogonal questions run through this synthesis: **is this failure a flake?** (classification — part 2) and **is this run still the verdict?** (currency — this part). Passing the first tells you nothing about the second: `filter=latest` emits one run per check-*suite*, four timestamp fields invert on a re-run, and a superseded suite can carry the freshest failing timestamp in an entire sweep.

## TL;DR

- **`filter=latest` returns the latest run per check-SUITE, not the latest suite** — one head sha can carry both a `pull_request` and a `workflow_dispatch` CI suite, so a stale failed dispatch suite stays red forever. Check `event` before any rerun; a `pull_request:success` at the same sha means the head is green — **do not rerun**.
- **Only suite/run `created_at` is a safe currency field.** Check-run `started_at`, check-run `completed_at`, suite/run `updated_at`, and run `run_started_at` all invert and pick the stale red — **any timestamp a re-run advances inverts**, and `run_started_at` equals `created_at` on attempt 1 so it validates clean on every single-attempt sample.
- **A superseded suite can hold the freshest failing timestamp in an entire sweep and fake a state-change** — rank "what broke most recently" over `created_at`-winning suites only. Cheap whole-sweep detector: print `event:conclusion` per red PR; `pull_request:success workflow_dispatch:failure` is the tell.
- **`created_at` is the single load-bearing discriminator; "prefer the `pull_request` suite" is only a tiebreaker** — same-event duplicates exist (8 doubled workflows at one head; 4 `Verify PR Labels` suites all `event=pull_request`), which event-preference cannot separate.
- **`updated_at` is not a push signal, and is wrong in both directions** — comments inflate it, merge-queue enqueue/eviction leave it frozen. Use `commit.committer.date` (not `author.date`, which survives rebase) for the push clock.
- **Draft-era CI readings expire on the draft→ready flip** — re-derive at the current head. Priority-yield looks like `check-ci`/`wait-for-human-priority` failure with all `build-*`/`test-*` skipped; **count failures, not skips** (45 success / 45 skipped / 0 failures is normal).
- **A `cancelled` job is neither pass nor fail — a flake hypothesis "tested" by that rerun is still untested.** After a rerun, `actor`/`triggering_actor` names whoever pressed rerun, not whoever cancelled. **Only a green retry at an unchanged head sha converts "suspected flake" into "confirmed flake."**
- **Label-gate reds cut both ways — read the PR's CURRENT labels**: gate failed + a `pr:` label present today ⇒ phantom (already fixed); gate failed + no `pr:` label ⇒ genuine and author-actionable.
- **Never assert live queue health from `health_snapshots.jsonl`** — its last line has been months stale, and `merge_queue {success,failure}` is a cumulative counter, not the recent eviction rate. Compute the pass rate from the last ~30 `merge_group` runs.

## A required draft-PR ci.yml workflow_dispatch can itself priority-yield

On shader-slang/slang a **draft** PR's *required* manual `gh workflow run ci.yml --ref <branch>` dispatch can itself PRIORITY-YIELD to human CI — not just the redundant non-draft dispatches. Signature: the run completes `failure` almost instantly with build/test legs skipped. Read the `pull_request` run rollup for the real head-green signal rather than trusting the manual dispatch's red ([A required draft-PR ci.yml workflow_dispatch can itself priority-yield](wiki/learnings/1782867699255-a-required-draft-pr-ci-yml-workflow-dispatch-can-i.md)).

## Merge-Queue Health From Recent merge_group Runs, Not the Snapshot Counter (2026-07-12 fold)

Do NOT infer merge-queue health from the `merge_queue {success, failure}` field in `health_snapshots.jsonl` — that's a cumulative/aggregate counter, not the recent eviction rate. On 2026-07-11 citing the snapshot's `13 success / 17 failure` as "queue majority-failing, acute emergency" was wrong: the live last-30 `merge_group` runs were 27/3 (~10% evict), an intermittent latent evictor with a known fix, not a queue-down outage. Query the last N `merge_group` workflow runs and compute the pass rate directly (`gh run list --workflow=...` filtered to the merge_group event); reserve "queue degraded/down" language for genuinely high recent failure shares, and frame a known-fix intermittent evictor as "fix identified, PR in progress" ([read merge-queue health from recent merge_group runs, not the health-snapshot field](wiki/learnings/1783757863607-read-merge-queue-health-from-recent-merge-group-ru.md)).

<!-- fold-20260712 -->

## Citing Cross-Repo Flakes by Run-ID (2026-07-14 fold)

Cite a cross-repo flake by CI **run-id**, not the babysat PR number. When the CI babysitter logs a cross-repo flake, the durable log's `pr` field is whatever slang PR was being babysat at the time — not a tracking issue for the flake. Citing it as provenance ("2nd point since #11680") reads as if that PR tracks the flake when it usually doesn't, and the number 404s in the other repo ([cite cross-repo flake occurrences by run-id, not the babysat PR number](wiki/learnings/1783930550138-cite-cross-repo-flake-occurrences-by-run-id-not-th.md)).

## Never Trust health_snapshots.jsonl's Last Line as "Latest" — Cross-Check the Actions API (2026-07-15 fold)

The last line of `health_snapshots.jsonl` (shader-slang/slang-ci-analytics) can be *badly* stale: on the 2026-07-14 daily report it was dated 2026-03-03 (~4 months old) while the report ran on 07-14. The daily-report CI-health workflow treats the last line as "the latest snapshot," so citing it verbatim reports a queue depth months old. Rule: never assert live CI queue health from `health_snapshots.jsonl` alone — check the snapshot's `timestamp` against today's date first; if it's not from the last ~24h, fall back to the GitHub Actions API (`/actions/runs?branch=master&status=failure&per_page=N`) for the real signal and state the staleness as a data caveat rather than quoting a stale queue depth. (This compounds with the separate rule above that the `merge_queue {success,failure}` field is a cumulative counter, not the recent eviction rate.) Also useful: when a master nightly shows `failure`, fetch `/actions/runs/<id>/jobs` and classify by which job/step failed — a failure isolated to `agentic-tests` or a perf job (build/setup/lint green) is NOT a core-compiler regression and should be framed that way, not "master red" ([Daily-report CI: health_snapshots.jsonl last line can be badly stale — cross-check with Actions API](wiki/learnings/1784017364046-daily-report-ci-health-snapshots-jsonl-last-line-c.md)).

## Currency Is Independent of Classification — Is This Run Even the Verdict? (2026-08-04 fold)

Every classification rule in [part 2](ci-runners-flake-triage-2.md) answers *"is this failure a flake?"* This section answers the orthogonal question *"is this run still the answer?"* — and **passing the first check tells you nothing about the second.**

**A stale `workflow_dispatch` suite makes a GREEN PR look red.** `GET /commits/<sha>/check-runs?filter=latest` returns the latest run **per check-suite**, and a single PR head can carry **two CI suites at the same sha** — one from `pull_request`, one from `workflow_dispatch`. `filter=latest` does not prefer the newer suite; it emits both, so a stale *failed* dispatch suite stays in your red list permanently even when a later `pull_request` run at the identical sha is fully green. On slang#12186 the Falcor log carried a correctly-identified, known-tracked flake signature (`renderpasses/test_GBufferRTTexGrads_d3d12` FAILED, `Mogwai.exe` return code `3221225477` = 0xC0000005) with the usual discriminator holding — one step from `gh run rerun --failed`. That run was `event=workflow_dispatch, run_attempt=2`; the `pull_request` run at the same head was **36 success / 1 skipped**, with `test-falcor` and `check-ci` both success. **Signature validity does not establish that the run is the live verdict.** Second instance in the same sweep: #12208's red `build-linux-debug-gcc-x86_64` was a 07-24 dispatch suite (logs since 410-expired) while the `pull_request` run at the identical sha had that job *and* `check-ci` green — 2 of 29 red PRs affected in that sweep (the rate across sweeps is higher, 5–6 of 29; see the currency section below). Recipe before **any** rerun:

```bash
gh api "repos/<o>/<r>/actions/runs/<run-id>" --jq '{event, conclusion, run_attempt, head_sha}'
# if event != pull_request, enumerate every CI run at that sha:
full=$(gh api repos/<o>/<r>/pulls/<N> --jq .head.sha)
gh api "repos/<o>/<r>/actions/runs?head_sha=$full&per_page=50" \
  --jq '.workflow_runs[] | select(.name=="CI") | "\(.event)\t\(.conclusion)\t\(.created_at)\trun=\(.id)"'
```

A `pull_request:success` at the same sha ⇒ head is green, **do not rerun**. Cheap whole-sweep detector: print the `event:conclusion` list per red PR — `pull_request:success workflow_dispatch:failure` is the tell. Most exposed population: **bot-authored PRs**, because retry/priority-yield workflows re-dispatch CI via `workflow_dispatch` — the same population as the known "lone red dispatch with every job SKIPPED is a no-op" case, but this is the harder variant where the dispatch suite really ran, really failed, and still isn't the verdict. **Judge head health from the `pull_request` run or the check rollup, never from a `workflow_dispatch` run alone** ([a stale workflow_dispatch run makes a GREEN PR look red — verify run event before rerunning](wiki/learnings/1785816873789-ci-sweeps-a-stale-workflow-dispatch-run-makes-a-gr.md)).

### The phantom outranks every real failure — and four timestamp fields invert, only `created_at` is safe

The `filter=latest` trap above has a second-order consequence that is worse than a wasted rerun: **a superseded suite can hold the freshest failing timestamps in the entire repo, and thereby fake a state-change.** Same PR (slang#12186, 2026-08-04), one head unchanged since 22:15:41Z:

```
workflow_dispatch run 30858600527  suite created_at 22:25:39Z  attempt 2 (run_started_at 01:47:10Z)
  falcor    started 02:12:53Z  failure   <- real signature (tracked GBufferRTTexGrads_d3d12 crash)
  check-ci  started 03:10:29Z  failure   <- FRESHEST failing check across all 74 open PRs
pull_request run 30860511719   suite created_at 22:56:30Z  attempt 1
  36 success / 1 skipped                 <- the live verdict
```

A sweep two hours earlier had recorded this PR fully green, so the naive read was *fresh timestamp + genuine failure signature + regression since last sweep = new break, rerun it* — and all three signals were misleading. The dispatch suite's checks are newer **only because that suite was re-run**; its triggering event is 31 minutes *older* than the green `pull_request` suite. A phantom whose timestamps post-date your own previous green reading is indistinguishable from a fresh regression you either caused or missed, which is the most alarming shape a false signal can take ([a phantom-red CI suite can carry the freshest failing timestamp in an entire sweep](wiki/learnings/1785823939594-a-phantom-red-ci-suite-can-carry-the-freshest-fail.md)).

**The safe-field set is much smaller than "don't use check-run `started_at`."** Measured at HEAD on the same PR, stale `workflow_dispatch` suite (failure) vs winning `pull_request` suite (success):

| field | stale suite (failure) | winning suite (success) | picks? |
|---|---|---|---|
| check-run `started_at` | 02:12:53Z | 23:22:28Z | ❌ RED |
| check-run `completed_at` | **03:10:33Z** | 00:19:03Z | ❌ RED |
| suite / run `updated_at` | **03:10:33Z** | 00:19:04Z | ❌ RED |
| run `run_started_at` | **01:47:10Z** | 22:56:30Z | ❌ RED |
| **suite / run `created_at`** | 22:25:39Z | **22:56:30Z** | ✅ GREEN |

**Four fields invert; only `created_at` is safe.** Carry the *mechanism*, not the blocklist: **every timestamp that advances on a re-run inverts**, because the stale suite keeps getting re-run while the winning verdict's timestamps stay frozen. `created_at` is the only field pinned to the triggering event and never rewritten. So the question for any field you are considering is *"does a re-run move it?"* — which generalizes to fields not in the table. The subtle one is `run_started_at`, the field a careful reader is most likely to assume is safe: it **equals `created_at` on attempt 1** and diverges only from attempt 2 onward, so it tests clean on the majority of runs and fails *precisely* on the re-run population where currency questions arise — a validation sample containing no multi-attempt runs will certify it as correct ([CI suite currency: four timestamp fields invert, only created_at is safe](wiki/learnings/1785824275373-ci-suite-currency-four-timestamp-fields-invert-onl.md)).

Consequences for sweep mechanics: **compute any "what broke most recently" ranking over `created_at`-winning suites only**, or it is actively misleading rather than merely incomplete — an inverting field systematically surfaces phantoms at the *top* of a recency-ordered red list, exactly the PRs a human or bot actions first. "Newer than my last sweep" is not evidence of a new break until the suite is reconciled. One call joins suite id + event + `created_at` (`/check-suites/<id>` has **no `event` field**):

```bash
gh api "repos/<o>/<r>/actions/runs?head_sha=$sha&per_page=100" \
  --jq '.workflow_runs[]|"\(.name)\t\(.event)\t\(.created_at)\t\(.conclusion)\t\(.id)"'
```

Two riders. **This is not CI-specific:** at one head **8 workflows were doubled** (`Verify PR Labels`, `Check Formatting`, `PR Maintenance`, …), and the same-event duplicates all share `event=pull_request`, so a "prefer the `pull_request` suite" rule **cannot** discriminate them — `created_at` is the single load-bearing rule and the event-preference is only a tiebreaker for the `workflow_dispatch` variant. And **label-gate reds cut both ways — read *current* labels:** gate failed **+** a `pr:` label present today ⇒ phantom (author fixed it, gate re-ran green, the failed suite persists); gate failed **+** no `pr:` label today ⇒ genuine and author-actionable. One sweep held 4 phantom and 5 genuine (#11223 #11234 #11081 #9809 with zero labels, #10787 with only `[Testing]`), so check `gh api repos/<o>/<r>/pulls/<N> --jq '[.labels[].name]'` before classifying. Rate across sweeps: **5–6 of 29 red PRs carried at least one phantom** — blanket dismissal and blanket trust are both wrong, the reconciliation *is* the work.

**Draft-era CI readings expire on the draft→ready flip.** Correctly reading a draft's manual-dispatch red as a cosmetic priority-yield is well known; the less obvious half is that the reading has a **short shelf life**. On slang#12246 the report said "CI has not run a full build/test pass; a maintainer needs to trigger it" — a maintainer had already flipped the PR ready, and full CI had passed on the approved head (builds + `test-slang` on Linux/macOS/Windows, Falcor, benchmark, compile-regression, sanitizer, formatting, label checks, **0 failures**). That caveat would have sent a reviewer hunting green signal that already existed and could have stalled a ready merge. **Re-read check-runs at the CURRENT head before making any CI claim**, especially in a report a human will act on:

| | priority-yield (draft) | real pass (non-draft) |
|---|---|---|
| `check-ci`, `wait-for-human-priority` | **failure** | **success** |
| `build-*` / `test-*` jobs | all `skipped` | present and `success` |

Two secondary gotchas: **lots of `skipped` runs is NOT evidence CI didn't run** (one head showed 45 success / 45 skipped / 0 failures — normal for matrix legs plus draft-era leftovers, so count *failures* rather than eyeballing the skip count); and **don't manually dispatch on a non-draft** to "get signal" — the push already triggered the real run and a `workflow_dispatch` there just adds a confusing red yield on the head. Generalized: **a CI status is a claim about a specific commit at a specific time, not a durable property of the PR** — any state change someone else can make (draft flip, rebase, force-push, re-run) invalidates it, and a stale "it's not ready" is more damaging than saying nothing because reviewers act on it ([draft-era CI readings expire on the draft-to-ready flip](wiki/learnings/1785778108303-draft-era-ci-readings-expire-on-draft-to-ready-fli.md)).

**Measure freshness by the failing check's `started_at` rather than the head commit date — but only after reconciling suites, because `started_at` inverts on a re-run.** (Superseded in scope by the currency table above: an unreconciled `started_at` ranking systematically puts phantoms on top. Compute clock 2 over `created_at`-winning suites only.) Head-commit age and failure age are **different clocks**: a stale head can carry a freshly-failed rerun (someone pressed rerun an hour ago on a 300h-old commit), and a fresh head can carry only old failures if the new run hasn't finished. Filtering candidate work by head-commit date alone misses the first case and over-reports the second. Compute both per PR:

```bash
# clock 1: when the code was last pushed (NOT updated_at — comments bump that)
gh api /repos/<o>/<r>/commits/$SHA --jq '.commit.committer.date'
# clock 2: newest failing check's start — catches fresh reruns on stale heads
jq -r '[.check_runs[]|select(.conclusion=="failure" or .conclusion=="timed_out"
        or .conclusion=="cancelled")|.started_at]|max' checkruns.json
```

Sort a 28-red list by clock 2 and the triage order falls out — **provided each red has been suite-reconciled first**; on an unreconciled list the top entry is likelier to be a phantom than a fresh break (see the currency table above). On a real 75-PR slang sweep, clock 2 gave 6h / 75h / 172h / 224h / 255h… — one genuinely recent failure and a long tail of stale re-confirms; a single low number ("freshest failure anywhere = 6h") is *suggestive* that nothing newly broke since the previous sweep, but it only becomes proof once that freshest suite is confirmed to be the `created_at` winner at its sha. Essentially free either way, since the data is already in the check-runs payload. Related trap: **pending (`in_progress`) jobs are no information** about health — don't fold them into either clock, and judge them against the job's *declared* `timeout-minutes` from `.github/workflows` (10→360 across slang: build 120, slang-test 80), never a global guessed threshold ([measure CI freshness by failing-check started_at, not head commit date](wiki/learnings/1785809336773-measure-ci-freshness-by-failing-check-started-at-n.md)).

**`updated_at` is not a push signal — and it is unreliable in both directions.** Splitting 74 open PRs into "fresh today" vs "stale re-confirm" by `updated_at` misclassified #12089: `updated_at` = 2026-08-03T13:36Z, **head commit date = 2026-07-22** — the bump came from a *comment*. That decides whether a failure is new information or a 12-day-old re-confirm already logged three times. Read the head commit's own date, using **`committer.date` not `author.date`** (a rebase/cherry-pick preserves the original author date, so `author.date` can look ancient on a branch just pushed):

```bash
sha=$(gh api repos/<o>/<r>/pulls/<n> --jq .head.sha)
gh api repos/<o>/<r>/commits/$sha --jq .commit.committer.date
```

The converse also bites: `updated_at` stays **frozen** through merge-queue enqueue and eviction, so a PR that just got bounced looks quiescent — read the issue timeline or `actions/runs?event=merge_group` for queue history. Generalization worth carrying past this field: **any "last modified" timestamp on a composite object** (a PR = code + conversation + labels + queue state) aggregates several kinds of change; ask which sub-change you care about and find the field scoped to it, because a timestamp answering a broader question than yours is a silent source of both false positives and false negatives ([updated_at is not a push signal — comment bumps fake freshness in CI triage](wiki/learnings/1785795714343-updated-at-is-not-a-push-signal-comment-bumps-fake.md)).

## Triaging a `cancelled` Job, and Who Actually Delivered the Verdict (2026-08-04 fold)

A job that ends `cancelled` is **neither pass nor fail**: if you reran it to test a flake hypothesis, that hypothesis is still **untested** — not vindicated, not refuted. Booking it either way is the first mistake; inventing a cause is the second. A "cancel-without-re-dispatch systemic signature" proposed from a single occurrence was refuted in one pass by evidence already in hand. The playbook, in order:

1. **Sibling start times FIRST.** On a `--failed` rerun only the re-dispatched job restarts; every sibling keeps its *original* timestamp and prior conclusion. Here the re-dispatched job started 22:47:53 and cancelled, while **34 siblings had started ~21:2x–21:5x and succeeded an hour earlier** — so the run-level rollup (`34 success / 2 cancelled / 1 failure`) was one job's cancel plus retained history, and there was never a fleet-wide cancellation to explain. **The core error was reading a post-rerun rollup as a snapshot of one moment:** a rerun makes a run's aggregate a *composite across time*, and any "what happened to this run?" story built from the aggregate will invent events.
2. **Step conclusions separate external kill from crash.** Teardown steps all `success` with clean orphan-process termination in order ⇒ **external** kill; a crash leaves teardown dirty. Compare the failing step's duration to `timeout-minutes` (23s here — nowhere near it).
3. **`runner_name: null` + starts-after = victim, not actor.** A `needs:`-dependent gate gets cancelled *unstarted* when its upstream dies. The job fingered as the canceller started **22:49:00** and cancelled at 22:49:00 — *five seconds after* the job it supposedly killed (22:48:55). **A job that starts after the cancellation cannot have caused it**; the timestamps were in hand and never compared.
4. **Rule out the cheap alternatives.** `actions/runs?head_sha=<sha>` → 0 newer runs ⇒ not `cancel-in-progress` (no superseding push). If a deliberate priority-yield/backpressure gate exists, check whether it **succeeded** — if so, not that class.

Verdict shape: single cancelled job + siblings green + clean teardown + no superseding run ⇒ **infrastructure cancellation of one hosted-runner job** (runner reclaim / pool interruption). Not systemic, and not a new bucket on one data point. **And don't blindly re-fire just because the retry budget allows it** — the asymmetry is that declining to act on an unexplained signal costs one cycle, while acting on a misdiagnosis costs budget and credibility ([triaging a cancelled CI job: sibling start times first, and a rerun's actor field is a trap](wiki/learnings/1785797794359-triaging-a-cancelled-ci-job-sibling-start-times-fi.md)).

**⚠️ The `actor` / `triggering_actor` trap — and its legitimate use.** After a rerun, `runs/<id>`'s `actor` / `triggering_actor` is **whoever pressed rerun**. It answers *"who re-dispatched this run?"* while reading exactly like a smoking gun for *"who cancelled this job?"* — the field is real, the value correct, and the inference wrong (it named the bot's own identity, i.e. precisely the datum that would have convinced it that it killed its own job). Generalization: **a measurement that answers a narrower or adjacent question than yours is more dangerous than a missing one, because it arrives with the authority of hard data.**

The same field is the *right* tool when the question genuinely is attribution. When a deferred/inconclusive action later appears resolved, **the resolution has an author and it may not be you.** After the cancelled rerun above, the PR was fully green two sweeps later; both tempting write-ups — "it self-healed" and "my rerun worked" — were wrong, because `gh api repos/O/R/actions/runs/<id>/attempts/3` showed `triggering_actor: pdeayton-nv`, a **human maintainer** pressing attempt 3. Procedure: get the attempt that actually produced the green result (`/attempts/N`, not the rollup), read its `triggering_actor`, and **confirm the head SHA is unchanged** — a green retry at an *unchanged* head with zero code change is the only thing that converts "suspected flake" into "confirmed flake"; a new commit proves nothing about the flake. So the lesson is not "distrust the field" but that **a field answers one question, and whether it is a trap or a gold standard depends entirely on whether that is the question you are asking.** Why it matters beyond bookkeeping: an agent that quietly absorbs a human's fix into its own success record produces a corrupted picture of what the automation is actually doing, and if the humans stop pressing those buttons nobody finds out until throughput drops ([a deferred CI verdict can be delivered by someone else — check triggering_actor before claiming credit or self-healing](wiki/learnings/1785802359611-a-deferred-ci-verdict-can-be-delivered-by-someone-.md)).

**Source learnings (13):**
- [a phantom-red suite can carry the FRESHEST failing timestamp in a whole sweep — it fakes a state-change; rank over winning suites only, and read current labels on gate reds](wiki/learnings/1785823939594-a-phantom-red-ci-suite-can-carry-the-freshest-fail.md)
- [CI suite currency: four timestamp fields invert (check-run started_at/completed_at, suite updated_at, run_started_at) — only suite/run `created_at` is safe; any field a re-run advances inverts](wiki/learnings/1785824275373-ci-suite-currency-four-timestamp-fields-invert-onl.md)
- [CI sweeps: a stale workflow_dispatch run makes a GREEN PR look red — `filter=latest` emits both suites at one sha; verify `event` before rerunning](wiki/learnings/1785816873789-ci-sweeps-a-stale-workflow-dispatch-run-makes-a-gr.md)
- [draft-era CI readings expire on the draft→ready flip — re-read check-runs at the CURRENT head before any CI claim](wiki/learnings/1785778108303-draft-era-ci-readings-expire-on-draft-to-ready-fli.md)
- [measure CI freshness by the failing check's started_at, not the head commit date (two clocks)](wiki/learnings/1785809336773-measure-ci-freshness-by-failing-check-started-at-n.md)
- [updated_at is not a push signal — comments inflate it, merge-queue evictions leave it frozen; use commit.committer.date](wiki/learnings/1785795714343-updated-at-is-not-a-push-signal-comment-bumps-fake.md)
- [triaging a `cancelled` CI job: sibling start times FIRST; a rerun's actor field is a trap](wiki/learnings/1785797794359-triaging-a-cancelled-ci-job-sibling-start-times-fi.md)
- [a deferred CI verdict can be delivered by someone else — read `/attempts/N` triggering_actor before claiming self-heal](wiki/learnings/1785802359611-a-deferred-ci-verdict-can-be-delivered-by-someone-.md)
- [Bot draft PRs get zero CI](wiki/learnings/1781663343829-bot-draft-prs-get-zero-ci-on-shader-slang-slang-fi.md)
- [A required draft-PR ci.yml workflow_dispatch can itself priority-yield](wiki/learnings/1782867699255-a-required-draft-pr-ci-yml-workflow-dispatch-can-i.md)
- [Read merge-queue health from recent merge_group runs, not the health-snapshot merge_queue field](wiki/learnings/1783757863607-read-merge-queue-health-from-recent-merge-group-ru.md)
- [Cite cross-repo flake occurrences by run-id, not the babysat PR number](wiki/learnings/1783930550138-cite-cross-repo-flake-occurrences-by-run-id-not-th.md)
- [Daily-report CI: health_snapshots.jsonl last line can be badly stale — cross-check with Actions API](wiki/learnings/1784017364046-daily-report-ci-health-snapshots-jsonl-last-line-c.md)
_Catalog: [[wiki/index.md]]_
