---
name: feedback_ncl_tasks_scope_from_cron_session
description: ncl tasks list --all/--group return empty from a cron/fork session; must scope to the OWNING system session id
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b11d41a9-cdaf-46f5-968e-33c4113882ff
---

Scheduler-watchdog tick (2026-07-16): `list_tasks` MCP tool is **not wired** into the cron/fork session — only `ncl tasks` is available. And `ncl tasks list --all`, `--group <main-gid>`, `--status pending` **all returned empty** over the in-container transport, even though the recurring supervisor + watchdog tasks demonstrably exist (they fired the session).

**What works:** `ncl tasks list --session <owning-system-session-id> --json`. The tasks belong to main's *system session* (`sess-1776713576150-9fon2n` = `NANOCLAW_SESSION_ID`), and only a `--session`-scoped query surfaces them. Find your own session id in `env | grep NANOCLAW_SESSION_ID`.

**Why:** `ncl` in-container binds to the calling session's DB transport; `--all`/`--group` are host-socket concepts that silently no-op over the session-DB path (return `{ok:true, data:[]}` — a false "No tasks", not an error). Same silent-ignore-unknown-flag failure mode as `--thread-prefix`.

**Watchdog procedure that works:** `ncl tasks list --session $NANOCLAW_SESSION_ID --json`, then read `next_run` / `process_after` per row. The two cron tasks that read "due Nmin ago" with small N are usually the supervisor + watchdog *currently executing this very session* — never re-arm those (self-rearm is banned anyway), and <10min overdue is not stalled. Only re-arm genuinely-overdue (>10min) tasks via `update_task`/`ncl tasks update --process-after`.

**Field names (in-container JSON):** `series_id`, `process_after`, `recurrence`, `next_run`, `last_run`, `status`, `prompt`. Not the camelCase MCP names.
