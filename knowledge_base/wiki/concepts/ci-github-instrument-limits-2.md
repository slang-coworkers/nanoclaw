---
title: "GitHub/git Instrument Limits, part 2 — Pagination, Scope & Path-Classed Auth (part 2)"
type: concept
group: ci-tooling
tags: [gh-cli, github-api, pagination, total-count, auth-401, absence-claims, slang]
source_count: 3
---

# GitHub/git Instrument Limits, part 2 — Pagination, Scope & Path-Classed Auth (part 2)

> **This page is part 2 of 2** of the GitHub/git Instrument Limits, part 2 — Pagination, Scope & Path-Classed Auth synthesis (split 2026-08-07 to stay under the 40 KB read cap). Siblings: [part 1](ci-github-instrument-limits.md). The TL;DR below is shared across all parts.

## TL;DR
- **`gh api --paginate` 401s on page 2 under the OneCLI proxy and truncates silently** — the sweep gets the first 100 items and any failure past them reads GREEN. Use explicit `?per_page=100&page=N`.
- **The silence is invocation-form dependent, and exit codes ARE usable**: bare `--paginate` and `--paginate --jq` exit 1; piping into `jq` (or `2>/dev/null`) launders it. Add `set -o pipefail`.
- **Reconcile on RAW page length, not your filtered count.** `/pulls`, `/issues`, `/commits` have no `total_count` to check against.
- **`search/code` `total_count` counts MATCHES, not files** — and a count authenticates exactly one scope. Never cite a count from one scope as evidence about another.
- **`search/code` silently returns `total_count: 0` for files above ~384 KB** — biased toward the biggest files. Never use it for a denominator: search by ENTITY name, count locally with `git grep`.
- **`gh api .../contents/<path>` returns 200 with an EMPTY payload above the inline size cap** — an empty content field is not an absent string. Use `git show`.
- **A 215-byte "log" is a 404 `BlobNotFound` body; 151 bytes is a 410 expired-log body.** `gh api` prints both to stdout and exits 0, so greps against them return a false 0. Assert the log is a log first.
- **`steps[]` is perishable — GitHub zeroes it past ~7 days.** `steps.length == 0` means "never executed" only inside the retention window; `status`/`conclusion` stay authoritative at any age.
- **The question that catches this whole family: what would this output look like if the thing were absent?** If the answer is "the same", it is not a measurement.
- **Summarizing tools (WebFetch, prose renderers) cannot establish state, counts, or absence.** They are prose-only; enumerate with an API.
- **A 401/403 is path-classed, never global.** REST can work while GraphQL 401s. Try the unprivileged sibling endpoint before declaring the fact unavailable; `raw.githubusercontent` reads public files when `gh api` 401s.
- **The patch endpoint 406s above 300 files**, poisoning any grep-based scan of it — use `compare`, and pair every absence claim with two controls: a non-zero control on the artifact and a positive control on the pattern.
- **Scope a deletion-PR diff to the PR, not to the dispatch's delta.** Prove dead-code claims with a double build and `cmp -s`, not a diff read; compare operand *kinds*, not counts.
- **A wake payload's `evicted` list is wrong in both directions — measured 0-for-5.** Only `RemovedFromMergeQueueEvent` with `reason=="failed_checks"` is an eviction; a red job is a fact about a *run*. Reject any blamed run whose start postdates the enqueue.
- **A completion notification from a detached launcher describes the launcher, not the work.** Wait on the real process (`pgrep -f ninja`), and verify a build **behaviourally** — grep the artifact for a string the commit introduced. A stale-looking artifact mid-build is indistinguishable from a failed build.

## A Wake Payload's `evicted` List Is Not a Measurement (2026-08-06 fold)

The pagination family above ends with "a degraded transport yields a well-formed, plausible, empty-or-short answer." The CI-babysitter wake payload is the productionized version of that failure, and it is wrong in **both** directions — enumerated against a 93-PR union population (79 non-draft open + 14 recently-merged) over the prior ~24h, the payload was **0-for-5: 1 false positive, 4 false negatives, 0 correct.** It named #12357 as evicted; truth was four evictions it never mentioned (#12252 06:51:45Z, #12353 00:41:16Z, #12363 14:01:51Z, #12365 15:25:54Z) plus one that never happened. **#12357 had an empty `RemovedFromMergeQueueEvent` list and was sitting in the queue at position 1** (`enqueuedAt 03:13:55Z`), while the run the payload blamed (`Check Submodule Pointers`, id 31068599983) **started 03:30:02Z — 16 minutes AFTER the enqueue** ([wake payload evicted list measured 0-for-5](../learnings/1785990268683-wake-payload-evicted-list-measured-0-for-5-enumera.md), [a payload can report an eviction that never happened](../learnings/1785989687956-wake-payload-can-report-an-eviction-that-never-hap.md)).

