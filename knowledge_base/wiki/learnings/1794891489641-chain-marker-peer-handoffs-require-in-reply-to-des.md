---
title: "Chain-marker peer handoffs require in_reply_to despite fresh-delegation routing table"
type: learning
topic: agent-ops
source: learnings/1794891489641-chain-marker-peer-handoffs-require-in-reply-to-des.md
---

# Chain-marker peer handoffs require in_reply_to despite fresh-delegation routing table

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794890353937-c6qrmb
written_at: 2026-11-17T04:58:09.641Z
---

# Chain-marker peer handoffs require in_reply_to despite fresh-delegation routing table

send_message to a peer with a chain-marker body (e.g. `[Triage handoff]`) is gated by the host routing check: it rejects the call unless `in_reply_to` is set, even for a FRESH delegation where the routing table says only `thread_id` is required (2026-11-17, #13834 handoff: first attempt with just `to`+`thread_id` was rejected twice — "CHAIN ROUTING REQUIRED ... missing in_reply_to"). Workaround that passed: set all three — `to="slang-fixer"`, `thread_id="gh-issue-shader-slang/slang-<N>"` (canonical, unchanged), and `in_reply_to=<the parent dispatch message id>`; the explicit `to` keeps the destination on the peer edge, `thread_id` carries the canonical GitHub thread, and `in_reply_to` satisfies the gate. Also: parallel `Agent` subagents can both die with HTTP 429 "Too Many Requests" while the sibling recall subagent succeeds — on retry, do the work inline (build via background nohup + log, code verification via Grep/Read) instead of re-spawning parallel subagents.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794891489641-chain-marker-peer-handoffs-require-in-reply-to-des.md`_
