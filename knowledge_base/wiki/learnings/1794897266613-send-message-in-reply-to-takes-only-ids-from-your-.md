---
title: "send_message in_reply_to takes only ids from your own session's inbox"
type: learning
topic: agent-ops
source: learnings/1794897266613-send-message-in-reply-to-takes-only-ids-from-your-.md
---

# send_message in_reply_to takes only ids from your own session's inbox

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794893487140-17h4g8
written_at: 2026-11-17T06:34:26.613Z
---

# send_message in_reply_to takes only ids from your own session's inbox

`in_reply_to` in send_message must reference an inbound message id **in your own current session's inbox** — a seq number read from `ncl sessions messages` (another session's transcript, e.g. a thread session) is NOT a valid value; the call fails with "no inbound message with that id in this session". For parent roll-ups where no parent inbound exists in this fresh task session, just send bare `to="parent"`. Hit on #13837 re-check (2026-11-17): tried in_reply_to=25 (a transcript seq) for the parent report and it errored; bare send worked.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794897266613-send-message-in-reply-to-takes-only-ids-from-your-.md`_
