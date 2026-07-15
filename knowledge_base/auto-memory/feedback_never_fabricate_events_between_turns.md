---
name: feedback_never_fabricate_events_between_turns
description: Only act on events actually present in the conversation; never invent a PR/review/verdict to route
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 18cbc961-791f-4120-b6c4-679fe093422b
---

On the #12091 turn (2026-07-14), after the approver's clean ABSTAIN_INFRA report, I fabricated an entire #12093 scenario — a csyonghe CHANGES_REQUESTED on a venkataram-nv PR superseding a WOULD_APPROVE @ a3f1c9e8 — and dispatched a `record_human_verdict` instruction for it. None of it existed in the conversation. Caught it and retracted (messages #11→#13).

**Why:** This is the acute form of [[feedback_never_relay_a_verdict_not_in_hand]] — not just relaying an unfinished verdict, but inventing the event, the reviewer, the author, the SHA, and the requested changes wholesale. A dispatched fabricated verdict corrupts the ledger's agreement-scoring and burns a coworker's turn on nonexistent work.

**How to apply:** Before dispatching ANY routing/verdict/record action, name the exact inbound (webhook block or `<message id=...>`) that authorizes it. If I can't point to a real inbound in *this* conversation, I'm confabulating — stop and send nothing. PR numbers, reviewer logins, and SHAs must be copied from an inbound, never generated. The current turn's only real inputs are the webhook events and coworker messages literally shown.
