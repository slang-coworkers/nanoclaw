---
title: "A merge-group job failure is not an eviction — a superseding green batch can still merge the PR"
type: learning
topic: verification
source: learnings/1786091523426-a-merge-group-job-failure-is-not-an-eviction-a-sup.md
---

# A merge-group job failure is not an eviction — a superseding green batch can still merge the PR

## What I got wrong

A failing `merge_group` CI run is **not** evidence the PR was evicted. GitHub can form a
**new batch** for the same PR; if that later batch is green, the PR merges and the earlier
failing batch is simply superseded.

Measured 2026-08-06..08-07 on shader-slang/slang, both with the tracked
`test_GBufferRTTexGrads_d3d12` AV (`return code 3221225477`):

| PR | failing batch | outcome |
|---|---|---|
| #12322 | `pr-12322-0ce673de` 01:55Z | **MERGED** 03:30Z — merge_commit `e82a9317` **is** the head of the *green* `pr-12353` batch (01:56Z) |
| #12359 | `pr-12359-702c471f` 19:52Z | **MERGED** 00:55Z via green `pr-12359-d7d59f37` batch (23:27Z) |

Zero evictions from two merge-group failures. The authoritative signal is the
`RemovedFromMergeQueueEvent` in the PR timeline (with its `reason` and `beforeCommit`) —
never the conclusion of a merge-group run.

Batch branches are named after **one** PR in the batch, so `pr-<N>-<sha>` does not mean
"only N". Resolve membership by matching the PR's `merge_commit_sha` against batch heads.

## The reasoning error worth keeping

I wrote this up as "contradicts my stored verdict that this flake is the dominant evictor",
then checked the stored claim at source and found it **stood**: #12322's *earlier*
eviction (2026-08-05T00:09:14Z, `failed_checks`, `beforeCommit 133aa07bcd4e`) has 45
check-runs of which exactly 2 failed — `check-ci` (a pure aggregator) and
`test-falcor / Test (Falcor)`. A real Falcor-caused eviction.

**A window is not a property.** "Caused 0 evictions" was true of a 26-hour window only;
as a general sentence it was false. Both facts coexist: top-frequency failure
(5 of 52 terminal real-runs = 9.6%) *and* a proven historical evictor. Before writing a
zero as a verdict, name the window — and check whether the stored claim you think you're
refuting was measured on a different one.

## Bucketing note

`test-falcor / Test (Falcor)` and `test-falcor / Test (Falcor Perf)` are **two distinct
jobs**; a `test("Falcor")` regex conflates them and can make one PR look like it has a
duplicate-named job. Also split the real Windows run (`steps>=8`, ~309 KB log, names the
crash) from the Linux bridge poller (`steps==3`, ~2.2 KB, only reports an internal GitLab
pipeline status). Compute failure ratios from `success+failure` only — excluding the 15
`cancelled` and 2 `steps==0` rows, which are UNTESTED, not healthy.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786091523426-a-merge-group-job-failure-is-not-an-eviction-a-sup.md`_
