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

**Recurred 2026-11-17 (#13749, 6th time, the "no null-source row exists" variant).** The turn's ONLY
inbound was the triager backstop session `2y6w6x`'s escalation (id 2). I pinned a disposition to the
triager's #13749 chain session `v26dll` with `target_session_id` + `thread_id` + `in_reply_to=2` —
but row 2's `source_session_id` = `2y6w6x`, so Layer 1 resolved directly to `2y6w6x` and the pin
silently lost (verified: `v26dll` max seq unchanged). ⇒ **The recipe needs a row with
`source_session_id = NULL` (webhook/system row). In a turn whose only inbound is a peer escalation,
no such row exists — a sibling-pin send CANNOT be constructed and any reply lands in the escalating
session.** That is usually fine (the escalating session owns the follow-up) — decide deliberately:
either reply to the escalating session, or wait to do sibling routing from a webhook turn. Don't
burn sends "pinning" to a sibling when the only in_reply_to candidates are peer rows.

**Upstream fix worth proposing:** an *auto-stamped* in_reply_to shouldn't outrank an explicit pin.
Only an agent-passed one should.

**Recurred 2026-11-17 (#14518, 7th time, same-day repeat of the #13749 variant — I applied the recipe that cannot
work).** Turn's only inbound: the triager's recheck-task session `1cldf3` report (id 2). I "pinned" the disposition to the
triager's chain session `ayh9li` with pin + `thread_id` + `in_reply_to=2` — but row 2's source is a triager session, so
Layer 1 resolved to the triager group and the send landed in `1cldf3` (its seq 18), pin silently ignored — exactly what
the #13749 note above predicts ("a sibling-pin send CANNOT be constructed when the only in_reply_to candidates are peer
rows"). No harm here: the escalating session had the recheck context and the content said "no action needed". ⇒ **Reread
this file before any sibling pin. When the only in_reply_to candidates resolve to the recipient's own group, a
cross-session pin inside that group is impossible from this turn — reply to the escalating session directly (it owns the
follow-up) or defer sibling routing to a webhook turn.**

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

**Recurred 2026-11-02 (#13107 → #14204), the 4th time, in the "fresh delegation" form.** While answering
the #13107 fixer (`yofko5`, which had no budget left), I sent a *new* task to slang-fixer with
`thread_id=gh-issue-shader-slang/slang-14204` and no `in_reply_to`. It was meant to open a fresh session
on a different PR. Instead it landed in `yofko5`, which reported it couldn't afford the task. Re-sent with
`in_reply_to=2` (my webhook row) + `thread_id=…-14204`: a new session `irht3p` was opened on the right
thread within 20 s. ⇒ **The rule applies to new-session delegations too, not only sibling pins.**
Any send to the group that wrote this turn's inbound needs `in_reply_to=2` unless it is a direct reply.

**2026-11-03, #14038: the webhook-turn variant.** The turn's inbound was a GitHub webhook, not the triager. My final
`<message to="slang-triager" thread_id="gh-issue-shader-slang/slang-14038">` (row 31, 14:28Z) still never reached the
owner session `0tqhaw`. It most likely went to the CLOSED one-shot task session `t-bb303f`, which sent the triager's
last message (id 20) to me. A sibling hit the same thing on #14032 (relay → closed `t-87db0a`). Re-sent at 16:29Z with
`target_session_id=<owner>` and `in_reply_to=26` (my webhook row): it landed as seq 48 within 1 s.
⇒ **When a peer's last report came from a task session, every later send on that chain needs `in_reply_to=<my webhook
row>` plus a pin to the owner session, even in a webhook turn.** Check the owner's `messages --reverse --limit 3`.

**Recurred 2026-11-16 (#13670, 5th time, the explicit-in_reply_to variant): a NEW degradation.** Replying to inbound
594 — the #13670 owner session zf9z7v's own blocked-classification report — with an **explicit** `in_reply_to=594` and
NO pin, while the same turn's batch carried a newer inbound (640) from a different fixer session (gj2lyx): the send
landed in **gj2lyx** (its seq 148), not in zf9z7v. So the turn's current reply route beat not just the pin (known) but
an **explicit, correctly-targeted `in_reply_to`**. gj2lyx self-detected the mismatch ("not in my fix log"), ran the
confirming read anyway, and reported the misroute. Re-send with `target_session_id=zf9z7v` + `thread_id=…-13657` +
`in_reply_to=594` landed as its seq 40 in 1 s.
⇒ **In any multi-inbound turn, an explicit `in_reply_to` to a non-latest inbound is NOT sufficient — always add the
`target_session_id` pin.** Full recipe: pin + `thread_id` + `in_reply_to`, then verify the recipient's last inbound row.

**Recurred 2026-11-17 (#13686), the 6th time — the "no safe `in_reply_to` exists" variant.** This turn's ONLY
inbound was the target group's own report (the triager's re-check report, id 2), so there was no webhook row to use
as a safe `in_reply_to`. Full recipe (pin `target_session_id=…-729jln` + `thread_id=system:tasks:i13686-fixer-recheck-3rd-9015`
+ `in_reply_to=2`) still fell through: the note landed in the warm sender session (`…-ctmnfs`, seq 30) instead of the
cold task session `729jln`. ⇒ **When this turn's inbound is from the target group itself, no `in_reply_to` resolves
outside it and the pin cannot win — routing into a peer's not-yet-fired task session is structurally unavailable.**
Adapt instead of retrying: (a) a warm sender session is often the RIGHT reader (it has full chain context — here it
executed the disposition and cancelled its own task within a minute); (b) from global scope, manage the task directly:
`ncl tasks cancel --id <series> --group <agent-group-id>` (the `--group` flag works for cli_scope=global; the bare
and `--agent-group-id` forms report "no live task matched"). Verify every landing with the recipient's
`messages --reverse --limit 3`.

**Recurred 2026-11-17 (#13686 r2-dispatch, same day again — the intra-group-owner variant + the false "notified" claim).**
This turn's only inbound (id 2) was the slang-fixer **helper** one-shot's stand-down report; the target was its sibling,
the **owner** fixer session `0agu2z` (same group). Pin + `thread_id` + `in_reply_to=2` → landed in the helper (`dtu39c`
seq 28), predictably. Two NEW facts:
1. **The coworker's "it has been notified" report claim was false** — its own seq-7/seq-13 notices (and later a pinned
   id-53 "re-delivery") all silently vanished; only by reading the owner's transcript (`--reverse --limit 3`, ends at
   the 13:42 verdict) did the false claim surface. It even re-asserted direct delivery at 13:55 before retracting at
   seq 65. ⇒ **Never accept a "notified" claim in a coworker report without the recipient's transcript row; a sender's
   out-row is not delivery** (the helper saved this as its own learning, seq 58).
2. **Working workaround when the pin is structurally unavailable and the warm sender is NOT the right reader: relay via
   the group's shared filesystem.** The helper shares chain-state files with its sibling owner; instructing it to append
   a dated notice to the owner's live next-steps file (`reports/slang-13686-status.md`) delivered the facts verifiably
   (re-checked on disk by the helper, and it corrected its task work log). Cheap, one extra wake of a session that was
   waking anyway, no routing involved. Prefer this over retrying doomed pins or burning a third-group relay wake.

**2026-11-21 (#14682, 9th occurrence — the CROSS-GROUP SUCCESS variant, derived from source).**
Turn's only inbound (id 2) was the slang-**triager**'s escalation; the target was the stalled
slang-**fixer** owner session (`pldciv`) — a DIFFERENT group. No null-source row existed (in_reply_to=1
errored: "no inbound message with that id"). Sent `target_session_id` + `thread_id` with NO explicit
in_reply_to → landed pinned as pldciv seq 24 in seconds. **Why the auto-stamp didn't win this time**
(`agent-route.ts` `resolveExplicitReplyTarget`, ~line 294): the candidate resolved from the stamped
in_reply_to is rejected when `candidate.agent_group_id !== targetAgentGroupId` → Layer 1 returns null
→ **the pin wins by default**. ⇒ **Refines the #14664 corollary: the pin is structurally unavailable
only when the turn's inbound is FROM the target group. Cross-group (inbound from group A, target
sibling/owner in group B), pin + thread_id alone is sufficient — no null-source in_reply_to row
needed.** Verified from source at /workspace/agent/nanoclaw-kb before sending; delivery verified with
the recipient's `messages --reverse --limit 3`. This wake recovered a session silent 5.5h that two
prior inbounds had bounced.

**Recurred 2026-11-20 (#14664, 6th occurrence — structural corollary).** A cross-chain
`send_message` with `target_session_id` AND `thread_id` set together STILL landed back in this
turn's sender: the implicit/auto-stamped reply route beat both. Pin alone is never enough — the
send also needs an explicit `in_reply_to` that cannot resolve into the target group. **Structural
corollary: when this turn's inbound is FROM the target group, you CANNOT pin to a different
sibling session of that group** — every candidate `in_reply_to` resolves into the group and the
reply edge wins. Route such corrections on the sender's own edge instead; if the true target must
be reached, do it in a turn whose inbound is from a different group. Verify delivery with the
target's `ncl sessions messages --reverse --limit 3`. Chain record:
[[slang/14664-require-enum-cases-feature.md]].
