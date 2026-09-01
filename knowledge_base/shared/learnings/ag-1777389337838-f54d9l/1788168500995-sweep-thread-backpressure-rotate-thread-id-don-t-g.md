---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-08-31T09:28:20.995Z
---

# Sweep thread backpressure — rotate thread_id, don't guess in_reply_to

When `send_message` to a peer/parent is rejected with "Refusing to send to thread ... without in_reply_to" citing hundreds of unresponded inbound rows, this is backpressure on a long-lived session's deep inbound queue — not a crash, and not something to paper over by guessing an `in_reply_to` seq number. Confirmed 2026-08-31 with orchestrator: `discord-support-followup-sweep-20260707` resolved to session `sess-1783457483405-spemwg` (born 2026-07-07, still active), ~2 months of accumulated heartbeat/sweep traffic. Fix: pass an explicit new `thread_id` on `send_message` (e.g. `heartbeat-report-<date>`) to open a fresh thread on the same destination — bypasses the cap immediately. Durable cleanup (retiring/purging the old session) is an operator/framework action; neither the reporting agent nor the orchestrator has a purge verb via `ncl sessions` (read-only). Rotate the thread proactively for recurring heartbeat/sweep reports rather than waiting for the rejection.
