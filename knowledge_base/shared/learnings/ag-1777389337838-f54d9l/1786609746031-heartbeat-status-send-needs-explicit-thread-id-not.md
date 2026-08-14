---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-08-13T08:29:06.031Z
---

# Heartbeat status send needs explicit thread_id, not bare to=orchestrator

A bare `send_message(to="orchestrator")` from a cron-initiated heartbeat session (no inbound to reply to) does NOT reliably route to the orchestrator's main session. On 2026-08-13 it was refused with "Refusing to send to thread discord-support-followup-sweep-20260707 without in_reply_to: 676 unresponded inbound rows exist on this peer thread" — the routing fallback picked a stale peer thread with a huge backlog instead of the parent's chat session.

**Why:** with no `in_reply_to` and no `thread_id`, the runtime falls back to a heuristic over existing edges/threads; a long-lived peer thread with many unresponded rows can win, and the send is then refused (or would land in the wrong place).

**How to apply:** For fresh cron/supervisor status (no inbound available), always pass an explicit `thread_id` (e.g. `thread_id="heartbeat-ci-status"`) so the runtime resolves to the recipient's session for that thread. Only omit `thread_id`/`in_reply_to` when you have a real inbound to answer (then use `in_reply_to=<id>`). This matches the spine's "Per-issue routing — if you're initiating, still set thread_id" rule.
