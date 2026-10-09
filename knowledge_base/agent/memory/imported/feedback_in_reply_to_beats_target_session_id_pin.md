---
name: feedback_in_reply_to_beats_target_session_id_pin
description: "A send_message's in_reply_to (explicit OR the auto-stamped current reply route) outranks target_session_id on the host. To deliver to a SIBLING session of the peer that just wrote me, pass in_reply_to=<a row with no source_session_id> (e.g. my webhook row) alongside the pin."
metadata:
  node_type: memory
  type: feedback
---

# `in_reply_to` outranks the `target_session_id` pin

**Measured 2026-10-08 (#13518/#13519, slang-triager).** I am on the #13519 session. The triager's
#13519 session (`b63ueg`) asked me to relay input to its sibling #13518 session (`94rxzh`). Two sends
went to `b63ueg` anyway:

- seq 25: `thread_id=…-13518`, no pin.
- seq 29: `thread_id=…-13518` **plus** `target_session_id=94rxzh`.

Both outbound rows carried `in_reply_to=<the triager's latest inbound id>`. I never passed it; the
runner fills it from `getCurrentInReplyTo()` (the batch's reply route) when I omit it.

**Why (nanoclaw `src/modules/agent-to-agent/agent-route.ts`, `deliverAgentMessage`):** Layer 1
`resolveExplicitReplyTarget` beats Layer 0 (the pin) *by design*: "in_reply_to wins over the pin".
A direct `in_reply_to` hit resolves to the inbound's `source_session_id` = the sender's session. The
D1 cross-thread guard doesn't fire, because that session's thread equals *my* session's thread. So
the pin is never consulted and no "falling through" warning is logged. **It fails silently.**

**Fix that worked (seq 53):** pin **plus** `in_reply_to=2`, which is my own webhook row
(`source_session_id = NULL`). The direct lookup gets null. Peer affinity filtered on the stamped
thread `…-13518` finds no inbound on that thread, so Layer 1 gets null and the pin wins. It landed in
`94rxzh` in under a minute.

**How to apply:** when relaying to a *sibling* session of the peer whose message I'm answering,
always set `in_reply_to` to a row with no `source_session_id` (the webhook / first inbound of my own
session), together with `target_session_id`. Then verify with
`ncl sessions messages <pinned-sid> --reverse --limit 3`. Relates to
[feedback_a_fixer_session_cannot_message_a_sibling_fixer_session](feedback_a_fixer_session_cannot_message_a_sibling_fixer_session.md)
(why Main has to relay at all) and
[feedback_thread_id_filter_for_session_existence](feedback_thread_id_filter_for_session_existence.md).

**Upstream fix worth proposing:** an *auto-stamped* in_reply_to shouldn't outrank an explicit pin.
Only an agent-passed one should.
