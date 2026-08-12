# Prove rerun futility with the QUEUE, not the status page — measure median wait

## The question a CI babysitter must answer during an Actions incident

"Is the outage over, so can I rerun?" The status page is the wrong instrument and a single green sample is worse.

Observed 2026-08-06 in shader-slang/slang. A prior sweep at 16:33Z had proven futility with a sibling retry that re-failed. By 18:00Z that proof was **stale** — and the naive re-probes disagreed:

- **Status page**: `Actions = major_outage`, incident still `investigating`. Suggests "don't act" — but the component field lags and had a stale `updated_at` (16:33Z, ~2h old).
- **Green-sample probe**: REUSE Compliance Check was red 16:34–16:40Z but **green at 17:04Z and 17:34Z**; Check Formatting and PR Maintenance green too. Reads as "recovered → rerun now."

The green sample was the seductive one: it's a *fresh measurement of real runs* and it confirmed the convenient conclusion. It was still wrong.

## The measurement that actually decides it

Count queued/pending run-attempts and compute how long they've been waiting:

```bash
gh api "/repos/OWNER/REPO/actions/runs?per_page=100&page=N"
# then: status in (queued, pending), age = now - (run_started_at or created_at)
```

Result: **103 run-attempts queued, median wait 51.4 min, 71/103 waiting >30 min, oldest 75 min** — including trivial GitHub-hosted checks like `Verify PR Labels` stuck 72 minutes. And since 17:34Z (40 min) **nothing terminal had completed** except 3 lightweight checks.

So the greens were survivor bias: the few cheap jobs that squeezed through, not evidence the fleet was healthy. A rerun fired then would have joined the back of a 51-minute queue.

## Rules

1. **A green sibling proves that job ran, not that the fleet recovered.** Cheap GitHub-hosted checks recover first; self-hosted GPU legs recover last. Don't generalize across runner classes.
2. **Read the incident text, not the component enum.** The 18:11Z update said runs are "still failing or delayed in starting" and "self-hosted runners may see errors or rate limiting when runners register" — that names the exact fault class that kills GPU legs, which no component color conveys.
3. **Queue depth + median wait is the futility metric.** It's one cheap API call and it's a *direct* measure of what a rerun would experience.
4. **Absence of fresh failures is not health during an outage** — it's the absence of *completions*. Bucket 4-way (`status` before `conclusion`): a window with 0 failures and 35 queued is a stalled fleet, not a green one. A failure-only reading folds "nothing finished" into "everything's fine."

## Outage kill signature (Slang CI, this incident)

`filter` job → `cancelled` with `steps=0` (never executed a step) → downstream jobs `skipped` → `check-ci` aggregator reports dependency `result: "abandoned"`. Separately, `board-sync` logged verbatim: `Failed to resolve action download info. Error: Service Unavailable` and `##[error]Service Unavailable`.

A job cancelled with `steps=0` is **untested, not failed** — and a cancelled merge-group job is not evidence of a code problem.
