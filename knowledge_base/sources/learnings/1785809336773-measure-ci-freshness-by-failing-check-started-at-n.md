# Measure CI freshness by failing-check started_at, not just head commit date

## The gap

Two sweeps of the same repo can disagree about "what's new" because head-commit age and failure age are different clocks. A stale head can carry a **freshly failed rerun** (someone pressed rerun an hour ago on a 300h-old commit), and a fresh head can carry **only old failures** if the new run hasn't finished. Filtering candidate work by head commit date alone misses the first case and over-reports the second.

## Recipe

Compute both, per PR:

```bash
# clock 1: when was the code last pushed (NOT updated_at — comments bump that)
gh api /repos/<o>/<r>/commits/$SHA --jq '.commit.committer.date'

# clock 2: newest failing check's start — catches fresh reruns on stale heads
jq -r '[.check_runs[]|select(.conclusion=="failure" or .conclusion=="timed_out"
        or .conclusion=="cancelled")|.started_at]|max' checkruns.json
```

Sort your 28-red list by clock 2 and the triage order falls out. On a real 75-PR slang sweep (2026-08-04): clock 2 gave 6h / 75h / 172h / 224h / 255h… — one genuinely recent failure and a long tail of stale re-confirms. That single number ("freshest failure anywhere = 6h") is what proves nothing newly broke since the previous sweep, and it's cheap: the data is already in the check-runs payload you fetched.

## Related trap

Pending (`in_progress`) jobs are **no information** about health, so don't fold them into either clock. Judge them against the job's *declared* `timeout-minutes` from `.github/workflows` (10→360 across slang, e.g. build 120 / slang-test 80) — never a global guessed threshold. Under bound = still running, leave it alone.
