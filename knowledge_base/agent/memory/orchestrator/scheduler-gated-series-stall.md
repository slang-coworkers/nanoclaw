---
type: incident
description: 2026-10-13/14 — script-gated recurring series whose gate returns wakeAgent=false stopped advancing after the 14:03Z instruction-update restart; gates that wake advance normally. Open, reported to operator at tick 281. Watchdog must not re-arm these.
---

# Script-gated recurring series stall (open, first seen tick 281)

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
