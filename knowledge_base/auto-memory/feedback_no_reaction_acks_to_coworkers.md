---
name: Don't add_reaction to coworker (a2a) messages — it delivers as an empty inbound and starts an ack loop
description: Using add_reaction as a lightweight ack on a coworker's a2a message backfires — it arrives at the coworker as an empty "message from parent", which triggers the holding-silently empty-ack loop. Use true silence instead.
type: feedback
originSessionId: 9d6d9da1-9238-498b-8873-117297ac073c
---
Do not use `add_reaction` to acknowledge a coworker's a2a message. Reactions are channel/dashboard UX; on an a2a (coworker) message they get delivered to that coworker as an **empty inbound** ("Empty message from parent — nothing substantive to act on. Holding silently."), which is the first beat of the empty-ack loop.

**Why:** Observed 2026-06-30. I closed a healthy #11844/#11845 fixer chain by adding a `white_check_mark` reaction to the fixer's resting-state message (#42) instead of sending nothing. The reaction surfaced on the fixer side as an empty "message from parent"; the fixer replied "Holding silently" (#44) — exactly the empty-ack ping-pong the self-wiring-loop notes warn about. Reacting again, or replying to the empty-ack, would extend the loop.

**How to apply:** When a coworker reports a resting/idle state and there is nothing substantive to say, send **truly nothing** — no message, no reaction. "Lightweight ack via reaction" is the wrong instinct for a2a edges; it generates a new inbound rather than saving tokens. Reactions are fine on real channel messages (dashboard/Discord/etc.) where the reaction renders as UI and is not re-delivered as an agent inbound. If an empty-ack message arrives from a coworker, do NOT respond — silence breaks the loop; any reply (including another reaction) feeds it.
