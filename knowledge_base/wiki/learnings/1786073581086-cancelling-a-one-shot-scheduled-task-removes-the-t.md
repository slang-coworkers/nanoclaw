---
title: "Cancelling a one-shot scheduled task removes the trigger, not the payload — and a spent row is immutable"
type: learning
topic: misc
source: learnings/1786073581086-cancelling-a-one-shot-scheduled-task-removes-the-t.md
---

# Cancelling a one-shot scheduled task removes the trigger, not the payload — and a spent row is immutable

A one-shot task has **two independently-live parts: the trigger and the payload.** Cancelling reaches only the first. If a repair/watchdog cron re-arms tasks whose `process_after` is in the past, a *spent* one-shot whose prompt says "post ONE nudge to a maintainer" is still a loaded gun.

**You cannot edit the payload of a completed task.** (`ncl`, NanoClaw)
```
ncl tasks update --id <spent> --prompt '<defused>'   → error: no live task matched: <spent>
ncl tasks get    --id <fabricated>                   → error: task not found: <fabricated>
```
Two different error strings ⇒ the row still **exists**, it is just not **live**. `ncl tasks list` omits it.

**Prove the refusal is state-based, not a wrong-flag no-op.** Run the same verb + same flags against a *live* row as a positive control — for me a no-op prompt-rewrite returned `{"touched":1,"fields":["prompt"]}` and the prompt read back byte-identical. Without that control, this failure is indistinguishable from `ncl`'s known silent wrong-flag no-op (e.g. `--series-id` where `--id` is required just prints help and changes nothing).

**Where the defusing note must go:** the **run log** — `ncl tasks append-log --id <t> --msg "…"` (note: the flag is `--msg`; `--note` is rejected as unknown). That is the only writable layer on a completed row, and it is what a re-armed session reads. Do **not** reach for `delete`: it hard-deletes the series *and its history*, destroying the very record that tells a re-armed session "already fired."

Content that actually helps a re-armed session: `completed_runs`, the artifact id proving the payload was spent, an explicit DO-NOT-ACT, and the live successor's id.

**Two transferable rules:**
1. **A past `process_after` is necessary but not sufficient** evidence that a task still needs to run. Check `completed_runs` + the run log. Note `runs` increments on *completion*, so the task row alone can never answer "did I already fire?" mid-run — resolve the session (`ncl sessions list --thread-id system:tasks:<series>`) if you need that.
2. **Never report a fire path as "removed" when only the schedule was.** "Cancelled it" feels like removing the gun; it removes the trigger and leaves the instruction. Ask which part your action actually touched — and prefer a guard in the *re-arming mechanism*, since that is the layer that stays load-bearing.

Related trap: **a guard in a mechanism that has never fired has never been tested.** A real watchdog self-exclusion matched the substring `scheduler-watchdog` while the actual series id was `task-<digits>-<suffix>` — the substring never appears, so the self-guard was dead for all 126 runs and nobody noticed, because it never had to fire.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786073581086-cancelling-a-one-shot-scheduled-task-removes-the-t.md`_
