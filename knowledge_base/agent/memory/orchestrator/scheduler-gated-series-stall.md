---
type: incident
description: 2026-10-13/14 — script-gated recurring series whose gate returns wakeAgent=false stopped advancing after the 14:03Z restart. CLOSED at tick 282 — cleared by the 10-14 06:06Z restart; the 11 i1xxxx per-issue gates were deleted (R10 cleanup, nanoclaw PR #1948), not stuck.
---

# Script-gated recurring series stall (CLOSED tick 282; first seen tick 281)

**Symptom (measured 2026-10-14 00:00–00:33Z, Main's group):** recurring series with a `--script` whose gate
returns `{"wakeAgent": false}` keep their past `process_after` and never mint the next occurrence.
- Stuck since 18:00Z: `okf-memory-synthesis-4fba`, `dispatch-13472-after-131-0e0a` (occurrence rows inserted 12:02Z).
- Stuck since 00:00Z (still at 00:33Z): i13580/81/82, i13603, i13433, i13446, i13435, i13407 maintainer gates.
- Control: gates that returned `wakeAgent:true` (i13531/13533/13464) advanced to 12:00Z; unscripted series fine.
- Their sessions show `container_status: running`, `last_active` bumped at 21:01Z and 00:02Z, but no new rows.
- The scripts themselves run fine by hand (`okf_synth.py gate`, `tools/pr13171-merged-gate.sh` → false in <1 s).

**Hypothesis (unverified):** a false gate's `processing_ack` (`completed`, written by `sqliteMarkScriptSkipped`)
isn't being synced/recorded, or the containers are marked running but not polling. Lead: agent-runner #3918
(`15c6124f6`) landed ~14:04Z, at the restart. Needs host-side `processing_ack` inspection.

**Watchdog rule:** do NOT re-arm — the session evidence reads "fired", and a `processAfter` bump can't fix a
completion bug. Re-check each tick; if the next tick shows them advanced, close this note.

Related: [[orchestrator/supervise-tick-runbook.md]].

## Resolution (tick 282, 2026-10-14 12:30Z)

- `okf-memory-synthesis-4fba` and `dispatch-13472-after-131-0e0a` fired at 12:00Z with `gated_runs` 2 and next 18:00Z, so the
  stall cleared after the 06:06Z instruction-update restart. Root cause never confirmed.
- All 11 recurring `i1xxxx-*-gate` series (the 8 stuck ones + i13531/13533/13464) return `task not found` from `ncl tasks get`
  and are absent from `ncl tasks list`. Their `system:tasks:` sessions were all `closed` at 06:06:41Z. That matches the
  operator's merged nanoclaw PR #1948 (`cb13820d8`: "reject agent per-issue recurrences … Ten such gates are live on prod").
  I read it as a deliberate R10 cleanup and did **not** re-create them; the operator was asked which, if any, need one-shot
  `--process-after` re-checks. Their issues stay on the board with dispositions; webhooks still deliver replies.
- Watchdog consequence: a missing series is not "stalled". Never re-create a deleted per-issue recurrence (R10, and the
  CLI now rejects it for agent callers anyway).
