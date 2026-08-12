# ncl tasks list returns "No tasks" even while a scheduled task is running — never conclude "no cron exists" from it

# `ncl tasks list` can report "No tasks" while a scheduled task is actively executing

**Observed 2026-08-04**, investigating who owns the daily slang Release-CI check.

I was invoked *by* a scheduled task — the turn arrived with a guard-script payload
(`{"run_id": ..., "conclusion": "success"}`) plus a cron-style prompt. While running inside
that very task, every form of the task query returned empty:

```
ncl tasks list --all                                  -> No tasks.
ncl tasks list                                        -> No tasks.       (container auto-fill)
ncl tasks list --group <my-group-id>                  -> No tasks.
ncl tasks list --group <recipient-group-id>           -> No tasks.
ncl tasks list --status pending --all                 -> No tasks.
ncl tasks list --status paused  --all                 -> No tasks.
```

A demonstrably-live task was invisible to the instrument meant to enumerate it.

## Rule

**Do not infer "nothing is scheduled" / "no cron owns this" / "the wiring is inverted" from an
empty `ncl tasks list`.** The empty result is evidence about the query surface, not about the
scheduler. It is a capability-negative, and capability-negatives must be re-probed against a
known-positive control before being load-bearing — here the control was free: *I was the
running instance of the thing it claimed did not exist.*

## Why this bites

The natural next step from "No tasks" is an ownership conclusion ("parent must be doing this
manually", "the cron was never created", "let me create one") — which can produce a **duplicate
schedule** on top of an invisible live one, or a wrong escalation to the operator about broken
wiring. Both are worse than admitting the owner is unknown.

## What to do instead

- To answer *who fires this*, use the artifact's own provenance, not the task table:
  `gh api repos/O/R/actions/workflows/<id>/runs --jq '.workflow_runs[] | "\(.created_at) \(.event) \(.triggering_actor.login)"'`
  — a stable actor + stable wall-clock minute is strong evidence of an automated dispatcher,
  and it tells you whether the trigger is even inside this fleet.
- To confirm a task exists at all, look for its *effects* (session `last_active` stamps at the
  cron minute, run-log rows, the payload shape of the invoking turn).
- If you still cannot attribute it, **say "owner unattributed"** rather than naming one.
  `ncl sessions list --agent-group-id <id>` does work and shows the sessions the fires land on.

## Related instrument note (same investigation)

`ncl sessions list --agent-group <id>` is silently useless — `--agent-group` is not a recognized
filter there and the command returns the *unfiltered* global list, so a grep for your group can
come back empty and read as "this group has no sessions". The real flag is
`--agent-group-id`. (`ncl tasks list` uses `--group`; `ncl sessions list` uses
`--agent-group-id`. Two resources, two different flag names for the same concept — check
`ncl <resource> help <verb>` rather than reusing the flag that worked last.)
