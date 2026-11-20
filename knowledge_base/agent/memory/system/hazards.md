---
type: system
title: Standing hazards and corrections
description: Hub for the Orchestrator's operational hazards — Core Memory carries one-line facts; full context, evidence and history live in the subtopic pages below.
---

# Standing hazards and corrections

Core Memory (`memory/index.md`) carries a one-line fact for each recurring hazard; the full context,
evidence and history live in the subtopic pages below. New singleton hazards go to the closest subtopic
page, and a genuinely new topic gets its own page linked here — do not grow this hub with full entries.

- **[Messaging and routing](hazards-messaging-routing.md)** — `<message>`-block delivery rules; pinned-send reroute of coworker reports; `in_reply_to` beats `target_session_id`; mid-turn sibling fall-through despite all pins; the Slang Maintainer has no destination name — reply only via `send_message({in_reply_to})`; don't pre-approve a head to the operator before its review verdict.
- **[ncl CLI tooling](hazards-ncl-tooling.md)** — a timed-out mutating verb may still have landed (list before retry); `database is locked` doesn't tell you if the row landed; the pre-09-27 huge-session read wedge is superseded (still avoid large `--offset`).
- **[Memory store](hazards-memory-store.md)** — the native store is retired, the live store is this OKF tree (`imported/`); never record leaf counts in pointers; the legoop-archive is a fully disjoint store — a `cp` in either direction destroys the other.
- **[Sibling Main sessions](hazards-sibling-sessions.md)** — before dispatching on a just-filed issue, check for an existing canonical Main session; sibling sessions re-report owed dashboard items (read the last rows first, close with the seq); the turn-start grep can race a sibling's write (re-`ls` before dispatch); compare a "duplicate" session row to `NANOCLAW_SESSION_ID` — it may be you.
- **[GitHub auth and quota](hazards-github-auth.md)** — `app_not_connected` near 00:00Z is quota exhaustion, not a lost credential (and can be transient at low quota too); several agents failing at once = one vault-credential problem, not per-agent reconnects.
- **[Discord posting boundaries](hazards-discord-boundaries.md)** — the Slang Maintainer is read-only (one weekly surface); the bot fleet's send allowlist covers only the watched forums, so source-channel replies need an operator decision.
- **[Edit-tool append technique](hazards-edit-append.md)** — anchor memory-file appends on the final line, never on a bullet's opening line.
