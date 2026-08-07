---
title: "Merge-queue checks_timed_out: an outage evicts PRs with zero failing checks"
type: learning
topic: misc
source: learnings/1786054584563-merge-queue-checks-timed-out-an-outage-evicts-prs-.md
---

# Merge-queue checks_timed_out: an outage evicts PRs with zero failing checks

## What happened

During the 2026-08-06 GitHub Actions control-plane outage, PR #12348 was evicted from the merge queue with `RemovedFromMergeQueueEvent reason=checks_timed_out` — while having **zero failing checks**. Its merge-group CI run (31122984116) was created 17:23:26Z and was still `queued` with **zero jobs started** at 22:07Z (4h44m). The queue timed it out because the required checks never got a runner.

## Why this is worth knowing

`checks_timed_out` is a distinct eviction reason from `failed_checks`, and it needs the opposite reading:

- `failed_checks` → something ran and failed → classify the failure.
- `checks_timed_out` → **nothing ran** → there is no failure to classify, and a requeue re-enters the same stalled queue and times out again.

The wake payload blamed a *different* run (`CI SlangPy Trigger Test`, sole job cancelled at `steps=0`) — also an outage artifact. If you classify from the blamed run you conclude "SlangPy is broken"; if you read the eviction reason plus the queue-branch run's `status`, you get the real story.

## How to apply

On any eviction, pull `reason` from the timeline event, then check whether the merge-group run on `gh-readonly-queue/<base>/pr-<N>-<sha>` ever started jobs:

```bash
gh api "repos/$REPO/actions/runs?per_page=100&event=merge_group" \
  --jq '.workflow_runs[]|select(.head_branch|test("pr-<N>"))|[.id,.name,.status,(.conclusion//"-"),.created_at,.updated_at]|@tsv'
```

A long-`queued` run with no started jobs means the eviction is an infrastructure timeout — leave it, and say so.

## The non-obvious part: a "contradiction" that isn't

Two earlier sweeps that day had recorded #12348 as a **phantom** eviction (correctly — no `RemovedFromMergeQueueEvent` existed then). My fresh derivation found a real one, which normally is a defect signal that your instrument or a stored verdict is wrong.

It was neither: the eviction landed 21:22:37Z, **70 minutes after** the prior sweep's 20:12Z write. Before treating a new-vs-stored disagreement as a defect, **diff the event timestamp against the prior sweep's write time** — a genuinely new event is not a reversal, and recording it as one would defame your own earlier correct call.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786054584563-merge-queue-checks-timed-out-an-outage-evicts-prs-.md`_
