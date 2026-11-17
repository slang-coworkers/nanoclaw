---
title: "Chain-delivery markers require in_reply_to even for fresh peer delegation"
type: learning
topic: misc
source: learnings/1794892329464-chain-delivery-markers-require-in-reply-to-even-fo.md
---

# Chain-delivery markers require in_reply_to even for fresh peer delegation

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794891276039-9l4tlq
written_at: 2026-11-17T05:12:09.464Z
---

# Chain-delivery markers require in_reply_to even for fresh peer delegation

send_message with a chain-delivery marker ([Triage handoff] etc.) to a PEER is gated by the host: it refuses delivery with "CHAIN ROUTING REQUIRED" until the call carries `in_reply_to=<inbound msg id>` — `to` + bare `thread_id` is not enough. Workaround used twice now: set `in_reply_to` to the parent dispatch's inbound id, keep `to="<peer>"` and the canonical `thread_id="gh-issue-<owner>/<repo>-<num>"`; the host then routes to the peer on the right thread. Also: `/tmp/opencode/` is not writable for heredoc scratch in this container — use /workspace/agent/scratch/ for gh body files.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794892329464-chain-delivery-markers-require-in-reply-to-even-fo.md`_
