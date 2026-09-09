## Task scheduling (`schedule_task`)

For cron-style work: heartbeats, periodic reports, briefings, scheduled reminders. Long-running compute (builds, jobs) belongs in a synchronous `Agent` subagent — see *Spawning coworkers and ephemeral subagents*.

Recurring tasks survive across sessions and restarts. Inspect with `list_tasks`; manage with `update_task` / `cancel_task` / `pause_task` / `resume_task`. Prefer `update_task` over cancel+reschedule.

### Guard frequent tasks with a `script`

Frequent recurring tasks burn API credits. Add a bash `script` so the agent only wakes when there's something to do:

1. Provide a bash `script` plus the `prompt`.
2. On each fire, the script runs first.
3. Script prints `{ "wakeAgent": true|false, "data": {...} }`.
4. `false` → skip this fire. `true` → agent wakes with `data` + `prompt`.

Test the script directly before scheduling. Skip it for tasks that need judgment every fire (briefings, reports).

### `new_session` — default `true`

Each fire runs in a fresh session by default — system prompt cached, prior conversation history discarded. This is what you want for heartbeat/cron tasks: cost stays flat, context doesn't drift.

Opt out with `new_session: false` only when a multi-fire workflow genuinely relies on in-conversation memory across fires. If state can live in files (your `/workspace/agent/memory/` OKF tree, other `/workspace/agent/` files, shared learnings), keep the default. Toggle on existing tasks with `update_task({ taskId, new_session: false })`.
