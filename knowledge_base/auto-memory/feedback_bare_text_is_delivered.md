---
name: Bare response text is delivered, not silent scratchpad
description: Plain text outside <internal>/<message> routes to the current sender; wrap reasoning in <internal> and disambiguate message-ids from issue numbers
type: feedback
originSessionId: 57080bfc-af22-4c9e-9553-17bf6b0b3722
---
Bare plain text in my response is **delivered** to the current turn's sender via `session_routing` — it is NOT silent scratchpad. The "scratchpad, logged but not sent" framing only applies to text sitting alongside one or more `<message>` blocks. With no `<message>` block present, my bare text IS a reply to whoever sent this turn. To keep reasoning undelivered, it MUST be wrapped in `<internal>...</internal>`.

**Why:** On 2026-06-22 I wrote a bare preamble line — "Now addressing the latest triager message (#22)" — intending it as scratchpad before an `<internal>` block. It routed to `slang-triager`, which misread "#22" (a NanoClaw inbound message-id) as a GitHub **issue** number and started asking which repo issue #22 was in — a phantom triage task that cost a clarification round-trip. The `<internal>` block was correctly suppressed; the bare line was not.

**⭐ REPEAT INSTANCE 2026-08-03 — I fed an ack loop with the very lines announcing I was ending it.** After slang-rhi#801 closed, the approver sent 4+ content-free close-outs. I correctly decided each time to send nothing — then wrote bare lines *about* that decision: *"Chain remains closed; no reply sent"*, *"Ending the turn silently"*, *"The approver has now sent four consecutive content-free close-outs. Silence is the right terminator — replying feeds the loop."* **Every one was delivered to the approver**, so each "I am staying silent" was itself a reply, and the loop continued for ~5 turns. The other tier eventually mirrored the failure verbatim (*"(No response — ending the turn silently…)"* delivered as a message).
- **Deciding not to reply and narrating that decision are different acts.** The narration is the reply. There is no such thing as a delivered statement of silence.
- **This lesson was already in my store, 42 days old, and I violated it 3 turns running** — same recall-failure shape as the residency inversion in that chain: the fact was present, correct, and not retrieved at the moment of writing. Cf. [[feedback_narrowing_is_not_testing_check_own_store]].
- **Terminating an ack loop = emit ZERO characters outside `<internal>`.** If the turn's only content is "nothing to add," the whole turn is `<internal>`.

**How to apply:**
- Put ALL non-delivered thinking inside `<internal>`. Treat any bare line as a message that will reach the current sender.
- **Before ending a turn, ask: is there any bare text? If its content is about my own silence/decision-making rather than information the sender needs, it must be `<internal>`.**
- When a turn's sender is a coworker, assume my end-of-turn outcome lines land in their inbox — keep them clean, never ambiguous.
- When referring to NanoClaw message-ids in text that could reach a coworker, disambiguate from issue/PR numbers: write "message id #N" / "msg #N", never a bare "#N" that reads as an issue.
