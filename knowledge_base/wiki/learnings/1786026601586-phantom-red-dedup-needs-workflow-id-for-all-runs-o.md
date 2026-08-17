---
title: "Phantom-red dedup needs workflow_id for ALL runs on the sha, not just failing ones"
type: learning
topic: misc
source: learnings/1786026601586-phantom-red-dedup-needs-workflow-id-for-all-runs-o.md
---

# Phantom-red dedup needs workflow_id for ALL runs on the sha, not just failing ones

## The defect

A phantom-red filter keyed on `(pr, workflow_id, job_name)` is the right key — but it silently breaks if you only resolve `workflow_id` for the runs that *contain a failure*.

I built the failing-run set first (`65` run ids out of `1384` total on 75 PRs' head shas), fetched `actions/runs/<id>` for just those, then joined. Every **sibling success** under the same `(pr, workflow, name)` got `wf = "UNKNOWN"`, so it landed in a *different* group key than the failure it should have superseded. The failure survived dedup as a "live red."

## Measured effect

5 of 84 "live reds" were phantoms — all the same shape: **two runs of one workflow on one sha, seconds apart, one `failure` + one `success`.**

- `12363|check-pr-label` — fail run `30992469631` @ 09:15:11Z, success run `30992479713` @ 09:15:19Z, both `workflow_id=295081936` / `.github/workflows/check-pr-label.yml`
- `11964|check-pr-label`, `11373|label`, `11087|label`, `10885|label` — same pattern

I wasted a classification pass on #12363's "missing label" when `gh pr view` showed `pr: non-breaking` present all along.

## Why this one is easy to miss

It **fails closed** (invents reds) — the opposite of the name-alone keying bug, which fails open (hides reds). A fabricated red costs you minutes of classification and looks like diligence; you only catch it by checking whether the thing the check complains about is *actually* true at HEAD. The `UNKNOWN` sentinel never appeared in output because I only printed rows that survived the filter.

## Fix

Resolve `workflow_id` per **sha**, not per run:

```bash
gh api "repos/<owner>/<repo>/actions/runs?head_sha=$FULL_40_CHAR_SHA&per_page=100"
```

One call returns every run on that sha *with* its `workflow_id`. 29 calls covered 29 red PRs.

Do **not** loop `actions/runs/<id>` over every run id — 1384 sequential calls blew a 10-minute timeout and returned nothing usable.

## Assert it

Emit a sentinel (`"UNRESOLVED-" + run_id`) instead of `"UNKNOWN"` for unmapped runs and print the count. If it's non-zero, the join is incomplete and your dedup is unsound in **both** directions.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786026601586-phantom-red-dedup-needs-workflow-id-for-all-runs-o.md`_
