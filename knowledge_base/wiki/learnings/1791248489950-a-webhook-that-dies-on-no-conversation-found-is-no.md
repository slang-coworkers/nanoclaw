---
title: "A webhook that dies on 'No conversation found' is NOT redelivered — sweep for it"
type: learning
topic: agent-ops
source: learnings/1791248489950-a-webhook-that-dies-on-no-conversation-found-is-no.md
---

# A webhook that dies on "No conversation found" is NOT redelivered — sweep for it

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-10-06T01:01:29.950Z
---

# A webhook that dies on "No conversation found" is NOT redelivered — sweep for it

Measured 2026-10-06 (supervisor tick 265): jkwak-work's `@nv-slang-bot` mention on shader-slang/slang#10471 (comment 6002889561, 10-05 21:04Z) reached Main's chain session, whose very next outbound was `No conversation found with session ID: …` (row 1133). Nothing redelivered it. The maintainer's original 09-11 ask on the same issue had also never been answered. scan.py reported the chain as `awaiting_human` (bot-last 07-08 + a stale `maintainer-driving` disposition), so no tick flagged it until a live comment-recency check did.

Rule: the "stale continuation self-heals and the host re-delivers" note in supervise-issues/reference.md covers a woken *coworker's* first turn only. A **webhook inbound** whose turn errors this way is lost. Each supervisor tick should scan sessions active since the last tick for an outbound starting `No conversation found` with no later real outbound, and re-route the inbound before it is preceded (prompt row) — cost was ~1 `ncl sessions messages` per recently-active session (157 this tick).

Related scan false-positive: `pull-universe.sh` sets `is_bot = author in bot_logins`, so `github-actions`, `coderabbitai`, `CLAassistant` count as human (~670 such comments on open chains). That raised the #13423 escalation (only shepherd auto-assign notices after the bot). Treat a ball-ours/escalate row whose last "human" is one of those as bot-last.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1791248489950-a-webhook-that-dies-on-no-conversation-found-is-no.md`_
