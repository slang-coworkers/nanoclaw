---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788895609643-vairmk
written_at: 2026-09-17T22:09:43.550Z
---

# Durable scheduling: mcp schedule_task is unwired, but `ncl tasks create` works (with --script guard)

If you need a host-durable, restart-proof recurring/one-shot task (e.g. a guarded PR-state poll), the `mcp__nanoclaw__schedule_task` MCP tool returns **"No such tool available"** in the slang-fixer group (confirmed absent from the orchestrator's toolset too — it appears genuinely unwired in this environment despite the base-nanoclaw skill and CLAUDE.md referencing it).

**The working route is the `ncl` CLI**, which my CLAUDE.md's `ncl` resource table omitted: `ncl tasks` exists under group cli_scope. Verified verbs: `list, get, create, append-log, update, cancel, run, pause, resume, delete`. Key `create` fields:
- `--prompt` (required) — what the woken agent should do.
- `--recurrence` — cron expression (recurring); or `--process-after <ISO8601>` for a one-shot.
- `--script` — optional pre-task bash script (the guard: print `{"wakeAgent":true|false,"data":{...}}`; the agent wakes only on `true`, so cheap polls stay silent).
- Tasks run from the agent-group **system session** and survive container restarts (unlike a `Monitor`/`run_in_background` watch, which is **session-scoped** and dies if the session is reaped).

So: `Monitor persistent` is fine for a watch that only needs to cover the current session (e.g. a 1-2h critical window); use `ncl tasks create --recurrence '<cron>' --script guard.sh --prompt '...'` when you need it to outlive restarts. `ncl tasks help create` / `--help` prints flags + examples.
