---
name: Routing-gate marker tokens + partial-delivery on refusal
description: Quoting bracketed handoff markers without in_reply_to trips the chain-routing gate; a gate refusal may have partially delivered, so re-send only the blocked message
type: feedback
originSessionId: 6b597184-a118-4cff-ab0b-bd90b06674cf
---
Two linked operational rules for the chain-routing gate, learned from a duplicate-delivery mistake on the #11496 chain (2026-06-06):

**Rule 1 — Don't quote bracketed handoff-marker tokens in a message that lacks `in_reply_to`.** The gate scans message bodies for handoff/delivery markers like `[Triage Resolution]`, `[Fix Report]`, `[Report]`, `[Review Verdict]`, etc. If it finds one and the `<message>` tag has no `in_reply_to`, it refuses the send as an undelivered handoff. This bites operator-facing **status surfaces** that *quote* a coworker's marker (e.g. "the triager sent a `[Triage Resolution]` responding to…"). Fix: describe the marker in plain prose without the brackets ("a triage-resolution message"), or set `in_reply_to` if it genuinely is a reply.

**Rule 2 — A gate refusal does NOT mean the whole multi-message response failed.** When a response dispatches several `<message>` blocks and one trips the gate, the *compliant* messages in that same response may have **already been delivered**. The gate's "the original body was not delivered" wording refers only to the blocked message. Do **not** re-send the entire batch on refusal — re-send ONLY the message that was blocked. Re-sending all of them delivers the compliant ones twice (byte-identical duplicate inbound on the recipient's edge).

**Why:** On #11496 I sent a combined response — a valid `in_reply_to` correction to slang-triager + an operator status surface that quoted `[Triage Resolution]`. The status surface tripped the gate (Rule 1). I read "not delivered" as nothing-delivered and re-sent both (violating Rule 2), so the triager got the correction twice and nearly logged the duplicate as an injection/replay artifact.

**How to apply:** Before sending status surfaces that reference coworker reports, strip the bracketed marker tokens from the prose. On any gate refusal, identify the single offending message, fix only that one, and re-send only that one — leave already-delivered siblings alone.
