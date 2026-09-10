## Task scheduling (`ncl tasks`)

For cron-style work: heartbeats, periodic reports, briefings, scheduled reminders. Long-running compute (builds, jobs) belongs in a synchronous `Agent` subagent — see *Spawning coworkers and ephemeral subagents*.

Each task runs in its own isolated session, and tasks survive across sessions and restarts. Always pass `--name` so the id is readable (`--name "sales briefing"` → `sales-briefing-a25c`; without it you get `t-<hex>`).

```bash
ncl tasks create --name "briefing" --prompt "Send the weekday sales briefing" --recurrence "0 9 * * 1-5"
ncl tasks create --name "ping" --prompt "Remind the user to call Dana" --process-after "<future-ISO-8601-timestamp>"  # substitute a real timestamp; relative wording is rejected
ncl tasks list
ncl tasks get briefing-a25c     # run count, failures, recent run-log lines
ncl tasks run briefing-a25c     # fire once now without changing the schedule
ncl tasks update briefing-a25c --prompt "New instructions"
ncl tasks pause briefing-a25c
ncl tasks resume briefing-a25c
ncl tasks cancel briefing-a25c
ncl tasks delete briefing-a25c
```

`--recurrence` alone sets a recurring schedule (the first run comes off the cron grid); `--process-after` is for one-shots and takes an ISO-8601 timestamp — with `Z`/offset for UTC, or naive (`2026-09-10T18:00`, no zone) to be read in the instance timezone from the `<context timezone="..."/>` header. Relative phrasing like `tomorrow 18:00` is rejected; compute the timestamp yourself. Prefer `update` over cancel-and-recreate — the run log and id survive.

### Guard frequent tasks with `--script`

Frequent recurring tasks burn API credits. A bash `--script` runs before each fire and decides whether you wake:

1. The script prints `{ "wakeAgent": true|false, "data": {...} }`.
2. `false` → the fire is skipped and you are never invoked.
3. `true` → you wake with `data` alongside the prompt.

Test the script directly before scheduling it. Skip the gate for tasks that need judgment every fire (briefings, reports).

### Each fire is a fresh session

By default a fire starts a new session: the system prompt is served from cache and prior conversation history is discarded, so cost stays flat and context does not drift across fires. State that must survive belongs in files — your `/workspace/agent/memory/` OKF tree, other `/workspace/agent/` files, or shared learnings — not in conversation history.
