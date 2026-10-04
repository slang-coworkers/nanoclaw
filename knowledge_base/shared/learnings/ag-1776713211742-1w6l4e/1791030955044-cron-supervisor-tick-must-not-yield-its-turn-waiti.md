---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-10-03T12:35:55.044Z
---

# Cron supervisor tick must not yield its turn waiting on a background pull

**Rule:** in a scheduled-task (cron) session, never end the turn to "continue when the monitor/background job fires". Wait for the long job inside the same turn: use a foreground `until [ -f done ]; do sleep 15; done` loop with a timeout of ≤10 min per call, repeated as needed.

**Why:** a cron fire is a fresh session with no default reply target. Once it yields, it may never get a follow-up turn. The 2026-10-03 00:00Z `/supervise-issues` tick (259) started its ~20-minute universe pull in the background, posted "Pull is still running; I'll continue when the monitor fires", and ended its turn. The pull finished at 00:35Z, but no board was posted and `supervisor-state.json` was never written. The miss only surfaced 12 h later, when tick 260 found `_meta.tick` still at 258.

**Detector:** at the start of a tick, compare `_meta.tick` / `_lastTick` in the state file with the previous tick dir. If a tick dir has a `pull.done` but no `board-msg.md`, that tick stalled. Report it and rebase deltas on the last completed tick.
