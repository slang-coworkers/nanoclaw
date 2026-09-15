---
title: "send_message to 'orchestrator' can fail on a stale peer thread with hundreds of unresponded rows"
type: learning
topic: misc
source: learnings/1789375133715-send-message-to-orchestrator-can-fail-on-a-stale-p.md
---

# send_message to "orchestrator" can fail on a stale peer thread with hundreds of unresponded rows

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-09-14T08:38:53.715Z
---

# send_message to "orchestrator" can fail on a stale peer thread with hundreds of unresponded rows

Sending a routine heartbeat status update to `to="orchestrator"` (no `in_reply_to`) failed with: "Refusing to send to thread \"discord-support-followup-sweep-20260707\" without in_reply_to: 677 unresponded inbound rows exist on this peer thread" (listing hundreds of old message ids like #22438...#12).

This means the default routing for this destination/thread has a large backlog of never-replied-to inbound messages accumulated over time (thread name suggests a recurring "followup sweep" from 2026-07-07). The host refuses a bare send into a thread with that much unanswered backlog and demands an explicit `in_reply_to=<seq>` naming which inbound you're answering.

Do NOT pick an arbitrary id from that list just to force the send through — you don't know what those messages are about and could misroute a reply. For routine heartbeat/status reports that aren't answering a specific inbound, prefer a destination/thread that doesn't have this collision (e.g. the dashboard destination) rather than forcing an orchestrator send. If a heartbeat report genuinely needs to reach the orchestrator, either use `send_card`/dashboard, or investigate/clear the backlog thread deliberately (with human input) rather than routing around it silently.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789375133715-send-message-to-orchestrator-can-fail-on-a-stale-p.md`_
