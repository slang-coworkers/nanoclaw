---
name: feedback_a_thread_id_on_a_message_tag_loses_to_your_own_session_thread
description: "A thread_id written on a <message> tag can be silently overridden by your own session's thread — verify arrival in the recipient session, never assume dispatch == delivery"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 7693145c-5f5e-4458-9942-45a60e842b65
---

⛔ **MEASURED 2026-08-05. I sent two `<message>` blocks in one response — one on my session's
own thread (`gh-issue-shader-slang/slang-6520`), one carrying an explicit
`thread_id="gh-issue-shader-slang/slang-10181"`. BOTH landed in the 6520 session
(seq 6 and seq 8). The 10181 session never received it.**

The mechanism, revealed by a later `send_message` guard error rather than by any doc:
**my session was born from the #6520 webhook, so its own thread IS the 6520 thread, and
outbound defaults to it.** A `thread_id` attribute on a final-response `<message>` tag did
not override that. The guard that finally exposed it:

```
Refusing to send to thread "gh-issue-shader-slang/slang-6520" without in_reply_to:
3 unresponded inbound rows exist on this peer thread (#12, #6, #4).
```

— i.e. the runtime told me my destination thread was 6520 **at the moment I believed I was
addressing 10181.**

## Why this is worse than a lost message

⭐⭐⭐ **The failure is invisible from the sending side and reads as success.** My own status
line said *"I'm nudging that thread separately"* — a claim about what I **sent**, never about
what **arrived**. The recipient session sat idle after its "On it", the issue stayed at 1
comment, and nothing anywhere reported an error. Had I not gone looking at the session rows,
the nudge would have read as delivered indefinitely.

**Compounding shape:** the misrouted message told the 6520 session *not to do work it had
never been asked to do* ("do not scrub #10181 from this session") — so a misroute can also
inject a confusing negative instruction into an unrelated chain.

## ⛔⭐⭐⭐ RECURRENCE 20:36–20:46, SAME DAY, SAME SESSION — FIVE dispatches, none delivered

**I sent five `send_message(to="orchestrator")` calls** — two task dispatches (#6540 post, #9872
redrive), a hold, a lift, and a correction — each returning `Message sent to orchestrator (id: …)`.
**All five landed as `direction=out` rows in MY OWN #12360 session** (ids 547/551/553/557/569). The
#6540 session (`lj3eg0`) sat at its 20:20 row; the #9872 session (`y497hc`) sat at its 20:08 429.
Neither ever saw a word.

⛔**The added mechanism this instance exposes: `orchestrator` IS MY OWN GROUP** (`ag-1776713211742-1w6l4e`,
folder `main`). So `to="orchestrator"` is the CLAUDE.md-forbidden self-destination — it loops back into
my own session rather than erroring. I spent ten minutes believing I was tasking sibling sessions while
writing to myself. ⇒ ⭐⭐**Resolve the destination NAME to a group id before dispatching** (`ncl groups list`);
a name that reads like a role ("orchestrator") may be *you*.

✅**What finally worked — `target_session_id` pinned to the session that owns the issue**, verified by
reading the recipient's rows: #6540 → `lj3eg0` row **376 `direction=in`**; #9872 → `y497hc` row **316
`direction=in`**. Note this *contradicts* the pessimistic note below: the pin **does** work when the
session id is live and belongs to the destination group. Its documented fall-through is a real failure
mode, not a guarantee of failure — which is exactly why arrival must be read either way.

⛔⭐⭐⭐**The damning part: this rule was ALREADY IN THIS FILE, written earlier the same day, from the
same session, and its top line is "verify ARRIVAL, dispatch ≠ delivery." I ran five sends before
checking once.** Why it didn't fire: each send was a *sub-step of a task I was tracking by its own
success string*, and `Message sent to orchestrator (id: 569)` is a **positive, specific, ID-bearing
receipt** — the most convincing possible shape for "it worked." ⇒ ⭐⭐⭐**A confirmation issued by the
SENDING side is not evidence about the receiving side, no matter how specific it looks.** The id
identifies the row I wrote, not the row anyone read.

⚠️**Cost:** #6540 and #9872 sat unworked for ~10 extra minutes on a maintainer's request, and the
"done-but-unposted" gap I was fixing stayed open the whole time — I had *diagnosed* it correctly and my
remedy was undeliverable.

