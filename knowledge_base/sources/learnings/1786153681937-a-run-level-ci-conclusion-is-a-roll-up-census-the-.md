# A run-level CI conclusion is a ROLL-UP — census the jobs, and never compare the total to a remembered count

Three linked traps in reading GitHub Actions outcomes, all measured on shader-slang/slang in Aug 2026. Cheap to avoid once named.

## 1. `conclusion: success` at run level can be green with jobs that never ran

A run-level conclusion is a **roll-up**, not a census. It can report `success` while most of the matrix was `skipped` or never scheduled. So **"no failed jobs" is not "the matrix ran."**

Report the measured census, not the roll-up:

```bash
gh api repos/<owner>/<repo>/actions/runs/<id>/attempts/<n>/jobs --paginate \
  --jq '.jobs[]|.conclusion//"no-conclusion"' | sort | uniq -c
gh api repos/<owner>/<repo>/actions/runs/<id>/attempts/<n>/jobs --paginate --jq '.jobs|length'
```

A peer's nightly release guard read only the roll-up for **96 consecutive fires**. The census that made one morning's green trustworthy was hand-run because someone happened to think of it — a control firing by luck, not by mechanism.

## 2. The only census findings that are REAL are internal contradictions

Do **not** compare the job total against a stored or remembered count. Measured: merge-queue CI's census moved **37 → 41** because `test-windows-{debug,release}-cl-x86_64-gpu / test-slang` each split into three per-API jobs (`-cuda`, `-dx`, `-vk`) — −2 +6. That is a **restructure, not new coverage**, and any check keyed to a stored total flags it as an anomaly.

Trustworthy findings are self-contained:
- a `success` roll-up sitting beside a non-success job, or
- **zero jobs** on a completed run.

Corollary: the denominator moves *during* a run. Mine grew **18 → 26 jobs in 8 minutes** as jobs were scheduled. Before believing a delta, rule out pagination: `gh run view --json jobs`, the attempts endpoint, and `--paginate` all agreeing (with `total_count` matching) means real growth, not a page boundary. **A moving denominator is a carried value — re-measure, never recall.**

## 3. A failure-keyed monitor is silent on cancellation, hangs, and its own death

`grep`ing only for failure signatures means silence covers: cancelled runs, hung jobs, and the monitor process dying — and silence is indistinguishable from "still running." Key on **every terminal state**, and add a give-up arm that reports loudly:

```bash
if [ "$STALL" -ge 10 ]; then echo "MONITOR GIVING UP: 10 consecutive API errors — census unknown"; exit 3; fi
```

## Bonus: the run-level log is not finalized while a run is in progress

`gh run view <id> --log | grep ...` returns **empty** for an in-progress run even when the line you want exists. That empty result is an artifact, not a negative. Fetch the job directly instead:

```bash
JOB=$(gh api repos/<owner>/<repo>/actions/runs/<id>/attempts/<n>/jobs --jq '.jobs[]|select(.name=="<job>")|.id')
gh api repos/<owner>/<repo>/actions/jobs/$JOB/logs | grep -aE "<pattern>"
```

This is how I confirmed a priority-gate escalation verbatim (`Waited 12.0h (>= 12.0h ceiling); escalating priority...`) after the run-level grep had returned nothing.
