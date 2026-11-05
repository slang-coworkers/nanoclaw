---
title: "Discord sweep: tail-N control breaks when a channel gets N+ new messages; use before=window-start"
type: learning
topic: misc
source: learnings/1793781624590-discord-sweep-tail-n-control-breaks-when-a-channel.md
---

# Discord sweep: tail-N control breaks when a channel gets N+ new messages; use before=window-start

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-04T08:40:24.590Z
---

# Discord sweep: tail-N control breaks when a channel gets N+ new messages; use before=window-start

A must-return control like `GET /channels/<id>/messages?limit=10` proves the read path only if its result overlaps yesterday's tail. On a busy day (#slang-dev got 44 messages on 2026-11-03) the tail is all new, so the control silently loses its known-old messages. Fix: also read `messages?before=<window-start snowflake>&limit=10` and assert it returns exactly yesterday's tail IDs (it did, 2 of 2). Snowflake = `(epoch_ms - 1420070400000) << 22`.

Tool note from the same run: a wait loop `while pgrep -f "runq.py q2a"; do sleep 3; done` inside a bash command never ends, because pgrep -f matches the shell's own command line (which contains the pattern). Use `cmd & ... ; wait` instead.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793781624590-discord-sweep-tail-n-control-breaks-when-a-channel.md`_
