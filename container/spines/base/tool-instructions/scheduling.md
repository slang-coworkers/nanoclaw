## Task scheduling (`schedule_task`)

Recurring tasks survive across sessions and restarts. Inspect with `list_tasks`; manage with `update_task` / `cancel_task` / `pause_task` / `resume_task`. Prefer `update_task` over cancel+reschedule.

### Build and compilation tasks — delegate to Agent subagent

**For cmake, make, cargo, pip install, npm install, or any other compilation task: do NOT use `run_in_background=True` and do NOT set up a watchdog.**

Builds produce large output that pollutes your context. Delegate to a subagent so only the result comes back:

```
Agent(prompt="Run the build: <build commands from your project skill>. Log to /workspace/agent/build/build.log. Report: success/fail, any errors, and the log path.")
```

The subagent runs the build synchronously (blocking its own turn). You get back a clean summary. Before writing any build commands yourself, use `ToolSearch` or `Skill` to find and invoke your project's build skill — it has the exact steps for your project.

**Why not `run_in_background`:** If the build triggers an `install_packages` approval, the container is rebuilt and every background process is killed. A background build vanishes with no output and no recovery path.

**Pre-build checklist:** Before spawning the subagent, identify ALL missing packages by checking the build manifest, then request them all in a single `install_packages` call. After the container rebuilds, then delegate the build to a subagent.

### Mid-turn notifications

`<message to="name">` blocks are **only dispatched from the final assistant response** (after all tool calls complete). Any `<message>` block written mid-turn is silently ignored. For progress updates during long work, use `mcp__nanoclaw__send_message` instead.

**Never use your own group name as the destination.** `<message to="name">` is for routing to a *different* agent. Sending to yourself loops the message back as a2a, creating a duplicate bubble. To reply to the sender, write plain text with no wrapper.

### Recurring and scheduled tasks

Use `schedule_task` for cron-style work: heartbeats, periodic reports, briefings, scheduled reminders. Long-running work (builds, compute jobs) belongs in a synchronous `Agent` subagent instead — not in scheduled tasks.

Frequent recurring tasks consume API credits and can hit rate limits. When possible, guard the task with a `script` so the agent only wakes when there's something to do:

1. Provide a bash `script` + the `prompt`.
2. On each fire, the script runs first.
3. Script prints `{ "wakeAgent": true|false, "data": {...} }`.
4. `false` → skip this fire. `true` → agent wakes with `data` + `prompt`.

Test your script directly before scheduling. If a task requires judgment every fire (briefings, reports), skip the script.

### `new_session` — default is true

Each fire runs in a fresh session by default — the cached system prompt is reused, but prior fires' conversation history is discarded. This is what you want for heartbeat/cron tasks: cost stays flat, context doesn't drift.

Opt out with `new_session: false` only when a multi-fire workflow genuinely relies on in-conversation memory across fires. If the state can live in files (`CLAUDE.local.md`, `/workspace/agent/`, shared learnings), keep the default. Toggle on existing tasks with `update_task({ taskId, new_session: false })`.
