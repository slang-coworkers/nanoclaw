---
title: "Peer 'not addressable / blocked' can mean session logged-out — operator /login blocker, don't re-dispatch"
type: learning
topic: agent-ops
source: learnings/1783565846208-peer-not-addressable-blocked-can-mean-session-logg.md
---

# Peer 'not addressable / blocked' can mean session logged-out — operator /login blocker, don't re-dispatch

## Symptom
A peer coworker (e.g. slang-reviewer) that you dispatch work to goes silent, and you get conflicting signals: one tier reports the message "landed / was accepted into the thread," another reports "not currently addressable / blocked." Both can be **simultaneously true** — they describe different layers:
- **Routing layer:** the a2a message routes and is accepted into the thread (wiring exists, message not dropped).
- **Session layer:** the recipient session is **unauthenticated** — it emits `"Not logged in · Please run /login"` and physically cannot act on the message.

## How to diagnose (Jul 2026, #11969/#12015)
1. **Read-only GitHub check first:** if the peer is a reviewer, check the PR — `gh pr view <n> --json reviews,reviewRequests,comments`. Zero review activity despite a "landed" dispatch is consistent with a peer that can't act.
2. **Look for the literal `"Not logged in · Please run /login"`** in the peer's emitted message — that's the unauthenticated-session tell, NOT a substantive reject.
3. **Global-scope confirmation is the parent's job** (group-scoped `ncl` can't see other groups' sessions): parent checks the reviewer group's newest `last_active` — if it's days/weeks stale (ours was June 24 vs a July 9 task), the session is dead/logged-out, not slow.

## The rule
- **This is an OPERATOR-scoped blocker** — a `/login` re-auth on the peer's container. Auth is provider/OneCLI-credential; **even a group restart won't re-auth an expired credential.** Neither triager, fixer, nor orchestrator can fix it.
- **Do NOT re-dispatch / re-fire the request.** A logged-out session won't act on more messages — re-firing just adds noise. Mark the item **pending-not-skipped** and suspend the hold; the parent owns the operator escalation and signals when re-auth lands, then the owning tier re-fires.
- **Don't hold for a verdict that structurally can't arrive.** Surface the blocker up so no tier waits indefinitely.

## Why it matters
This looked like the silent-rot / orphaned-session failure family (we'd just spent the night recovering a 14h build orphan), so the instinct is to re-chase. But re-chasing a logged-out session is wasted motion. The distinguishing move is the read-only PR check + the global-scope `last_active` scan — cheap, and it converts "mysteriously blocked, keep poking" into "operator /login needed, hold quietly."

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1783565846208-peer-not-addressable-blocked-can-mean-session-logg.md`_
