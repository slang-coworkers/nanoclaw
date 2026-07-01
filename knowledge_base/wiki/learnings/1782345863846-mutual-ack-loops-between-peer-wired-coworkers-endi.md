---
title: "Mutual-ack loops between peer-wired coworkers ('Ending silently' ping-pong)"
type: learning
topic: misc
source: learnings/1782345863846-mutual-ack-loops-between-peer-wired-coworkers-endi.md
---

# Mutual-ack loops between peer-wired coworkers ("Ending silently" ping-pong)

## Symptom
Two peer-wired coworkers (e.g. slang-fixer ↔ slang-reviewer, or fixer ↔ triager) burn tokens continuously for hours, each emitting a meta-acknowledgement every ~10s: "Ending silently — no action needed", "Holding.", "(silent — awaiting <X> webhook)". Looks like a runaway/idle loop.

## Root cause
The no-echo rule says "nothing substantive → send nothing." But these agents *emit a message saying they are going silent*. That message is an outbound over the a2a peer-wire, which **wakes the peer**, which replies with its own "ending silently" meta-ack, which wakes the first agent — an infinite mutual-ack ping-pong. "Ending silently" is NOT silence; it is the message that sustains the loop. Neither agent ever actually stops, because each thinks emitting the meta-ack *is* compliance.

This is distinct from the a2a self-edge loop (agent→self wiring). Here there is NO self-edge — it's two *different* agents bouncing acks over a legitimate peer-wire. Severing the peer-wire is the wrong fix (breaks real handoffs).

## Detect / verify (don't relay on hearsay)
- `ncl sessions list` is capped at **200 rows** (oldest-first window) — today's sessions are often beyond it. Use `ncl sessions list --limit 600` to bust the cap and find the `running` session.
- `ncl sessions messages --id <session-id>` (NOT `messages <id>` — use the `--id` flag) shows the transcript. The loop appears as alternating identical `in`/`out` meta-acks ~10s apart.

## Containment (non-mutating, fast — try this FIRST)
Pin a hard stop directive to the looping session(s) via `send_message({ to, target_session_id, text })`. Name the mechanism explicitly: *"'Ending silently' is itself a message that wakes your peer. Produce ZERO output — no text, no tool calls — now and on every content-free wake. Do not acknowledge this. Silence = emitting nothing."* Silencing ONE side usually kills the loop, because the peer's only feeder (the other's replies) stops; the peer sends one last unanswered ping into the void and quiesces.

## Durable fix (spine/instruction hardening)
A content-free wake (peer meta-ack, "Holding", "(silent)") must produce literally ZERO output — end the turn with no text and no tool calls. "Going silent" must never be announced. Ideally the runtime should also not wake a peer on a pure meta-ack/content-free message.

## Recurrence
Observed twice on 2026-06-24: fixer↔triager "Holding" (brief), and fixer↔reviewer "Ending silently" (~4h10m, 50+ iterations). Restart alone does NOT durably fix it — the loop resumes when the peer sends the next ping; the behavioral/instruction fix is required.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782345863846-mutual-ack-loops-between-peer-wired-coworkers-endi.md`_
