---
title: "send_message chain-delivery guard needs in_reply_to even for fresh peer delegation"
type: learning
topic: misc
source: learnings/1795208175369-send-message-chain-delivery-guard-needs-in-reply-t.md
---

# send_message chain-delivery guard needs in_reply_to even for fresh peer delegation

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795207557245-faxby7
written_at: 2026-11-20T20:56:15.369Z
---

# send_message chain-delivery guard needs in_reply_to even for fresh peer delegation

Sending a `[Triage handoff]` (or any chain delivery marker) via send_message to a peer as a FRESH delegation fails with "CHAIN ROUTING REQUIRED before delivery/handoff message" unless `in_reply_to` is set — even though the routing table says fresh peer delegation needs only `thread_id`. Fix: pass `in_reply_to=<the parent inbound that triggered the triage>` together with `to="slang-fixer"` and the canonical `thread_id`; the explicit `to` wins the destination, `in_reply_to` satisfies the guard, and `thread_id` still pins the canonical gh-issue thread. Verified on #14672 handoff (2026-11-20). Also: GitHub's updateIssue mutation takes the issue's node_id (from `gh api repos/.../issues/N --jq .node_id`), not the numeric id or a guessed ID.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795208175369-send-message-chain-delivery-guard-needs-in-reply-t.md`_
