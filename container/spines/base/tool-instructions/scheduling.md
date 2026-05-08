## Task scheduling (`schedule_task`)

Recurring tasks survive across sessions and restarts. Inspect with `list_tasks`; manage with `update_task` / `cancel_task` / `pause_task` / `resume_task`. Prefer `update_task` over cancel+reschedule.

### Long-running task watchdog (mandatory for any task > 5 min)

Any task that runs longer than ~5 minutes (builds, external API calls, long compute jobs) **must** have a watchdog before it starts. Without one, the container's idle-end timer can close the query stream mid-work, and neither the user nor the orchestrator will know the outcome.

**Three steps — do all three before starting the long work:**

1. **Notify parent:**
   ```
   send_message(to="parent", text="⚙️ Long task started — <what/branch/worktree>. ETA ~<N> min. Will report when done.")
   ```
   This tells the orchestrator the session is actively working, not stalled.

2. **Schedule a watchdog** with `new_session=false` (REQUIRED — the watchdog must resume this session's context so it knows what to check):
   ```
   schedule_task(
     prompt="Check status of <task description>. If done: report result, then call cancel_task(<this task id>). If still running: report 'still running' and let this fire again.",
     processAfter="<now + N+5 min, naive local time>",
     recurrence="*/30 * * * *",
     new_session=false
   )
   ```
   Store the task id. Call `cancel_task(taskId=<id>)` immediately once the work completes successfully.

3. **Start the long work.**

**Why `new_session=false` is required here:** The watchdog needs to remember what it's checking (the worktree path, branch name, task goal). With `new_session=true` (the default) the agent wakes with no context and cannot make a meaningful check. `new_session=false` resumes the same SDK session so the full prior context is available.

Frequent recurring tasks consume API credits and can hit rate limits. When possible, guard the task with a `script` so the agent only wakes when there's something to do:

1. Provide a bash `script` + the `prompt`.
2. On each fire, the script runs first.
3. Script prints `{ "wakeAgent": true|false, "data": {...} }`.
4. `false` → skip this fire. `true` → agent wakes with `data` + `prompt`.

Test your script directly before scheduling. If a task requires judgment every fire (briefings, reports), skip the script.

### `new_session` — default is true

Each fire runs in a fresh session by default — the cached system prompt is reused, but prior fires' conversation history is discarded. This is what you want for heartbeat/cron tasks: cost stays flat, context doesn't drift.

Opt out with `new_session: false` only when a multi-fire workflow genuinely relies on in-conversation memory across fires. If the state can live in files (`CLAUDE.local.md`, `/workspace/agent/`, shared learnings), keep the default. Toggle on existing tasks with `update_task({ taskId, new_session: false })`.
