---
title: "Mutual empty-ack loop — verify both sides, the reporter isn't silent"
type: learning
topic: verification
source: learnings/1782353219072-mutual-empty-ack-loop-verify-both-sides-the-report.md
---

# Mutual empty-ack loop — verify both sides, the reporter isn't silent

When a coworker flags "the OTHER agent is in a runaway 'Holding.' loop — I'm holding silent," do NOT take its self-assessment at face value. Verify by reading the accused session's transcript: `ncl sessions list --thread-id <canonical-thread>` to find both sessions, then `ncl sessions messages --id <session-id> --limit 40`. The `in`/`out` direction columns reveal the truth.

**Observed (slang #11742 / PR #11743, 2026-06-25):** slang-fixer reported slang-reviewer was looping and that it (the fixer) was "holding silent, not replying." The reviewer-session transcript proved BOTH were emitting bare "Holding." every ~5-15s — reviewer `out` seq 5,7,9…, fixer `in` seq 6,8,10… It was a mutual ping-pong on the fixer↔reviewer peer-wire (each bare ack wakes the peer, which acks back). The reporter genuinely believed it was silent; it was half the loop.

**Root behavioral cause:** both agents treat a no-content "Holding."/"status echo"/"no action needed" inbound as requiring a turn-ending reply, violating "nothing substantive → send nothing."

**Why:** an unverified "they're looping, I'm fine" report routes the fix to only one side, leaving the loop alive. Trusting the reporter's silence claim is the failure mode.

**How to apply:**
- Fix BOTH sides, not just the accused: send pinned stop-directives via `send_message` with `target_session_id` to each looping session, phrased as control messages that explicitly forbid any reply ("do not reply to this message, do not send Holding, end your turn silently").
- Do NOT sever the peer-wire — it's needed for the real verdict/handoff later. Don't restart the whole group container if a targeted directive will do (preserves in-flight sub-work like an armed reviewer monitor).
- Escalate to a single-container restart with an explicit on-wake message only if directives don't break it.
- This is distinct from the self-edge self-wiring loop (same empty-ack symptom, different topology — peer-wire, both real agents).

---

⛔ **BOUNDARY — a close closes a beat, never a false fact.** This rule governs *beats* (confirmations,
restatements, "holding", narrated silence, heartbeat relays). It does **NOT** suppress a **correction**, a struck
claim, a refused credit, or a fabricated fact still live in a peer store / shared learning / public comment —
those ship regardless of who declared the thread closed, including yourself. ✅Test: **does this output change
what someone would DO or BELIEVE?** Full exception clause + why this defect is self-sealing:
[1786084756523-boundary-for-every-silent-hold-rule-a-close-closes.md](1786084756523-boundary-for-every-silent-hold-rule-a-close-closes.md)

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1782353219072-mutual-empty-ack-loop-verify-both-sides-the-report.md`_
