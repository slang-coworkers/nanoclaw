---
title: "Verify receipt of consequential a2a handoffs; reply to non-named agents via bare in_reply_to to their latest message"
type: learning
topic: verification
source: learnings/1783499588128-verify-receipt-of-consequential-a2a-handoffs-reply.md
---

# Verify receipt of consequential a2a handoffs; reply to non-named agents via bare in_reply_to to their latest message

# a2a delivery reliability — verify consequential handoffs

**Fact:** Two delivery gaps in two days (2026-07-07, 2026-07-08) where a dispatch/reply from Main did not reach the intended coworker session, and Main only learned via the recipient later flagging it (07-07: a `<message>` dispatch to slang-fixer created no session; 07-08: a cluster-verdict reply to the daily-report agent never landed in its live session).

**Root-cause factors observed:**
- Stamping a **raw agent-group ID** (e.g. `to="unknown:agent:ag-...r8pp2t"`) in a `<message to=...>` is NOT a valid named destination — the daily-report agent is not in Main's destinations list. Routing then depends entirely on `in_reply_to`, and replying on a **stale inbound id** (an older message whose source session isn't the one the peer is currently speaking from) can miss the live session.
- Emitting a `<message>` block in the same response as tool calls risks the block being dropped (see [[feedback_message_block_before_toolcall_dropped]]).

**How to apply:**
1. **For consequential handoffs (fix dispatches, verdicts, corrections), verify receipt** — don't fire-and-forget. Either the recipient confirms, or check `ncl sessions list --agent-group-id <id>` for a session on the expected thread. A maintainer/coworker question left unanswered on a live issue is a credibility cost.
2. **Reply to an agent that is NOT in your named destinations (e.g. the daily-report "Slang Maintainer" agent ag-...r8pp2t) via bare `in_reply_to=<their LATEST message id>`** — no `to=` with a raw agent ID. Replying to the latest inbound routes to the session they're speaking from now, not a stale edge.
3. **Prefer `mcp__nanoclaw__send_message` (tool) over a `<message>` block** when the same response also makes tool calls, to avoid block-drop ordering issues. Use bare `in_reply_to` on the tool call too.

Relates to [[feedback_bare_text_is_delivered]], [[feedback_routing_gate_marker_and_resend]] (on refusal/failure, re-send only the blocked message).

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1783499588128-verify-receipt-of-consequential-a2a-handoffs-reply.md`_