Both false positives in four hours (#12353, #12357) share one shape: **a failing job inside an in-flight merge-group run, mistaken for an eviction.** The category error is the whole lesson — **a red job is a fact about a *run*; only `RemovedFromMergeQueueEvent` is a record of an *eviction*.** A queue can run checks on a batch without evicting anything, and a red *non-required* check evicts nobody. The four real evictions were invisible for the mirror-image reason: **a PR's own head checks stay green after an eviction**, so nothing else in a head-sha-oriented sweep surfaces them. Enumerate per PR instead of consuming `evicted`:

```bash
gh api graphql -f query='
{repository(owner:"O",name:"R"){pullRequest(number:N){
  state mergeQueueEntry{position enqueuedAt}
  timelineItems(last:15,itemTypes:[REMOVED_FROM_MERGE_QUEUE_EVENT]){
    nodes{... on RemovedFromMergeQueueEvent{createdAt reason beforeCommit{oid}}}}}}}'
```

Require `reason == "failed_checks"` (`merged` and `checks_timed_out` are **not** evictions); empty node list ⇒ nothing to recover, log `action:"left"` and stop. Attribute cause from `beforeCommit.oid`, reading **both** check-runs and commit-status (the object-class rule from part 1), and **reject any candidate run whose `run_started_at` postdates the event or the enqueue** — that one timestamp comparison catches the whole false-positive class in a single step. Calibration worth carrying: **3 of the 4 real evictions self-recovered and merged with no action**, so the cost of the misses is lower than it looks, while the cost of the false positive is a requeue attempt against a *healthy* queue entry. ~90 API calls on a 93-PR population; run it every sweep.


## A Detached Build's "Exit Code 0" Describes the Launcher (2026-08-06 fold)

Same instrument-scope defect one layer down, on the local build. `setsid nohup cmake --build … &` plus the harness's *"Background command completed (exit code 0)"* notification describes **the shell wrapper exiting immediately**, not the compiler finishing. On slang#12371 two detached builds both reported exit 0, and a properly-conducted freshness check then produced a genuinely alarming picture: `slang-emit.cpp.o` at 03:43:34Z, `libslang-compiler.so` at **01:09:12Z — older than its own input**, and a behavioural probe for the merged PR's new diagnostic string in the built library at **0 hits**. That reads exactly like a silently-skipped link step. It wasn't: `pgrep -af ninja` showed **both builds still live** (and two `cmake --build` invocations racing in one ninja directory); ten minutes later the `.so` relinked at 03:54:41Z and the probe returned 1 ([setsid + run_in_background makes exit code 0 report the wrapper](../learnings/1785988615115-setsid-run-in-background-makes-exit-code-0-report-.md)).

⇒ ⭐⭐ **A stale-looking artifact mid-build is indistinguishable from a failed build — both readings were correct and the conclusion was wrong.** Check whether a builder is still alive before concluding anything: `pgrep -f 'ninja -f build-*.ninja'`, or arm a monitor that waits on the real process (`until ! pgrep -f ninja; do sleep 20; done`) rather than on an exit code — and never launch a second `cmake --build` against a live ninja directory. **The freshness check that actually works is behavioural**: grep the built binary or library for a string introduced by the commit you expect it to contain. Timestamps alone cannot separate "not built yet" from "built without your change", and `-v`/version strings are configure-time. Corollary for measurement hygiene: after a dependency merges, **rebuild the inputs too** — staged `.slang-module` files produced by the pre-merge binary would have made a "merged master" run a mixed-binary measurement.

## Reading a CI run: census, roll-ups, and the retry layers (2026-08-08 fold)

A run-level `conclusion` is a **roll-up census**, not a per-job verdict, so it can read `failure`
above zero failing check-runs ([Excluding an aggregator check from a DASHBOARD and from a TALLY are two different actions — doing only the first still double-counts](../learnings/1786164627761-excluding-an-aggregator-check-from-a-dashboard-and.md)). A census taken while a rerun is in flight is
the hardest kind of stale, because the field is **populated but not final** — staleness normally
announces itself as absence ([Two correct CI scans can disagree on failure count — reconcile the UNIT (current vs completed) before conceding or disputing](../learnings/1786164106546-two-correct-ci-scans-can-disagree-on-failure-count.md)). "Retried" is ambiguous across three distinct
retry layers, so the word alone cannot support a claim ([A `cancelled` CI job is three different things — only arithmetic tells them apart](../learnings/1786155858380-a-cancelled-ci-job-is-three-different-things-only-.md)). A **cancelled** job
tested nothing: it is neither evidence for nor against, and folding it into a failure streak inflates
the strongest number in a report ([A run-level CI conclusion is a ROLL-UP — census the jobs, and never compare the total to a remembered count](../learnings/1786153681937-a-run-level-ci-conclusion-is-a-roll-up-census-the-.md), [GitHub workflow identity is keyed to file path — pin the id but cross-check via the path endpoint, which 404s loudly](../learnings/1786153514241-github-workflow-identity-is-keyed-to-file-path-pin.md)). Job **names** are
not safe selectors — one name can be a strict prefix of a sibling's, so a prefix match silently
reports the wrong job ([A CI job name can be a strict prefix of a sibling's — anchor the match, and audit credit as hard as blame](../learnings/1786151349296-a-ci-job-name-can-be-a-strict-prefix-of-a-sibling-.md), [A prefix-collision selector reports a sibling job's result as yours](../learnings/1786151335188-a-prefix-collision-selector-reports-a-sibling-job-.md)). Workflow identity is keyed to
**file path**, so a rename mints a new id and retires the old one.
**Rule: bound every census (`rows == total_count`), take the newest row per job name within a naming
family, and treat any non-terminal `conclusion` as unknown rather than as a value.**

**Source learnings (14):**
- [Wake payload evicted list measured 0-for-5 — enumerate merge-queue evictions yourself every sweep](../learnings/1785990268683-wake-payload-evicted-list-measured-0-for-5-enumera.md) — 1 false positive, 4 false negatives, 0 correct on a 93-PR population; ~90 calls buys ground truth.
- [A wake payload can report an eviction that never happened — verify against RemovedFromMergeQueueEvent](../learnings/1785989687956-wake-payload-can-report-an-eviction-that-never-hap.md) — A red job is a fact about a run, not an eviction; reject any blamed run that started after the enqueue.
- [setsid + run_in_background makes "exit code 0" report the WRAPPER, not your build](../learnings/1785988615115-setsid-run-in-background-makes-exit-code-0-report-.md) — Wait on `pgrep -f ninja`; verify freshness behaviourally by grepping the artifact for a commit-introduced string.
- [Excluding an aggregator check from a DASHBOARD and from a TALLY are two different actions — doing only the first still double-counts](../learnings/1786164627761-excluding-an-aggregator-check-from-a-dashboard-and.md)
- [Two correct CI scans can disagree on failure count — reconcile the UNIT (current vs completed) before conceding or disputing](../learnings/1786164106546-two-correct-ci-scans-can-disagree-on-failure-count.md)
- [A `cancelled` CI job is three different things — only arithmetic tells them apart](../learnings/1786155858380-a-cancelled-ci-job-is-three-different-things-only-.md)
- [A run-level CI conclusion is a ROLL-UP — census the jobs, and never compare the total to a remembered count](../learnings/1786153681937-a-run-level-ci-conclusion-is-a-roll-up-census-the-.md)
- [GitHub workflow identity is keyed to file path — pin the id but cross-check via the path endpoint, which 404s loudly](../learnings/1786153514241-github-workflow-identity-is-keyed-to-file-path-pin.md)
- [A CI job name can be a strict prefix of a sibling's — anchor the match, and audit credit as hard as blame](../learnings/1786151349296-a-ci-job-name-can-be-a-strict-prefix-of-a-sibling-.md)
- [A prefix-collision selector reports a sibling job's result as yours](../learnings/1786151335188-a-prefix-collision-selector-reports-a-sibling-job-.md)
- [slang layer-C retry (retry-on-gpu-failure) is merge_group-ONLY and its GPU-health trigger has not fired in ~6 weeks — existence is not firing](../learnings/1786137766218-slang-layer-c-retry-retry-on-gpu-failure-is-merge-.md)
- [A check-run census taken while a rerun is in flight is not the run's verdict — poll until conclusion != null before writing "N failures" or "all green](../learnings/1786137761743-a-check-run-census-taken-while-a-rerun-is-in-fligh.md)
- ["Retried" is ambiguous across THREE retry layers in slang CI — and PendingRetry means a first-pass failure is never counted](../learnings/1786137292183-retried-is-ambiguous-across-three-retry-layers-in-.md)
- [A cancelled job tested nothing — so it cannot corroborate "retried and still failed"](../learnings/1786136609115-a-cancelled-job-tested-nothing-so-it-cannot-corrob.md)
