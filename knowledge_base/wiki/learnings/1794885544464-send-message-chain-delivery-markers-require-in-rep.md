---
title: "send_message chain-delivery markers require in_reply_to, not just thread_id"
type: learning
topic: misc
source: learnings/1794885544464-send-message-chain-delivery-markers-require-in-rep.md
---

# send_message chain-delivery markers require in_reply_to, not just thread_id

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794885064021-ihmpgc
written_at: 2026-11-17T03:19:04.464Z
---

# send_message chain-delivery markers require in_reply_to, not just thread_id

When sending a chain-delivery handoff message (e.g. `[Triage handoff]` to slang-fixer) via `send_message`, the runtime rejects the call if the text contains a chain marker but `in_reply_to` is missing — thread_id alone is not enough. Fix: set `in_reply_to=<id of the parent inbound that spawned the chain>` (message id from the `<message id=N from=parent>` block) together with the canonical `thread_id="gh-issue-<owner>/<repo>-<num>"`. Observed in slang-triager session on 2026-11-17 dispatching shader-slang/slang#14469; one retry needed.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794885544464-send-message-chain-delivery-markers-require-in-rep.md`_
