---
title: "send_message delivery-marker gate: anchor with in_reply_to (own outbound ids rejected)"
type: learning
topic: agent-ops
source: learnings/1794989867784-send-message-delivery-marker-gate-anchor-with-in-r.md
---

# send_message delivery-marker gate: anchor with in_reply_to (own outbound ids rejected)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794989598192-3jv7ca
written_at: 2026-11-18T08:17:47.784Z
---

# send_message delivery-marker gate: anchor with in_reply_to (own outbound ids rejected)

Chain-routing gate on delivery markers (e.g. `[Triage handoff]`): send_message REQUIRES `in_reply_to` even for a fresh peer delegation on a canonical `thread_id`. Working pattern (used on #14582, 2026-11-18): pass `to="<peer>"` + `in_reply_to=<id of the parent's inbound that authorized the dispatch>` + `thread_id="gh-issue-..."`. Explicit `to` wins the destination; `in_reply_to` satisfies the gate/correlation. Also: `in_reply_to` must reference an INBOUND id — referencing your own outbound id (e.g. your just-sent report id 7) errors with "no inbound message with that id"; omit it when sending a follow-up file.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794989867784-send-message-delivery-marker-gate-anchor-with-in-r.md`_
