---
name: watchdog-ncl-tasks-list-empty-not-a-freeze
description: "Scheduler-watchdog — an empty `ncl tasks list` WAS a real CLI lookup bug (root-caused by nanoclaw#1064), never a stall and never a display artifact; the fix is LIVE here since 08-04T10:40Z, so a fresh empty result now needs its own investigation"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4d963c83-265f-4246-9cbb-8b4d6ecd7926
---

# ⛔ ROOT CAUSE FOUND 2026-08-04 — this was a real bug, not a "display artifact"

`slang-coworkers/nanoclaw#1064` (szihs, merged `fcb39e4f`) root-caused the empty output: group-scoped
`tasks` lookups called `findTaskSessions()`, which matches only `messaging_group_id IS NULL AND
thread_id LIKE 'system:tasks%'`. Every agent caller is group-scoped (`groupArg` forces
`ctx.agentGroupId` and ignores `--all`), so my tasks — parked in `sess-1776713576150-9fon2n`
(`thread_id NULL`, `messaging_group_id mg-1776713211742-om8syu`) — failed the second predicate and
were invisible. Fix: `getActiveSessionsForGroup()`, so the group path scans like the global path.

**MINE-VERIFIED on my own edge (2026-08-04T08:46Z, host up since 08:13):**
```
ncl tasks list                                          → "No tasks."  exit 0
ncl tasks list --all                                    → "No tasks."  exit 0
ncl tasks list --session sess-1776713576150-9fon2n      → 5 live series ← the control
```
The `--session` path bypasses `selectedSessions`'s group branch via `ownSession`, which is **why it
sees what the group path cannot**. ⭐**That one-line control is the whole diagnosis** — and it is
exactly what "display artifact" reasoning stopped me from running for two days.

✅**FIX IS NOW LIVE ON THIS HOST — verified 2026-08-04T10:40Z**: bare `ncl tasks list` returns
**6 live series** (was `No tasks.` at 08:46Z). The earlier "fixed in source but NOT yet live" note was
accurate when written and is now superseded. ⇒ **An empty `ncl tasks list` is no longer explained by
this bug** — from here, treat a bare empty result as an unexplained observation to investigate, not as
the known CLI defect. Still re-probe rather than assuming either way.

⛔**Two of my numbers here were wrong; both came from unbounded/mis-flagged instruments:**
- I first enumerated "79 active sessions" in my group and found 0 task rows. `ncl sessions list`
  **silently caps at 200 rows, newest-first**, and my session was created 2026-04-20 — outside the
  page. At `--limit 10000` my group has **823** active sessions and the cited one is present.
  See [[feedback_ncl_sessions_list_agent_group_flag_not_filtering]] — same cap, second victim.
- `--status all` is **invalid-args** (`pending|paused` only), and I read its error as "0 rows".
  ⭐**An error is not an empty set** — check `ok`/exit, not just whether output looks blank.

⛔**The PR's own figures do not reproduce on my edge** — its "11 live task series (524 task rows)"
and a dead `*/5` heartbeat with 53 failures. I measure **5** live series, `failed_runs=0` on all
five, and **zero** `*/5` series. Probing all 10 plausible sessions in my group (`thread_id NULL` or
`system:tasks*`) finds task rows in **exactly one**. The mechanism is confirmed; the magnitude is
not. ⭐**Adopt a PR's mechanism without inheriting its counts.**

---

## (Original framing below — the *conclusion* "don't escalate" still holds; the *reason* was wrong)

Observed 2026-08-02 during the scheduler-watchdog run: `ncl tasks list --all` (and every `--group`/`--status`/`--json` variant) returns `data: []` even though `ncl groups list` (20 rows) and `ncl sessions list` return full host data — so the container-side ncl transport works, tasks just don't surface through it.

⛔**SUPERSEDED framing:** the claim below that this is only a "display artifact" is **wrong** — it is a
real lookup bug (see header). What survives is the *action*: still don't escalate "tasks vanished".

**Why this is NOT a freeze:** the watchdog and daily wiki-synth tasks *fired and reached the agent this very turn* (their scheduled-task blocks are in the turn context). A recurring series that fires is by definition live and armed. A genuine recurrence-freeze shows a task row with a **past `at=`**; an *absent* task that just fired is a different thing entirely — and un-re-armable anyway (no series id to pass to `update_task`).

**How to apply:** On a watchdog run, if `ncl tasks list` is empty, do NOT escalate "tasks vanished/frozen" — that contradicts the fact the watchdog itself is running. Send no message (per the watchdog's "nothing overdue → do nothing" rule). Only re-arm tasks that actually appear with a past `at=`. This is distinct from the coverage-checker stall in the shared learnings (that one leaves a visible overdue row). Related: [[feedback_benign_ack_loop_dont_restart_if_live_chains]].
