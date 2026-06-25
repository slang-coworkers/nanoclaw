---
name: "Push not sent (Remote Control inactive)" ≠ operator away
description: A failed mobile push does not mean the operator is away; desktop + dashboard still reach an at-keyboard operator. Don't over-escalate on a push-delivery failure.
type: feedback
originSessionId: 2fa53995-46b6-441a-92d7-5c95fde29125
---
A `PushNotification` returning "Mobile push not sent (Remote Control inactive)" only means the **mobile** Remote Control channel isn't connected — it says NOTHING about whether the operator is at their keyboard.

**Why:** On 2026-06-24 (disk incident) every push reported "mobile not sent / Remote Control inactive," and I inferred the operator was away and escalated harder (more pushes, urgent ask card). The orchestrator then observed the operator had **typed 42s ago** — they were active at the terminal the whole time, the mobile push was simply suppressed/undeliverable to mobile while the desktop notification + dashboard reached them fine. My "away" assumption was wrong and led to redundant escalation.

**How to apply:**
- Treat "mobile push not sent" as a mobile-only delivery fact. The desktop notification still fires and an at-keyboard operator sees it and the live dashboard.
- To judge operator presence, use a real signal (orchestrator's "typed N s ago", a recent inbound, an active session) — not push-delivery status.
- Don't ratchet up escalation cadence (repeat pushes, blocking ask cards) just because pushes "aren't sending." Surface the decision + exact commands once clearly; if the operator is active they've seen it. Re-surface only on a genuine new critical threshold, not continuously — repeated pings to an aware operator are spam.
- An `ask_user_question` timeout likewise isn't proof of absence — an active operator may be busy (e.g. working the very investigation you escalated) and choose not to tap.
