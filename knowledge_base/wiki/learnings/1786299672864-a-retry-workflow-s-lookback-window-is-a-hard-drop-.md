---
title: "A retry workflow's lookback window is a HARD DROP, not a backoff — 66 slang bot CI runs stranded up to 53 days"
type: learning
topic: slang-compiler
source: learnings/1786299672864-a-retry-workflow-s-lookback-window-is-a-hard-drop-.md
superseded_by: 1786300033438-correction-to-the-yielded-bot-lookback-finding-the
---

# A retry workflow's lookback window is a HARD DROP, not a backoff — 66 slang bot CI runs stranded up to 53 days

## The defect

`shader-slang/slang`'s `ci-retry-yielded-bot.yml` reruns bot CI runs that
intentionally yielded to human CI (the `wait-for-human-priority` gate in
`ci.yml`). Measured 2026-08-09: **66 bot `ci.yml` runs are permanently stranded
in the yielded state, oldest 1281h = 53.4 days.**

Root cause, read at source in `extras/ci/retry-yielded-bot-ci.py`,
`yielded_bot_candidates()`:

```python
created_at = parse_github_time(run.get("created_at"))
if created_at and created_at < cutoff:
    continue          # cutoff = now - lookback_hours
```

`ci-retry-yielded-bot.yml` passes `--lookback-hours 16`. That cutoff is a **hard
drop, not a backoff**: once a yielded run is older than 16h it is never a
candidate again, forever.

## Why the in-repo comment reads as if this is handled (but isn't)

The workflow comments:

> `--lookback-hours (16)` must stay above `wait-for-priority.py`'s
> `--max-yield-hours (12)` so a run ages out and escalates before this stops
> considering it.

The two windows **do not compose**. Escalation lives inside
`wait-for-priority.py` and only fires when the gate job *re-runs* and
re-evaluates its own age (`self_age_hours >= args.max_yield_hours`). A run that
is never rerun never re-evaluates, so it never escalates — it just falls out of
the retry window. Ordering the two numbers correctly is necessary but not
sufficient; the escalation needs a trigger, and the only trigger is the thing
the cutoff prevents.

## The generalizable lesson

**A "recent-window" filter in a remediation loop silently converts a transient
backlog into a permanent one.** The loop reports success the whole time — its own
runs are green (20/20 successes here) because *doing nothing* is a successful
run. Silence and health look identical.

Two checks that catch it:

1. **Look at `run_attempt` on the things the loop is supposed to fix.** All 15
   currently-yielded runs sat at `attempt=1`. A retry loop that works leaves
   `attempt>1` behind. Its own green runs prove nothing.
2. **Before calling it a defect, run the superseded control.** Of 8 stale runs I
   first flagged, **6 were legitimately superseded** by a newer run on the same
   branch (`has_newer_run_for_branch`), where `attempt=1` forever is *correct*.
   Only 2 were genuinely stranded. Then confirm the age cutoff is the *sole*
   excluding filter by walking every other candidate filter individually
   (conclusion, bot actor, attempt, gate-only jobs, newest-on-branch) — the leak
   claim is only as good as that per-filter audit.

## Not-my-scope note (CI babysitter)

These are `workflow_dispatch` runs on **draft** bot PRs, outside the non-draft
sweep population, and the workflow owns retrying them. Correct action is to
report for a maintainer fix (add an escalation path for runs past the ceiling,
or drop/raise the cutoff), not to fire 66 reruns.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786299672864-a-retry-workflow-s-lookback-window-is-a-hard-drop-.md`_
