---
title: "Reading a CI Run — Census, Roll-Ups & the Retry Layers"
type: concept
group: ci-tooling
tags: [gh-cli, github-api, ci-health, check-runs, retry, merge-queue, roll-up, slang]
source_count: 11
---

# Reading a CI Run — Census, Roll-Ups & the Retry Layers

Reading a run's verdict is not one measurement — it is a census over jobs, taken at a moment, keyed by a name that may collide, under a `conclusion` that rolls several things up and may not yet be final. Each of those four seams emits a believable wrong number. This page is how to read a run so the number survives.

## TL;DR

- **A run-level `conclusion` is a roll-up census, not a per-job verdict** — it can read `failure` above zero failing check-runs. Census the jobs; never compare the total to a *remembered* count.
- **A census taken while a rerun is in flight is the hardest kind of stale** — the field is populated but not final. Poll until `conclusion != null` before writing "N failures" or "all green".
- **"Retried" is ambiguous across three distinct retry layers** in slang CI, and `PendingRetry` means a first-pass failure is never counted — the word alone cannot support a claim.
- **Layer-C retry (`retry-on-gpu-failure`) is merge_group-ONLY** and its GPU-health trigger has not fired in ~6 weeks — **existence is not firing**; don't credit a retry mechanism you never saw run.
- **A `cancelled` job tested nothing** — it is neither evidence for nor against, so it cannot corroborate "retried and still failed", and folding it into a failure streak inflates the strongest number in a report.
- **Job names are not safe selectors** — one name can be a strict prefix of a sibling's, so a prefix match silently reports the wrong job. Anchor the match; audit credit as hard as blame.
- **Workflow identity is keyed to file path** — a rename mints a new id and retires the old one; pin the id but cross-check via the path endpoint, which 404s loudly.
- **Excluding an aggregator check from a DASHBOARD and from a TALLY are two different actions** — doing only the first still double-counts.
- **Rule:** bound every census (`rows == total_count`), take the newest row per job name within a naming family, and treat any non-terminal `conclusion` as unknown rather than as a value.

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

## The retry layers in detail: three layers, PendingRetry, and "existence is not firing"

The word "retried" collapses **three distinct retry layers** in slang CI, and the collapse is what
lets a false streak survive. The most dangerous of the three for counting is that **`PendingRetry`
means a first-pass failure is never counted** — a job scheduled for retry drops out of the failure
tally before its retry resolves, so a naive census undercounts exactly the failures that are being
actively worked. Disambiguate which layer you mean before the word "retried" enters a report; only
arithmetic over per-attempt states tells the layers apart ([\"Retried\" is ambiguous across THREE retry layers in slang CI — and PendingRetry means a first-pass failure is never counted](../learnings/1786137292183-retried-is-ambiguous-across-three-retry-layers-in-.md)).

**Existence is not firing.** Layer-C retry — the `retry-on-gpu-failure` mechanism — is
**merge_group-ONLY**, and its GPU-health trigger **has not fired in ~6 weeks**. A mechanism that
exists in the workflow file is not a mechanism you observed run; crediting a GPU-failure retry that
never triggered is the same category error as reading a populated field as a final one. Confirm a
retry layer *fired* on the run in front of you before attributing recovery to it ([slang layer-C retry (retry-on-gpu-failure) is merge_group-ONLY and its GPU-health trigger has not fired in ~6 weeks — existence is not firing](../learnings/1786137766218-slang-layer-c-retry-retry-on-gpu-failure-is-merge-.md)).

**Poll until the verdict is final.** A check-run census taken while a rerun is in flight is **not the
run's verdict** — the fields are populated but the run has not converged, and this is the staleness
that does *not* announce itself as absence. Poll until `conclusion != null` (every counted job
terminal) before writing "N failures" or "all green"; a mid-flight census written as a verdict is
the single easiest way to publish a wrong CI status that looks fully sourced ([A check-run census taken while a rerun is in flight is not the run's verdict — poll until conclusion != null before writing \"N failures\" or \"all green](../learnings/1786137761743-a-check-run-census-taken-while-a-rerun-is-in-fligh.md)).

**A cancelled job tested nothing.** Because it ran nothing, a `cancelled` job cannot corroborate
"retried and still failed" — it is neither evidence for the failure nor against it, and it must be
excluded from a failure streak rather than counted toward it. Folding a cancelled job into a streak
inflates the strongest number in a report, and the strongest number is the one an upstream reader is
most likely to act on ([A cancelled job tested nothing — so it cannot corroborate \"retried and still failed\"](../learnings/1786136609115-a-cancelled-job-tested-nothing-so-it-cannot-corrob.md)).

**Source learnings (11):**

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

_Catalog: [index](../index.md)_
