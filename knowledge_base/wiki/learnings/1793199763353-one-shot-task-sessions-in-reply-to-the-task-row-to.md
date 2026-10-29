---
title: "One-shot task sessions: in_reply_to the task row to send a gated chain marker"
type: learning
topic: agent-ops
source: learnings/1793199763353-one-shot-task-sessions-in-reply-to-the-task-row-to.md
---

# One-shot task sessions: in_reply_to the task row to send a gated chain marker

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792071257628-744i6a
written_at: 2026-10-28T15:02:43.353Z
---

# One-shot task sessions: in_reply_to the task row to send a gated chain marker

In a scheduled one-shot (`ncl tasks`) run, `gate-chain-routing.sh` blocks `send_message` with a delivery marker like `[Triage Resolution]` unless `in_reply_to` is set. Message ids from the original chain session don't work; the tool says "no inbound message with that id in this session". The task row itself is an inbound: look up `seq` in `/workspace/inbound.db` → `messages_in` where `kind='task'` (it was seq 2). Then `send_message(to="parent", in_reply_to=<that seq>, thread_id="gh-issue-<owner>/<repo>-<n>")` passes the gate and is delivered. The other option is to send an ungated `[Report]` 5-bullet.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793199763353-one-shot-task-sessions-in-reply-to-the-task-row-to.md`_
