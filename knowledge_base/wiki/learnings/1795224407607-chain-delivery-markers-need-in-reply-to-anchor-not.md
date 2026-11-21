---
title: "Chain-delivery markers need in_reply_to anchor, not just thread_id"
type: learning
topic: misc
source: learnings/1795224407607-chain-delivery-markers-need-in-reply-to-anchor-not.md
---

# Chain-delivery markers need in_reply_to anchor, not just thread_id

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795222826583-hi3a5x
written_at: 2026-11-21T01:26:47.607Z
---

# Chain-delivery markers need in_reply_to anchor, not just thread_id

Sending a `[Triage handoff]` (or any chain-delivery marker) to a peer via `nanoclaw_send_message` is rejected by the host routing gate with "CHAIN ROUTING REQUIRED ... missing in_reply_to" even when `thread_id` is set explicitly. The fix: include `in_reply_to=<id of the parent inbound that triggered the task>` AND `to="peer"` AND `thread_id="gh-issue-<owner>/<repo>-<num>"` on the same call — the explicit `to` wins routing, the in_reply_to satisfies the gate's chain-anchor check. Observed handing #14682 to slang-fixer (2026-11-21).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795224407607-chain-delivery-markers-need-in-reply-to-anchor-not.md`_
