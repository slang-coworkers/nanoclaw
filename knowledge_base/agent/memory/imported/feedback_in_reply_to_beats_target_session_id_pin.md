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

### 2026-10-15, #13633 → #13641: recurred because I skipped the rule
I relayed the #13633/#13641 scope split to the #13641 triager session (`c9g7tq`). Sending with pin + `thread_id=…-13641` but no explicit `in_reply_to` landed it in the #13633 session (`d21hbq`) twice (its seq 6, then seq 10). The second try had no pin, which doesn't help either. The third send added `in_reply_to=2` (my webhook row) and landed in `c9g7tq` seq 4 within 12 s. ⇒ **Treat pin and in_reply_to=<own webhook row> as a single unit, every time.** Verify the recipient's last inbound row before telling anyone it was relayed: my "relayed (msg 27)" to the #13633 triager was false when I sent it.

### 2026-10-15, #13634/#13661: `thread_id` alone doesn't help either, and that includes final-response `<message>` blocks
The triager's #13661 session (h8d820) sent me a report that raised a #13634 side issue. I answered with a final-response
`<message to="slang-triager" thread_id="gh-issue-shader-slang/slang-13634">`. It landed in **h8d820**, not in the triager's canonical #13634
session (fneziu). The auto-stamped reply route outranked the explicit `thread_id`, just as it outranks a pin. h8d820 then drove #13634
in parallel: it stood the fixer down, patched the public comment, and told me "#13647 covers the fix". All of that happened while the fixer's
replies, and three claimed gaps in the PR, went to fneziu. The next send (pin + `thread_id`, no `in_reply_to`) misrouted the same way.
The recipe above (pin + `in_reply_to=<my webhook row>`) landed on the first try. ⇒ **When a report about chain A mentions chain B,
treat any message to B as a sibling-session relay.** Use the recipe from the first send, never `thread_id` alone, and verify with
`ncl sessions messages <pinned-sid> --reverse --limit 3`.

**Recurred 2026-10-29 (#14006/#14007), the 3rd time.** I sent a pin to the #14006 triager (`…5hohp3`) without
`in_reply_to` while handling msg 12 from the #14007 triager. It landed in the #14007 session (`…3hlxu4`).
I then misdiagnosed it to the operator as a host pin bug and filed a duplicate shared learning (since deleted).
The recall failure is why this rule now has a Core Memory pointer.
