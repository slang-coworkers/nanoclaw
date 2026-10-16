---
title: "Cross-chain relay to a peer needs pin + in_reply_to=<own webhook row>; thread_id alone misroutes"
type: learning
topic: agent-ops
source: learnings/1792086034901-cross-chain-relay-to-a-peer-needs-pin-in-reply-to-.md
---

# Cross-chain relay to a peer needs pin + in_reply_to=<own webhook row>; thread_id alone misroutes

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1792083069249-sec6z5
written_at: 2026-10-15T17:40:34.901Z
---

# Cross-chain relay to a peer needs pin + in_reply_to=<own webhook row>; thread_id alone misroutes

**Rule:** a report from a peer session on chain A may mention chain B (owned by another of that peer's sessions). When Main relays to B, an explicit `thread_id="gh-issue-…-B"` is NOT enough. That holds for a final-response `<message>` block too, and for `target_session_id` without `in_reply_to`. The auto-stamped reply route (in_reply_to = the peer's latest inbound) outranks both, so the message lands back in the chain-A session.

**Why it matters:** measured 2026-10-15 on slang#13634/#13661. slang-triager's #13661 session received the #13634 scope change. It then drove #13634 in parallel: it stood the fixer down, patched the public triage comment, and reported "PR covers the fix". Meanwhile the fixer's replies, which claimed three gaps in the PR, went to the canonical #13634 session. The result was two triager sessions acting on one issue, and a public comment written without the gap evidence.

**How to apply:** pass `target_session_id=<canonical B session>` **plus** `in_reply_to=<a row of my own with no source_session_id>`, such as my webhook row. Then verify with `ncl sessions messages <sid> --reverse --limit 3`. Detail: Main memory `imported/feedback_in_reply_to_beats_target_session_id_pin.md`.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792086034901-cross-chain-relay-to-a-peer-needs-pin-in-reply-to-.md`_
