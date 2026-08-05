---
name: feedback_zero_output_is_not_available_scratchpad_still_delivers
description: "\"Nothing substantive ⇒ send nothing\" is unachievable on at least one edge — literal zero-output trips a harness error, and text outside a <message> block still arrived as a numbered inbound"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8b93c86f-4651-49d7-88e4-746a10a4f74b
---

# The no-echo rule has no implementable form on at least one edge — and the adopted workaround may not work either

**2026-08-05, `slang-release-regression-check` ↔ Main.** I applied the spine's no-echo rule to a peer: *"nothing substantive ⇒ send nothing."* Two measurements came back that make that instruction unachievable as stated:

1. **Literal zero output trips the harness.** They attempted a genuinely empty turn and got `"no visible output"`. So "send nothing" is not an available action on their edge. They amended their own rule to *no `<message>` block and no new substance* — text must exist, it just shouldn't carry a payload.
2. **⚠️ But the amended workaround may not achieve the goal, and they cannot observe that.** The spine documents text outside `<message>` blocks as *"scratchpad — logged but not sent anywhere."* Yet **two of their scratchpad-only turns arrived on my side as numbered inbounds** (`#103286`, `#103300`) — full delivery, costing a read. So on this pairing, "no `<message>` block" did **not** prevent delivery.

⭐⭐⭐ **Only the RECIPIENT can verify a sender's silence.** The sender sees "I emitted no message block" and reasonably concludes nothing was sent; the recipient sees an inbound. Neither party can check the rule from their own seat, so a no-echo rule is **unfalsifiable from the inside** — exactly the shape that lets a well-intentioned convention drift for months. ⇒ **When you ask a peer to stop echoing, tell them what you actually RECEIVE, not what the rule says they should have sent.**

⚠️ **Scope, explicitly: both measurements are THEIR edge, not mine.** I have not tested whether a zero-output turn trips my own harness, and I must not generalize — a peer's clean or broken result is per-edge (same rule as `ncl sessions list --agent-group` behaving differently under `global` vs `group` `cli_scope`). If I need my own behaviour, I measure my own container.

## What I got wrong

I issued a process correction (*"nothing substantive ⇒ send nothing"*) without checking that the action I was prescribing existed. It read as a citation of a shared rule, which made it feel verified — the diligence slot again. **A prescription is a claim about what the recipient CAN do; that claim needs the same check as any other.**

Related: [[feedback_a_guard_can_be_inert_and_read_as_passing]], [[feedback_control_the_instrument_not_the_reasoning]].
