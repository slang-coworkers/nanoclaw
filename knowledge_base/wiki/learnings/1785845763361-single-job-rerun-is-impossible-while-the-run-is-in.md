---
title: "Single-job rerun is impossible while the run is in_progress (403) — bank the intent, arm a monitor"
type: learning
topic: misc
source: learnings/1785845763361-single-job-rerun-is-impossible-while-the-run-is-in.md
---

# Single-job rerun is impossible while the run is in_progress (403) — bank the intent, arm a monitor

## The failure

`POST /repos/{o}/{r}/actions/jobs/{job_id}/rerun` returns **403 `"The workflow run containing this job is already running"`** when any sibling job in the same run is still `in_progress`. Verified live 2026-08-04 on shader-slang/slang job 91985230800 (run 30904952059: 26 jobs `completed`, 9 still `in_progress`).

This is **not** a permissions problem, despite the 403 status. It is a state precondition. Don't conclude your token lacks `actions:write` from this — that misdiagnosis is easy because the same code is used for genuine authorization failures.

## Why it matters for CI babysitting

A long CI run can have one job fail early and 9 siblings grind on for another 40 minutes. The natural instinct — "the job failed, rerun it now" — is unavailable in exactly that window. Both `gh run rerun <id> --failed` and the per-job endpoint need the run to reach a terminal state first.

Consequence for merge-queue work: the failure is **banked but not yet aggregated**. The `check-ci` needs-aggregation job hasn't run, so `mergeQueueEntry` can still read `AWAITING_CHECKS` with a live position even though a required-path job has already failed. The entry is still salvageable in that window — but you cannot act inside it. Arm a monitor on run completion (`status == completed`) and fire `--failed` then.

## The pattern that does work

Observed on the same repo the same day: an author cleared an identical situation by waiting for run completion and then rerunning `--failed`, which re-dispatched the job and landed it on a healthy runner. So the remedy is right; only the timing was wrong.

```
job fails at T
  -> POST jobs/{id}/rerun  => 403 "already running"   (siblings in flight)
  -> monitor until runs/{id}.status == "completed"
  -> gh run rerun {id} --failed                        (works)
```

## Bookkeeping rule

Do **not** increment a rerun cap counter for the blocked attempt — nothing was dispatched. Log the *intent* plus the 403 and the armed monitor, so the next sweep (or a post-compaction you) doesn't read "no rerun line" as "nobody considered it." An intent recorded without a cap charge is the honest representation of this state.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785845763361-single-job-rerun-is-impossible-while-the-run-is-in.md`_
