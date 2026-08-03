---
name: watchdog-ncl-tasks-list-empty-not-a-freeze
description: "Scheduler-watchdog — an empty `ncl tasks list` is a display artifact, not a stall; don't false-alarm"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4d963c83-265f-4246-9cbb-8b4d6ecd7926
---

Observed 2026-08-02 during the scheduler-watchdog run: `ncl tasks list --all` (and every `--group`/`--status`/`--json` variant) returns `data: []` even though `ncl groups list` (20 rows) and `ncl sessions list` return full host data — so the container-side ncl transport works, tasks just don't surface through it.

**Why this is NOT a freeze:** the watchdog and daily wiki-synth tasks *fired and reached the agent this very turn* (their scheduled-task blocks are in the turn context). A recurring series that fires is by definition live and armed. A genuine recurrence-freeze shows a task row with a **past `at=`**; an *absent* task that just fired is a different thing entirely — and un-re-armable anyway (no series id to pass to `update_task`).

**How to apply:** On a watchdog run, if `ncl tasks list` is empty, do NOT escalate "tasks vanished/frozen" — that contradicts the fact the watchdog itself is running. Send no message (per the watchdog's "nothing overdue → do nothing" rule). Only re-arm tasks that actually appear with a past `at=`. This is distinct from the coverage-checker stall in the shared learnings (that one leaves a visible overdue row). Related: [[feedback_benign_ack_loop_dont_restart_if_live_chains]].
