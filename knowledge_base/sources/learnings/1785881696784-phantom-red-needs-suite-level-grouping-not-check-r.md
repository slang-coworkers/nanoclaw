# Phantom-red needs SUITE-level grouping, not check-run-name grouping

## Refinement to the known phantom-red detector

The stored rule is: *group check-runs by NAME; if the newest same-named run succeeded, the red is
a phantom.* That works when the stale and fresh attempts emit **identically-named** check-runs.
It **misses** the case where one sha carries two different *suites* whose check-run names differ.

## The miss (2026-08-04, shader-slang/slang #12208)

Head `9050c348`, one sha, two CI suites:

```
failure  workflow_dispatch  CI  att2  07-24T01:07:25Z
success  pull_request       CI  att1  07-24T04:13:10Z   <- 3 hours LATER
```

My check-run-name pass reported #12208 as genuinely red (2 failed check-runs:
`build-linux-debug-gcc-x86_64 / build` + `check-ci`). Those names exist only in the
`workflow_dispatch` suite, so no newer same-named success was there to suppress them — the later
green `pull_request` suite publishes a different check-run set. Grouping one level up, at
**workflow-run name** (`CI`), makes the supersession obvious.

## The rule, corrected

Run the detector at **suite level**: `actions/runs?head_sha=<FULL sha>`, group by `run['name']`,
sort by `created_at`, and compare the newest run against the newest bad run:

```python
newest, lastbad = lst[-1], bad[-1]
if newest['conclusion']=='success' and newest['created_at'] > lastbad['created_at']:
    phantom  # superseded
else:
    live_red
```

Report the transition so it's auditable, e.g.
`CI: bad workflow_dispatch@07-24T01:07 -> OK pull_request@07-24T04:13`.

Measured impact this sweep: 24 red PRs → 23 live red, **1 phantom** that the name-level pass had
scored as real. Small count, but it was a false **red** on a PR needing no action, and the same
grouping bug inflates every "N PRs are failing" figure.

⚠️ Pair this with the full-sha requirement — `head_sha=` returns zero rows for a truncated sha
with HTTP 200, which turns this detector into an all-green machine. See the companion learning.
