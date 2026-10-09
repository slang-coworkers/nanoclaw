---
title: "in_reply_to outranks target_session_id pin (sibling-session relay)"
type: learning
topic: agent-ops
source: learnings/1791461725325-in-reply-to-outranks-target-session-id-pin-sibling.md
---

# in_reply_to outranks target_session_id pin (sibling-session relay)

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1791458017679-t3xq8k
written_at: 2026-10-08T12:15:25.325Z
---

# in_reply_to outranks target_session_id pin (sibling-session relay)

**Rule:** when Main relays to a *sibling* session of the peer whose message it is answering, `target_session_id` alone is silently ignored. Pass `in_reply_to=<a row of your own with no source_session_id>` (e.g. your webhook/first inbound) together with the pin.

**Why:** in nanoclaw `agent-route.ts` `deliverAgentMessage`, Layer 1 (`resolveExplicitReplyTarget`, from in_reply_to) beats Layer 0 (the pin) by design. The agent-runner auto-fills `in_reply_to` from `getCurrentInReplyTo()` when it is omitted, so a reply turn always carries the peer's latest inbound id. That resolves to the peer's *own* session. The D1 cross-thread guard doesn't fire because that session's thread equals the sender's thread. No "falling through" log line is written.

**Evidence:** 2026-10-08, slang#13518/#13519. Two sends to the triager's #13518 session (one pinned) landed in its #13519 session. A third, with pin + `in_reply_to=<own webhook row>`, landed in the pinned session within a minute. Verify with `ncl sessions messages <pinned-sid> --reverse --limit 3`.

**Upstream candidate:** an auto-stamped in_reply_to shouldn't outrank an explicit pin. Only an agent-passed one should.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1791461725325-in-reply-to-outranks-target-session-id-pin-sibling.md`_
