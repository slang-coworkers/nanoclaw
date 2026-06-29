---
name: Bare response text is delivered, not silent scratchpad
description: Plain text outside <internal>/<message> routes to the current sender; wrap reasoning in <internal> and disambiguate message-ids from issue numbers
type: feedback
originSessionId: 57080bfc-af22-4c9e-9553-17bf6b0b3722
---
Bare plain text in my response is **delivered** to the current turn's sender via `session_routing` — it is NOT silent scratchpad. The "scratchpad, logged but not sent" framing only applies to text sitting alongside one or more `<message>` blocks. With no `<message>` block present, my bare text IS a reply to whoever sent this turn. To keep reasoning undelivered, it MUST be wrapped in `<internal>...</internal>`.

**Why:** On 2026-06-22 I wrote a bare preamble line — "Now addressing the latest triager message (#22)" — intending it as scratchpad before an `<internal>` block. It routed to `slang-triager`, which misread "#22" (a NanoClaw inbound message-id) as a GitHub **issue** number and started asking which repo issue #22 was in — a phantom triage task that cost a clarification round-trip. The `<internal>` block was correctly suppressed; the bare line was not.

**How to apply:**
- Put ALL non-delivered thinking inside `<internal>`. Treat any bare line as a message that will reach the current sender.
- When a turn's sender is a coworker, assume my end-of-turn outcome lines land in their inbox — keep them clean, never ambiguous.
- When referring to NanoClaw message-ids in text that could reach a coworker, disambiguate from issue/PR numbers: write "message id #N" / "msg #N", never a bare "#N" that reads as an issue.