## What to do

- ⭐⭐ **After any cross-thread dispatch, verify ARRIVAL in the recipient session**, not
  departure from mine: `ncl sessions messages <recipient-sess-id> --limit 10` and look for
  a `direction=in` row with your text. Dispatch ≠ delivery.
- ⛔⛔ **THE SESSION PIN ALSO FAILED — MEASURED, SAME CHAIN, 20 MIN LATER.** I re-sent with
  `send_message` carrying BOTH `thread_id="…-10181"` AND
  `target_session_id="sess-1785955421135-9grh1m"`. It returned `Message sent (id: 21)` — and
  the text landed in the **6520** session (`eurqam` seq 10) again. `9grh1m` never received it;
  its only inbounds remained 429 strings. ⇒ **`target_session_id` is documented to fall
  through to default routing on any mismatch, and a fall-through looks IDENTICAL to a
  success in the tool result.** A success string from the send is NOT evidence of arrival.
- ⭐⭐⭐ **THEREFORE: the ONLY reliable confirmation is reading the recipient's rows.**
  `ncl sessions messages <recipient-sess> --limit 10` → look for `direction=in` with your
  text. Do this for every cross-thread dispatch that matters, every time.
- ⚠️ **Consequence of not checking:** the 6520 session (already loaded with the 6520 scrub)
  silently absorbed the #10181 assignment and did BOTH — while the real 10181-thread session
  sat idle. That is how one issue ended up **double-scrubbed** (see below).
- Find the session id first: `ncl sessions list | grep <issue-number>` — match on the
  `thread_id` column, and beware that column is shift-prone when `messaging_group_id` is
  empty (see [[feedback_a_fanned_out_webhook_delivers_per_issue_verify_the_set]]).
- ⭐ **A `<message thread_id=...>` block is only reliable for threads OTHER than my own when
  I have confirmed arrival.** For anything load-bearing, use the tool call and pin the session.

## The misroute CAUSED a double-post — the orchestrator's routing defect is a content defect

⭐⭐⭐ **Batch census after the fact: 18 issues in jkiviluoto's departure scrub, 17 with exactly
one bot comment, #10181 with TWO** (`5196891201` 6406 B 20:19:39Z; `5196892695` 3036 B
20:19:49Z — **10 seconds apart, different bodies, both recommending closure**).

**#10181 is the one issue whose dispatch I misrouted.** The 6520-thread session absorbed the
#10181 assignment (twice: `<message>` tag, then the pinned `send_message`) and executed it,
while the session actually sitting on the 10181 thread had also been dispatched at 18:43 by
the original webhook fan-out. Two sessions, one issue, one shared bot identity.

⇒ **A routing error does not stay a routing error.** It produced a public artifact defect:
two concurrent bots recommending closure read to a maintainer as **two independent votes**
(false corroboration), and they disagreed in content — one carried a lead (slangpy#904) the
other lacked. The triager caught it only because its post-verify compared `.comments` against
an expected value, and reconciled inside its OWN comment ("treat the pair as one conditional
recommendation, not two") without editing the sibling's.

**Per-chain hygiene CANNOT see this** — each session correctly answered "have *I* posted?" = no.
⇒ **Run a BATCH-level census when fanning out:** for each issue, count
`author=="nv-slang-bot[bot]" && created_at > <dispatch-time>`; flag any `>1` AND any `0`.
⚠️ The census DRAINS while you read it — a `0` means "not yet", never "dropped".

⚠️ **Attribution limit:** I could NOT prove which session wrote which comment.
`ncl sessions messages` shows messages, not tool calls, and `nv-slang-bot[bot]` is shared
across sessions. I can prove the structural cause (my misroute created the second worker);
I cannot prove authorship of a given comment. Say the former, not the latter.

## Related

- [[feedback_a_fanned_out_webhook_delivers_per_issue_verify_the_set]] — same family: N
  dispatches are N independent chances to drop, and a dropped one is invisible by construction.
- [[feedback_last_active_tracks_inbound_not_agent_work]] — do NOT probe the recipient by
  nudging it; that refreshes the field you'd judge it by. Read message rows / the GitHub
  artifact instead.
- [[feedback_publish_a_claim_as_wide_as_your_evidence]] — "I nudged that thread" was a claim
  wider than the evidence (I had sent, not delivered).
