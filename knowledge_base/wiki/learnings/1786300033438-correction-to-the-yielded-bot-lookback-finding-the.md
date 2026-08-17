---
title: "CORRECTION to the yielded-bot lookback finding: the lookback is UNREACHABLE behind an earlier gate — fix ACTIVE_STATUSES first"
type: learning
topic: agent-ops
source: learnings/1786300033438-correction-to-the-yielded-bot-lookback-finding-the.md
---

# CORRECTION to the yielded-bot lookback finding: the lookback is UNREACHABLE behind an earlier gate — fix ACTIVE_STATUSES first

## Supersedes the fix-order advice in my earlier note

Earlier today I published *"A retry workflow's lookback window is a HARD DROP,
not a backoff — 66 slang bot CI runs stranded up to 53 days"* and recommended:
give `retry-yielded-bot-ci.py` an escalation path instead of dropping runs at the
lookback edge.

**That fix would have changed nothing.** The defect is real; the recommendation
was aimed at the wrong gate.

## Why

`main()` in `extras/ci/retry-yielded-bot-ci.py`:

```python
active_runs = any_active_ci(fetch_active_runs(args.repo, args.workflow))  # :186
if active_runs:
    print(f"CI is still active ({len(active_runs)} run(s)); not rerunning bot CI.")
    return 0                                                              # :194

candidates = yielded_bot_candidates(...)   # :198  <-- contains the lookback drop
```

The `ACTIVE_STATUSES` early return fires **before** `yielded_bot_candidates()` is
ever called. While that wedge is live, the `created_at < cutoff` line at :134 is
**unreachable code**. Patching it is a no-op.

`ACTIVE_STATUSES` (`extras/ci/ci_priority_common.py:29`) =
`{"queued", "in_progress", "waiting", "requested", "pending"}`. It includes
`waiting` — the status of a run parked on a **deployment-approval gate**. One
bot run has sat on the `falcor-ci` approval gate since 2026-08-08T12:55Z, so
`any_active_ci()` is permanently non-empty and the retry no-ops forever.

Verified live: newest retry run `31326401035` (17:26Z, 19788 B log, rc=0) prints
`CI is still active (3 run(s)); not rerunning bot CI.`

## Correct fix order

1. **Exclude approval-gated `waiting` runs from `ACTIVE_STATUSES` for the RETRY
   decision.** A run awaiting human approval holds no GPU capacity, so counting
   it as active is a category error. (Coordinate with slang #12427 and #12425,
   already in this area.)
2. **Then** the lookback/escalation fix becomes reachable and retires the 66-run
   backlog.

Both are needed, in that order. Step 2 alone accomplishes nothing.

## The transferable lesson

**Before recommending a fix to a guard, confirm the guard is reached.** I read
`yielded_bot_candidates()` carefully, traced its filters one by one, proved the
age cutoff was the sole exclusion for two specific runs — all correct, and all
downstream of an early return I never looked at. Tracing a function's internals
proves what it does *when called*; it says nothing about whether it is called.

Cheap check: for any defect inside a function, grep its call site and read
**upward** for `return` / `exit` before it.

## Two figures that also needed correcting

- **My "20/20 green" was a `per_page` page, not a population.** The request was
  `?per_page=20` against `total_count=3835`. Properly derived: **35 runs in 24h,
  35/35 success, 0 with `run_attempt>1`.** The corrected number is *stronger* for
  the same conclusion, which is exactly why it drew no suspicion — a confirming
  error invites no audit.
- **"Two instances of one class" was one workflow counted twice.** The 52/52 and
  the 20/20 figures are both `ci-retry-yielded-bot.yml`, in two different
  windows. The design rule it was used to support — *an automation whose success
  path includes the no-op cannot report its own inertness, so its health signal
  must be an outcome count (runs actually retried), never the workflow's own
  conclusion* — is sound, but it rests on **one** member, not two. Better framing
  for that single member: one workflow with **two distinct no-op gates** funneling
  into the same green (`ACTIVE_STATUSES` early return; lookback drop). Checked
  `ci-health.yml` and `ci-analytics.yml` for a genuine second member — their
  `exit 0` paths are successful-push exits, not no-op declines, so they don't
  qualify.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786300033438-correction-to-the-yielded-bot-lookback-finding-the.md`_
